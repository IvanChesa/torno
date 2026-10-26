/**
 * Procesador del AudioWorklet: adapta `LoopCore` (audio/core) al `AudioWorkletProcessor` (PLAN §4.3).
 * Lo compila aparte esbuild (scripts/build-worklet.mjs) en public/audio/processor.<hash>.js (D5).
 *
 * - Entrada 0: el micrófono (mono), solo mientras se graba o se calibra. Salida 0: estéreo.
 * - Los mensajes que llegan se validan: los del núcleo, campo a campo en `LoopCore.handle`.
 * - Al hilo principal salen el estado (≤ 30/s, el mismo objeto), la copia de la sesión cuando se
 *   pide (hecha por tramos en `process()`) y la grabación de la calibración, con el PCM
 *   transferido.
 *
 * Reglas del hilo de audio: `process()` no reserva memoria, no usa `async` ni `console` y no crea
 * cierres. La única excepción es el `postMessage` de los eventos (CLAUDE.md).
 */
import { LoopCore } from '../core/loop-core';
import { COPY_SAMPLES_PER_FRAME, SessionCopy } from '../core/session-copy';
import { PROCESSOR_NAME, isCurrentMessage, type WorkletMessage } from '../core/protocol';

class TornoProcessor extends AudioWorkletProcessor {
  readonly #core = new LoopCore({ sampleRate });
  /** Copias de la sesión pedidas: se hacen por tramos, de una en una, desde `#copyHead`. */
  readonly #copies: SessionCopy[] = [];
  #copyHead = 0;
  /** Lista de transferencia reutilizada para la calibración (sin reservar en `process()`). */
  readonly #transfer: ArrayBuffer[] = [new ArrayBuffer(0)];
  #alive = true;

  constructor() {
    super();
    this.port.onmessage = (event) => this.handle(event.data);
    SessionCopy.warmUp();
  }

  /** Un mensaje del hilo principal (aquí sí se puede reservar: va entre dos bloques). */
  handle(data: unknown): void {
    if (!isCurrentMessage(data)) return;
    const message = data as WorkletMessage;
    switch (message.type) {
      case 'copy-session':
        // Se reserva aquí y se copia por tramos en `process()` (de golpe, serían milisegundos sin
        // audio). Lo que suena se toma ahora: el contenido de una capa no cambia nunca.
        if (typeof message.id !== 'number') return;
        if (this.#copyHead === this.#copies.length) {
          this.#copies.length = 0;
          this.#copyHead = 0;
        }
        this.#copies.push(new SessionCopy(message.id, this.#core.snapshot()));
        return;
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
    if (this.#copyHead < this.#copies.length) {
      const copy = this.#copies[this.#copyHead]!;
      copy.pump((left?.length ?? 128) * COPY_SAMPLES_PER_FRAME);
      if (copy.done) {
        this.#copyHead++;
        this.port.postMessage(copy.event, copy.transfer);
      }
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
