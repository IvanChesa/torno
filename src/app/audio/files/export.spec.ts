// WAV de 24 bits, ZIP y exportación (PLAN §4.8): lo que se exporta es el render del mismo núcleo,
// con N vueltas, fundido final opcional y pistas por separado.
import { describe, expect, it } from 'vitest';
import { renderOffline } from '../core/offline';
import { EMPTY_LAYER, type SessionState } from '../core/session';
import { seededRandom } from '../core/test-harness';
import { renderMixWav, renderStemWavs, sessionLoopFrames } from './export';
import { encodeWav, readWav, WavWriter } from './wav';
import { createZip, crc32, readZip } from './zip';

const RATE = 48_000;
const LSB = 1 / 8_388_607;

function session(): SessionState {
  const random = seededRandom(5);
  const tone = Float32Array.from(
    { length: 256_000 },
    (_, i) => 0.4 * Math.sin((2 * Math.PI * 220 * i) / 256_000),
  );
  const noise = Float32Array.from({ length: 128_000 }, () => (random() * 2 - 1) * 0.2);
  return {
    sampleRate: RATE,
    bpm: 120,
    layers: [
      {
        pcm: tone,
        lengthBeats: 8,
        offsetBeats: 0,
        source: { kind: 'recording' },
        level: 0.9,
        muted: false,
        pan: -0.5,
        reversed: false,
        filter: 0.3,
      },
      {
        pcm: noise,
        lengthBeats: 4,
        offsetBeats: 0,
        source: { kind: 'library', id: 'ruido' },
        level: 0.5,
        muted: true,
        pan: 0.7,
        reversed: true,
        filter: 0,
      },
      EMPTY_LAYER,
      EMPTY_LAYER,
    ],
  };
}

describe('WAV de 24 bits', () => {
  it('ida y vuelta con 1 LSB de error como mucho, recortando fuera de ±1 y los NaN', () => {
    const left = Float32Array.from([0, 0.5, -0.5, 1, -1, 1.5, -2, Number.NaN, 1e-7]);
    const right = left.map((x) => -x / 3);
    const bytes = encodeWav([left, right], 44_100);
    expect(bytes.length).toBe(44 + 9 * 2 * 3);
    const wav = readWav(bytes)!;
    expect(wav.sampleRate).toBe(44_100);
    expect(wav.bitsPerSample).toBe(24);
    const expected = [0, 0.5, -0.5, 1, -1, 1, -1, 0, 1e-7];
    expected.forEach((x, i) => expect(Math.abs(wav.channels[0]![i]! - x)).toBeLessThanOrEqual(LSB));
    expect(Math.abs(wav.channels[1]![1]! + 0.5 / 3)).toBeLessThanOrEqual(LSB);
  });

  it('se escribe por tramos y avisa si se pasa', () => {
    const writer = new WavWriter(1, RATE, 10);
    writer.write([new Float32Array(6).fill(0.25)], 6);
    expect(writer.complete).toBe(false);
    writer.write([new Float32Array(4).fill(0.25)], 4);
    expect(writer.complete).toBe(true);
    expect(() => writer.write([new Float32Array(1)], 1)).toThrow(RangeError);
    expect(() => new WavWriter(0, RATE, 1)).toThrow(RangeError);
    expect(readWav(new Uint8Array(10))).toBeNull();
  });
});

describe('lector de WAV', () => {
  /** Un WAV a mano: cabecera RIFF, `fmt ` con el formato y los bits dados, y los datos. */
  function handmade(format: number, bits: number, data: number[]): Uint8Array {
    const bytes = new Uint8Array(44 + data.length);
    const view = new DataView(bytes.buffer);
    const ascii = (at: number, text: string) =>
      [...text].forEach((char, i) => (bytes[at + i] = char.charCodeAt(0)));
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + data.length, true);
    ascii(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint16(34, bits, true);
    ascii(36, 'data');
    view.setUint32(40, data.length, true);
    bytes.set(data, 44);
    return bytes;
  }

  it('lee 16 bits y rechaza lo que no es PCM de 16 o 24 bits', () => {
    const wav = readWav(handmade(1, 16, [0xff, 0x7f, 0x01, 0x80]))!;
    expect(wav.bitsPerSample).toBe(16);
    expect([...wav.channels[0]!]).toEqual([1, -1]);
    expect(readWav(handmade(3, 32, [0, 0, 0, 0]))).toBeNull();
    expect(readWav(handmade(1, 8, [0, 0]))).toBeNull();
    const truncated = handmade(1, 16, [0, 0, 0, 0]);
    new DataView(truncated.buffer).setUint32(40, 400, true);
    expect(readWav(truncated)).toBeNull();
    expect(readWav(new TextEncoder().encode('RIFF....WAVEdata'))).toBeNull();
  });
});

