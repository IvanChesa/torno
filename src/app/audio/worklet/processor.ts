/**
 * Procesador del AudioWorklet: adapta el núcleo (audio/core) al `AudioWorkletProcessor`. Lo
 * compila aparte esbuild (scripts/build-worklet.mjs) en public/audio/processor.<hash>.js (PLAN D5).
 *
 * Fase 0: prueba técnica con el pitido de `BeepGenerator`. En la fase 1 lo sustituye `LoopCore`.
 * Reglas del hilo de audio: `process()` no reserva memoria, no usa `async` ni `console` y no crea
 * cierres; los mensajes que salen se reservan antes.
 */
import { BeepGenerator } from '../core/beep';
import {
  PROCESSOR_NAME,
  PROTOCOL_VERSION,
  isCurrentMessage,
  type BeepEndedEvent,
  type WorkletCommand,
} from '../core/protocol';

class TornoProcessor extends AudioWorkletProcessor {
  private readonly beep = new BeepGenerator(sampleRate);
  private readonly beepEnded: BeepEndedEvent = {
    v: PROTOCOL_VERSION,
    type: 'beep-ended',
    frames: 0,
  };
  /** Hay un pitido cuyo final aún no se ha avisado (aunque empiece y acabe en el mismo bloque). */
  private endPending = false;
  private alive = true;

  constructor() {
    super();
    this.port.onmessage = (event) => {
      if (isCurrentMessage(event.data)) this.handle(event.data as WorkletCommand);
    };
  }

  private handle(command: WorkletCommand): void {
    switch (command.type) {
      case 'beep':
        this.beep.start(command.frequency, command.seconds, command.gain);
        this.endPending = true;
        break;
      case 'dispose':
        this.beep.stop();
        this.endPending = false;
        this.alive = false;
        this.port.close();
        break;
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channels = outputs[0];
    const first = channels?.[0];
    if (channels && first) {
      this.beep.process(first, 0, first.length);
      for (let c = 1; c < channels.length; c++) channels[c]?.set(first);
    }
    if (this.endPending && !this.beep.active) {
      this.endPending = false;
      this.beepEnded.frames = this.beep.lengthFrames;
      this.port.postMessage(this.beepEnded);
    }
    return this.alive;
  }
}

registerProcessor(PROCESSOR_NAME, TornoProcessor);
