/**
 * Mensajes entre el hilo principal, el worklet y los workers (PLAN §4.3, D7): tipados, versionados
 * y sin `SharedArrayBuffer`. Un mensaje con otra versión se ignora.
 *
 * - Hilo principal → worklet: los comandos de `LoopCore` (`CoreCommand`) y las peticiones del
 *   propio worklet (`WorkletRequest`: copia de la sesión y cierre).
 * - Worklet → hilo principal: el estado agrupado (`CoreStatus`, ≤ 30/s) con los avisos discretos,
 *   la copia de la sesión y la grabación de la calibración (`WorkletEvent`).
 * - Hilo principal ↔ workers: los sonidos de la biblioteca (`synth.worker`) y la exportación a WAV
 *   (`export.worker`).
 */
import type { TakeBars } from './constants';
import type { SessionError, SessionState } from './session';

export const PROTOCOL_VERSION = 3;

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
    /**
     * Calibrar la latencia: con el transporte parado, suenan clics en muestras conocidas y se graba
     * la entrada sin tocar. El resultado sale en un `CalibrationEvent`.
     */
    | { readonly type: 'calibrate' }
  );

export type CoreCommandType = CoreCommand['type'];

type WithoutVersion<C> = C extends unknown ? Omit<C, 'v'> : never;
/** Un comando sin la versión (la pone quien lo envía). */
export type CoreCommandBody = WithoutVersion<CoreCommand>;

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
  | 'stopped'
  /** La calibración ha terminado: su grabación sale en un `CalibrationEvent`. */
  | 'calibrated'
  /** Calibración interrumpida (`reason`: cancelled o standby). */
  | 'calibration-cancelled';

/** Por qué se rechaza un comando (o el error de la sesión que no se ha podido cargar). */
export type RejectReason =
  | 'range'
  | 'invalid'
  | 'no-memory'
  | 'too-long'
  | 'disc'
  | 'empty'
  | 'unknown'
  /** Calibrando, o calibrar con el transporte en marcha o durante una toma. */
  | 'busy'
  | SessionError;

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
  /** Sube cada vez que cambia el sonido de la capa (la pantalla rehace su forma de onda). */
  contentVersion: number;
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

// --- Worklet: peticiones y eventos propios -------------------------------------------------------

/** Lo que el hilo principal pide al worklet, además de los comandos del núcleo. */
export type WorkletRequest = Versioned &
  /** Copia de la sesión (para guardar, autoguardar o exportar); responde con un `SessionCopyEvent`. */
  (
    | { readonly type: 'copy-session'; readonly id: number }
    /** El procesador deja de pedir `process()` y el nodo se puede liberar. */
    | { readonly type: 'dispose' }
  );

export type WorkletMessage = CoreCommand | WorkletRequest;

/** Copia de la sesión, con el PCM transferido (sin copias de más). */
export interface SessionCopyEvent extends Versioned {
  readonly type: 'session';
  readonly id: number;
  readonly session: SessionState;
}

/**
 * Grabación de la calibración: la entrada sin tocar desde el principio de la calibración y las
 * muestras de esa grabación en las que empezó a sonar cada clic.
 */
export interface CalibrationEvent extends Versioned {
  readonly type: 'calibration';
  readonly sampleRate: number;
  readonly pcm: Float32Array;
  readonly clickFrames: readonly number[];
}

export type WorkletEvent = CoreStatus | SessionCopyEvent | CalibrationEvent;

// --- Hilo principal ↔ worker de síntesis ------------------------------------------------------

export interface RenderSoundRequest extends Versioned {
  readonly type: 'render-sound';
  readonly id: number;
  /** Id del sonido de la biblioteca. */
  readonly sound: string;
  readonly sampleRate: number;
}

export interface RenderSoundResponse extends Versioned {
  readonly type: 'sound';
  readonly id: number;
  readonly sound: string;
  /** PCM mono del bucle; llega como `Transferable` (sin copia). */
  readonly pcm: Float32Array<ArrayBuffer>;
  readonly lengthBeats: number;
  readonly renderMs: number;
}

export interface WorkerErrorResponse extends Versioned {
  readonly type: 'error';
  readonly id: number;
  readonly message: string;
}

export type SynthWorkerRequest = RenderSoundRequest;
export type SynthWorkerResponse = RenderSoundResponse | WorkerErrorResponse;

// --- Hilo principal ↔ worker de exportación ---------------------------------------------------

export type ExportWorkerRequest = Versioned &
  /** Mezcla estéreo: `repeats` vueltas del bucle (1–8) y, si se pide, un fundido al final. */
  (
    | {
        readonly type: 'export-mix';
        readonly id: number;
        readonly session: SessionState;
        readonly repeats: number;
        readonly fadeOut: boolean;
      }
    /** Una pista mono por capa con sonido, una vuelta del bucle. */
    | { readonly type: 'export-stems'; readonly id: number; readonly session: SessionState }
  );

export interface ExportedFile {
  /** Capa de la pista (−1 = la mezcla). */
  readonly layer: number;
  /** El WAV entero; llega como `Transferable`. */
  readonly bytes: ArrayBuffer;
}

export interface ExportWorkerResponseOk extends Versioned {
  readonly type: 'exported';
  readonly id: number;
  readonly files: readonly ExportedFile[];
  readonly renderMs: number;
}

export type ExportWorkerResponse = ExportWorkerResponseOk | WorkerErrorResponse;

/** ¿Es un mensaje de este protocolo y de esta versión? (No valida el resto de campos.) */
export function isCurrentMessage(data: unknown): data is Versioned & { readonly type: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { v?: unknown }).v === PROTOCOL_VERSION &&
    typeof (data as { type?: unknown }).type === 'string'
  );
}
