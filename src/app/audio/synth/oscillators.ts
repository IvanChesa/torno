/**
 * Osciladores sin *aliasing* audible (PLAN fase 3): las formas con saltos (sierra y pulso) corrigen
 * cada salto con PolyBLEP, y el triángulo integra el pulso corregido. Cada llamada escribe una nota
 * entera en un `Float64Array`; la frecuencia puede ser fija o una curva por muestra (barridos y
 * *glides*).
 */

export type Waveform = 'sine' | 'saw' | 'square' | 'triangle';

/** Tabla de un ciclo de seno (con una muestra de más para interpolar sin comprobar el final). */
export const SINE_SIZE = 8192;
export const SINE_TABLE = new Float64Array(SINE_SIZE + 1);
for (let i = 0; i <= SINE_SIZE; i++) SINE_TABLE[i] = Math.sin((2 * Math.PI * i) / SINE_SIZE);

/**
 * sen(2π·`phase`) por tabla con interpolación lineal (error < 10⁻⁷, unos −140 dB): mucho más rápido
 * que `Math.sin`, y la tabla se calcula una sola vez al cargar el módulo.
 */
export function sine(phase: number): number {
  const x = (phase - Math.floor(phase)) * SINE_SIZE;
  const i = x | 0;
  const a = SINE_TABLE[i]!;
  return a + (SINE_TABLE[i + 1]! - a) * (x - i);
}

export interface OscillatorOptions {
  /** Fase inicial en [0, 1). */
  readonly phase?: number;
  /** Ancho del pulso en (0, 1) (solo `square`; 0,5 = cuadrada). */
  readonly width?: number;
}

/**
 * Corrección PolyBLEP de un salto unidad en la fase `t` (en [0, 1)) con paso `dt`: suaviza la
 * muestra de antes y la de después del salto con un polinomio de 2.º grado.
 */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/**
 * `length` muestras de la forma de onda, con amplitud ±1. `frequency` en Hz (un número o una curva
 * de `length` valores).
 */
export function oscillator(
  waveform: Waveform,
  length: number,
  sampleRate: number,
  frequency: number | Float64Array,
  options: OscillatorOptions = {},
): Float64Array {
  const out = new Float64Array(length);
  const width = Math.min(0.95, Math.max(0.05, options.width ?? 0.5));
  const limit = (sampleRate / 2) * 0.999;
  const fixed = typeof frequency === 'number' ? Math.min(frequency, limit) / sampleRate : 0;
  const curve = typeof frequency === 'number' ? null : frequency;
  let phase = options.phase ?? 0;
  // Un bucle por forma de onda: la ruta caliente no decide nada por muestra.
  switch (waveform) {
    case 'sine':
      for (let i = 0; i < length; i++) {
        out[i] = sine(phase);
        phase += curve ? Math.min(curve[i]!, limit) / sampleRate : fixed;
        if (phase >= 1) phase -= 1;
      }
      return out;
    case 'saw':
      for (let i = 0; i < length; i++) {
        const dt = curve ? Math.min(curve[i]!, limit) / sampleRate : fixed;
        out[i] = 2 * phase - 1 - polyBlep(phase, dt);
        phase += dt;
        if (phase >= 1) phase -= 1;
      }
      return out;
    case 'square':
    case 'triangle': {
      // Integrador del triángulo, con una fuga mínima para que no derive.
      let triangle = 0;
      const integrate = waveform === 'triangle';
      for (let i = 0; i < length; i++) {
        const dt = curve ? Math.min(curve[i]!, limit) / sampleRate : fixed;
        const shifted = phase + 1 - width >= 1 ? phase - width : phase + 1 - width;
        const pulse = (phase < width ? 1 : -1) + polyBlep(phase, dt) - polyBlep(shifted, dt);
        if (integrate) {
          triangle = 0.9995 * triangle + 4 * dt * pulse;
          out[i] = triangle;
        } else {
          out[i] = pulse;
        }
        phase += dt;
        if (phase >= 1) phase -= 1;
      }
      return out;
    }
  }
}

/** Curva de frecuencia que cae (o sube) de `from` a `to` Hz con constante de tiempo `seconds`. */
export function sweep(
  length: number,
  sampleRate: number,
  from: number,
  to: number,
  seconds: number,
): Float64Array {
  const out = new Float64Array(length);
  const k = Math.exp(-1 / (seconds * sampleRate));
  let delta = from - to;
  for (let i = 0; i < length; i++) {
    out[i] = to + delta;
    delta *= k;
  }
  return out;
}

/**
 * Curva de frecuencia con *glide*: empieza en `from` y llega a `to` con constante de tiempo
 * `seconds` (en escala logarítmica, como un portamento).
 */
export function glide(
  length: number,
  sampleRate: number,
  from: number,
  to: number,
  seconds: number,
): Float64Array {
  const out = new Float64Array(length);
  const k = Math.exp(-1 / (seconds * sampleRate));
  let ratio = Math.log(from / to);
  for (let i = 0; i < length; i++) {
    out[i] = to * Math.exp(ratio);
    ratio *= k;
  }
  return out;
}
