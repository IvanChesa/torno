/**
 * Análisis de espectro para comprobar la síntesis y el núcleo: FFT de base 2 y picos de un espectro.
 * Lo usan los tests (fundamentales de los bajos, imágenes del *varispeed*) y no entra en ningún
 * bundle del navegador.
 */

/** FFT compleja en su sitio (Cooley-Tukey iterativa). `re` e `im` de longitud potencia de 2. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) throw new RangeError('La FFT pide una potencia de 2');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

export interface Spectrum {
  /** Magnitud de cada bin, de 0 a Nyquist (normalizada: un seno de amplitud 1 da ≈ 1). */
  readonly magnitude: Float64Array;
  /** Hz por bin. */
  readonly binHz: number;
}

/**
 * Ventanas: Hann (lóbulo principal estrecho: para separar frecuencias cercanas) y de techo plano
 * (pierde < 0,01 dB entre bins: para medir amplitudes).
 */
export type Window = 'hann' | 'flattop';

const FLATTOP = [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368];

function windowAt(window: Window, i: number, length: number): number {
  const x = (2 * Math.PI * i) / (length - 1);
  if (window === 'hann') return 0.5 - 0.5 * Math.cos(x);
  let w = 0;
  for (let k = 0; k < FLATTOP.length; k++)
    w += (k % 2 === 0 ? 1 : -1) * FLATTOP[k]! * Math.cos(k * x);
  return w;
}

/** Espectro de magnitud con una ventana, rellenando con ceros hasta `size` (potencia de 2). */
export function spectrum(
  signal: ArrayLike<number>,
  sampleRate: number,
  size: number,
  window: Window = 'hann',
): Spectrum {
  const length = Math.min(signal.length, size);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let windowSum = 0;
  for (let i = 0; i < length; i++) {
    const w = windowAt(window, i, length);
    re[i] = signal[i]! * w;
    windowSum += w;
  }
  fft(re, im);
  const magnitude = new Float64Array(size / 2 + 1);
  for (let k = 0; k <= size / 2; k++) magnitude[k] = (2 * Math.hypot(re[k]!, im[k]!)) / windowSum;
  return { magnitude, binHz: sampleRate / size };
}

export interface Peak {
  readonly hz: number;
  readonly magnitude: number;
}

/**
 * Máximos locales entre `fromHz` y `toHz` por encima de `floor` (magnitud absoluta), con la
 * frecuencia afinada por interpolación parabólica.
 */
export function peaks(spec: Spectrum, fromHz: number, toHz: number, floor: number): Peak[] {
  const { magnitude, binHz } = spec;
  const out: Peak[] = [];
  const first = Math.max(1, Math.floor(fromHz / binHz));
  const last = Math.min(magnitude.length - 2, Math.ceil(toHz / binHz));
  for (let k = first; k <= last; k++) {
    const m = magnitude[k]!;
    if (m < floor || m < magnitude[k - 1]! || m < magnitude[k + 1]!) continue;
    const a = magnitude[k - 1]!;
    const c = magnitude[k + 1]!;
    const shift = (a - c) / (2 * (a - 2 * m + c) || 1);
    out.push({ hz: (k + shift) * binHz, magnitude: m });
  }
  return out;
}

/** Nota MIDI (con decimales) de una frecuencia. */
export const frequencyToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
