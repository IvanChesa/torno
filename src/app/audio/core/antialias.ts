/**
 * Filtro contra el *aliasing* del *varispeed* (PLAN fase 3, tarea 7; revisión de la fase 1, #14).
 *
 * Leer un bucle `s` veces más deprisa multiplica sus frecuencias por `s`: lo que pase de Nyquist se
 * pliega y cae en otra frecuencia. Una componente de `f` Hz del PCM sale en `f·s`; si `f·s` está
 * entre `sr − B` y `sr + B` (B = 20 kHz, lo que se oye), su imagen cae en la banda audible. Por eso,
 * por encima de `antialiasThreshold`, la voz pasa el PCM por este paso bajo **antes de interpolar**,
 * a la frecuencia del propio PCM: su banda eliminada empieza en `(sr − B) / s`, y lo que plegaría por
 * debajo de 20 kHz queda al menos `STOPBAND_DB` abajo.
 *
 * Es un Chebyshev de tipo II de orden 10 (banda pasante plana, rizado solo en la eliminada), en 5
 * secciones de 2.º orden. Cada sección es un filtro de variables de estado de topología preservada
 * (TPT, la transformada bilineal del analógico, como el SVF del brazo) con su salida «muesca»: paso
 * alto + paso bajo escalado pone los ceros en ±j·z. A diferencia de una forma directa, el TPT admite
 * cambiar los coeficientes con el filtro sonando sin transitorios (girar el tempo los cambia).
 *
 * El diseño depende solo de la velocidad: las constantes del prototipo se calculan una vez y cada
 * cambio de velocidad recalcula los coeficientes en arrays ya reservados (sin reservas en
 * `process()`).
 */

/** Orden del filtro (par: secciones de 2.º orden). */
export const ANTIALIAS_ORDER = 10;
const SECTIONS = ANTIALIAS_ORDER / 2;
/** Atenuación mínima de la banda eliminada, en dB. */
export const ANTIALIAS_STOPBAND_DB = 68;
/** Lo que se oye: las imágenes que caen por encima de esto no importan. */
const AUDIBLE_HZ = 20_000;

/** Banda que se protege: 20 kHz, o el 90 % de Nyquist con frecuencias de muestreo bajas. */
function protectedBand(sampleRate: number): number {
  return Math.min(AUDIBLE_HZ, sampleRate * 0.45);
}

/**
 * Velocidad de lectura a partir de la cual las imágenes podrían caer en la banda audible:
 * `(sr − B) / (sr / 2)`. A 48 kHz, 1,167 (105 BPM para un bucle de 90); a 44,1 kHz, 1,1.
 */
export function antialiasThreshold(sampleRate: number): number {
  return (sampleRate - protectedBand(sampleRate)) / (sampleRate / 2);
}

// Prototipo (banda eliminada en 1 rad/s): los polos son los inversos de los de un Chebyshev I y
// los ceros están en ±j / cos θₖ. Solo dependen del orden y de la atenuación.
const PROTO_RE = new Float64Array(SECTIONS);
const PROTO_MAG2 = new Float64Array(SECTIONS);
const PROTO_ZERO2 = new Float64Array(SECTIONS);
{
  const epsilon = 1 / Math.sqrt(10 ** (ANTIALIAS_STOPBAND_DB / 10) - 1);
  const mu = Math.asinh(1 / epsilon) / ANTIALIAS_ORDER;
  for (let k = 0; k < SECTIONS; k++) {
    const theta = (Math.PI * (2 * k + 1)) / (2 * ANTIALIAS_ORDER);
    const re = -Math.sinh(mu) * Math.sin(theta);
    const im = Math.cosh(mu) * Math.cos(theta);
    const mag2 = re * re + im * im;
    // 1 / p = conj(p) / |p|².
    PROTO_RE[k] = re / mag2;
    PROTO_MAG2[k] = 1 / mag2;
    PROTO_ZERO2[k] = 1 / (Math.cos(theta) * Math.cos(theta));
  }
}

