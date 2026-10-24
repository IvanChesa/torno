/**
 * Piezas pequeñas del DSP, sin estado o con estado reservado de antemano: interpolación, suavizado
 * de un polo y fundidos de coseno alzado.
 */

/**
 * Interpolación cúbica de Hermite de 4 puntos y 3.er orden (forma «x» de Niemitalo): pasa por las
 * muestras (`t = 0` da `x0` exacto) y su derivada es continua entre tramos.
 */
export function hermite(xm1: number, x0: number, x1: number, x2: number, t: number): number {
  const c1 = 0.5 * (x1 - xm1);
  const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
  const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
  return ((c3 * t + c2) * t + c1) * t + x0;
}

/** Lee `data` (de `frames` muestras, en bucle) en una posición fraccionaria de [0, frames). */
export function readLooped(data: Float32Array, frames: number, position: number): number {
  const i = Math.floor(position);
  const t = position - i;
  const im1 = i === 0 ? frames - 1 : i - 1;
  const i1 = i + 1 === frames ? 0 : i + 1;
  const i2 = i1 + 1 === frames ? 0 : i1 + 1;
  return hermite(data[im1]!, data[i]!, data[i1]!, data[i2]!, t);
}

/** `x mod m` en [0, m), también con `x` negativo (y sin −0). */
export function wrap(x: number, m: number): number {
  const r = x % m;
  return r < 0 ? r + m : r + 0;
}

/** Coeficiente de un suavizado de un polo con constante de tiempo `seconds`. */
export function onePoleCoefficient(seconds: number, sampleRate: number): number {
  return 1 - Math.exp(-1 / (seconds * sampleRate));
}

/** Número de muestras de una duración, redondeado (al menos 1). */
export function framesOf(seconds: number, sampleRate: number): number {
  return Math.max(1, Math.round(seconds * sampleRate));
}

/**
 * Tabla de un fundido de coseno alzado de `length` muestras, muestreado en el centro de cada una:
 * la primera ya se mueve (el cambio empieza justo en su muestra) y después de la última se llega
 * al objetivo. Es simétrica y complementaria: `t[i] + t[length − 1 − i] = 1`, así que los fundidos
 * cruzados suman 1. El salto máximo entre muestras de un fundido de Δ es π/2 · Δ / length.
 */
export function fadeTable(length: number): Float32Array {
  const table = new Float32Array(length);
  for (let i = 0; i < length; i++) table[i] = 0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / length);
  return table;
}

/** Un «fundido» de 0 muestras: el cambio es inmediato. */
export const INSTANT_FADE = new Float32Array(0);

/**
 * Rampa de ganancia de `from` a `to` con la forma de una tabla de fundido. Sin reservas: se
 * reutiliza el mismo objeto en cada fundido.
 */
export class Ramp {
  private from = 0;
  private to = 0;
  private table: Float32Array;
  private position = 0;
  private length = 0;

  constructor(
    initial: number,
    private readonly defaultTable: Float32Array,
  ) {
    this.from = initial;
    this.to = initial;
    this.table = defaultTable;
  }

  /** Valor actual (el de la próxima muestra). */
  get value(): number {
    if (this.position >= this.length) return this.to;
    return this.from + (this.to - this.from) * this.table[this.position]!;
  }

  get target(): number {
    return this.to;
  }

  get ramping(): boolean {
    return this.position < this.length;
  }

  /** Muestras que le quedan al fundido. */
  get remaining(): number {
    return this.length - this.position;
  }

  /** Empieza un fundido desde el valor actual hasta `to` con la forma de `table`. */
  start(to: number, table: Float32Array = this.defaultTable): void {
    this.from = this.value;
    this.to = to;
    this.table = table;
    this.length = table.length;
    this.position = this.from === to ? this.length : 0;
  }

  /** Salta a `value` sin fundido. */
  set(value: number): void {
    this.from = value;
    this.to = value;
    this.position = this.length;
  }

  /** Escribe los próximos `frames` valores en `out` (desde 0) y avanza la rampa. */
  renderInto(out: Float32Array, frames: number): void {
    let position = this.position;
    const length = this.length;
    const from = this.from;
    const span = this.to - from;
    const table = this.table;
    for (let i = 0; i < frames; i++) {
      if (position < length) {
        out[i] = from + span * table[position]!;
        position++;
      } else {
        out[i] = this.to;
      }
    }
    this.position = position;
  }

  /** Avanza la rampa `frames` muestras sin escribir nada. */
  skip(frames: number): void {
    this.position = Math.min(this.length, this.position + frames);
  }
}
