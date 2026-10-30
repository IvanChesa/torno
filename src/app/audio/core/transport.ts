/**
 * Transporte (PLAN §4.4, D6): un contador entero de muestras y la posición en pulsos calculada por
 * tramos de tempo constante, sin acumular errores:
 *
 *   pulso(f) = pulsoAlEmpezarElTramo + (f − muestraAlEmpezarElTramo) × bpm / 60 / sampleRate
 *
 * Cambiar de tempo o reposicionar abre un tramo nuevo en la muestra actual. El contador solo avanza
 * cuando el núcleo lo dice (reproduciendo o mientras se apaga al pausar).
 *
 * El pulso se calcula en ese orden, con una sola división al final: (f − f₀) × bpm / (60 · sampleRate).
 * Así es exacto cuando el de verdad lo es. Con los pulsos por muestra precalculados (bpm / 60 /
 * sampleRate, que no es exacto), a 40 BPM la muestra 288 000 daba el pulso 3,9999999999999996 y el
 * compás llegaba una muestra tarde (fase 5.b).
 */
import { BEATS_PER_BAR, DEFAULT_BPM, MAX_BPM, MIN_BPM } from './constants';

/**
 * Posición del transporte al principio de un tramo. Las voces la leen de aquí: en V8, pasar
 * números con decimales a una función no integrada los empaqueta en el heap (reserva memoria).
 */
export interface Clock {
  beat: number;
  beatsPerFrame: number;
}

export class Transport {
  /** Muestra actual del transporte (entera). */
  frame = 0;
  #segmentFrame = 0;
  #segmentBeat = 0;
  #tempo = DEFAULT_BPM;
  #perFrame: number;
  /** Muestras por minuto (60 · sampleRate): el divisor exacto del pulso. */
  readonly #framesPerMinute: number;

  constructor(
    readonly sampleRate: number,
    bpm = DEFAULT_BPM,
  ) {
    if (!(sampleRate > 0)) throw new RangeError(`Frecuencia de muestreo no válida: ${sampleRate}`);
    this.#tempo = clampBpm(bpm);
    this.#perFrame = this.#tempo / 60 / sampleRate;
    this.#framesPerMinute = 60 * sampleRate;
  }

  get bpm(): number {
    return this.#tempo;
  }

  /** Pulsos por muestra con el tempo actual. */
  get beatsPerFrame(): number {
    return this.#perFrame;
  }

  /** Muestras por pulso con el tempo actual (no tiene por qué ser entero). */
  get framesPerBeat(): number {
    return (60 * this.sampleRate) / this.#tempo;
  }

  /** Pulso en la muestra actual. */
  get beat(): number {
    return this.beatAt(this.frame);
  }

  /** Escribe en `clock` el pulso de la muestra actual y los pulsos por muestra. */
  writeClock(clock: Clock): void {
    clock.beat =
      this.#segmentBeat + ((this.frame - this.#segmentFrame) * this.#tempo) / this.#framesPerMinute;
    clock.beatsPerFrame = this.#perFrame;
  }

  /** Pulso en una muestra del tramo actual. */
  beatAt(frame: number): number {
    return this.#segmentBeat + ((frame - this.#segmentFrame) * this.#tempo) / this.#framesPerMinute;
  }

  /**
   * Primera muestra (entera, ≥ la actual) en la que el pulso llega a `target`. Es exacta: usa la
   * misma fórmula que `beatAt`, así que `beatAt(f − 1) < target ≤ beatAt(f)`.
   */
  frameAtBeat(target: number): number {
    if (this.beatAt(this.frame) >= target) return this.frame;
    let f = this.#segmentFrame + Math.ceil((target - this.#segmentBeat) / this.#perFrame);
    if (f <= this.frame) f = this.frame + 1;
    while (f - 1 > this.frame && this.beatAt(f - 1) >= target) f--;
    while (this.beatAt(f) < target) f++;
    return f;
  }

  /** Cambia el tempo a partir de la muestra actual (la posición no salta). */
  setTempo(bpm: number): void {
    const beat = this.beat;
    this.#tempo = clampBpm(bpm);
    this.#perFrame = this.#tempo / 60 / this.sampleRate;
    this.#segmentBeat = beat;
    this.#segmentFrame = this.frame;
  }

  /** Pone la muestra actual en el pulso `beat`. */
  locate(beat: number): void {
    this.#segmentBeat = beat;
    this.#segmentFrame = this.frame;
  }

  /** Vuelve a la muestra 0 y al pulso 0 (parar). */
  rewind(): void {
    this.frame = 0;
    this.#segmentFrame = 0;
    this.#segmentBeat = 0;
  }

  /** Redefine la línea de tiempo: la muestra `frame` pasa a ser el pulso `beat`, con otro tempo. */
  redefine(frame: number, beat: number, bpm: number): void {
    this.#tempo = clampBpm(bpm);
    this.#perFrame = this.#tempo / 60 / this.sampleRate;
    this.#segmentFrame = frame;
    this.#segmentBeat = beat;
  }

  advance(frames: number): void {
    this.frame += frames;
  }
}

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

/** Siguiente límite de compás estrictamente posterior a `beat`. */
export function nextBarAfter(beat: number): number {
  return (Math.floor(beat / BEATS_PER_BAR) + 1) * BEATS_PER_BAR;
}

/** Límite de compás en `beat` o el siguiente. */
export function barAtOrAfter(beat: number): number {
  return Math.ceil(beat / BEATS_PER_BAR) * BEATS_PER_BAR;
}
