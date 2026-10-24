// Banco de rendimiento del núcleo (PLAN §5, «CPU del audio»): 4 capas sonando con varispeed,
// filtro y panorama, más el limitador, en bloques de 128 como el worklet. Objetivo: ≥ 100× tiempo
// real en escritorio. La cifra se imprime para el informe.
import { describe, expect, it } from 'vitest';
import { LAYER_COUNT } from './constants';
import { BLOCK, Harness, sineSound } from './test-harness';

const RATE = 48_000;
const SECONDS = 60;

function busyCore(): Harness {
  const harness = new Harness({ sampleRate: RATE });
  for (let layer = 0; layer < LAYER_COUNT; layer++) {
    harness.send({ type: 'set-sound', layer, sound: sineSound(RATE, 101 + 37 * layer, 0.6) });
    harness.send({ type: 'set-filter', layer, amount: 0.3 + 0.1 * layer });
    harness.send({ type: 'set-pan', layer, pan: -0.6 + 0.4 * layer });
  }
  // Un tempo distinto del nativo: la lectura es fraccionaria (Hermite de verdad).
  harness.send({ type: 'set-tempo', bpm: 97 });
  harness.send({ type: 'play' });
  return harness;
}

describe('rendimiento de LoopCore', () => {
  it(`rinde ≥ 100× tiempo real con 4 capas, filtros y limitador (${SECONDS} s a 48 kHz)`, () => {
    const harness = busyCore();
    const core = harness.core;
    const outL = new Float32Array(BLOCK);
    const outR = new Float32Array(BLOCK);
    // Calentamiento: que el JIT compile el bucle antes de medir.
    for (let i = 0; i < RATE / BLOCK; i++) core.process(null, outL, outR, BLOCK);
    const blocks = Math.round((SECONDS * RATE) / BLOCK);
    const start = performance.now();
    for (let i = 0; i < blocks; i++) core.process(null, outL, outR, BLOCK);
    const seconds = (performance.now() - start) / 1000;
    const factor = (blocks * BLOCK) / RATE / seconds;
    console.info(`LoopCore: ${factor.toFixed(0)}× tiempo real (${(seconds * 1000).toFixed(0)} ms)`);
    expect(core.status.layers.every((layer) => layer.hasContent)).toBe(true);
    expect(factor).toBeGreaterThanOrEqual(100);
  });
});
