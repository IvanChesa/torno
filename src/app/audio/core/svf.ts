/**
 * Filtro paso bajo de variables de estado con integradores trapezoidales (TPT, A. Simper, Cytomic):
 * estable aunque el corte cambie en cada muestra y exacto en el corte gracias al prewarping
 * (`g = tan(π·fc/fs)`). Con k = √2 es un Butterworth de 2 polos: −3,01 dB en la frecuencia de corte.
 */
import { FILTER_CLOSED_HZ, FILTER_MAX_FRACTION, FILTER_OPEN_HZ } from './constants';

/** Amortiguamiento de Butterworth (Q = 1/√2). */
export const BUTTERWORTH_K = Math.SQRT2;

/**
 * Corte del filtro según la posición del brazo, de 0 (extremo exterior) a 1 (interior): exponencial
 * de 18 kHz a 150 Hz. En 0 el filtro no actúa (*bypass*); esta función da el corte de casi 0.
 */
export function cutoffForAmount(amount: number, sampleRate: number): number {
  const hz = FILTER_OPEN_HZ * (FILTER_CLOSED_HZ / FILTER_OPEN_HZ) ** amount;
  return Math.min(hz, FILTER_MAX_FRACTION * sampleRate);
}

export class LowpassSvf {
  #ic1 = 0;
  #ic2 = 0;
  #a1 = 1;
  #a2 = 0;
  #a3 = 0;

  readonly #sampleRate: number;
  readonly #k: number;

  constructor(sampleRate: number, k = BUTTERWORTH_K) {
    this.#sampleRate = sampleRate;
    this.#k = k;
  }

  setCutoff(hz: number): void {
    const g = Math.tan((Math.PI * hz) / this.#sampleRate);
    this.#a1 = 1 / (1 + g * (g + this.#k));
    this.#a2 = g * this.#a1;
    this.#a3 = g * this.#a2;
  }

  /** Estado de reposo para una entrada constante `x`: la salida empieza en `x`, sin transitorio. */
  settle(x: number): void {
    this.#ic1 = 0;
    this.#ic2 = x;
  }

  /** Filtra una muestra. */
  tick(x: number): number {
    const v3 = x - this.#ic2;
    const v1 = this.#a1 * this.#ic1 + this.#a2 * v3;
    const v2 = this.#ic2 + this.#a2 * this.#ic1 + this.#a3 * v3;
    this.#ic1 = 2 * v1 - this.#ic1;
    this.#ic2 = 2 * v2 - this.#ic2;
    return v2;
  }

  /** Filtra `frames` muestras de `buffer` (desde `offset`) en el sitio. */
  processInPlace(buffer: Float32Array, offset: number, frames: number): void {
    let ic1 = this.#ic1;
    let ic2 = this.#ic2;
    const a1 = this.#a1;
    const a2 = this.#a2;
    const a3 = this.#a3;
    const end = offset + frames;
    for (let i = offset; i < end; i++) {
      const v3 = buffer[i]! - ic2;
      const v1 = a1 * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1;
      ic2 = 2 * v2 - ic2;
      buffer[i] = v2;
    }
    this.#ic1 = ic1;
    this.#ic2 = ic2;
  }

  reset(): void {
    this.#ic1 = 0;
    this.#ic2 = 0;
  }

  /** Si un `NaN` o un infinito ha llegado al estado, lo limpia (nunca debería pasar). */
  sanitize(): void {
    if (!Number.isFinite(this.#ic1) || !Number.isFinite(this.#ic2)) this.reset();
  }
}
