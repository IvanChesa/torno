// La forma de onda de una capa para la pantalla (PLAN §0.2): un pico por tramo, normalizado.
import { describe, expect, it } from 'vitest';
import { mixPeak, waveformPeaks } from './waveform';

describe('la forma de onda de una capa', () => {
  it('da el pico de cada tramo, normalizado al de la capa', () => {
    const pcm = new Float32Array(400);
    pcm[50] = -0.5;
    pcm[150] = 0.25;
    pcm[399] = 0.125;
    const peaks = waveformPeaks(pcm, 4);
    expect(Array.from(peaks)).toEqual([1, 0.5, 0, 0.25]);
  });

  it('una capa en silencio se queda en cero, y una más corta que los tramos no se sale', () => {
    expect(Array.from(waveformPeaks(new Float32Array(100), 8))).toEqual(new Array(8).fill(0));
    const short = waveformPeaks(new Float32Array([0.5, -1]), 8);
    expect(short).toHaveLength(8);
    expect(Math.max(...short)).toBe(1);
    expect(Array.from(waveformPeaks(new Float32Array(0), 4))).toEqual([0, 0, 0, 0]);
  });

  it('el pico de la suma de varios bucles (la escucha de la anatomía)', () => {
    const a = new Float32Array([0.5, -0.25, 0.1]);
    const b = new Float32Array([0.4, -0.7]);
    expect(mixPeak([a, b])).toBeCloseTo(0.95, 6);
    expect(mixPeak([new Float32Array(4)])).toBe(1);
    expect(mixPeak([])).toBe(1);
  });
});
