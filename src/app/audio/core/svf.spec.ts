import { describe, expect, it } from 'vitest';
import { FILTER_CLOSED_HZ, FILTER_OPEN_HZ } from './constants';
import { cutoffForAmount, LowpassSvf } from './svf';

/** Ganancia en régimen permanente del filtro para un seno de `f` Hz (en dB). */
function gainDb(rate: number, cutoff: number, f: number): number {
  const filter = new LowpassSvf(rate);
  filter.setCutoff(cutoff);
  const frames = Math.max(rate / 2, Math.round((40 * rate) / f));
  const buffer = new Float32Array(frames);
  for (let n = 0; n < frames; n++) buffer[n] = Math.sin((2 * Math.PI * f * n) / rate);
  filter.processInPlace(buffer, 0, frames);
  // RMS de la segunda mitad (sin el transitorio) frente a 1/√2.
  let sum = 0;
  const from = frames >> 1;
  for (let n = from; n < frames; n++) sum += buffer[n]! * buffer[n]!;
  return 20 * Math.log10(Math.sqrt(sum / (frames - from)) / Math.SQRT1_2);
}

/** Frecuencia en la que la respuesta cae −3,01 dB (bisección en escala logarítmica). */
function minus3dbFrequency(rate: number, cutoff: number): number {
  let low = cutoff / 2;
  let high = Math.min(cutoff * 2, rate * 0.49);
  for (let i = 0; i < 30; i++) {
    const mid = Math.sqrt(low * high);
    if (gainDb(rate, cutoff, mid) > -3.0103) low = mid;
    else high = mid;
  }
  return Math.sqrt(low * high);
}

describe('LowpassSvf', () => {
  it.each([44_100, 48_000])('a %i Hz cae −3 dB en la frecuencia de corte (±10 %)', (rate) => {
    for (const cutoff of [150, 400, 1000, 5000, 15_000]) {
      const measured = minus3dbFrequency(rate, cutoff);
      expect(Math.abs(measured / cutoff - 1)).toBeLessThan(0.1);
    }
  });

  it('deja pasar los graves (0 dB) y corta los agudos (12 dB por octava)', () => {
    expect(Math.abs(gainDb(48_000, 1000, 50))).toBeLessThan(0.05);
    // Dos octavas por encima del corte: un paso bajo de 2 polos cae ~24 dB.
    expect(gainDb(48_000, 1000, 4000)).toBeLessThan(-22);
  });

  it('settle(x) arranca en reposo: una entrada constante sale constante, sin transitorio', () => {
    const filter = new LowpassSvf(48_000);
    filter.setCutoff(300);
    filter.settle(0.5);
    const buffer = new Float32Array(256).fill(0.5);
    filter.processInPlace(buffer, 0, buffer.length);
    for (const y of buffer) expect(y).toBeCloseTo(0.5, 9);
  });

  it('es estable aunque el corte cambie en cada muestra', () => {
    const filter = new LowpassSvf(48_000);
    let peak = 0;
    for (let n = 0; n < 48_000; n++) {
      filter.setCutoff(150 + 17_000 * (0.5 + 0.5 * Math.sin(n / 200)));
      peak = Math.max(peak, Math.abs(filter.tick(n % 2 === 0 ? 1 : -1)));
    }
    expect(peak).toBeLessThan(2);
  });

  it('tick y processInPlace dan lo mismo; sanitize limpia un estado no finito', () => {
    const a = new LowpassSvf(48_000);
    const b = new LowpassSvf(48_000);
    a.setCutoff(2000);
    b.setCutoff(2000);
    const buffer = Float32Array.from({ length: 64 }, (_, n) => Math.sin(n / 3));
    const ticked = buffer.map((x) => a.tick(x));
    b.processInPlace(buffer, 0, buffer.length);
    expect([...buffer]).toEqual([...ticked]);
    a.tick(Number.NaN);
    a.sanitize();
    expect(a.tick(0)).toBe(0);
  });
});

describe('cutoffForAmount', () => {
  it('va de 18 kHz a 150 Hz en escala exponencial', () => {
    expect(cutoffForAmount(0, 48_000)).toBeCloseTo(FILTER_OPEN_HZ, 6);
    expect(cutoffForAmount(1, 48_000)).toBeCloseTo(FILTER_CLOSED_HZ, 6);
    expect(cutoffForAmount(0.5, 48_000)).toBeCloseTo(
      Math.sqrt(FILTER_OPEN_HZ * FILTER_CLOSED_HZ),
      6,
    );
  });

  it('nunca pasa del 45 % de la frecuencia de muestreo', () => {
    expect(cutoffForAmount(0, 32_000)).toBe(0.45 * 32_000);
  });
});
