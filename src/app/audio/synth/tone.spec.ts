import { describe, expect, it } from 'vitest';
import { PROBE_TONE, midiToFrequency, renderTone, type ToneOptions } from './tone';

/** Potencia de `signal` en la frecuencia `f` (algoritmo de Goertzel). */
function goertzel(signal: Float32Array, f: number, sampleRate: number): number {
  const coeff = 2 * Math.cos((2 * Math.PI * f) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (const x of signal) {
    const s0 = x + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

describe('midiToFrequency', () => {
  it('usa temperamento igual con La4 = 440 Hz', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(57)).toBeCloseTo(220, 10);
    expect(midiToFrequency(62)).toBeCloseTo(293.6648, 4); // Re4, la tónica de la colección
  });
});

describe('renderTone', () => {
  it.each([44_100, 48_000])('a %i Hz dura exactamente un segundo', (rate) => {
    expect(renderTone(rate)).toHaveLength(rate);
  });

  it('tiene el pico pedido y empieza y acaba en 0', () => {
    const pcm = renderTone(48_000);
    expect(Math.max(...pcm.map(Math.abs))).toBeCloseTo(PROBE_TONE.peak, 6);
    expect(Math.abs(pcm[0] ?? 1)).toBe(0); // ±0
    expect(Math.abs(pcm[pcm.length - 1] ?? 1)).toBe(0); // ±0
  });

  it('es determinista: dos renders dan los mismos bytes', () => {
    const a = renderTone(48_000);
    const b = renderTone(48_000);
    expect(Buffer.from(b.buffer)).toEqual(Buffer.from(a.buffer));
  });

  it('suena en Re: la fundamental domina y no hay energía entre armónicos', () => {
    const rate = 48_000;
    const pcm = renderTone(rate);
    const f0 = PROBE_TONE.frequency;
    const fundamental = goertzel(pcm, f0, rate);
    expect(fundamental).toBeGreaterThan(100 * goertzel(pcm, f0 * 1.5, rate));
    expect(fundamental).toBeGreaterThan(goertzel(pcm, 2 * f0, rate));
  });

  it('descarta los parciales por encima de Nyquist (sin aliasing)', () => {
    const rate = 8_000;
    const options: ToneOptions = { ...PROBE_TONE, frequency: 3_000, partials: [1, 1] };
    const pcm = renderTone(rate, options);
    // El segundo parcial (6 kHz) se reflejaría en 2 kHz si no se descartara.
    expect(goertzel(pcm, 2_000, rate)).toBeLessThan(1e-3 * goertzel(pcm, 3_000, rate));
  });

  it('rechaza opciones no válidas', () => {
    expect(() => renderTone(0)).toThrow(RangeError);
    expect(() => renderTone(48_000, { ...PROBE_TONE, seconds: 0 })).toThrow(RangeError);
    expect(() => renderTone(48_000, { ...PROBE_TONE, peak: 2 })).toThrow(RangeError);
    expect(() => renderTone(48_000, { ...PROBE_TONE, frequency: 30_000 })).toThrow(RangeError);
    expect(() => renderTone(48_000, { ...PROBE_TONE, partials: [] })).toThrow(RangeError);
  });
});
