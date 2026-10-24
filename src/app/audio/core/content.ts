/**
 * Contenido de una capa (PLAN §4.4): PCM mono, duración en pulsos, fase sobre la línea de tiempo y
 * origen. Una vez confirmado, el contenido no cambia nunca: una toma, un sonido nuevo o deshacer
 * cambian de contenido, no lo editan (copia en escritura).
 *
 * La muestra `i` del PCM suena en el pulso `offsetBeats + i / framesPerBeat` (módulo
 * `lengthBeats`): las capas de distinta duración se repiten sobre la misma línea de tiempo.
 */

/** De dónde viene el sonido de una capa. */
export type LayerSource =
  { readonly kind: 'library'; readonly id: string } | { readonly kind: 'recording' };

export const RECORDING_SOURCE: LayerSource = { kind: 'recording' };

export interface LayerContent {
  /** PCM mono. Puede tener más capacidad que `frames` (la toma libre reserva 60 s). */
  readonly data: Float32Array;
  /** Muestras del bucle. */
  readonly frames: number;
  /** Duración del bucle en pulsos. */
  readonly lengthBeats: number;
  /** Pulso de la línea de tiempo en el que suena la muestra 0 (módulo `lengthBeats`). */
  readonly offsetBeats: number;
  readonly source: LayerSource;
}

/** Contenido que se rellena al confirmar una toma (se reserva al empezarla). */
export interface MutableLayerContent {
  data: Float32Array;
  frames: number;
  lengthBeats: number;
  offsetBeats: number;
  source: LayerSource;
}

/** Muestras del bucle por pulso. */
export function framesPerBeatOf(content: LayerContent): number {
  return content.frames / content.lengthBeats;
}

/** Tempo al que el bucle suena a velocidad 1 (su tempo nativo). */
export function nativeBpmOf(content: LayerContent, sampleRate: number): number {
  return (60 * sampleRate * content.lengthBeats) / content.frames;
}

/** Bytes que ocupa el PCM de un contenido (su capacidad, no solo las muestras en uso). */
export function contentBytes(content: LayerContent | null): number {
  return content ? content.data.byteLength : 0;
}

/** Comprueba un contenido que llega de fuera (la biblioteca o un archivo). */
export function isValidContent(content: LayerContent, maxFrames: number): boolean {
  return (
    Number.isInteger(content.frames) &&
    content.frames >= 1 &&
    content.frames <= maxFrames &&
    content.frames <= content.data.length &&
    Number.isFinite(content.lengthBeats) &&
    content.lengthBeats > 0 &&
    Number.isFinite(content.offsetBeats)
  );
}
