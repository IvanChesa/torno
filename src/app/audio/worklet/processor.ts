/**
 * Procesador del AudioWorklet: adapta `LoopCore` (audio/core) al `AudioWorkletProcessor` (PLAN §4.3).
 * Lo compila aparte esbuild (scripts/build-worklet.mjs) en public/audio/processor.<hash>.js (D5).
 *
 * - Entrada 0: el micrófono (mono), solo mientras se graba o se calibra. Salida 0: estéreo.
 * - Los mensajes que llegan se validan: los del núcleo, campo a campo en `LoopCore.handle`.
 * - Al hilo principal salen el estado (≤ 30/s, el mismo objeto), la copia de la sesión cuando se
 *   pide y la grabación de la calibración, con el PCM transferido.
 *
 * Reglas del hilo de audio: `process()` no reserva memoria, no usa `async` ni `console` y no crea
 * cierres. La única excepción es el `postMessage` de los eventos (CLAUDE.md).
 */
import { LoopCore } from '../core/loop-core';
import {
  PROCESSOR_NAME,
  PROTOCOL_VERSION,
  isCurrentMessage,
  type SessionCopyEvent,
  type WorkletMessage,
} from '../core/protocol';

class TornoProcessor extends AudioWorkletProcessor {
  readonly #core = new LoopCore({ sampleRate });
  /** Lista de transferencia reutilizada para la calibración (sin reservar en `process()`). */
  readonly #transfer: ArrayBuffer[] = [new ArrayBuffer(0)];
  #alive = true;

  constructor() {
    super();
    this.port.onmessage = (event) => this.handle(event.data);
  }

  /** Un mensaje del hilo principal (aquí sí se puede reservar: va entre dos bloques). */
  handle(data: unknown): void {
    if (!isCurrentMessage(data)) return;
    const message = data as WorkletMessage;
    switch (message.type) {
      case 'copy-session': {
        if (typeof message.id !== 'number') return;
        const session = this.#core.exportState();
        const event: SessionCopyEvent = {
          v: PROTOCOL_VERSION,
          type: 'session',
          id: message.id,
          session,
        };
        const transfer: ArrayBuffer[] = [];
        for (const layer of session.layers)
          if (layer.pcm) transfer.push(layer.pcm.buffer as ArrayBuffer);
        this.port.postMessage(event, transfer);
        return;
      }
      case 'dispose':
        this.#alive = false;
        this.port.close();
        return;
      default:
        this.#core.handle(message);
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const core = this.#core;
    const output = outputs[0];
    const left = output?.[0];
    if (left) {
      const input = inputs[0]?.[0] ?? null;
      core.process(input, left, output[1] ?? left, left.length);
    }
    if (core.statusReady) {
      core.statusReady = false;
      this.port.postMessage(core.status);
    }
    const calibration = core.calibrationResult;
    if (calibration) {
      core.calibrationResult = null;
      this.#transfer[0] = calibration.pcm.buffer as ArrayBuffer;
      this.port.postMessage(calibration, this.#transfer);
    }
    return this.#alive;
  }
}

registerProcessor(PROCESSOR_NAME, TornoProcessor);
