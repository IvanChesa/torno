/**
 * Worker de síntesis (PLAN §4.3): renderiza la síntesis de audio/synth fuera del hilo principal,
 * a la frecuencia del contexto, y devuelve el PCM como `Transferable` (sin copia).
 *
 * Fase 0: prueba técnica con el tono de `renderTone`. Los 12 bucles llegan en la fase 3.
 */
import {
  PROTOCOL_VERSION,
  isCurrentMessage,
  type SynthWorkerRequest,
  type SynthWorkerResponse,
} from '../core/protocol';
import { PROBE_TONE, renderTone } from '../synth/tone';

const scope = self as unknown as DedicatedWorkerGlobalScope;

function reply(response: SynthWorkerResponse, transfer: Transferable[] = []): void {
  scope.postMessage(response, transfer);
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  if (!isCurrentMessage(event.data)) return;
  const request = event.data as SynthWorkerRequest;
  try {
    switch (request.type) {
      case 'render-tone': {
        const start = performance.now();
        const pcm = renderTone(request.sampleRate, { ...PROBE_TONE, seconds: request.seconds });
        const renderMs = performance.now() - start;
        reply({ v: PROTOCOL_VERSION, type: 'tone', id: request.id, pcm, renderMs }, [pcm.buffer]);
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reply({ v: PROTOCOL_VERSION, type: 'error', id: request.id, message });
  }
};
