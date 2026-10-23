/**
 * Mensajes entre el hilo principal, el worklet y los workers (PLAN §4.3, D7): tipados, versionados
 * y sin `SharedArrayBuffer`. Un mensaje con otra versión se ignora.
 *
 * Fase 0: solo la sonda técnica (pitido en el worklet y render de un tono en el worker). El
 * protocolo del instrumento completo llega en la fase 1.
 */

export const PROTOCOL_VERSION = 1;

/** Nombre con el que se registra el procesador del worklet. */
export const PROCESSOR_NAME = 'torno';

interface Versioned {
  readonly v: typeof PROTOCOL_VERSION;
}

// --- Hilo principal → worklet ---

/** Suena un pitido (lo genera `BeepGenerator`, de audio/core). */
export interface BeepCommand extends Versioned {
  readonly type: 'beep';
  readonly frequency: number;
  readonly seconds: number;
  readonly gain: number;
}

/** El procesador deja de pedir `process()` y el nodo se puede liberar. */
export interface DisposeCommand extends Versioned {
  readonly type: 'dispose';
}

export type WorkletCommand = BeepCommand | DisposeCommand;

// --- Worklet → hilo principal ---

/** El pitido ha terminado: `frames` es su duración exacta en muestras. */
export interface BeepEndedEvent extends Versioned {
  readonly type: 'beep-ended';
  frames: number;
}

export type WorkletEvent = BeepEndedEvent;

// --- Hilo principal ↔ worker de síntesis ---

export interface RenderToneRequest extends Versioned {
  readonly type: 'render-tone';
  readonly id: number;
  readonly sampleRate: number;
  readonly seconds: number;
}

export interface RenderToneResponse extends Versioned {
  readonly type: 'tone';
  readonly id: number;
  /** PCM mono; llega como `Transferable` (sin copia). */
  readonly pcm: Float32Array<ArrayBuffer>;
  readonly renderMs: number;
}

export interface WorkerErrorResponse extends Versioned {
  readonly type: 'error';
  readonly id: number;
  readonly message: string;
}

export type SynthWorkerRequest = RenderToneRequest;
export type SynthWorkerResponse = RenderToneResponse | WorkerErrorResponse;

/** ¿Es un mensaje de este protocolo y de esta versión? (No valida el resto de campos.) */
export function isCurrentMessage(data: unknown): data is Versioned & { readonly type: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { v?: unknown }).v === PROTOCOL_VERSION &&
    typeof (data as { type?: unknown }).type === 'string'
  );
}
