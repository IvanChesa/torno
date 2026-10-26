/**
 * Voces con tono: FM de dos operadores (piano eléctrico, campanas, percusión afinada), pad de
 * sierras desafinadas, tres bajos y gotas. Cada función devuelve una nota entera (amplitud ≈ 1),
 * con su relajación, lista para sumarla al bucle.
 */
import { saturate } from './effects';
import { adsr, adsrLength, applyEnvelope, percussive, type Adsr } from './envelope';
import { filter } from './filter';
import { glide, oscillator, SINE_SIZE, SINE_TABLE } from './oscillators';

/** Hz de una nota MIDI con un desafinado en cents. */
export const detuned = (hz: number, cents: number) => hz * 2 ** (cents / 1200);

export interface FmOptions {
  /** Frecuencia del modulador / frecuencia de la portadora. */
  readonly ratio: number;
  /** Índice de modulación al empezar y al final, y su constante de tiempo. */
  readonly index: number;
  readonly indexEnd: number;
  readonly indexDecay: number;
}

/** FM de dos operadores: sen(2π·f·t + I(t)·sen(2π·f·ratio·t)). */
export function fm(
  sampleRate: number,
  length: number,
  hz: number,
  options: FmOptions,
): Float64Array {
  const out = new Float64Array(length);
  const k = Math.exp(-1 / (options.indexDecay * sampleRate));
  // El índice, en ciclos de la portadora (el modulador desplaza su fase).
  const end = options.indexEnd / (2 * Math.PI);
  let index = (options.index - options.indexEnd) / (2 * Math.PI);
  const carrierStep = (hz / sampleRate) * SINE_SIZE;
  const modulatorStep = ((hz * options.ratio) / sampleRate) * SINE_SIZE;
  const table = SINE_TABLE;
  let carrier = 0;
  let modulator = 0;
  for (let i = 0; i < length; i++) {
    // Las dos lecturas de la tabla, en línea (es la ruta más caliente de la síntesis).
    const m = modulator | 0;
    const ma = table[m]!;
    const modulation = ma + (table[m + 1]! - ma) * (modulator - m);
    let x = carrier + (end + index) * modulation * SINE_SIZE;
    while (x < 0) x += SINE_SIZE;
    while (x >= SINE_SIZE) x -= SINE_SIZE;
    const c = x | 0;
    const ca = table[c]!;
    out[i] = ca + (table[c + 1]! - ca) * (x - c);
    index *= k;
    carrier += carrierStep;
    if (carrier >= SINE_SIZE) carrier -= SINE_SIZE;
    modulator += modulatorStep;
    if (modulator >= SINE_SIZE) modulator -= SINE_SIZE;
  }
  return out;
}

const EPIANO: Adsr = { attack: 0.003, decay: 0.9, sustain: 0.35, release: 0.35 };

/**
 * Piano eléctrico cálido: dos FM 1:1 algo desafinadas (cuerpo) y un FM 1:14 muy breve (el golpe
 * metálico de la púa).
 */
export function electricPiano(
  sampleRate: number,
  hz: number,
  gate: number,
  velocity: number,
): Float64Array {
  const length = adsrLength(EPIANO, gate, sampleRate);
  const brightness = 1.2 + 1.3 * velocity;
  const a = fm(sampleRate, length, detuned(hz, -3), {
    ratio: 1,
    index: brightness,
    indexEnd: 0.25,
    indexDecay: 0.45,
  });
  const b = fm(sampleRate, length, detuned(hz, 3), {
    ratio: 1,
    index: brightness,
    indexEnd: 0.2,
    indexDecay: 0.5,
  });
  // El golpe de la púa dura poco: 0,3 s bastan (a −60 dB).
  const tineLength = Math.min(length, Math.round(0.3 * sampleRate));
  const tine = fm(sampleRate, tineLength, hz, {
    ratio: 14,
    index: 0.9 * velocity,
    indexEnd: 0,
    indexDecay: 0.03,
  });
  applyEnvelope(tine, percussive(0.001, 0.05, tineLength / sampleRate, sampleRate));
  const out = new Float64Array(length);
  for (let i = 0; i < length; i++) out[i] = 0.5 * (a[i]! + b[i]!);
  for (let i = 0; i < tineLength; i++) out[i] = out[i]! + 0.12 * tine[i]!;
  return applyEnvelope(out, adsr(EPIANO, gate, sampleRate));
}

/** Campana FM inarmónica (1:3,5) con caída larga. */
export function bell(
  sampleRate: number,
  hz: number,
  seconds: number,
  velocity: number,
): Float64Array {
  const length = Math.round(seconds * sampleRate);
  const out = fm(sampleRate, length, hz, {
    ratio: 3.5,
    index: 1.2 + 2 * velocity,
    indexEnd: 0.05,
    indexDecay: 0.22,
  });
  const body = oscillator('sine', length, sampleRate, hz);
  for (let i = 0; i < length; i++) out[i] = 0.75 * out[i]! + 0.25 * body[i]!;
  return applyEnvelope(out, percussive(0.0015, seconds / 5, seconds, sampleRate));
}

/** Percusión afinada (conga de madera): FM 1:1,5 con índice que cae muy deprisa. */
export function woodTone(sampleRate: number, hz: number): Float64Array {
  const seconds = 0.35;
  const length = Math.round(seconds * sampleRate);
  const out = fm(sampleRate, length, hz, {
    ratio: 1.5,
    index: 2.4,
    indexEnd: 0.1,
    indexDecay: 0.012,
  });
  return applyEnvelope(out, percussive(0.0008, 0.07, seconds, sampleRate));
}

