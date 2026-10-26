import { describe, expect, it } from 'vitest';
import { libraryLoopFrames, renderTestLoop, TEST_LOOP_PEAK, TEST_SOUND_IDS } from './test-loop';

describe('sonidos de prueba del menú', () => {
  it('hay uno por categoría', () => {
    expect(TEST_SOUND_IDS).toEqual([
      'prueba-bateria',
      'prueba-bajo',
      'prueba-acordes',
      'prueba-textura',
    ]);
  });

  it.each(TEST_SOUND_IDS)('%s: 2 compases exactos a 90 BPM, pico −6 dBFS y sin junta', (id) => {
    for (const rate of [44_100, 48_000]) {
      const pcm = renderTestLoop(id, rate);
      expect(pcm).toHaveLength(libraryLoopFrames(rate));
      expect(libraryLoopFrames(48_000)).toBe(256_000);
      const peak = pcm.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
      expect(peak).toBeCloseTo(TEST_LOOP_PEAK, 6);
      // La vuelta del bucle no salta: la última muestra y la primera están en silencio.
      expect(Math.abs(pcm[pcm.length - 1]!)).toBeLessThan(1e-3);
      expect(Math.abs(pcm[0]!)).toBeLessThan(1e-3);
    }
  });

  it('es determinista y rechaza un sonido desconocido', () => {
    const a = renderTestLoop('prueba-acordes', 48_000);
    const b = renderTestLoop('prueba-acordes', 48_000);
    expect(Buffer.from(b.buffer)).toEqual(Buffer.from(a.buffer));
    expect(() => renderTestLoop('no-existe', 48_000)).toThrow(RangeError);
  });
});
