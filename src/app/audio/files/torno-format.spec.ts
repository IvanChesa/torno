// Formato .torno (PLAN §4.8, D15): ida y vuelta idéntica byte a byte y 1000 archivos malformados
// rechazados con un código de error, sin excepciones.
import { describe, expect, it } from 'vitest';
import { renderOffline } from '../core/offline';
import { EMPTY_LAYER, type SessionState } from '../core/session';
import { seededRandom } from '../core/test-harness';
import {
  DEFAULT_SETTINGS,
  isTornoError,
  readTorno,
  writeTorno,
  type TornoSettings,
} from './torno-format';

const RATE = 48_000;

function session(): SessionState {
  const random = seededRandom(11);
  const noise = Float32Array.from({ length: 256_000 }, () => random() * 2 - 1);
  const ramp = Float32Array.from({ length: 128_000 }, (_, i) => i / 128_000);
  return {
    sampleRate: RATE,
    bpm: 97.5,
    layers: [
      {
        pcm: noise,
        lengthBeats: 8,
        offsetBeats: 1.25,
        source: { kind: 'recording' },
        level: 0.8,
        muted: false,
        pan: -0.3,
        reversed: true,
        filter: 0.25,
      },
      EMPTY_LAYER,
      {
        pcm: ramp,
        lengthBeats: 4,
        offsetBeats: 0,
        source: { kind: 'library', id: 'prueba-bajo' },
        level: 1,
        muted: true,
        pan: 1,
        reversed: false,
        filter: 0,
      },
      { ...EMPTY_LAYER, level: 0.4, pan: 0.5 },
    ],
  };
}

const SETTINGS: TornoSettings = {
  takeBars: 2,
  countIn: false,
  metronome: true,
  fitTempo: false,
  inputGain: 1.5,
};

describe('.torno', () => {
  it('ida y vuelta: los mismos bytes y la misma sesión', () => {
    const original = session();
    const bytes = writeTorno(original, SETTINGS);
    const read = readTorno(bytes);
    if (isTornoError(read)) throw new Error(read);
    expect(read.settings).toEqual(SETTINGS);
    expect(read.session.sampleRate).toBe(RATE);
    expect(read.session.bpm).toBe(97.5);
    read.session.layers.forEach((layer, i) => {
      const { pcm, ...rest } = layer;
      const { pcm: expectedPcm, ...expectedRest } = original.layers[i]!;
      expect(rest).toEqual(expectedRest);
      expect(pcm ? Buffer.from(pcm.buffer) : null).toEqual(
        expectedPcm ? Buffer.from(expectedPcm.buffer) : null,
      );
    });
    expect(Buffer.from(writeTorno(read.session, read.settings))).toEqual(Buffer.from(bytes));
    // Y suena igual: el render del núcleo da los mismos bytes con la sesión leída.
    const a = renderOffline(original, 10_000);
    const b = renderOffline(read.session, 10_000);
    expect(Buffer.from(b.left.buffer)).toEqual(Buffer.from(a.left.buffer));
  });

  it('una sesión vacía también va y vuelve', () => {
    const empty: SessionState = {
      sampleRate: 44_100,
      bpm: 90,
      layers: [0, 1, 2, 3].map(() => EMPTY_LAYER),
    };
    const read = readTorno(writeTorno(empty, DEFAULT_SETTINGS));
    expect(isTornoError(read) ? read : read.session.layers.every((l) => l.pcm === null)).toBe(true);
  });

  it('la cabecera va en ASCII aunque un id lleve tildes', () => {
    const original = session();
    const layers = [...original.layers];
    layers[2] = { ...layers[2]!, source: { kind: 'library', id: 'canción-ñ' } };
    const bytes = writeTorno({ ...original, layers }, SETTINGS);
    const headerLength = new DataView(bytes.buffer).getUint32(12, true);
    expect(bytes.subarray(16, 16 + headerLength).every((byte) => byte < 0x80)).toBe(true);
    const read = readTorno(bytes);
    expect(isTornoError(read) ? read : read.session.layers[2]!.source).toEqual({
      kind: 'library',
      id: 'canción-ñ',
    });
  });
});

/** Las mutaciones que hacen un archivo inválido, cada una con su error esperado. */
type Mutation = (bytes: Uint8Array, random: () => number) => Uint8Array;