export interface PadOptions {
  readonly envelope: Adsr;
  /** Corte del filtro en reposo y en lo más alto del ataque, en Hz. */
  readonly cutoff: number;
  readonly cutoffPeak: number;
  readonly q: number;
}

/**
 * Pad de un acorde: dos sierras desafinadas (−7 y +6 cents) por nota, y todas juntas por un mismo
 * paso bajo que se abre al atacar (las notas comparten envolvente: filtrar la suma es lo mismo que
 * filtrar cada una, y cuesta una vez). `gains`: el nivel de cada nota.
 */
export function pad(
  sampleRate: number,
  notes: readonly number[],
  gains: readonly number[],
  gate: number,
  options: PadOptions,
): Float64Array {
  const length = adsrLength(options.envelope, gate, sampleRate);
  const out = new Float64Array(length);
  notes.forEach((hz, note) => {
    const gain = (gains[note] ?? 1) / 2;
    for (const [cents, phase] of [
      [-7, 0.13 + 0.17 * note],
      [6, 0.61 + 0.29 * note],
    ] as const) {
      const saw = oscillator('saw', length, sampleRate, detuned(hz, cents), { phase: phase % 1 });
      for (let i = 0; i < length; i++) out[i] = out[i]! + gain * saw[i]!;
    }
  });
  const envelope = adsr(options.envelope, gate, sampleRate);
  const cutoff = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    cutoff[i] = options.cutoff + (options.cutoffPeak - options.cutoff) * envelope[i]!;
  }
  filter(out, sampleRate, 'lowpass', cutoff, options.q);
  return applyEnvelope(out, envelope);
}

const SUB: Adsr = { attack: 0.008, decay: 0.6, sustain: 0.85, release: 0.07 };

/** Sub-bajo: seno con un poco de segundo armónico y saturación (se oye también en altavoces pequeños). */
export function subBass(sampleRate: number, hz: number, gate: number): Float64Array {
  const length = adsrLength(SUB, gate, sampleRate);
  const fundamental = oscillator('sine', length, sampleRate, hz);
  const second = oscillator('sine', length, sampleRate, hz * 2);
  for (let i = 0; i < length; i++) fundamental[i] = fundamental[i]! + 0.18 * second[i]!;
  saturate(fundamental, 1.4);
  return applyEnvelope(fundamental, adsr(SUB, gate, sampleRate));
}

const PLUCK: Adsr = { attack: 0.002, decay: 0.35, sustain: 0.45, release: 0.06 };

/** Bajo pulsado: sierra por un paso bajo resonante con envolvente rápida. */
export function pluckBass(
  sampleRate: number,
  hz: number,
  gate: number,
  velocity: number,
): Float64Array {
  const length = adsrLength(PLUCK, gate, sampleRate);
  const out = oscillator('saw', length, sampleRate, hz);
  // La fundamental de una sierra ascendente es −sen: el seno, en fase con ella (media vuelta), la
  // refuerza en vez de restarle.
  const sub = oscillator('sine', length, sampleRate, hz, { phase: 0.5 });
  const k = Math.exp(-1 / (0.11 * sampleRate));
  const cutoff = new Float64Array(length);
  let open = 900 + 900 * velocity;
  for (let i = 0; i < length; i++) {
    cutoff[i] = 170 + open;
    open *= k;
  }
  filter(out, sampleRate, 'lowpass', cutoff, 1.5);
  for (let i = 0; i < length; i++) out[i] = out[i]! + 0.5 * sub[i]!;
  saturate(out, 1.5);
  return applyEnvelope(out, adsr(PLUCK, gate, sampleRate));
}

const RUBBER: Adsr = { attack: 0.002, decay: 0.12, sustain: 0.6, release: 0.03 };

/** Bajo de goma: pulso estrecho con portamento desde la nota anterior y filtro con golpe. */
export function rubberBass(
  sampleRate: number,
  hz: number,
  fromHz: number,
  gate: number,
  velocity: number,
): Float64Array {
  const length = adsrLength(RUBBER, gate, sampleRate);
  const pitch = glide(length, sampleRate, fromHz, hz, 0.018);
  const out = oscillator('square', length, sampleRate, pitch, { width: 0.32 });
  const sub = oscillator('sine', length, sampleRate, pitch);
  const k = Math.exp(-1 / (0.07 * sampleRate));
  const cutoff = new Float64Array(length);
  let open = 1500 + 1300 * velocity;
  for (let i = 0; i < length; i++) {
    cutoff[i] = 220 + open;
    open *= k;
  }
  filter(out, sampleRate, 'lowpass', cutoff, 2.4);
  for (let i = 0; i < length; i++) out[i] = 0.8 * out[i]! + 0.55 * sub[i]!;
  saturate(out, 2);
  return applyEnvelope(out, adsr(RUBBER, gate, sampleRate));
}

/** Gota de agua: seno que sube de tono deprisa (una burbuja que se cierra) y se apaga. */
export function droplet(sampleRate: number, hz: number): Float64Array {
  const seconds = 0.16;
  const length = Math.round(seconds * sampleRate);
  const pitch = glide(length, sampleRate, hz, hz * 1.7, 0.02);
  const out = oscillator('sine', length, sampleRate, pitch);
  return applyEnvelope(out, percussive(0.0015, 0.035, seconds, sampleRate));
}
