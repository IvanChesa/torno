/**
 * Exportar a WAV (PLAN §4.8) con el mismo `LoopCore` que suena en directo, sin metrónomo:
 * - **mezcla** estéreo de 24 bits con N vueltas del bucle (1–8) y fundido final opcional;
 * - **pistas**: un WAV mono de 24 bits por capa con sonido, una vuelta del bucle de la sesión.
 *   Cada pista es la capa sola, con su nivel, filtro y reverso, sin panorama y sin silenciar (quien
 *   exporta pistas quiere todas, también las que tenía en silencio).
 *
 * Se renderiza por tramos directamente en el archivo: una exportación de 8 vueltas de 60 s no
 * necesita, además del WAV, el render entero en memoria.
 */
import { OfflineRenderer } from '../core/offline';
import { EMPTY_LAYER, type SessionState } from '../core/session';
import { WavWriter } from './wav';

export const MAX_REPEATS = 8;
/** Duración del fundido final (o la de toda la exportación, si es más corta). */
export const FADE_OUT_SECONDS = 2;
const CHUNK = 16_384;

export interface MixOptions {
  /** Vueltas del bucle, 1–8. */
  readonly repeats: number;
  readonly fadeOut: boolean;
}

/** Muestras de una vuelta del bucle de la sesión (la capa más larga), o 0 si no hay sonido. */
export function sessionLoopFrames(session: SessionState): number {
  let beats = 0;
  for (const layer of session.layers)
    if (layer.pcm && layer.lengthBeats > beats) beats = layer.lengthBeats;
  return Math.round((beats * 60 * session.sampleRate) / session.bpm);
}

/** Mezcla estéreo. Lanza `RangeError` si la sesión no vale, no tiene sonido o las vueltas no valen. */
export function renderMixWav(session: SessionState, options: MixOptions): Uint8Array<ArrayBuffer> {
  const { repeats, fadeOut } = options;
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > MAX_REPEATS) {
    throw new RangeError(`Vueltas no válidas: ${repeats}`);
  }
  const loop = sessionLoopFrames(session);
  if (loop === 0) throw new RangeError('La sesión no tiene sonido');
  const total = loop * repeats;
  const renderer = new OfflineRenderer(session);
  const writer = new WavWriter(2, session.sampleRate, total);
  const fade = fadeOut ? Math.min(total, Math.round(FADE_OUT_SECONDS * session.sampleRate)) : 0;
  const left = new Float32Array(CHUNK);
  const right = new Float32Array(CHUNK);
  const channels = [left, right];
  for (let done = 0; done < total; done += CHUNK) {
    const n = Math.min(CHUNK, total - done);
    renderer.render(left, right, n);
    // Fundido de coseno alzado en las últimas `fade` muestras: la última queda casi en silencio.
    for (let i = Math.max(0, total - fade - done); i < n; i++) {
      const k = done + i - (total - fade);
      const gain = 0.5 + 0.5 * Math.cos((Math.PI * (k + 0.5)) / fade);
      left[i] = left[i]! * gain;
      right[i] = right[i]! * gain;
    }
    writer.write(channels, n);
  }
  return writer.bytes;
}

export interface Stem {
  readonly layer: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

/** Una pista mono por capa con sonido. Lanza `RangeError` si la sesión no vale o está vacía. */
export function renderStemWavs(session: SessionState): Stem[] {
  const loop = sessionLoopFrames(session);
  if (loop === 0) throw new RangeError('La sesión no tiene sonido');
  const stems: Stem[] = [];
  session.layers.forEach((layer, index) => {
    if (!layer.pcm) return;
    // La capa sola y a la izquierda del todo: el canal izquierdo es la capa por su nivel, sin más.
    const alone: SessionState = {
      ...session,
      layers: session.layers.map((other, j) =>
        j === index ? { ...other, pan: -1, muted: false } : EMPTY_LAYER,
      ),
    };
    const renderer = new OfflineRenderer(alone);
    const writer = new WavWriter(1, session.sampleRate, loop);
    const left = new Float32Array(CHUNK);
    const right = new Float32Array(CHUNK);
    for (let done = 0; done < loop; done += CHUNK) {
      const n = Math.min(CHUNK, loop - done);
      renderer.render(left, right, n);
      writer.write([left], n);
    }
    stems.push({ layer: index, bytes: writer.bytes });
  });
  return stems;
}
