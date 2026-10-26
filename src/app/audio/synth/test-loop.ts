/**
 * Sonidos de prueba del menú SONIDO hasta que llegue la colección de la fase 3: un bucle sencillo de
 * 2 compases a 90 BPM en Re menor por categoría, hecho con notas de `renderTone`. Deterministas y
 * sin junta: cada nota acaba en silencio antes del final del bucle.
 */
import { midiToFrequency, renderTone } from './tone';

/** Tempo nativo y duración de los bucles de la biblioteca (PLAN D8). */
export const LIBRARY_BPM = 90;
export const LIBRARY_LOOP_BEATS = 8;

interface Note {
  /** Pulso en el que empieza. */
  readonly beat: number;
  readonly midi: number;
  /** Duración en pulsos (acaba con una rampa a cero). */
  readonly beats: number;
  readonly decaySeconds: number;
  readonly gain: number;
}

const beatsOf = (start: number, step: number, count: number) =>
  Array.from({ length: count }, (_, i) => start + i * step);

/** Las notas de cada sonido de prueba (Re menor: Re, Fa, La; bajo en Re-Fa-La-Do). */
const TEST_LOOPS: Readonly<Record<string, readonly Note[]>> = {
  'prueba-bateria': [
    ...beatsOf(0, 1, 8).map((beat) => ({
      beat,
      midi: 38,
      beats: 0.5,
      decaySeconds: 0.06,
      gain: 1,
    })),
    ...beatsOf(0.5, 1, 8).map((beat) => ({
      beat,
      midi: 86,
      beats: 0.25,
      decaySeconds: 0.015,
      gain: 0.35,
    })),
  ],
  'prueba-bajo': [
    { beat: 0, midi: 38, beats: 1.75, decaySeconds: 0.5, gain: 1 },
    { beat: 2, midi: 41, beats: 1.75, decaySeconds: 0.5, gain: 1 },
    { beat: 4, midi: 45, beats: 1.75, decaySeconds: 0.5, gain: 1 },
    { beat: 6, midi: 48, beats: 1.75, decaySeconds: 0.5, gain: 1 },
  ],
  'prueba-acordes': [0, 4].flatMap((beat) =>
    [62, 65, 69].map((midi) => ({ beat, midi, beats: 3.75, decaySeconds: 1.2, gain: 0.6 })),
  ),
  'prueba-textura': [
    { beat: 0, midi: 69, beats: 7.75, decaySeconds: 4, gain: 0.6 },
    { beat: 0, midi: 74, beats: 7.75, decaySeconds: 3, gain: 0.4 },
  ],
};

/** Ids de los sonidos de prueba, uno por categoría. */
export const TEST_SOUND_IDS = Object.keys(TEST_LOOPS);

/** Pico de los bucles de prueba (−6 dBFS). */
export const TEST_LOOP_PEAK = 0.5;

/** Muestras de un bucle de la biblioteca a la frecuencia indicada. */
export function libraryLoopFrames(sampleRate: number): number {
  return Math.round((LIBRARY_LOOP_BEATS * 60 * sampleRate) / LIBRARY_BPM);
}

/** Renderiza un sonido de prueba a la frecuencia del contexto. */
export function renderTestLoop(id: string, sampleRate: number): Float32Array<ArrayBuffer> {
  const notes = TEST_LOOPS[id];
  if (!notes) throw new RangeError(`Sonido desconocido: ${id}`);
  const frames = libraryLoopFrames(sampleRate);
  const framesPerBeat = frames / LIBRARY_LOOP_BEATS;
  const out = new Float32Array(frames);
  for (const note of notes) {
    const seconds = (note.beats * 60) / LIBRARY_BPM;
    const pcm = renderTone(sampleRate, {
      frequency: midiToFrequency(note.midi),
      seconds,
      peak: 1,
      partials: [1, 0.35, 0.12],
      decaySeconds: note.decaySeconds,
      rampSeconds: 0.004,
    });
    const start = Math.round(note.beat * framesPerBeat);
    for (let i = 0; i < pcm.length && start + i < frames; i++) {
      out[start + i] = out[start + i]! + note.gain * pcm[i]!;
    }
  }
  let max = 0;
  for (let i = 0; i < frames; i++) max = Math.max(max, Math.abs(out[i]!));
  const scale = max > 0 ? TEST_LOOP_PEAK / max : 0;
  for (let i = 0; i < frames; i++) out[i] = out[i]! * scale;
  return out;
}
