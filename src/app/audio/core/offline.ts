/**
 * Render sin conexión (PLAN §4.3 y §4.8): la exportación usa el mismo `LoopCore` que suena en
 * directo (lo que suena es lo que se exporta), sin metrónomo, desde el pulso 0 y sin fundido de
 * entrada. La anticipación del limitador se compensa: la muestra 0 de la salida es el pulso 0.
 */
import { LoopCore } from './loop-core';
import { PROTOCOL_VERSION } from './protocol';
import { validateSessionState, type SessionState } from './session';

export interface OfflineRender {
  readonly left: Float32Array;
  readonly right: Float32Array;
}

/** Renderiza `frames` muestras estéreo de la sesión. Lanza `RangeError` si el estado no vale. */
export function renderOffline(state: SessionState, frames: number): OfflineRender {
  if (!Number.isInteger(frames) || frames < 0) {
    throw new RangeError(`Muestras no válidas: ${frames}`);
  }
  const checked = validateSessionState(state);
  if (typeof checked === 'string') throw new RangeError(`Sesión no válida: ${checked}`);
  const core = new LoopCore({ sampleRate: checked.sampleRate, live: false });
  core.handle({ v: PROTOCOL_VERSION, type: 'load-session', session: checked });
  core.playImmediately();
  // La salida va retrasada la anticipación del limitador: esas primeras muestras se descartan.
  const latency = core.outputLatency;
  const skipL = new Float32Array(latency);
  const skipR = new Float32Array(latency);
  core.process(null, skipL, skipR, latency);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  core.process(null, left, right, frames);
  return { left, right };
}
