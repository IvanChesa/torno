/**
 * Clics del metrónomo y de la cuenta previa (PLAN §4.4). Se sintetizan una vez, en tablas, y suenan
 * desde la muestra exacta del pulso. Van solo a la salida en directo: nunca se graban ni se exportan.
 */

const CLICK_SECONDS = 0.06;
const ATTACK_SECONDS = 0.001;
const DECAY_SECONDS = 0.012;
const TAIL_SECONDS = 0.005;
/** Primer pulso del compás: más agudo y algo más fuerte. */
const ACCENT = { frequency: 1760, gain: 0.3 } as const;
const NORMAL = { frequency: 1320, gain: 0.22 } as const;

/** Un clic: seno con ataque de coseno alzado, caída exponencial y final en 0 exacto. */
export function renderClickTable(
  sampleRate: number,
  frequency: number,
  gain: number,
): Float32Array {
  const length = Math.round(CLICK_SECONDS * sampleRate);
  const attack = Math.max(1, Math.round(ATTACK_SECONDS * sampleRate));
  const tail = Math.max(1, Math.round(TAIL_SECONDS * sampleRate));
  const table = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const t = n / sampleRate;
    let envelope = Math.exp(-t / DECAY_SECONDS);
    if (n < attack) envelope *= 0.5 - 0.5 * Math.cos((Math.PI * n) / attack);
    const fromEnd = length - 1 - n;
    if (fromEnd < tail) envelope *= 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / tail);
    table[n] = gain * envelope * Math.sin(2 * Math.PI * frequency * t);
  }
  return table;
}

export class Metronome {
  private readonly accent: Float32Array;
  private readonly normal: Float32Array;
  private table: Float32Array;
  /** Muestra del clic que suena a continuación (≥ longitud: no suena nada). */
  private position: number;
  /** Muestras que faltan, desde el principio del próximo tramo, para que empiece el clic. */
  private delay = 0;

  constructor(sampleRate: number) {
    this.accent = renderClickTable(sampleRate, ACCENT.frequency, ACCENT.gain);
    this.normal = renderClickTable(sampleRate, NORMAL.frequency, NORMAL.gain);
    this.table = this.normal;
    this.position = this.normal.length;
  }

  get active(): boolean {
    return this.position < this.table.length;
  }

  /** Programa un clic que empieza `delay` muestras después del principio del próximo tramo. */
  trigger(accent: boolean, delay: number): void {
    this.table = accent ? this.accent : this.normal;
    this.position = 0;
    this.delay = delay;
  }

  /** Calla el clic que esté sonando. */
  stop(): void {
    this.position = this.table.length;
  }

  /** Suma el clic a las dos salidas en las `frames` primeras muestras. */
  renderAdd(outL: Float32Array, outR: Float32Array, frames: number): void {
    const table = this.table;
    const length = table.length;
    let position = this.position;
    if (position >= length) return;
    const start = this.delay < frames ? this.delay : frames;
    this.delay -= start;
    for (let i = start; i < frames && position < length; i++) {
      const sample = table[position++]!;
      outL[i] = outL[i]! + sample;
      outR[i] = outR[i]! + sample;
    }
    this.position = position;
  }
}
