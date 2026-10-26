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

/** Índice de la primera muestra con sonido (|x| por encima de `threshold`), o −1. */
export function firstSound(samples: Float32Array, threshold = 1e-3): number {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]!) > threshold) return i;
  }
  return -1;
}

/** Lo último que ha salido: las muestras (la más reciente al final) y su frecuencia. */
export interface OutputWindow {
  readonly samples: Float32Array;
  readonly sampleRate: number;
}

/**
 * Espera a que suene algo y devuelve cuántos ms pasaron desde `since` (reloj de
 * `performance.now()`) hasta la primera muestra con sonido, o `null` si no suena en `timeoutMs`.
 * `read` devuelve lo último que ha salido (o `null` si aún no hay audio). Se lee cada pocos ms y se
 * descuenta lo que llevaba sonando dentro de la ventana leída.
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
    const index = output ? firstSound(output.samples) : -1;
    if (output && index >= 0) {
      const sounding = ((output.samples.length - index) / output.sampleRate) * 1000;
      return Math.max(0, now() - since - sounding);
    }
    await pause();
  }
  return null;
}
