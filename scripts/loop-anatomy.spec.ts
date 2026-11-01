// Las formas de onda de «Anatomía de un bucle» (scripts/loop-anatomy.mjs) siguen siendo las de la
// síntesis: si cambia un sonido, este test pide generarlas otra vez.
import { describe, expect, it } from 'vitest';
import { waveformPeaks } from '../src/app/audio/core/waveform';
import { renderLibraryLoop } from '../src/app/audio/synth/library';
import { LOOP_ANATOMY_WAVES } from '../src/app/features/product/loop-anatomy.data';

describe('las formas de onda de la anatomía de un bucle', () => {
  it('son las de los sonidos de la biblioteca (node scripts/loop-anatomy.mjs)', () => {
    expect(Object.keys(LOOP_ANATOMY_WAVES)).toEqual(['alfar', 'raiz', 'olivo', 'cierzo']);
    for (const [id, wave] of Object.entries(LOOP_ANATOMY_WAVES)) {
      const peaks = waveformPeaks(renderLibraryLoop(id, 48_000), wave.length);
      expect(wave).toHaveLength(96);
      wave.forEach((peak, i) => expect(peak).toBeCloseTo(peaks[i]!, 2));
    }
  });
});
