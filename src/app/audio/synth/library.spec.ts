// La colección (PLAN fase 3): determinismo, duración, niveles por papel, sin continua, sin junta y
// las fundamentales de los bajos en Re menor. El tiempo de render se mide aparte (banco, fuera de
// `check`: scripts/bench-synth.mjs).
import { describe, expect, it } from 'vitest';
import { frequencyToMidi, peaks, spectrum } from '../core/analysis';
import { dbToGain, gainToDb, peakOf, rmsOf } from './effects';
import {
  BASS_LINES,
  LEVELS,
  LIBRARY_IDS,
  libraryCategory,
  PEAK_CEILING_DB,
  renderLibraryLoop,
} from './library';
import { D_MINOR_PITCH_CLASSES, LIBRARY_BPM, LIBRARY_LOOP_BEATS, libraryLoopFrames } from './music';

/** FNV-1a de 32 bits sobre los bytes del PCM. */
function hash(pcm: Float32Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let h = 0x811c9dc5;
  for (const byte of bytes) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

const RATES = [44_100, 48_000];
const renders = new Map<string, Float32Array>();
const render = (id: string, rate: number) => {
  const key = `${id}@${rate}`;
  let pcm = renders.get(key);
  if (!pcm) {
    pcm = renderLibraryLoop(id, rate);
    renders.set(key, pcm);
  }
  return pcm;
};

/**
 * Hash del PCM de cada bucle a 48 kHz. Si cambia una receta, cambia su hash: se actualiza aquí a
 * propósito (y Iván vuelve a escuchar ese bucle).
 */
const GOLDEN: Readonly<Record<string, string>> = {
  alfar: 'eeea43e2',
  horno: '4aa83394',
  adobe: '883bd0db',
  raiz: 'c342c230',
  cinca: 'b6ec9101',
  surco: '55274ade',
  olivo: '5ed765ea',
  vega: 'a0eba3f2',
  almendro: '382c9f64',
  cierzo: '69b997d8',
  acequia: '36e5a41f',
  brasa: '66f31c91',
};

describe('la colección', () => {
  it('tiene 12 bucles, 3 por papel', () => {
    expect(LIBRARY_IDS).toHaveLength(12);
    for (const category of ['drums', 'bass', 'chords', 'texture'] as const) {
      expect(LIBRARY_IDS.filter((id) => libraryCategory(id) === category)).toHaveLength(3);
    }
    expect(() => renderLibraryLoop('nada', 48_000)).toThrow(RangeError);
    expect(() => libraryCategory('nada')).toThrow(RangeError);
    expect(() => renderLibraryLoop('alfar', 1000)).toThrow(RangeError);
  });

  it('es determinista: el mismo bucle y la misma frecuencia dan los mismos bytes', () => {
    const hashes: Record<string, string> = {};
    for (const id of LIBRARY_IDS) {
      const first = render(id, 48_000);
      expect(hash(renderLibraryLoop(id, 48_000))).toBe(hash(first));
      hashes[id] = hash(first);
    }
    console.warn(`Hash del PCM a 48 kHz: ${JSON.stringify(hashes)}`);
    expect(hashes).toEqual(GOLDEN);
  });

  it.each(RATES)('dura exactamente 2 compases a 90 BPM (%i Hz)', (rate) => {
    const frames = (LIBRARY_LOOP_BEATS * 60 * rate) / LIBRARY_BPM;
    expect(libraryLoopFrames(rate)).toBe(frames);
    for (const id of LIBRARY_IDS) expect(render(id, rate).length).toBe(frames);
  });

  it.each(RATES)('picos ≤ −1 dBFS y RMS en el rango de su papel, sin continua (%i Hz)', (rate) => {
    const rows: string[] = [];
    for (const id of LIBRARY_IDS) {
      const pcm = render(id, rate);
      const target = LEVELS[libraryCategory(id)];
      const rms = gainToDb(rmsOf(pcm));
      const peak = gainToDb(peakOf(pcm));
      let sum = 0;
      for (const x of pcm) sum += x;
      rows.push(`${id}: RMS ${rms.toFixed(1)} dBFS, pico ${peak.toFixed(1)} dBFS`);
      expect(peak).toBeLessThanOrEqual(-1);
      expect(peak).toBeLessThanOrEqual(PEAK_CEILING_DB + 1e-6);
      // El RMS llega a su objetivo salvo que mande el pico; nunca más de 3 dB por debajo.
      expect(rms).toBeLessThanOrEqual(target + 0.01);
      expect(rms).toBeGreaterThanOrEqual(target - 3);
      // Continua: la media de un bucle periódico, por debajo de −100 dBFS.
      expect(Math.abs(sum / pcm.length)).toBeLessThan(dbToGain(-100));
    }
    if (rate === 48_000) console.warn(rows.join('\n'));
  });

  it('no tiene junta: el salto del final al principio es como los saltos de alrededor', () => {
    for (const id of LIBRARY_IDS) {
      const pcm = render(id, 48_000);
      expect(seam(pcm)).toBeLessThanOrEqual(1);
    }
    // Control: un seno que no da un número entero de vueltas sí tiene junta.
    const broken = new Float32Array(48_000);
    for (let i = 0; i < broken.length; i++)
      broken[i] = 0.5 * Math.sin((2 * Math.PI * 440.5 * i) / 48_000);
    expect(seam(broken)).toBeGreaterThan(1);
  });

  it('las fundamentales de los bajos están en Re menor y son las de su línea (FFT nota a nota)', () => {
    const rate = 48_000;
    const framesPerBeat = (60 * rate) / LIBRARY_BPM;
    const rows: string[] = [];
    for (const [id, notes] of Object.entries(BASS_LINES)) {
      expect(libraryCategory(id)).toBe('bass');
      const pcm = render(id, rate);
      let worst = 0;
      for (const { beat, note, beats } of notes) {
        expect(D_MINOR_PITCH_CLASSES, `${id}: nota ${note}`).toContain(note % 12);
        // Desde 40 ms después del ataque (lo que queda de la nota anterior y el portamento de SURCO,
        // de 18 ms de constante de tiempo) hasta que se suelta.
        const start = Math.round(beat * framesPerBeat + 0.04 * rate);
        const end = Math.round((beat + beats) * framesPerBeat);
        const spec = spectrum(pcm.subarray(start, end), rate, 1 << 17);
        const strongest = peaks(spec, 25, 400, 0).reduce((a, b) =>
          b.magnitude > a.magnitude ? b : a,
        );
        const cents = (frequencyToMidi(strongest.hz) - note) * 100;
        worst = Math.max(worst, Math.abs(cents));
        expect(
          Math.abs(cents),
          `${id} en el pulso ${beat}: ${strongest.hz.toFixed(2)} Hz`,
        ).toBeLessThan(25);
      }
      rows.push(`${id}: ${notes.length} notas, la más desviada a ${worst.toFixed(1)} cents`);
    }
    console.warn(rows.join('\n'));
  });
});

/**
 * Cuánto se sale la junta de su entorno: la mayor segunda diferencia que cruza la junta (un salto
 * o un quiebro, como un seno cortado a media vuelta) entre 1,5 veces la mayor de los 5 ms de cada
 * lado, más un margen de 0,001. ≤ 1: la junta no se distingue de su entorno.
 */
function seam(pcm: Float32Array): number {
  const n = pcm.length;
  const d2 = (a: number, b: number, c: number) => Math.abs(pcm[a]! - 2 * pcm[b]! + pcm[c]!);
  const around = Math.round(0.005 * 48_000);
  let local = 0;
  for (let i = 1; i < around; i++)
    local = Math.max(local, d2(i - 1, i, i + 1), d2(n - i - 2, n - i - 1, n - i));
  const junction = Math.max(d2(n - 1, 0, 1), d2(n - 2, n - 1, 0));
  return junction / (1.5 * local + 0.001);
}
