import { describe, expect, it } from 'vitest';
import { BEEP_RAMP_SECONDS, BeepGenerator, secondsToFrames } from './beep';

const RATES = [44_100, 48_000, 96_000];
/** Tamaño de bloque del AudioWorklet (render quantum). */
const BLOCK = 128;

/** Genera `frames` muestras en bloques, como lo llama el worklet. */
function render(beep: BeepGenerator, frames: number, block = BLOCK): Float32Array {
  const out = new Float32Array(frames);
  for (let offset = 0; offset < frames; offset += block) {
    beep.process(out, offset, Math.min(block, frames - offset));
  }
  return out;
}

function beep(sampleRate: number, frequency = 440, seconds = 0.5, gain = 0.25): BeepGenerator {
  const generator = new BeepGenerator(sampleRate);
  generator.start(frequency, seconds, gain);
  return generator;
}

describe('BeepGenerator', () => {
  it.each(RATES)('dura exactamente round(0,5 s × %i) muestras y después calla', (rate) => {
    const generator = beep(rate);
    const length = secondsToFrames(0.5, rate);
    expect(generator.lengthFrames).toBe(length);
    const out = render(generator, length + 4 * BLOCK);
    // La última muestra con sonido es la anterior a la final (la final es 0 por la rampa).
    const lastNonZero = out.findLastIndex((sample) => sample !== 0);
    expect(lastNonZero).toBe(length - 2);
    expect(out.subarray(length).every((sample) => sample === 0)).toBe(true);
    expect(generator.active).toBe(false);
  });

  it.each(RATES)('a %i Hz empieza y acaba en 0 con rampas de 5 ms', (rate) => {
    const length = secondsToFrames(0.5, rate);
    const out = render(beep(rate), length);
    const ramp = secondsToFrames(BEEP_RAMP_SECONDS, rate);
    expect(Math.abs(out[0] ?? 1)).toBe(0); // ±0
    expect(Math.abs(out[length - 1] ?? 1)).toBe(0); // ±0
    // Dentro de la rampa la envolvente es < 1; justo después ya es 1 (pico del seno ≈ ganancia).
    const rampPeak = Math.max(...out.subarray(0, ramp >> 1).map(Math.abs));
    expect(rampPeak).toBeLessThan(0.25 * 0.6);
  });

  it.each(RATES)('a %i Hz tiene la ganancia pedida (pico = 0,25 ± 0,001)', (rate) => {
    const out = render(beep(rate), secondsToFrames(0.5, rate));
    const peak = Math.max(...out.map(Math.abs));
    expect(peak).toBeGreaterThan(0.249);
    expect(peak).toBeLessThanOrEqual(0.25 + 1e-6);
  });

  it.each(RATES)('a %i Hz suena a 440 Hz (ciclos contados por cruces por cero)', (rate) => {
    const length = secondsToFrames(0.5, rate);
    const out = render(beep(rate), length);
    let crossings = 0;
    for (let n = 1; n < length; n++) {
      if ((out[n - 1] ?? 0) <= 0 && (out[n] ?? 0) > 0) crossings++;
    }
    // 440 Hz × 0,5 s = 220 ciclos; ±1 por dónde caen el primero y el último.
    expect(Math.abs(crossings - 220)).toBeLessThanOrEqual(1);
  });

  it.each(RATES)('a %i Hz no hace clics: ningún salto supera al del propio seno', (rate) => {
    const out = render(beep(rate), secondsToFrames(0.5, rate) + BLOCK);
    let maxJump = 0;
    for (let n = 1; n < out.length; n++) {
      maxJump = Math.max(maxJump, Math.abs((out[n] ?? 0) - (out[n - 1] ?? 0)));
    }
    // Máximo salto de un seno de amplitud A: A·2π·f/fs (criterio de §5 con su margen de 0,01).
    const sineJump = 0.25 * 2 * Math.PI * (440 / rate);
    expect(maxJump).toBeLessThanOrEqual(sineJump + 0.01);
  });

  it('da los mismos bytes en bloques de 128, de 1 o de una vez (determinista)', () => {
    const length = secondsToFrames(0.5, 48_000);
    const inBlocks = render(beep(48_000), length);
    const bySample = render(beep(48_000), length, 1);
    const atOnce = render(beep(48_000), length, length);
    expect(Buffer.from(bySample.buffer)).toEqual(Buffer.from(inBlocks.buffer));
    expect(Buffer.from(atOnce.buffer)).toEqual(Buffer.from(inBlocks.buffer));
  });

  it('escribe silencio sin pitido y respeta el desplazamiento', () => {
    const generator = new BeepGenerator(48_000);
    const out = new Float32Array(16).fill(9);
    generator.process(out, 4, 8);
    expect([...out]).toEqual([9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9]);
    expect(generator.active).toBe(false);
  });

  it('un pitido nuevo sustituye al anterior desde la fase 0', () => {
    const generator = beep(48_000);
    render(generator, 1000);
    generator.start(440, 0.5, 0.25);
    const restarted = render(generator, 2000);
    expect(restarted).toEqual(render(beep(48_000), 2000));
  });

  it('stop() lo corta y deja de estar activo', () => {
    const generator = beep(48_000);
    render(generator, 100);
    generator.stop();
    expect(generator.active).toBe(false);
    expect(render(generator, BLOCK).every((sample) => sample === 0)).toBe(true);
  });

  it('un pitido de menos de dos rampas sigue empezando y acabando en 0', () => {
    const generator = beep(48_000, 440, 0.004);
    const length = generator.lengthFrames;
    const out = render(generator, length);
    expect(Math.abs(out[0] ?? 1)).toBe(0); // ±0
    expect(Math.abs(out[length - 1] ?? 1)).toBe(0); // ±0
    expect(Math.max(...out.map(Math.abs))).toBeGreaterThan(0);
  });

  it('rechaza parámetros fuera de rango', () => {
    expect(() => new BeepGenerator(0)).toThrow(RangeError);
    const generator = new BeepGenerator(48_000);
    expect(() => generator.start(0, 0.5, 0.25)).toThrow(RangeError);
    expect(() => generator.start(24_000, 0.5, 0.25)).toThrow(RangeError);
    expect(() => generator.start(440, 0, 0.25)).toThrow(RangeError);
    expect(() => generator.start(440, 0.5, 1.5)).toThrow(RangeError);
    expect(() => generator.start(440, Number.NaN, 0.25)).toThrow(RangeError);
  });

  it('secondsToFrames redondea a la muestra más cercana', () => {
    expect(secondsToFrames(0.5, 44_100)).toBe(22_050);
    expect(secondsToFrames(1 / 3, 48_000)).toBe(16_000);
    expect(secondsToFrames(0.005, 44_100)).toBe(221);
  });
});
