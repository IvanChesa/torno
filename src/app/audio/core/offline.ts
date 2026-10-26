/**
 * Render sin conexión (PLAN §4.3 y §4.8): la exportación usa el mismo `LoopCore` que suena en
 * directo (lo que suena es lo que se exporta), sin metrónomo, desde el pulso 0 y sin fundido de
 * entrada. La anticipación del limitador se compensa: la muestra 0 de la salida es el pulso 0.
 *
 * `OfflineRenderer` entrega la salida por tramos, así una exportación larga no necesita el render
 * entero en memoria además del archivo.
 */
import { LoopCore } from './loop-core';
import { PROTOCOL_VERSION } from './protocol';
import { validateSessionState, type SessionState } from './session';

export interface OfflineRender {
  readonly left: Float32Array;
  readonly right: Float32Array;
}

export class OfflineRenderer {
  readonly sampleRate: number;
  readonly #core: LoopCore;

  /** Lanza `RangeError` si el estado no vale. */
  constructor(state: SessionState) {
    const checked = validateSessionState(state);
    if (typeof checked === 'string') throw new RangeError(`Sesión no válida: ${checked}`);
    this.sampleRate = checked.sampleRate;
    const core = new LoopCore({ sampleRate: checked.sampleRate, live: false });
    core.handle({ v: PROTOCOL_VERSION, type: 'load-session', session: checked });
    core.playImmediately();
    // La salida va retrasada la anticipación del limitador: esas primeras muestras se descartan.
    const latency = core.outputLatency;
    core.process(null, new Float32Array(latency), new Float32Array(latency), latency);
    this.#core = core;
  }

  /** Las `frames` muestras siguientes, en `left` y `right` desde `offset`. */
  render(left: Float32Array, right: Float32Array, frames: number, offset = 0): void {
    this.#core.process(null, left, right, frames, offset);
  }
}

/** Renderiza `frames` muestras estéreo de la sesión. Lanza `RangeError` si el estado no vale. */
export function renderOffline(state: SessionState, frames: number): OfflineRender {
  if (!Number.isInteger(frames) || frames < 0) {
    throw new RangeError(`Muestras no válidas: ${frames}`);
  }
  const renderer = new OfflineRenderer(state);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  renderer.render(left, right, frames);
  return { left, right };
}
