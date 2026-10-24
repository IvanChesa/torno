/**
 * Latencia de ida y vuelta de la grabación (PLAN §4.4, «Latencia»): la que el núcleo resta a cada
 * toma para alinearla con lo que se oyó.
 * - Automática: `baseLatency + outputLatency` del contexto + la latencia de entrada de la pista.
 * - Calibrada: la que mide la calibración por clic.
 * - Manual: en milisegundos.
 * El modo y el valor se guardan en `localStorage` (una preferencia de este dispositivo; nunca en el
 * archivo de la sesión), siempre con `try/catch`.
 */

export type LatencyMode = 'auto' | 'calibrated' | 'manual';

export interface LatencySetting {
  readonly mode: LatencyMode;
  /** Latencia calibrada o manual, en ms (en modo automático se ignora). */
  readonly ms: number;
}

/** Hasta dónde se puede ajustar a mano. */
export const MAX_MANUAL_LATENCY_MS = 500;
export const DEFAULT_LATENCY: LatencySetting = { mode: 'auto', ms: 0 };

const STORAGE_KEY = 'torno.latencia';

function isSetting(value: unknown): value is LatencySetting {
  if (typeof value !== 'object' || value === null) return false;
  const { mode, ms } = value as { mode?: unknown; ms?: unknown };
  return (
    (mode === 'auto' || mode === 'calibrated' || mode === 'manual') &&
    typeof ms === 'number' &&
    ms >= 0 &&
    ms <= MAX_MANUAL_LATENCY_MS
  );
}

export function loadLatency(): LatencySetting {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return isSetting(value) ? value : DEFAULT_LATENCY;
  } catch {
    return DEFAULT_LATENCY;
  }
}

export function saveLatency(setting: LatencySetting): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setting));
  } catch {
    // Sin almacenamiento (modo privado, cuota): la preferencia dura lo que dure la página.
  }
}

/** La estimación automática, en segundos. */
export function autoLatencySeconds(context: AudioContext, inputLatency: number): number {
  const base = Number.isFinite(context.baseLatency) ? context.baseLatency : 0;
  const output = Number.isFinite(context.outputLatency) ? context.outputLatency : 0;
  return base + output + inputLatency;
}

/** Latencia en muestras para el núcleo (entera, entre 0 y 1 s). */
export function latencyFrames(
  setting: LatencySetting,
  autoSeconds: number,
  sampleRate: number,
): number {
  const seconds = setting.mode === 'auto' ? autoSeconds : setting.ms / 1000;
  return Math.min(sampleRate, Math.max(0, Math.round(seconds * sampleRate)));
}
