/**
 * Filtro de variables de estado (TPT/SVF, como el del núcleo) para la síntesis: paso bajo, paso
 * banda y paso alto a la vez, con el corte modulable muestra a muestra (barridos de filtro).
 */

export type FilterMode = 'lowpass' | 'bandpass' | 'highpass';

/** Con el corte en una curva, los coeficientes se recalculan cada `CONTROL_FRAMES` muestras. */
export const CONTROL_FRAMES = 16;

export class SynthFilter {
  #ic1 = 0;
  #ic2 = 0;
  // Coeficientes del último corte y resonancia (solo se recalculan si cambian).
  #cutoff = -1;
  #q = -1;
  #k = 0;
  #a1 = 0;
  #a2 = 0;
  #a3 = 0;
  readonly #sampleRate: number;

  constructor(sampleRate: number) {
    this.#sampleRate = sampleRate;
  }

  /**
   * Una muestra. `cutoff` en Hz (se limita por debajo de Nyquist); `q`, la resonancia (0,707 =
   * sin pico).
   */
  step(x: number, cutoff: number, q: number, mode: FilterMode): number {
    if (cutoff !== this.#cutoff || q !== this.#q) {
      this.#cutoff = cutoff;
      this.#q = q;
      const fc = Math.min(Math.max(cutoff, 10), this.#sampleRate * 0.49);
      const g = Math.tan((Math.PI * fc) / this.#sampleRate);
      this.#k = 1 / q;
      this.#a1 = 1 / (1 + g * (g + this.#k));
      this.#a2 = g * this.#a1;
      this.#a3 = g * this.#a2;
    }
    const k = this.#k;
    const a2 = this.#a2;
    const v3 = x - this.#ic2;
    const v1 = this.#a1 * this.#ic1 + a2 * v3;
    const v2 = this.#ic2 + a2 * this.#ic1 + this.#a3 * v3;
    this.#ic1 = 2 * v1 - this.#ic1;
    this.#ic2 = 2 * v2 - this.#ic2;
    if (mode === 'lowpass') return v2;
    if (mode === 'bandpass') return v1;
    return x - k * v1 - v2;
  }
}

/**
 * Filtra `signal` en su sitio. `cutoff`: Hz fijos o una curva por muestra (que se lee cada
 * `CONTROL_FRAMES` muestras: un barrido de filtro no necesita más).
 */
export function filter(
  signal: Float64Array,
  sampleRate: number,
  mode: FilterMode,
  cutoff: number | Float64Array,
  q = Math.SQRT1_2,
): Float64Array {
  const svf = new SynthFilter(sampleRate);
  for (let i = 0; i < signal.length; i++) {
    const fc = typeof cutoff === 'number' ? cutoff : cutoff[i - (i % CONTROL_FRAMES)]!;
    signal[i] = svf.step(signal[i]!, fc, q, mode);
  }
  return signal;
}
