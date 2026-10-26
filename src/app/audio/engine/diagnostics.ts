/**
 * Diagnóstico del audio (PLAN fase 4, tarea 7; la web con `?diagnostico=1`): lo que necesitan las
 * pruebas en los móviles, leído del propio navegador. Nada sale del dispositivo.
 */
import type { LatencySetting } from './latency';

export interface EngineDiagnostics {
  /** Estado del contexto (`running`, `suspended`…), o `null` si aún no hay. */
  readonly contextState: string | null;
  readonly sampleRate: number | null;
  /** Latencias que informa el contexto, en ms (`null` si no las da). */
  readonly baseLatencyMs: number | null;
  readonly outputLatencyMs: number | null;
  /** Latencia de entrada de la pista del micrófono, en ms (solo con el micrófono abierto). */
  readonly inputLatencyMs: number | null;
  /** Estimación automática de la latencia de ida y vuelta, en ms. */
  readonly autoLatencyMs: number;
  /** La latencia que se aplica a las tomas (automática, calibrada o manual). */
  readonly latency: LatencySetting;
  /** `navigator.audioSession.type`, si existe (Safari). */
  readonly audioSession: string | null;
  /** Memoria del audio en uso (bytes), según el núcleo. */
  readonly memoryBytes: number | null;
  /** Estadísticas de reproducción del navegador (cortes, latencia), si las da. */
  readonly playback: Readonly<Record<string, number>> | null;
}

/**
 * Las estadísticas de reproducción del contexto, si el navegador las da: `playbackStats` (Web
 * Audio) o su versión experimental `playoutStats` (Chrome). Se copian los campos numéricos, sean
 * los que sean (cada versión los llama de una forma).
 */
export function playbackStats(context: BaseAudioContext): Readonly<Record<string, number>> | null {
  for (const name of ['playbackStats', 'playoutStats']) {
    const stats = (context as unknown as Record<string, unknown>)[name];
    if (!stats || typeof stats !== 'object') continue;
    const out: Record<string, number> = {};
    // Los atributos WebIDL son getters enumerables del prototipo: `for…in` los recorre.
    for (const key in stats) {
      const value = (stats as Record<string, unknown>)[key];
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    }
    if (Object.keys(out).length > 0) return out;
  }
  return null;
}

/** Índice de la primera muestra con sonido (|x| por encima de `threshold`) desde `from`, o −1. */
export function firstSound(samples: Float32Array, threshold = 1e-3, from = 0): number {
  for (let i = Math.max(0, from); i < samples.length; i++) {
    if (Math.abs(samples[i]!) > threshold) return i;
  }
  return -1;
}

/** Lo último que ha salido: las muestras (la más reciente al final), su frecuencia y su hora. */
export interface OutputWindow {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  /** Cuándo sale por el altavoz la última muestra, en el reloj de `performance.now()`. */
  readonly end: number;
}

/**
 * Espera a que suene algo y devuelve cuántos ms pasaron desde `since` (reloj de
 * `performance.now()`, el del toque) hasta que la primera muestra con sonido sale por el altavoz, o
 * `null` si no suena en `timeoutMs`. `read` devuelve lo último que ha salido (o `null` si aún no
 * hay audio). La ventana es larga y lleva su hora: no importa cuándo se lea, mientras el arranque
 * siga dentro. Solo cuenta el sonido posterior al toque (no la cola de una pausa reciente).
 */
export async function waitForSound(
  read: () => OutputWindow | null,
  since: number,
  timeoutMs = 5000,
  now: () => number = () => performance.now(),
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 4)),
): Promise<number | null> {
  while (now() - since < timeoutMs) {
    const output = read();
    if (output) {
      const { samples, sampleRate, end } = output;
      const msPerSample = 1000 / sampleRate;
      // Muestra de la ventana que sonó en el momento del toque (negativa si es anterior).
      const touch = Math.ceil(samples.length - (end - since) / msPerSample);
      const index = firstSound(samples, 1e-3, touch);
      if (index >= 0) return Math.max(0, end - (samples.length - index) * msPerSample - since);
    }
    await pause();
  }
  return null;
}
