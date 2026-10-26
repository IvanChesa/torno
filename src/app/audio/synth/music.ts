/**
 * La tonalidad y la progresión de la colección (PLAN D8): Re menor, 90 BPM, 2 compases de 4/4.
 * Progresión propia, un acorde cada dos pulsos: Rem9 · Si♭maj9 · Solm9 · La7sus4 → La7.
 */

/** Tempo nativo y duración de los bucles de la biblioteca (PLAN D8). */
export const LIBRARY_BPM = 90;
export const LIBRARY_LOOP_BEATS = 8;

/** Clases de altura de Re menor natural (Re = 2), más Do♯, la sensible del La7. */
export const D_MINOR_PITCH_CLASSES: readonly number[] = [2, 4, 5, 7, 9, 10, 0, 1];

/** Frecuencia de una nota MIDI en temperamento igual (La4 = 69 = 440 Hz). */
export function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Muestras de un bucle de la biblioteca a la frecuencia indicada. */
export function libraryLoopFrames(sampleRate: number): number {
  return Math.round((LIBRARY_LOOP_BEATS * 60 * sampleRate) / LIBRARY_BPM);
}

export interface Chord {
  /** Pulso en el que empieza. */
  readonly beat: number;
  /** Fundamental del bajo (MIDI, octava 1–2). */
  readonly root: number;
  /** Voces del acorde sin la fundamental (MIDI), con un enlace suave entre acordes. */
  readonly voicing: readonly number[];
  /** Notas para arpegiar arriba (MIDI). */
  readonly arpeggio: readonly number[];
}

export const PROGRESSION: readonly Chord[] = [
  // Rem9: Fa La Do Mi sobre Re.
  { beat: 0, root: 38, voicing: [53, 57, 60, 64], arpeggio: [74, 77, 81, 76] },
  // Si♭maj9: Re Fa La Do sobre Si♭.
  { beat: 2, root: 34, voicing: [50, 53, 57, 60], arpeggio: [70, 74, 77, 72] },
  // Solm9: Fa La Si♭ Re sobre Sol.
  { beat: 4, root: 31, voicing: [53, 57, 58, 62], arpeggio: [67, 70, 74, 81] },
  // La7sus4: Mi Sol La Re sobre La.
  { beat: 6, root: 33, voicing: [52, 55, 57, 62], arpeggio: [69, 74, 76, 79] },
  // La7: el Re baja a Do♯ en el último pulso.
  { beat: 7, root: 33, voicing: [52, 55, 57, 61], arpeggio: [69, 73, 76, 79] },
];

/** El acorde que suena en un pulso. */
export function chordAt(beat: number): Chord {
  let current = PROGRESSION[0]!;
  for (const chord of PROGRESSION) if (chord.beat <= beat) current = chord;
  return current;
}
