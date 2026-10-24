/**
 * Estado de una sesión, tal como lo guarda el formato `.torno` y lo usa la exportación (PLAN §4.8):
 * tempo y, por capa, el PCM, la duración, la fase, el origen y la mezcla. No guarda el historial de
 * deshacer. Todo lo que llega de fuera se valida entero antes de tocar nada.
 */
import { LAYER_COUNT, MAX_BPM, MAX_LAYER_SECONDS, MIN_BPM } from './constants';
import type { LayerSource } from './content';

export interface LayerState {
  /** PCM mono con exactamente las muestras del bucle, o `null` si la capa está vacía. */
  readonly pcm: Float32Array | null;
  readonly lengthBeats: number;
  readonly offsetBeats: number;
  readonly source: LayerSource | null;
  readonly level: number;
  readonly muted: boolean;
  readonly pan: number;
  readonly reversed: boolean;
  /** Posición del brazo: 0 = sin filtro, 1 = corte en 150 Hz. */
  readonly filter: number;
}

export interface SessionState {
  readonly sampleRate: number;
  readonly bpm: number;
  readonly layers: readonly LayerState[];
}

export const EMPTY_LAYER: LayerState = {
  pcm: null,
  lengthBeats: 0,
  offsetBeats: 0,
  source: null,
  level: 1,
  muted: false,
  pan: 0,
  reversed: false,
  filter: 0,
};

/** Motivo por el que un estado no vale. */
export type SessionError =
  | 'not-an-object'
  | 'sample-rate'
  | 'bpm'
  | 'layer-count'
  | 'layer'
  | 'pcm'
  | 'samples'
  | 'length'
  | 'mix'
  | 'source';

export interface SessionCheckOptions {
  /** Frecuencia que tiene que tener el estado (la del contexto). */
  readonly sampleRate?: number;
  /** Comprobar también que todas las muestras son finitas (no se hace en el hilo de audio). */
  readonly checkSamples?: boolean;
}

/** Valida un estado de sesión que llega de fuera. Devuelve el estado o el primer error. */
export function validateSessionState(
  value: unknown,
  options: SessionCheckOptions = {},
): SessionState | SessionError {
  if (typeof value !== 'object' || value === null) return 'not-an-object';
  const state = value as Partial<SessionState>;
  const rate = state.sampleRate;
  if (typeof rate !== 'number' || !Number.isInteger(rate) || rate < 8000 || rate > 384_000) {
    return 'sample-rate';
  }
  if (options.sampleRate !== undefined && rate !== options.sampleRate) return 'sample-rate';
  if (!isNumberIn(state.bpm, MIN_BPM, MAX_BPM)) return 'bpm';
  if (!Array.isArray(state.layers) || state.layers.length !== LAYER_COUNT) return 'layer-count';
  for (const layer of state.layers as unknown[]) {
    const error = validateLayer(layer, rate, options.checkSamples ?? true);
    if (error) return error;
  }
  return state as SessionState;
}

function validateLayer(
  value: unknown,
  sampleRate: number,
  checkSamples: boolean,
): SessionError | undefined {
  if (typeof value !== 'object' || value === null) return 'layer';
  const layer = value as Partial<LayerState>;
  if (
    !isNumberIn(layer.level, 0, 1) ||
    typeof layer.muted !== 'boolean' ||
    !isNumberIn(layer.pan, -1, 1) ||
    typeof layer.reversed !== 'boolean' ||
    !isNumberIn(layer.filter, 0, 1)
  ) {
    return 'mix';
  }
  if (layer.pcm === null) {
    return layer.source === null ? undefined : 'source';
  }
  if (!(layer.pcm instanceof Float32Array)) return 'pcm';
  const frames = layer.pcm.length;
  if (frames < 1 || frames > MAX_LAYER_SECONDS * sampleRate) return 'pcm';
  if (!isNumberIn(layer.lengthBeats, 1e-3, 10_000) || !Number.isFinite(layer.offsetBeats)) {
    return 'length';
  }
  // El tempo nativo (el de su grabación o el de la biblioteca) está en 40–240 BPM, con un margen
  // de redondeo de la duración en muestras.
  const nativeBpm = (60 * sampleRate * (layer.lengthBeats as number)) / frames;
  if (nativeBpm < MIN_BPM * 0.99 || nativeBpm > MAX_BPM * 1.01) return 'length';
  if (!isValidSource(layer.source)) return 'source';
  if (checkSamples) {
    const pcm = layer.pcm;
    for (let i = 0; i < frames; i++) {
      const x = pcm[i]!;
      if (!(x >= -16 && x <= 16)) return 'samples';
    }
  }
  return undefined;
}

function isValidSource(source: unknown): boolean {
  if (typeof source !== 'object' || source === null) return false;
  const value = source as { kind?: unknown; id?: unknown };
  if (value.kind === 'recording') return true;
  return value.kind === 'library' && typeof value.id === 'string' && value.id.length <= 64;
}

function isNumberIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && value >= min && value <= max;
}
