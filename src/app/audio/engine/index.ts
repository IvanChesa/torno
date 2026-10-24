/**
 * API pública del motor de audio (PLAN §4.2): lo único que importan state/, features/ y pages/.
 * Entra en el bundle inicial, así que solo lleva el desbloqueo en el gesto (§4.9, < 2 kB); todo
 * lo demás se carga con `import()`.
 *
 * Fase 0: las sondas de la prueba técnica. El `AudioEngine` llega en la fase 2.
 */
import type { SynthProbeResult, WorkletProbeResult } from './probe';

export { unlockAudio } from './unlock';
export type { SynthProbeResult, WorkletProbeResult } from './probe';

/** Pitido de 0,5 s por el AudioWorklet, medido con un `AnalyserNode`. Antes: `unlockAudio()`. */
export async function runWorkletProbe(): Promise<WorkletProbeResult> {
  const probe = await import('./probe');
  return probe.runWorkletProbe();
}

/** Tono renderizado en el worker de síntesis y reproducido. Antes: `unlockAudio()`. */
export async function runSynthProbe(): Promise<SynthProbeResult> {
  const probe = await import('./probe');
  return probe.runSynthProbe();
}
