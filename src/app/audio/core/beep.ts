/**
 * Pitido de prueba (fase 0): un seno con rampas de entrada y salida y duración exacta en muestras.
 *
 * TS puro: se ejecuta igual en el worklet y en Node. `process()` no reserva memoria ni crea
 * cierres; todo el estado son números que se reservan en el constructor.
 */

/** Duración de cada rampa (entrada y salida), en segundos. */
export const BEEP_RAMP_SECONDS = 0.005;

/** Número de muestras de una duración, redondeado a la muestra más cercana. */
export function secondsToFrames(seconds: number, sampleRate: number): number {
  return Math.round(seconds * sampleRate);
}

export class BeepGenerator {
  /** Fase del seno en ciclos, en [0, 1). */
  private phase = 0;
  /** Ciclos por muestra. */
  private increment = 0;
  private gain = 0;
  /** Muestra del pitido que toca escribir. */
  private position = 0;
  private length = 0;
  /** Muestras de cada rampa. */
  private ramp = 0;

  constructor(private readonly sampleRate: number) {
    if (!(sampleRate > 0)) throw new RangeError(`Frecuencia de muestreo no válida: ${sampleRate}`);
  }

  /** Empieza un pitido nuevo desde la fase 0 (sustituye al que estuviera sonando). */
  start(frequency: number, seconds: number, gain: number): void {
    if (!(frequency > 0 && frequency < this.sampleRate / 2)) {
      throw new RangeError(`Frecuencia fuera de rango: ${frequency}`);
    }
    if (!(seconds > 0) || !(gain >= 0 && gain <= 1)) {
      throw new RangeError(`Duración o ganancia no válidas: ${seconds} s, ${gain}`);
    }
    this.phase = 0;
    this.increment = frequency / this.sampleRate;
    this.gain = gain;
    this.position = 0;
    this.length = secondsToFrames(seconds, this.sampleRate);
    this.ramp = Math.min(secondsToFrames(BEEP_RAMP_SECONDS, this.sampleRate), this.length >> 1);
  }

  /** Corta el pitido en seco. Solo para descartar el generador: suena a clic si está sonando. */
  stop(): void {
    this.position = this.length;
  }

  get active(): boolean {
    return this.position < this.length;
  }

  /** Duración del último pitido, en muestras. */
  get lengthFrames(): number {
    return this.length;
  }

  /** Escribe `frames` muestras en `out` a partir de `offset`; fuera del pitido, silencio. */
  process(out: Float32Array, offset: number, frames: number): void {
    const end = offset + frames;
    for (let i = offset; i < end; i++) {
      if (this.position >= this.length) {
        out[i] = 0;
        continue;
      }
      out[i] = Math.sin(2 * Math.PI * this.phase) * this.gain * this.envelope(this.position);
      this.phase += this.increment;
      if (this.phase >= 1) this.phase -= 1;
      this.position++;
    }
  }

  /** Rampas de coseno alzado: empiezan y acaban en 0 y con pendiente 0 (sin clics). */
  private envelope(n: number): number {
    const fromEnd = this.length - 1 - n;
    const edge = n < fromEnd ? n : fromEnd;
    if (edge >= this.ramp) return 1;
    return 0.5 - 0.5 * Math.cos((Math.PI * edge) / this.ramp);
  }
}
