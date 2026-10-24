/**
 * Worker de exportación (PLAN §4.3 y §4.8): renderiza la mezcla o las pistas con el mismo
 * `LoopCore` que suena en directo, fuera del hilo principal, y devuelve los WAV como `Transferable`.
 */
import {
  PROTOCOL_VERSION,
  isCurrentMessage,
  type ExportedFile,
  type ExportWorkerRequest,
  type ExportWorkerResponse,
} from '../core/protocol';
import { renderMixWav, renderStemWavs } from '../files/export';

const scope = self as unknown as DedicatedWorkerGlobalScope;

function reply(response: ExportWorkerResponse, transfer: Transferable[] = []): void {
  scope.postMessage(response, transfer);
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  if (!isCurrentMessage(event.data)) return;
  const request = event.data as ExportWorkerRequest;
  const start = performance.now();
  try {
    let files: ExportedFile[];
    switch (request.type) {
      case 'export-mix': {
        const bytes = renderMixWav(request.session, {
          repeats: request.repeats,
          fadeOut: request.fadeOut,
        });
        files = [{ layer: -1, bytes: bytes.buffer }];
        break;
      }
      case 'export-stems':
        files = renderStemWavs(request.session).map((stem) => ({
          layer: stem.layer,
          bytes: stem.bytes.buffer,
        }));
        break;
      default:
        return;
    }
    reply(
      {
        v: PROTOCOL_VERSION,
        type: 'exported',
        id: request.id,
        files,
        renderMs: performance.now() - start,
      },
      files.map((file) => file.bytes),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reply({ v: PROTOCOL_VERSION, type: 'error', id: request.id, message });
  }
};