const original = writeTorno(session(), SETTINGS);
const headerLength = new DataView(original.buffer).getUint32(12, true);
const headerText = String.fromCharCode(...original.subarray(16, 16 + headerLength));
const dataStart = (16 + headerLength + 3) & ~3;

/** Archivo con otra cabecera (y el PCM de siempre). */
function withHeader(transform: (header: Record<string, unknown>) => unknown): Uint8Array {
  const header = JSON.parse(headerText) as Record<string, unknown>;
  const json = JSON.stringify(transform(header));
  const start = (16 + json.length + 3) & ~3;
  const out = new Uint8Array(start + original.length - dataStart);
  out.set(original.subarray(0, 16));
  new DataView(out.buffer).setUint32(12, json.length, true);
  for (let i = 0; i < json.length; i++) out[16 + i] = json.charCodeAt(i);
  out.set(original.subarray(dataStart), start);
  return out;
}

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)]!;
const layerOf = (header: Record<string, unknown>, index: number) =>
  (header['layers'] as Record<string, unknown>[])[index]!;

const BAD_VALUES: unknown[] = [-1, 1e9, 'x', null, true, [], {}, 0.5, Number.MAX_SAFE_INTEGER];

const MUTATIONS: Record<string, Mutation> = {
  truncar: (bytes, random) => bytes.slice(0, Math.floor(random() * (bytes.length - 1))),
  'bytes de más': (bytes, random) => {
    const extra = 1 + Math.floor(random() * 64);
    const out = new Uint8Array(bytes.length + extra);
    out.set(bytes);
    return out;
  },
  firma: (bytes, random) => {
    const out = bytes.slice();
    const at = Math.floor(random() * 8);
    out[at] = (out[at]! + 1 + Math.floor(random() * 254)) & 0xff;
    return out;
  },
  versión: (bytes, random) => {
    const out = bytes.slice();
    new DataView(out.buffer).setUint16(8, 2 + Math.floor(random() * 1000), true);
    return out;
  },
  reservado: (bytes, random) => {
    const out = bytes.slice();
    new DataView(out.buffer).setUint16(10, 1 + Math.floor(random() * 1000), true);
    return out;
  },
  'longitud de la cabecera': (bytes, random) => {
    const out = bytes.slice();
    let length = headerLength;
    while (length === headerLength) length = Math.floor(random() * 70_000);
    new DataView(out.buffer).setUint32(12, length, true);
    return out;
  },
  'JSON roto': (bytes, random) => {
    const out = bytes.slice();
    const at = 16 + Math.floor(random() * headerLength);
    out[at] = pick([0x23, 0x00, 0x7b, 0x5d, 0x22], random); // # NUL { ] "
    if (out[at] === bytes[at]) out[at] = 0x23;
    return out;
  },
  'cabecera que no es ASCII': (bytes, random) => {
    const out = bytes.slice();
    out[16 + Math.floor(random() * headerLength)] = 0x80 + Math.floor(random() * 128);
    return out;
  },
  'relleno que no es cero': (bytes) => {
    if (dataStart === 16 + headerLength) return bytes.slice(0, 20);
    const out = bytes.slice();
    out[16 + headerLength] = 0x20;
    return out;
  },
  'cabecera que no es un objeto': (_bytes, random) =>
    withHeader(() => pick([[1, 2], 7, null, 'torno', true], random)),
  'otra aplicación': () => withHeader((h) => ({ ...h, app: 'otra' })),
  frecuencia: (_b, random) =>
    withHeader((h) => ({
      ...h,
      sampleRate: pick([0, 7999, 384_001, 44_100.5, 'x', null], random),
    })),
  tempo: (_b, random) =>
    withHeader((h) => ({ ...h, bpm: pick([0, 39.9, 240.1, 'x', null, -90], random) })),
  ajustes: (_b, random) =>
    withHeader((h) => {
      const settings = { ...(h['settings'] as Record<string, unknown>) };
      const key = pick(['takeBars', 'countIn', 'metronome', 'fitTempo', 'inputGain'], random);
      // Valores que no valen para esa clave (un booleano sí vale para las booleanas, 0,5 para la
      // ganancia).
      const bad = BAD_VALUES.filter((value) =>
        key === 'inputGain' ? value !== 0.5 : typeof value !== 'boolean',
      );
      settings[key] = key === 'takeBars' ? pick([3, -1, 8, '2'], random) : pick(bad, random);
      return { ...h, settings: random() < 0.1 ? null : settings };
    }),
  'número de capas': (_b, random) =>
    withHeader((h) => {
      const layers = [...(h['layers'] as unknown[])];
      if (random() < 0.5) layers.pop();
      else layers.push(layers[1]);
      return { ...h, layers };
    }),
  'muestras de una capa': (_b, random) =>
    withHeader((h) => {
      const layer = layerOf(h, pick([0, 2], random));
      layer['frames'] = (layer['frames'] as number) + pick([-1, 1, -1000, 4], random);
      return h;
    }),
  'mezcla de una capa': (_b, random) =>
    withHeader((h) => {
      const layer = layerOf(h, Math.floor(random() * 4));
      const key = pick(['level', 'muted', 'pan', 'reversed', 'filter'], random);
      layer[key] =
        key === 'muted' || key === 'reversed'
          ? pick([0, 1, 'true', null], random)
          : pick([-1.5, 1.5, 'x', null, 2], random);
      return h;
    }),
  'duración de una capa': (_b, random) =>
    withHeader((h) => {
      const layer = layerOf(h, pick([0, 2], random));
      // Fuera de rango, o un tempo nativo imposible (más de 240 o menos de 40 BPM).
      layer['lengthBeats'] = pick([0, -4, 'x', 20_000, 100, 0.5], random);
      return h;
    }),
  'origen de una capa': (_b, random) =>
    withHeader((h) => {
      const index = pick([0, 1, 2], random);
      const layer = layerOf(h, index);
      layer['source'] =
        index === 1
          ? { kind: 'recording' }
          : pick(
              [
                null,
                { kind: 'otro' },
                { kind: 'library', id: '' },
                { kind: 'library', id: 'x'.repeat(65) },
                'recording',
                { kind: 'recording', extra: 1 },
              ],
              random,
            );
      return h;
    }),
  'muestras no finitas': (bytes, random) => {
    const out = bytes.slice();
    const view = new DataView(out.buffer);
    const sample = Math.floor(random() * ((out.length - dataStart) / 4));
    view.setFloat32(
      dataStart + sample * 4,
      pick([Number.NaN, Infinity, -Infinity, 1e6, -17], random),
      true,
    );
    return out;
  },
};

