/**
 * Batería sintética (PLAN fase 3): cada golpe es una función que devuelve su sonido entero (de
 * amplitud ≈ 1). Todo sale de osciladores, ruido con semilla, filtros y envolventes.
 */
import { applyEnvelope, percussive } from './envelope';
import { filter } from './filter';
import { oscillator, sweep } from './oscillators';
import { noise, type Random } from './random';
import { saturate } from './effects';

const frames = (seconds: number, sampleRate: number) =>
  Math.max(1, Math.round(seconds * sampleRate));

function noiseBuffer(length: number, random: Random): Float64Array {
  const out = new Float64Array(length);
  for (let i = 0; i < length; i++) out[i] = noise(random);
  return out;
}

export interface KickOptions {
  /** Frecuencia al golpear y al final del barrido, en Hz. */
  readonly from: number;
  readonly to: number;
  /** Constante de tiempo del barrido de tono. */
  readonly sweep: number;
  /** Constante de tiempo de la caída. */
  readonly decay: number;
  /** Duración total, en segundos. */
  readonly length: number;
  /** Nivel del chasquido del ataque (0–1). */
  readonly click: number;
  /** Saturación (1 = poca). */
  readonly drive: number;
}

/** Bombo: seno con barrido de tono, chasquido de ruido filtrado y algo de saturación. */
export function kick(sampleRate: number, random: Random, options: KickOptions): Float64Array {
  const length = frames(options.length, sampleRate);
  const pitch = sweep(length, sampleRate, options.from, options.to, options.sweep);
  const body = oscillator('sine', length, sampleRate, pitch, { phase: 0.25 });
  applyEnvelope(body, percussive(0.001, options.decay, options.length, sampleRate));
  const clickLength = frames(0.006, sampleRate);
  const click = filter(noiseBuffer(clickLength, random), sampleRate, 'highpass', 1500);
  applyEnvelope(click, percussive(0.0003, 0.0015, 0.006, sampleRate));
  for (let i = 0; i < clickLength; i++) body[i] = body[i]! + options.click * click[i]!;
  return saturate(body, options.drive);
}

export interface SnareOptions {
  /** Tono del cuerpo, en Hz. */
  readonly tone: number;
  /** Constante de tiempo del cuerpo y del ruido. */
  readonly bodyDecay: number;
  readonly noiseDecay: number;
  /** Proporción de ruido (0–1). */
  readonly snappy: number;
  readonly length: number;
}

/** Caja: dos tonos que caen un poco al golpear y ruido filtrado (la bordonera). */
export function snare(sampleRate: number, random: Random, options: SnareOptions): Float64Array {
  const length = frames(options.length, sampleRate);
  const pitch = sweep(length, sampleRate, options.tone * 1.35, options.tone, 0.012);
  const body = oscillator('sine', length, sampleRate, pitch);
  const overtone = oscillator(
    'triangle',
    length,
    sampleRate,
    sweep(length, sampleRate, options.tone * 2.3, options.tone * 1.72, 0.01),
  );
  applyEnvelope(body, percussive(0.0008, options.bodyDecay, options.length, sampleRate));
  applyEnvelope(overtone, percussive(0.0008, options.bodyDecay * 0.55, options.length, sampleRate));
  const rattle = filter(noiseBuffer(length, random), sampleRate, 'highpass', 1400, 0.8);
  filter(rattle, sampleRate, 'lowpass', 9000);
  applyEnvelope(rattle, percussive(0.0015, options.noiseDecay, options.length, sampleRate));
  const out = new Float64Array(length);
  const tone = 1 - options.snappy;
  for (let i = 0; i < length; i++) {
    out[i] = tone * (body[i]! + 0.45 * overtone[i]!) + options.snappy * 1.6 * rattle[i]!;
  }
  return out;
}

/** Proporciones de los seis osciladores cuadrados del charles (un racimo inarmónico). */
const METAL_HZ = [263, 389, 471, 667, 690, 1023];

