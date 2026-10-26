/**
 * Worker de síntesis (PLAN §4.3): renderiza los sonidos de la biblioteca fuera del hilo principal,
 * a la frecuencia del contexto, y devuelve el PCM como `Transferable` (sin copia).
 *
 * Los 12 bucles de la colección (`audio/synth/library.ts`). El motor guarda lo renderizado en su
 * caché: cada sonido se renderiza una vez por frecuencia de muestreo.
 */
import {
  PROTOCOL_VERSION,
  isCurrentMessage,
  type SynthWorkerRequest,
  type SynthWorkerResponse,
} from '../core/protocol';
import { LIBRARY_LOOP_BEATS, renderLibraryLoop } from '../synth/library';

const scope = self as unknown as DedicatedWorkerGlobalScope;

function reply(response: SynthWorkerResponse, transfer: Transferable[] = []): void {
  scope.postMessage(response, transfer);
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  if (!isCurrentMessage(event.data)) return;
  const request = event.data as SynthWorkerRequest;
  try {
    switch (request.type) {
      case 'render-sound': {
        const start = performance.now();
        const pcm = renderLibraryLoop(request.sound, request.sampleRate);
        const renderMs = performance.now() - start;
        reply(
          {
            v: PROTOCOL_VERSION,
            type: 'sound',
            id: request.id,
            sound: request.sound,
            pcm,
            lengthBeats: LIBRARY_LOOP_BEATS,
            renderMs,
          },
          [pcm.buffer],
        );
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reply({ v: PROTOCOL_VERSION, type: 'error', id: request.id, message });
  }
};
