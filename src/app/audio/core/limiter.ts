/**
 * Limitador estéreo enlazado con anticipación (PLAN §4.4): techo de −0,3 dBFS garantizado.
 *
 * Para cada muestra, la ganancia necesaria es r = min(1, techo / pico). Con una anticipación de D
 * muestras:
 * 1. m = mínimo deslizante de r en las últimas D + 1 muestras (ataque instantáneo);
 * 2. h = m con recuperación lenta de un polo (h nunca supera a m);
 * 3. g = media de h en las últimas D + 1 muestras (el ataque dura D muestras, sin escalones);
 * 4. salida = entrada retrasada D muestras × g.
 * Cada término de la media es ≤ r de la muestra que sale, así que |salida| ≤ techo. Por debajo del
 * techo, g vale exactamente 1 y el limitador es transparente al bit. Después, una saturación suave
 * por encima de un codo cerca del techo recoge los errores de redondeo, y un `NaN` sale como 0.
 */
import { LIMITER_CEILING, LIMITER_LOOKAHEAD_SECONDS, LIMITER_RELEASE_SECONDS } from './constants';
import { framesOf, onePoleCoefficient } from './dsp';

/** Codo de la saturación de seguridad, como fracción del techo. */
export const LIMITER_KNEE = 0.98;

export class Limiter {
  /** Anticipación en muestras: también es la latencia que añade. */
  readonly lookahead: number;
  readonly ceiling: number;
  readonly #knee: number;
  readonly #window: number;
  readonly #release: number;
  readonly #delayL: Float32Array;
  readonly #delayR: Float32Array;
  #delayPos = 0;
  // Mínimo deslizante: cola monótona (valores crecientes) en un anillo.
  readonly #queueValue: Float64Array;
  readonly #queueIndex: Float64Array;
  #queueHead = 0;
  #queueSize = 0;
  #sample = 0;
  #held = 1;
  // Media móvil de `held`, con la cuenta de valores < 1 para volver a 1 exacto.
  readonly #box: Float64Array;
  #boxPos = 0;
  #boxSum: number;
  #boxBelow = 0;
  /** Reducción de ganancia más profunda desde `resetMinGain()` (para los medidores). */
  minGain = 1;

  constructor(sampleRate: number, ceiling = LIMITER_CEILING) {
    this.ceiling = ceiling;
    this.#knee = ceiling * LIMITER_KNEE;
    this.lookahead = framesOf(LIMITER_LOOKAHEAD_SECONDS, sampleRate);
    this.#window = this.lookahead + 1;
    this.#release = onePoleCoefficient(LIMITER_RELEASE_SECONDS, sampleRate);
    this.#delayL = new Float32Array(this.#window);
    this.#delayR = new Float32Array(this.#window);
    this.#queueValue = new Float64Array(this.#window);
    this.#queueIndex = new Float64Array(this.#window);
    this.#box = new Float64Array(this.#window).fill(1);
    this.#boxSum = this.#window;
  }

  resetMinGain(): void {
    this.minGain = 1;
  }

  reset(): void {
    this.#delayL.fill(0);
    this.#delayR.fill(0);
    this.#delayPos = 0;
    this.#queueHead = 0;
    this.#queueSize = 0;
    this.#sample = 0;
    this.#held = 1;
    this.#box.fill(1);
    this.#boxPos = 0;
    this.#boxSum = this.#window;
    this.#boxBelow = 0;
    this.minGain = 1;
  }

  /** Limita `frames` muestras de `inL`/`inR` (desde 0) y las escribe en `outL`/`outR` desde `offset`. */
  processInto(
    inL: Float32Array,
    inR: Float32Array,
    outL: Float32Array,
    outR: Float32Array,
    offset: number,
    frames: number,
  ): void {
    const window = this.#window;
    const ceiling = this.ceiling;
    const release = this.#release;
    const queueValue = this.#queueValue;
    const queueIndex = this.#queueIndex;
    const box = this.#box;
    for (let i = 0; i < frames; i++) {
      let l = inL[i]!;
      let r = inR[i]!;
      const al = l < 0 ? -l : l;
      const ar = r < 0 ? -r : r;
      let peak = al > ar ? al : ar;
      // Una muestra no finita (no debería llegar nunca) entra como silencio: ni suena ni hunde la
      // ganancia durante la recuperación.
      if (!(peak < Infinity)) {
        l = 0;
        r = 0;
        peak = 0;
      }
      const need = peak > ceiling ? ceiling / peak : 1;

      // 1. Mínimo deslizante de las últimas `window` ganancias necesarias. Primero sale la que ya
      // no está en la ventana (así nunca hay más de `window` en el anillo).
      const n = this.#sample++;
      if (this.#queueSize > 0 && queueIndex[this.#queueHead]! <= n - window) {
        this.#queueHead = this.#queueHead + 1 === window ? 0 : this.#queueHead + 1;
        this.#queueSize--;
      }
      while (this.#queueSize > 0) {
        const last = (this.#queueHead + this.#queueSize - 1) % window;
        if (queueValue[last]! < need) break;
        this.#queueSize--;
      }
      const tail = (this.#queueHead + this.#queueSize) % window;
      queueValue[tail] = need;
      queueIndex[tail] = n;
      this.#queueSize++;
      const min = queueValue[this.#queueHead]!;

      // 2. Ataque instantáneo, recuperación lenta, nunca por encima del mínimo.
      const rise = this.#held + (1 - this.#held) * release;
      this.#held = rise < min ? rise : min;
      // Por debajo de 1e-9 de distancia, la recuperación ha terminado: 1 exacto.
      if (this.#held > 1 - 1e-9 && min === 1) this.#held = 1;

      // 3. Media móvil de `held`.
      const old = box[this.#boxPos]!;
      box[this.#boxPos] = this.#held;
      this.#boxPos = this.#boxPos + 1 === window ? 0 : this.#boxPos + 1;
      this.#boxBelow += (this.#held < 1 ? 1 : 0) - (old < 1 ? 1 : 0);
      let gain: number;
      if (this.#boxBelow === 0) {
        this.#boxSum = window;
        gain = 1;
      } else {
        this.#boxSum += this.#held - old;
        gain = this.#boxSum / window;
        if (gain < this.minGain) this.minGain = gain;
      }

      // 4. Salida retrasada `lookahead` muestras.
      const pos = this.#delayPos;
      this.#delayL[pos] = l;
      this.#delayR[pos] = r;
      const read = pos + 1 === window ? 0 : pos + 1;
      this.#delayPos = read;
      outL[offset + i] = this.#safety(this.#delayL[read]! * gain);
      outR[offset + i] = this.#safety(this.#delayR[read]! * gain);
    }
  }

  /** Saturación suave por encima del codo: lleva (codo, ∞) a (codo, techo). */
  #safety(y: number): number {
    if (y !== y) return 0; // NaN
    const knee = this.#knee;
    if (y > knee)
      return knee + (this.ceiling - knee) * Math.tanh((y - knee) / (this.ceiling - knee));
    if (y < -knee) {
      return -knee - (this.ceiling - knee) * Math.tanh((-y - knee) / (this.ceiling - knee));
    }
    return y;
  }
}