/** Coeficientes por sección: k (amortiguamiento), a1, a2, a3 (TPT) y la ganancia del paso alto. */
const STRIDE = 5;

export class AntialiasFilter {
  readonly #coefficients = new Float64Array(STRIDE * SECTIONS);
  /** Por sección: los dos estados de los integradores del TPT. */
  readonly #state = new Float64Array(2 * SECTIONS);
  readonly #sampleRate: number;
  readonly #band: number;
  /** Velocidad para la que están calculados los coeficientes (0: ninguna). */
  speed = 0;
  /**
   * Retardo de grupo en continua, en muestras del PCM. La voz lee lo filtrado adelantado en este
   * retardo: los graves quedan alineados con la lectura directa y con las demás capas.
   */
  delay = 0;

  constructor(sampleRate: number) {
    this.#sampleRate = sampleRate;
    this.#band = protectedBand(sampleRate);
  }

  /** Calcula los coeficientes para leer a `speed` (> el umbral). No reserva memoria. */
  design(speed: number): void {
    this.speed = speed;
    const sr = this.#sampleRate;
    // Inicio de la banda eliminada, en Hz del PCM; por debajo de Nyquist (con el umbral y la
    // histéresis de la voz, como mucho el 98 %).
    const stop = Math.min((sr - this.#band) / speed, 0.49 * sr);
    const omega = Math.tan((Math.PI * stop) / sr);
    const omega2 = omega * omega;
    const c = this.#coefficients;
    let delay = 0;
    for (let k = 0; k < SECTIONS; k++) {
      // Sección analógica (frecuencias ya predeformadas): (s² + z²)·|p|²/z² / (s² + b·s + |p|²),
      // con ganancia 1 en continua.
      const zero2 = omega2 * PROTO_ZERO2[k]!;
      const b = -2 * omega * PROTO_RE[k]!;
      const pole2 = omega2 * PROTO_MAG2[k]!;
      // TPT: g = ω₀ = |p| y k = b / ω₀. Salida: (|p|²/z²)·paso alto + paso bajo.
      const g = Math.sqrt(pole2);
      const damping = b / g;
      const a1 = 1 / (1 + g * (g + damping));
      c[STRIDE * k] = damping;
      c[STRIDE * k + 1] = a1;
      c[STRIDE * k + 2] = g * a1;
      c[STRIDE * k + 3] = g * g * a1;
      c[STRIDE * k + 4] = pole2 / zero2;
      // Retardo de grupo en ω = 0 de su equivalente bilineal: el numerador es simétrico (1 muestra)
      // menos el del denominador, (d1 + 2·d2) / (1 + d1 + d2).
      const d0 = 1 + b + pole2;
      const d1 = (2 * (pole2 - 1)) / d0;
      const d2 = (1 - b + pole2) / d0;
      delay += 1 - (d1 + 2 * d2) / (1 + d1 + d2);
    }
    this.delay = delay;
  }

  /** Vacía la memoria del filtro (antes de una lectura que no sigue a la anterior). */
  reset(): void {
    this.#state.fill(0);
  }

  /** Una muestra del PCM filtrada. */
  process(x: number): number {
    const c = this.#coefficients;
    const s = this.#state;
    let y = x;
    for (let k = 0; k < SECTIONS; k++) {
      const at = STRIDE * k;
      const ic1 = s[2 * k]!;
      const ic2 = s[2 * k + 1]!;
      const a2 = c[at + 2]!;
      const v3 = y - ic2;
      const v1 = c[at + 1]! * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + c[at + 3]! * v3;
      s[2 * k] = 2 * v1 - ic1;
      s[2 * k + 1] = 2 * v2 - ic2;
      // Paso alto (y − k·v1 − v2) escalado más paso bajo (v2).
      y = c[at + 4]! * (y - c[at]! * v1 - v2) + v2;
    }
    return y;
  }
}
