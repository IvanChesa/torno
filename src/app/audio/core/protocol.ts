/**
 * Mensajes entre el hilo principal, el worklet y los workers (PLAN §4.3, D7): tipados, versionados
 * y sin `SharedArrayBuffer`. Un mensaje con otra versión se ignora.
 *
 * - Hilo principal → worklet: los comandos de `LoopCore` (`CoreCommand`).
 * - Worklet → hilo principal: el estado agrupado (`CoreStatus`, ≤ 30/s) con los avisos discretos.
 * - La sonda de la fase 0 (pitido y tono del worker) sigue aquí hasta que la sustituya el
 *   `AudioEngine` de la fase 2.
 */
import type { TakeBars } from './constants';
import type { SessionError, SessionState } from './session';

export const PROTOCOL_VERSION = 2;

/** Nombre con el que se registra el procesador del worklet. */
export const PROCESSOR_NAME = 'torno';

interface Versioned {
  readonly v: typeof PROTOCOL_VERSION;
}

// --- Comandos del núcleo (hilo principal → worklet) ------------------------------------------

/** Un sonido de la biblioteca, ya renderizado a la frecuencia del contexto. */
export interface LibrarySound {
  readonly id: string;
  /** PCM mono del bucle (llega como `Transferable`). */
  readonly pcm: Float32Array;
  readonly lengthBeats: number;
}

export type CoreCommand = Versioned &
  (
    | { readonly type: 'play' }
    | { readonly type: 'pause' }
    /** Mantener reproducir: parar y volver al pulso 0. */
    | { readonly type: 'stop' }
    | { readonly type: 'set-tempo'; readonly bpm: number }
    | { readonly type: 'set-level'; readonly layer: number; readonly level: number }
    | { readonly type: 'set-mute'; readonly layer: number; readonly muted: boolean }
    | { readonly type: 'set-pan'; readonly layer: number; readonly pan: number }
    | { readonly type: 'set-reverse'; readonly layer: number; readonly reversed: boolean }
    /** Brazo de expresión: 0 = sin filtro (extremo exterior), 1 = corte en 150 Hz. */
    | { readonly type: 'set-filter'; readonly layer: number; readonly amount: number }
    /** Cambio de sonido (o APAGADO con `null`): en marcha, espera al siguiente compás. */
    | { readonly type: 'set-sound'; readonly layer: number; readonly sound: LibrarySound | null }
    | { readonly type: 'clear-layer'; readonly layer: number }
    | { readonly type: 'undo'; readonly layer: number }
    | { readonly type: 'redo'; readonly layer: number }
    | { readonly type: 'disc-hold'; readonly layer: number }
    /** Vueltas del disco desde que se mantuvo (1 vuelta = 1 compás; negativo = atrás). */
    | { readonly type: 'disc-move'; readonly turns: number }
    | { readonly type: 'disc-release' }
    /** Grabar: empieza una toma, la termina o cancela la cuenta previa. */
    | {
        readonly type: 'record';
        readonly layer: number;
        readonly bars: TakeBars;
        readonly countIn: boolean;
        /** Ajustar el tempo a la primera toma libre si no hay otras capas. */
        readonly fitTempo: boolean;
      }
    | { readonly type: 'cancel-recording' }
    | { readonly type: 'set-volume'; readonly volume: number }
    | { readonly type: 'set-input-gain'; readonly gain: number }
    | { readonly type: 'set-metronome'; readonly enabled: boolean }
    /** Latencia de ida y vuelta (salida + entrada) que se resta a las tomas, en muestras. */
    | { readonly type: 'set-latency'; readonly frames: number }
    | { readonly type: 'load-session'; readonly session: SessionState }
    | { readonly type: 'reset' }
    /** Reposo: cancela la toma y pausa (el motor libera después el micrófono y el contexto). */
    | { readonly type: 'standby' }
  );

export type CoreCommandType = CoreCommand['type'];

// --- Estado y avisos (worklet → hilo principal) ----------------------------------------------

export type TransportState = 'stopped' | 'playing' | 'pausing';
export type RecordingState = 'idle' | 'count-in' | 'recording';

export type NoticeCode =
  /** Empieza a grabar (acaba la cuenta previa; `value` = muestra del transporte). */
  | 'take-started'
  /** La toma está en la capa (`value` = muestras). */
  | 'take-committed'
  /** Toma descartada (`reason`: cancelled, too-short, standby). */
  | 'take-cancelled'
  /** Ha entrado un cambio de sonido de la cola (`value` = muestra del transporte). */
  | 'sound-applied'
  /** El tempo se ha ajustado a la primera toma libre (`value` = BPM). */
  | 'tempo-fitted'
  /** Comando ignorado durante una toma (`command`). */
  | 'locked'
  /** Comando no válido o imposible (`command` y `reason`). */
  | 'rejected'
  /** La salida se ha apagado del todo tras pausar o parar. */
  | 'stopped';

/** Por qué se rechaza un comando (o el error de la sesión que no se ha podido cargar). */
export type RejectReason =
  'range' | 'invalid' | 'no-memory' | 'too-long' | 'disc' | 'empty' | 'unknown' | SessionError;

/** Por qué se descarta una toma. */
export type CancelReason = 'cancelled' | 'too-short' | 'standby';

export type NoticeReason = RejectReason | CancelReason | 'none';

export interface Notice {
  code: NoticeCode;
  layer: number;
  value: number;
  /** El comando bloqueado o rechazado (`none` si el aviso no viene de un comando). */
  command: CoreCommandType | 'none';
  reason: NoticeReason;
}

export interface LayerStatus {
  hasContent: boolean;
  sourceKind: 'empty' | 'library' | 'recording';
  sourceId: string;
  lengthBeats: number;
  /** Pulso dentro del bucle de la capa. */
  positionBeats: number;
  level: number;
  muted: boolean;
  pan: number;
  reversed: boolean;
  filter: number;
  /** RMS desde el último estado, en escala ±1. */
  rms: number;
  /** Hay un cambio de sonido esperando al siguiente compás. */
  pending: boolean;
  undo: number;
  redo: number;
  discHeld: boolean;
}

export interface CoreStatus extends Versioned {
  readonly type: 'status';
  /** Muestra y pulso del transporte. */
  frame: number;
  beat: number;
  bpm: number;
  transport: TransportState;
  recording: RecordingState;
  recordLayer: number;
  /** Fracción de la toma grabada (−1 si es una primera toma libre: aún no tiene duración). */
  recordProgress: number;
  recordSeconds: number;
  /** Pulsos que faltan para que empiece a grabar. */
  countInBeats: number;
  readonly layers: LayerStatus[];
  /** Memoria de audio en uso, en bytes. */
  memoryBytes: number;
  /** Ganancia mínima del limitador desde el último estado (1 = no ha limitado). */
  limiterGain: number;
  /** Avisos desde el último estado (los primeros `noticeCount`). */
  readonly notices: Notice[];
  noticeCount: number;
  /** Avisos que no cupieron. */
  noticesDropped: number;
}

// --- Sonda de la fase 0 (temporal) -----------------------------------------------------------

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

/** El pitido ha terminado: `frames` es su duración exacta en muestras. */
export interface BeepEndedEvent extends Versioned {
  readonly type: 'beep-ended';
  frames: number;
}

export type WorkletEvent = BeepEndedEvent;

// --- Hilo principal ↔ worker de síntesis ------------------------------------------------------

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
