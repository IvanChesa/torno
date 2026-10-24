import { describe, expect, it } from 'vitest';
import { LIMITER_CEILING } from './constants';
import { Limiter, LIMITER_KNEE } from './limiter';
import { seededRandom } from './test-harness';

const RATE = 48_000;
const BLOCK = 128;

/** Pasa `inL`/`inR` por el limitador en bloques y devuelve la salida. */
function run(limiter: Limiter, inL: Float32Array, inR: Float32Array) {
  const outL = new Float32Array(inL.length);
  const outR = new Float32Array(inR.length);
  for (let done = 0; done < inL.length; done += BLOCK) {
    const n = Math.min(BLOCK, inL.length - done);
    limiter.processInto(
      inL.subarray(done, done + n),
      inR.subarray(done, done + n),
      outL,
      outR,
      done,
      n,
    );
  }
  return { outL, outR };
}

const ceiling32 = Math.fround(LIMITER_CEILING);

describe('Limiter', () => {
  it('tiene 1 ms de anticipación y por debajo del codo es transparente al bit (solo retrasa)', () => {
    const limiter = new Limiter(RATE);
    expect(limiter.lookahead).toBe(48);
    const random = seededRandom(1);
    const inL = Float32Array.from({ length: RATE }, () => (random() * 2 - 1) * 0.9 * LIMITER_KNEE);
    const inR = Float32Array.from({ length: RATE }, () => (random() * 2 - 1) * 0.9 * LIMITER_KNEE);
    const { outL, outR } = run(limiter, inL, inR);
    for (let n = 48; n < RATE; n++) {
      expect(outL[n]).toBe(inL[n - 48]);
      expect(outR[n]).toBe(inR[n - 48]);
    }
    expect(limiter.minGain).toBe(1);
  });

  it('nunca supera −0,3 dBFS con 4 capas a tope en fase (suma de 2,8 veces el máximo)', () => {
    const limiter = new Limiter(RATE);
    const frames = 2 * RATE;
    const inL = new Float32Array(frames);
    const inR = new Float32Array(frames);
    for (let n = 0; n < frames; n++) {
      // 4 capas centradas (×0,707 por canal) de senos a tope y en fase, con graves y agudos.
      const s =
        Math.sin((2 * Math.PI * 55 * n) / RATE) * 0.5 +
        Math.sin((2 * Math.PI * 3520 * n) / RATE) * 0.5;
      inL[n] = 4 * Math.SQRT1_2 * s;
      inR[n] = 4 * Math.SQRT1_2 * s;
    }
    const { outL, outR } = run(limiter, inL, inR);
    let peak = 0;
    for (let n = 0; n < frames; n++) peak = Math.max(peak, Math.abs(outL[n]!), Math.abs(outR[n]!));
    expect(peak).toBeLessThanOrEqual(ceiling32);
    // Limita de verdad (no silencia): la salida llega cerca del techo.
    expect(peak).toBeGreaterThan(0.9 * LIMITER_CEILING);
    expect(limiter.minGain).toBeLessThan(0.4);
  });

  it('con ruido a +12 dB tampoco lo supera, y al acabar vuelve a ganancia 1 exacta', () => {
    const limiter = new Limiter(RATE);
    const random = seededRandom(7);
    const frames = 3 * RATE;
    const inL = new Float32Array(frames);
    const inR = new Float32Array(frames);
    for (let n = 0; n < RATE; n++) {
      inL[n] = (random() * 2 - 1) * 4;
      inR[n] = (random() * 2 - 1) * 4;
    }
    for (let n = RATE; n < frames; n++) inL[n] = inR[n] = 0.25 * Math.sin(n / 10);
    const { outL, outR } = run(limiter, inL, inR);
    let peak = 0;
    for (let n = 0; n < frames; n++) peak = Math.max(peak, Math.abs(outL[n]!), Math.abs(outR[n]!));
    expect(peak).toBeLessThanOrEqual(ceiling32);
    // 2 s después, la recuperación (80 ms) ha terminado: vuelve a ser transparente al bit.
    for (let n = frames - 1000; n < frames; n++) expect(outL[n]).toBe(inL[n - 48]);
  });

  it('el ataque no tiene escalones: la ganancia baja a lo largo de la anticipación', () => {
    const limiter = new Limiter(RATE);
    const frames = 4096;
    const inL = new Float32Array(frames);
    const inR = new Float32Array(frames);
    // Silencio y de golpe una constante el doble del techo: la ganancia baja suave, sin saltos.
    for (let n = 1000; n < frames; n++) inL[n] = inR[n] = 2;
    const { outL } = run(limiter, inL, inR);
    let jump = 0;
    for (let n = 1049; n < frames; n++) jump = Math.max(jump, Math.abs(outL[n]! - outL[n - 1]!));
    expect(jump).toBeLessThan(0.05);
    expect(Math.abs(outL[frames - 1]! - LIMITER_CEILING)).toBeLessThan(0.02);
  });

  it('un NaN sale como silencio y no estropea lo que viene después', () => {
    const limiter = new Limiter(RATE);
    const inL = new Float32Array(1024).fill(0.1);
    const inR = new Float32Array(1024).fill(0.1);
    inL[10] = Number.NaN;
    inR[20] = Number.POSITIVE_INFINITY;
    const { outL, outR } = run(limiter, inL, inR);
    for (let n = 0; n < 1024; n++) {
      expect(Number.isFinite(outL[n])).toBe(true);
      expect(Number.isFinite(outR[n])).toBe(true);
    }
    expect(outL[1023]).toBeCloseTo(0.1, 6);
    limiter.reset();
    expect(limiter.minGain).toBe(1);
  });
});
