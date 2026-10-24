import { describe, expect, it } from 'vitest';
import { barAtOrAfter, clampBpm, nextBarAfter, Transport } from './transport';

const RATES = [44_100, 48_000, 96_000];
const TEMPOS = [40, 90, 97, 133.3, 240];

describe('Transport', () => {
  it('cuenta pulsos con la fórmula por tramos', () => {
    const transport = new Transport(48_000, 90);
    transport.advance(32_000);
    expect(transport.beat).toBe(1);
    expect(transport.framesPerBeat).toBe(32_000);
  });

  it.each(RATES)('a %i Hz, frameAtBeat da la primera muestra exacta de cada pulso', (rate) => {
    for (const bpm of TEMPOS) {
      const transport = new Transport(rate, bpm);
      transport.advance(12_345);
      for (const target of [7, 8, 12.5, 100, 1003]) {
        const f = transport.frameAtBeat(target);
        expect(transport.beatAt(f)).toBeGreaterThanOrEqual(target);
        expect(transport.beatAt(f - 1)).toBeLessThan(target);
      }
    }
  });

  it('frameAtBeat de un pulso ya pasado es la muestra actual', () => {
    const transport = new Transport(48_000, 90);
    transport.advance(100_000);
    expect(transport.frameAtBeat(1)).toBe(100_000);
  });

  it('cambiar de tempo no mueve la posición y cambia la velocidad', () => {
    const transport = new Transport(48_000, 90);
    transport.advance(48_000);
    const before = transport.beat;
    transport.setTempo(180);
    expect(transport.beat).toBe(before);
    transport.advance(48_000);
    expect(transport.beat).toBeCloseTo(before + 3, 12);
  });

  it('deriva 0 en 10 minutos: el pulso no acumula error, avance a avance', () => {
    for (const rate of RATES) {
      for (const bpm of TEMPOS) {
        const transport = new Transport(rate, bpm);
        const frames = 10 * 60 * rate;
        for (let done = 0; done < frames; done += 128) transport.advance(128);
        const exact = (transport.frame * bpm) / 60 / rate;
        // Mismo valor que la fórmula cerrada: el error es solo el redondeo de un producto.
        expect(Math.abs(transport.beat - exact)).toBeLessThan(1e-9);
      }
    }
  });

  it('locate, rewind y redefine abren un tramo nuevo', () => {
    const transport = new Transport(48_000, 90);
    transport.advance(1000);
    transport.locate(16);
    expect(transport.beat).toBe(16);
    transport.rewind();
    expect(transport.frame).toBe(0);
    expect(transport.beat).toBe(0);
    transport.advance(5000);
    transport.redefine(1000, 0, 120);
    expect(transport.bpm).toBe(120);
    expect(transport.beat).toBeCloseTo((4000 * 120) / 60 / 48_000, 12);
  });

  it('el tempo se queda en 40–240 BPM', () => {
    expect(clampBpm(10)).toBe(40);
    expect(clampBpm(400)).toBe(240);
    expect(new Transport(48_000, 1000).bpm).toBe(240);
    expect(() => new Transport(0)).toThrow(RangeError);
  });

  it('límites de compás', () => {
    expect(nextBarAfter(0)).toBe(4);
    expect(nextBarAfter(3.99)).toBe(4);
    expect(nextBarAfter(4)).toBe(8);
    expect(barAtOrAfter(4)).toBe(4);
    expect(barAtOrAfter(4.01)).toBe(8);
    expect(barAtOrAfter(0)).toBe(0);
  });
});
