/**
 * Calibración de la latencia de ida y vuelta (PLAN §4.4, «Latencia»): con el transporte parado,
 * suenan clics en muestras conocidas, se graba la entrada sin tocar y se mide cuánto tarda cada clic
 * en volver por el micrófono.
 *
 * - `CalibrationRun` vive en el núcleo: se crea en el manejador del comando (aquí sí se reserva) y
 *   en `process()` solo copia la entrada y dice cuándo suena cada clic.
 * - `measureLatency` corre en el hilo principal con la grabación: busca el ataque de cada clic y da
 *   la mediana del desfase si los clics coinciden entre sí.
 */
import { clickTable, NORMAL_CLICK } from './metronome';
import { PROTOCOL_VERSION, type CalibrationEvent } from './protocol';

/** Clics de la calibración. */
export const CALIBRATION_CLICKS = 8;
/** Separación entre clics: también es la latencia máxima que se puede medir. */
export const CALIBRATION_INTERVAL_SECONDS = 0.5;
/** Silencio antes del primer clic: el ruido de fondo se mide ahí. */
export const CALIBRATION_LEAD_SECONDS = 0.3;
/** Clics que tienen que coincidir con la mediana (±1 ms) para dar la medida por buena. */
export const CALIBRATION_MIN_CONSISTENT = 6;
/** El ataque se fecha donde la señal llega a esta fracción del pico de su ventana. */
const ONSET_FRACTION = 0.3;
/** Un clic cuenta si su pico supera este múltiplo del ruido de fondo (y un mínimo absoluto). */
const SNR = 8;
const MIN_PEAK = 0.003;

/** Una calibración en curso: la grabación y los clics, reservados al empezar. */
export class CalibrationRun {
  readonly event: CalibrationEvent;
  /** Muestras grabadas hasta ahora. */
  frame = 0;
  /** Siguiente clic por sonar. */
  nextClick = 0;
  readonly #pcm: Float32Array;
  readonly #clicks: readonly number[];

  constructor(sampleRate: number) {
    const interval = Math.round(CALIBRATION_INTERVAL_SECONDS * sampleRate);
    const lead = Math.round(CALIBRATION_LEAD_SECONDS * sampleRate);
    const clicks: number[] = [];
    for (let i = 0; i < CALIBRATION_CLICKS; i++) clicks.push(lead + i * interval);
    this.#pcm = new Float32Array(lead + CALIBRATION_CLICKS * interval);
    this.#clicks = clicks;
    this.event = {
      v: PROTOCOL_VERSION,
      type: 'calibration',
      sampleRate,
      pcm: this.#pcm,
      clickFrames: clicks,
    };
  }

  get done(): boolean {
    return this.frame >= this.#pcm.length;
  }

  /** Muestra de la grabación en la que empieza el siguiente clic (o −1 si ya no quedan). */
  get nextClickFrame(): number {
    return this.nextClick < this.#clicks.length ? this.#clicks[this.nextClick]! : -1;
  }

  /** Copia `frames` muestras de la entrada (o silencio) desde `offset`. */
  record(input: Float32Array | null, offset: number, frames: number): void {
    const pcm = this.#pcm;
    let at = this.frame;
    for (let i = 0; i < frames && at < pcm.length; i++, at++) {
      pcm[at] = input ? input[offset + i]! : 0;
    }
    this.frame = at;
  }
}

export interface LatencyMeasurement {
  /** Latencia de ida y vuelta: la mediana de los clics detectados, en muestras. */
  readonly latencyFrames: number;
  /** Clics detectados por encima del ruido. */
  readonly detected: number;
  /** Clics a ±1 ms de la mediana. */
  readonly consistent: number;
  /** Desfase de cada clic (`NaN` si no se detectó). */
  readonly perClick: readonly number[];
}

/** Muestra en la que `signal[from..to)` llega a `ONSET_FRACTION` de su pico, o −1 si no hay señal. */
function onsetIn(signal: Float32Array, from: number, to: number, floor: number): number {
  let peak = 0;
  for (let i = from; i < to; i++) {
    const a = Math.abs(signal[i]!);
    if (a > peak) peak = a;
  }
  if (peak < floor) return -1;
  const threshold = ONSET_FRACTION * peak;
  for (let i = from; i < to; i++) if (Math.abs(signal[i]!) >= threshold) return i;
  return -1;
}

/**
 * Mide la latencia con la grabación de una calibración. Devuelve `null` si menos de
 * `CALIBRATION_MIN_CONSISTENT` clics coinciden con la mediana (±1 ms): ruido, el micrófono no oye
 * los altavoces o la latencia pasa del intervalo entre clics.
 */
export function measureLatency(
  pcm: Float32Array,
  clickFrames: readonly number[],
  sampleRate: number,
): LatencyMeasurement | null {
  // El ataque del clic de referencia, medido igual que el grabado: así se restan los dos.
  const reference = clickTable(sampleRate, NORMAL_CLICK.frequency, NORMAL_CLICK.gain);
  const referenceOnset = onsetIn(reference, 0, reference.length, 0);
  const interval = Math.round(CALIBRATION_INTERVAL_SECONDS * sampleRate);
  // Ruido de fondo: RMS del silencio antes del primer clic.
  const lead = Math.min(clickFrames[0] ?? 0, pcm.length);
  let sum = 0;
  for (let i = 0; i < lead; i++) sum += pcm[i]! * pcm[i]!;
  const noise = lead > 0 ? Math.sqrt(sum / lead) : 0;
  const floor = Math.max(SNR * noise, MIN_PEAK);

  const perClick: number[] = [];
  const found: number[] = [];
  for (const click of clickFrames) {
    const onset = onsetIn(pcm, click, Math.min(pcm.length, click + interval), floor);
    const latency = onset < 0 ? Number.NaN : onset - click - referenceOnset;
    perClick.push(latency);
    if (onset >= 0) found.push(latency);
  }
  if (found.length === 0) return null;
  const sorted = [...found].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  const median =
    sorted.length % 2 === 1
      ? sorted[middle]!
      : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
  const tolerance = sampleRate / 1000;
  const consistent = found.filter((latency) => Math.abs(latency - median) <= tolerance).length;
  if (consistent < CALIBRATION_MIN_CONSISTENT) return null;
  return { latencyFrames: Math.max(0, median), detected: found.length, consistent, perClick };
}