describe('ZIP', () => {
  it('un ZIP dañado no se lee', () => {
    const zip = createZip(
      [{ name: 'a.wav', bytes: new Uint8Array([1, 2, 3]) }],
      new Date(2026, 0, 1),
    );
    const crc = zip.slice();
    crc[30 + 'a.wav'.length] = 9; // el contenido ya no casa con su CRC
    expect(readZip(crc)).toBeNull();
    const directory = zip.slice();
    directory[zip.length - 22 - 46 - 'a.wav'.length] = 0; // firma del directorio central
    expect(readZip(directory)).toBeNull();
    expect(readZip(new Uint8Array(10))).toBeNull();
  });

  it('guarda los archivos tal cual, con su CRC, y se vuelve a leer', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array(1000).fill(7);
    const zip = createZip(
      [
        { name: 'capa-1.wav', bytes: a },
        { name: 'capa-3.wav', bytes: b },
      ],
      new Date(2026, 9, 24, 18, 30),
    );
    const files = readZip(zip)!;
    expect([...files.keys()]).toEqual(['capa-1.wav', 'capa-3.wav']);
    expect([...files.get('capa-3.wav')!]).toEqual([...b]);
    expect(() => createZip([{ name: 'ñ.wav', bytes: a }], new Date())).toThrow(RangeError);
  });
});

describe('exportar', () => {
  it('la vuelta del bucle es la de la capa más larga', () => {
    expect(sessionLoopFrames(session())).toBe(192_000); // 8 pulsos a 120 BPM
    expect(sessionLoopFrames({ ...session(), layers: [0, 1, 2, 3].map(() => EMPTY_LAYER) })).toBe(
      0,
    );
  });

  it('la mezcla es el render del núcleo, con N vueltas (24 bits, ±1 LSB)', () => {
    const state = session();
    const wav = readWav(renderMixWav(state, { repeats: 3, fadeOut: false }))!;
    const total = 3 * 192_000;
    expect(wav.channels).toHaveLength(2);
    expect(wav.channels[0]).toHaveLength(total);
    const reference = renderOffline(state, total);
    let worst = 0;
    for (let i = 0; i < total; i += 7) {
      worst = Math.max(
        worst,
        Math.abs(wav.channels[0]![i]! - reference.left[i]!),
        Math.abs(wav.channels[1]![i]! - reference.right[i]!),
      );
    }
    expect(worst).toBeLessThanOrEqual(LSB);
  });

  it('el fundido final baja hasta casi el silencio en los últimos 2 s', () => {
    const state = session();
    const wav = readWav(renderMixWav(state, { repeats: 1, fadeOut: true }))!;
    const reference = renderOffline(state, 192_000);
    const fade = 2 * RATE;
    const left = wav.channels[0]!;
    // Antes del fundido, igual que sin él.
    expect(
      Math.abs(left[192_000 - fade - 10]! - reference.left[192_000 - fade - 10]!),
    ).toBeLessThanOrEqual(LSB);
    // A mitad del fundido, la mitad; al final, nada.
    const middle = 192_000 - fade / 2;
    expect(left[middle]! / reference.left[middle]!).toBeCloseTo(0.5, 2);
    expect(Math.abs(left[192_000 - 1]!)).toBeLessThan(1e-4);
  });

  it('rechaza vueltas fuera de 1–8 y una sesión vacía', () => {
    expect(() => renderMixWav(session(), { repeats: 0, fadeOut: false })).toThrow(RangeError);
    expect(() => renderMixWav(session(), { repeats: 9, fadeOut: false })).toThrow(RangeError);
    const empty = { ...session(), layers: [0, 1, 2, 3].map(() => EMPTY_LAYER) };
    expect(() => renderMixWav(empty, { repeats: 1, fadeOut: false })).toThrow(RangeError);
    expect(() => renderStemWavs(empty)).toThrow(RangeError);
  });

  it('una pista mono por capa con sonido: la capa sola, sin panorama y aunque esté en silencio', () => {
    const state = session();
    const stems = renderStemWavs(state);
    expect(stems.map((stem) => stem.layer)).toEqual([0, 1]);
    for (const stem of stems) {
      const wav = readWav(stem.bytes)!;
      expect(wav.channels).toHaveLength(1);
      expect(wav.channels[0]).toHaveLength(192_000);
      // Igual que el canal izquierdo de la capa sola, a la izquierda del todo y sin silenciar.
      const alone: SessionState = {
        ...state,
        layers: state.layers.map((layer, j) =>
          j === stem.layer ? { ...layer, pan: -1, muted: false } : EMPTY_LAYER,
        ),
      };
      const reference = renderOffline(alone, 192_000).left;
      let worst = 0;
      let energy = 0;
      for (let i = 0; i < 192_000; i += 5) {
        worst = Math.max(worst, Math.abs(wav.channels[0]![i]! - reference[i]!));
        energy += reference[i]! * reference[i]!;
      }
      expect(worst).toBeLessThanOrEqual(LSB);
      expect(energy).toBeGreaterThan(1);
    }
  });
});
