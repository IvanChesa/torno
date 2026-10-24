/**
 * Primer bloque de la síntesis (fase 0): una nota con unos pocos parciales y caída exponencial.
 * La renderiza el worker de síntesis en la prueba técnica; la colección de bucles llega en la
 * fase 3. Determinista: la misma entrada da los mismos bytes.
 */

/** Frecuencia de una nota MIDI en temperamento igual (La4 = 69 = 440 Hz). */
export function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export interface ToneOptions {
  /** Hz. */
  readonly frequency: number;
  readonly seconds: number;
  /** Pico de la salida, en escala ±1. */
  readonly peak: number;
  /** Amplitud relativa de cada armónico (el primero es la fundamental). */
  readonly partials: readonly number[];
  /** Constante de tiempo de la caída exponencial, en segundos. */
  readonly decaySeconds: number;
  /** Duración de las rampas de entrada y salida, en segundos. */
  readonly rampSeconds: number;
}

/** El tono de la prueba técnica: Re4 (D4), la tónica de la colección (PLAN D8). */
export const PROBE_TONE: ToneOptions = {
  frequency: midiToFrequency(62),
  seconds: 1,
  peak: 0.3,
  partials: [1, 0.4, 0.15],
  decaySeconds: 0.35,
  rampSeconds: 0.005,
};

/** Renderiza el tono a la frecuencia de muestreo indicada. */
export function renderTone(
  sampleRate: number,
  options: ToneOptions = PROBE_TONE,
): Float32Array<ArrayBuffer> {
  const { frequency, seconds, peak, partials, decaySeconds, rampSeconds } = options;
  if (!(sampleRate > 0) || !(seconds > 0) || !(decaySeconds > 0) || !(peak > 0 && peak <= 1)) {
    throw new RangeError('Opciones de tono no válidas');
  }
  const nyquist = sampleRate / 2;
  if (partials.length === 0 || !(frequency > 0) || frequency >= nyquist) {
    throw new RangeError(`Frecuencia fuera de rango: ${frequency}`);
  }

  const length = Math.round(seconds * sampleRate);
  const ramp = Math.max(1, Math.min(Math.round(rampSeconds * sampleRate), length >> 1));
  const out = new Float32Array(length);
  let max = 0;
  for (let n = 0; n < length; n++) {
    const t = n / sampleRate;
    let sample = 0;
    for (let k = 0; k < partials.length; k++) {
      const f = frequency * (k + 1);
      // Los parciales por encima de Nyquist se descartan (sin aliasing).
      if (f < nyquist) sample += (partials[k] ?? 0) * Math.sin(2 * Math.PI * f * t);
    }
    const fromEnd = length - 1 - n;
    const edge = n < fromEnd ? n : fromEnd;
    const fade = edge >= ramp ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * edge) / ramp);
    sample *= Math.exp(-t / decaySeconds) * fade;
    out[n] = sample;
    const abs = Math.abs(sample);
    if (abs > max) max = abs;
  }
  if (max > 0) {
    const scale = peak / max;
    for (let n = 0; n < length; n++) out[n] = (out[n] ?? 0) * scale;
  }
  return out;
}
