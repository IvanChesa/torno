/**
 * Remuestreo de una sesión guardada a otra frecuencia (PLAN §4.8): `decodeAudioData` de un
 * `OfflineAudioContext`, que pasa el audio a la frecuencia del contexto con el remuestreador de
 * calidad del navegador. (Un `AudioBufferSourceNode` de otra frecuencia interpola linealmente en
 * Chromium: un tono de 15 kHz bajaba 3,4 dB y dejaba imágenes a −15 dB.) Cada capa es un bucle: se
 * remuestrean tres vueltas seguidas y se queda la del medio, que tiene el bucle a los dos lados
 * (sin junta en la vuelta).
 */
import type { LayerState, SessionState } from '../core/session';
import { encodeFloatWav } from '../files/wav';

export async function resampleSession(
  state: SessionState,
  sampleRate: number,
): Promise<SessionState> {
  const layers: LayerState[] = [];
  for (const layer of state.layers) {
    layers.push(
      layer.pcm
        ? { ...layer, pcm: await resampleLoop(layer.pcm, state.sampleRate, sampleRate) }
        : layer,
    );
  }
  return { ...state, sampleRate, layers };
}

async function resampleLoop(pcm: Float32Array, from: number, to: number): Promise<Float32Array> {
  const ratio = to / from;
  const frames = Math.max(1, Math.round(pcm.length * ratio));
  const offline = new OfflineAudioContext(1, 1, to);
  const decoded = await offline.decodeAudioData(encodeFloatWav(pcm, from, 3));
  const out = new Float32Array(frames);
  decoded.copyFromChannel(out, 0, Math.round(pcm.length * ratio));
  return out;
}
