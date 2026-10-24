/**
 * Remuestreo de una sesión guardada a otra frecuencia (PLAN §4.8): con `OfflineAudioContext`, el
 * remuestreador del navegador. Cada capa es un bucle: se remuestrean tres vueltas seguidas y se
 * queda la del medio, que tiene el bucle a los dos lados (sin junta en la vuelta).
 */
import type { LayerState, SessionState } from '../core/session';

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
  const tripled = new Float32Array(pcm.length * 3);
  for (let i = 0; i < 3; i++) tripled.set(pcm, i * pcm.length);
  const offline = new OfflineAudioContext(1, Math.round(tripled.length * ratio), to);
  const buffer = offline.createBuffer(1, tripled.length, from);
  buffer.copyToChannel(tripled, 0);
  const source = new AudioBufferSourceNode(offline, { buffer });
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const out = new Float32Array(frames);
  rendered.copyFromChannel(out, 0, Math.round(pcm.length * ratio));
  return out;
}