describe('lo que sobra en un archivo no llega a nadie', () => {
  it('las claves de más de los ajustes y del origen se descartan', () => {
    const extra = withHeader((h) => {
      h['settings'] = { ...(h['settings'] as object), latency: null, repeats: 999 };
      layerOf(h, 2)['source'] = { kind: 'library', id: 'prueba-bajo', volumen: 11 };
      h['comentario'] = 'hola';
      return h;
    });
    const read = readTorno(extra);
    if (isTornoError(read)) throw new Error(read);
    expect(read.settings).toEqual(SETTINGS);
    expect(Object.keys(read.settings).sort()).toEqual(
      ['countIn', 'fitTempo', 'inputGain', 'metronome', 'takeBars'].sort(),
    );
    expect(read.session.layers[2]!.source).toEqual({ kind: 'library', id: 'prueba-bajo' });
  });
});

describe('1000 archivos malformados', () => {
  it('se rechazan todos con un código de error y sin excepciones', () => {
    const random = seededRandom(2026);
    const kinds = Object.keys(MUTATIONS);
    const counts = new Map<string, number>();
    const errors = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const kind = kinds[i % kinds.length]!;
      const bytes = MUTATIONS[kind]!(original, random);
      let result: ReturnType<typeof readTorno>;
      expect(() => (result = readTorno(bytes)), kind).not.toThrow();
      if (!isTornoError(result!))
        throw new Error(`Se ha aceptado un archivo malformado (${kind}, nº ${i})`);
      errors.add(result!);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(1000);
    expect(counts.size).toBe(kinds.length);
    // Cada tipo de defecto cae en su comprobación: hay errores de todas las familias.
    for (const code of ['signature', 'version', 'header', 'size', 'settings', 'samples', 'mix']) {
      expect(errors).toContain(code);
    }
  });

  it('también rechaza lo que no es un archivo: vacío, otro formato o demasiado grande', () => {
    expect(readTorno(new Uint8Array(0))).toBe('too-small');
    expect(readTorno(new TextEncoder().encode('RIFF....WAVEfmt '))).toBe('signature');
    expect(readTorno(new Uint8Array(400_000_000))).toBe('too-large');
  });
});