export interface HatOptions {
  /** Constante de tiempo de la caída (cerrado ≈ 0,02; abierto ≈ 0,15). */
  readonly decay: number;
  readonly length: number;
  /** Brillo: frecuencia central del paso banda, en Hz. */
  readonly tone: number;
}

/** Charles: seis cuadradas inarmónicas y ruido, por un paso banda y un paso alto. */
export function hat(sampleRate: number, random: Random, options: HatOptions): Float64Array {
  const length = frames(options.length, sampleRate);
  const out = new Float64Array(length);
  for (const hz of METAL_HZ) {
    const square = oscillator('square', length, sampleRate, hz, { phase: random() });
    for (let i = 0; i < length; i++) out[i] = out[i]! + square[i]! / METAL_HZ.length;
  }
  for (let i = 0; i < length; i++) out[i] = 0.7 * out[i]! + 0.45 * noise(random);
  filter(out, sampleRate, 'bandpass', options.tone, 1.1);
  filter(out, sampleRate, 'highpass', options.tone * 0.7);
  return applyEnvelope(out, percussive(0.0005, options.decay, options.length, sampleRate));
}

/** Palmas: tres golpes de ruido muy seguidos y una cola corta, por un paso banda. */
export function clap(sampleRate: number, random: Random): Float64Array {
  const seconds = 0.32;
  const length = frames(seconds, sampleRate);
  const raw = noiseBuffer(length, random);
  const envelope = new Float64Array(length);
  for (const [start, decay, gain] of [
    [0, 0.004, 1],
    [0.011, 0.004, 0.9],
    [0.022, 0.005, 0.85],
    [0.031, 0.065, 0.8],
  ] as const) {
    const hit = percussive(0.0004, decay, seconds - start, sampleRate);
    const offset = frames(start, sampleRate);
    for (let i = 0; i < hit.length && offset + i < length; i++) {
      envelope[offset + i] = Math.max(envelope[offset + i]!, gain * hit[i]!);
    }
  }
  filter(raw, sampleRate, 'bandpass', 1250, 1.4);
  filter(raw, sampleRate, 'highpass', 600);
  return applyEnvelope(raw, envelope);
}

/** Aro: un golpe seco y agudo (dos tonos y un chasquido). */
export function rim(sampleRate: number, random: Random): Float64Array {
  const seconds = 0.08;
  const length = frames(seconds, sampleRate);
  const high = oscillator('triangle', length, sampleRate, 1720);
  const low = oscillator('sine', length, sampleRate, 505);
  const click = filter(noiseBuffer(length, random), sampleRate, 'bandpass', 3200, 2);
  const out = new Float64Array(length);
  for (let i = 0; i < length; i++) out[i] = 0.5 * high[i]! + 0.6 * low[i]! + 0.8 * click[i]!;
  return applyEnvelope(out, percussive(0.0003, 0.011, seconds, sampleRate));
}

/** Tom afinado en `hz`: seno que cae un poco al golpear, con un toque de ruido. */
export function tom(sampleRate: number, random: Random, hz: number): Float64Array {
  const seconds = 0.5;
  const length = frames(seconds, sampleRate);
  const body = oscillator(
    'sine',
    length,
    sampleRate,
    sweep(length, sampleRate, hz * 1.5, hz, 0.025),
  );
  const skin = filter(noiseBuffer(length, random), sampleRate, 'bandpass', hz * 4, 1);
  applyEnvelope(skin, percussive(0.0005, 0.012, seconds, sampleRate));
  applyEnvelope(body, percussive(0.001, 0.16, seconds, sampleRate));
  for (let i = 0; i < length; i++) body[i] = body[i]! + 0.25 * skin[i]!;
  return saturate(body, 1.4);
}

/** Maraca: ruido agudo con un ataque suave. */
export function shaker(sampleRate: number, random: Random): Float64Array {
  const seconds = 0.12;
  const length = frames(seconds, sampleRate);
  const out = filter(noiseBuffer(length, random), sampleRate, 'bandpass', 6800, 1.3);
  filter(out, sampleRate, 'highpass', 3500);
  return applyEnvelope(out, percussive(0.008, 0.022, seconds, sampleRate));
}
