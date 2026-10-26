/**
 * Efectos y acabado de los bucles: eco con realimentación amortiguada (calculado en bucle, sin
 * junta), saturación suave, continua fuera y nivel por papel (RMS objetivo con techo de pico).
 */
import { processLooped } from './loop-buffer';

export interface EchoOptions {
  /** Retardo en segundos. */
  readonly delay: number;
  /** Realimentación (0–0,9). */
  readonly feedback: number;
  /** Proporción del eco en la salida. */
  readonly mix: number;
  /** Corte del paso bajo de un polo en la realimentación (cada repetición, más oscura), en Hz. */
  readonly damping: number;
}

/**
 * Eco sobre un bucle entero, en bucle: dos vueltas, para que las repeticiones del final entren por
 * el principio igual que sonarían al repetirse. La memoria que queda de antes de la primera vuelta
 * es la realimentación elevada al número de repeticiones en un bucle de 5,3 s: con 0,4 y un retardo
 * de 0,5 s, 0,4¹⁰ ≈ −80 dB.
 */
export function loopEcho(
  loop: Float64Array,
  sampleRate: number,
  options: EchoOptions,
): Float64Array {
  const delay = Math.max(1, Math.round(options.delay * sampleRate));
  const line = new Float64Array(delay);
  const feedback = Math.min(0.9, Math.max(0, options.feedback));
  const lowpass = 1 - Math.exp((-2 * Math.PI * options.damping) / sampleRate);
  let cursor = 0;
  let state = 0;
  return processLooped(
    loop,
    (x) => {
      const wet = line[cursor]!;
      state += lowpass * (wet - state);
      line[cursor] = x + feedback * state;
      cursor = cursor + 1 === delay ? 0 : cursor + 1;
      return x + options.mix * wet;
    },
    2,
  );
}

/**
 * Curva de saturación suave: aproximación de Padé de tanh, x·(27 + x²) / (27 + 9·x²), que llega a
 * ±1 en ±3 con pendiente 0 y se queda ahí. Varias veces más rápida que `Math.tanh`.
 */
export function softClip(x: number): number {
  if (x >= 3) return 1;
  if (x <= -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/** Saturación suave con ganancia `drive`, normalizada para que 1 siga dando 1. */
export function saturate(signal: Float64Array, drive: number): Float64Array {
  const norm = 1 / softClip(drive);
  for (let i = 0; i < signal.length; i++) signal[i] = softClip(drive * signal[i]!) * norm;
  return signal;
}

/** Quita la continua de un bucle (resta la media: en una señal periódica, la deja en 0 exacto). */
export function removeDc(loop: Float64Array): Float64Array {
  let sum = 0;
  // Con índice: `for…of` sobre un array tipado es varias veces más lento en V8.
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < loop.length; i++) sum += loop[i]!;
  const mean = sum / loop.length;
  for (let i = 0; i < loop.length; i++) loop[i] = loop[i]! - mean;
  return loop;
}

export const dbToGain = (db: number) => 10 ** (db / 20);
export const gainToDb = (gain: number) => 20 * Math.log10(gain);

export function rmsOf(signal: Float32Array | Float64Array): number {
  let sum = 0;
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < signal.length; i++) sum += signal[i]! * signal[i]!;
  return Math.sqrt(sum / signal.length);
}

export function peakOf(signal: Float32Array | Float64Array): number {
  let peak = 0;
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < signal.length; i++) peak = Math.max(peak, Math.abs(signal[i]!));
  return peak;
}

/**
 * Lleva el bucle a su nivel: el RMS objetivo, salvo que el pico pasara de `peakDb` (entonces manda
 * el pico). Devuelve el PCM en float32, el formato del núcleo.
 */
export function levelLoop(
  loop: Float64Array,
  rmsDb: number,
  peakDb: number,
): Float32Array<ArrayBuffer> {
  const rms = rmsOf(loop);
  const peak = peakOf(loop);
  const scale = rms > 0 ? Math.min(dbToGain(rmsDb) / rms, dbToGain(peakDb) / peak) : 0;
  const out = new Float32Array(loop.length);
  for (let i = 0; i < loop.length; i++) out[i] = loop[i]! * scale;
  return out;
}
