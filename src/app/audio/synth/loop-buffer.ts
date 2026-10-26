/**
 * Búfer circular del tamaño de un bucle: lo que pasa del final entra por el principio. Así las colas
 * de las notas y de los efectos que cruzan el final del bucle suenan al volver a empezar, y el bucle
 * no tiene junta (PLAN §4.4: «los bucles de la biblioteca se sintetizan sin junta»).
 */
export class LoopBuffer {
  readonly data: Float64Array;

  constructor(readonly frames: number) {
    this.data = new Float64Array(frames);
  }

  /** Suma `signal × gain` empezando en la muestra `start` (con vuelta al principio). */
  add(signal: Float64Array, start: number, gain = 1): void {
    const frames = this.frames;
    let index = ((Math.round(start) % frames) + frames) % frames;
    for (const x of signal) {
      this.data[index] = this.data[index]! + x * gain;
      index++;
      if (index === frames) index = 0;
    }
  }

  /** Mezcla otro bucle del mismo tamaño. */
  mix(other: LoopBuffer | Float64Array, gain = 1): void {
    const data = other instanceof LoopBuffer ? other.data : other;
    for (let i = 0; i < this.frames; i++) this.data[i] = this.data[i]! + data[i]! * gain;
  }
}

/**
 * Procesa un bucle con un efecto que tiene memoria (eco, filtro continuo…) como si sonara en
 * bucle: da `passes` vueltas y se queda con la última, cuando la memoria del efecto ya viene de la
 * vuelta anterior. `step(x, i)` recibe la muestra y su índice en el bucle.
 */
export function processLooped(
  input: Float64Array,
  step: (x: number, index: number) => number,
  passes = 2,
): Float64Array {
  const frames = input.length;
  const out = new Float64Array(frames);
  for (let pass = 0; pass < passes; pass++) {
    const last = pass === passes - 1;
    for (let i = 0; i < frames; i++) {
      const y = step(input[i]!, i);
      if (last) out[i] = y;
    }
  }
  return out;
}
