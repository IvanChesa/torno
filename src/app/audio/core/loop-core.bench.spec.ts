// Banco de rendimiento del núcleo (PLAN §5, «CPU del audio»): 4 capas sonando con varispeed,
// filtro y panorama, más el limitador, en bloques de 128 como el worklet. Objetivo: ≥ 100× tiempo
// real en escritorio. La cifra se imprime para el informe.
import { describe, expect, it } from 'vitest';
import { LAYER_COUNT } from './constants';
import { COPY_SAMPLES_PER_FRAME, SessionCopy } from './session-copy';
import { BLOCK, Harness, sineSound, exportState } from './test-harness';

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

describe('copia de la sesión mientras suena', () => {
  it('con 4 capas de 60 s, ningún bloque pasa de 2 ms (un bloque dura 2,67) mientras se copia', () => {
    const harness = new Harness({ sampleRate: RATE });
    for (let layer = 0; layer < LAYER_COUNT; layer++) {
      // 60 s a 90 BPM: 90 pulsos (el máximo de una capa).
      const frames = 60 * RATE;
      const pcm = new Float32Array(frames);
      for (let i = 0; i < frames; i++) pcm[i] = Math.sin(i / (10 + layer)) * 0.3;
      harness.send({
        type: 'set-sound',
        layer,
        sound: { id: `capa-${layer}`, pcm, lengthBeats: 90 },
      });
    }
    harness.send({ type: 'play' });
    const core = harness.core;
    const outL = new Float32Array(BLOCK);
    const outR = new Float32Array(BLOCK);
    for (let i = 0; i < RATE / BLOCK; i++) core.process(null, outL, outR, BLOCK);
    // Como en el worklet: el bucle de copia se calienta al crearlo, la copia se reserva en el
    // manejador y cada bloque copia un tramo después de procesar.
    SessionCopy.warmUp();
    const copy = new SessionCopy(1, core.snapshot());
    const times: number[] = [];
    while (!copy.done) {
      const start = performance.now();
      core.process(null, outL, outR, BLOCK);
      copy.pump(BLOCK * COPY_SAMPLES_PER_FRAME);
      times.push(performance.now() - start);
    }
    // De golpe (como antes de la revisión): lo que tardaba el manejador del worklet.
    const startState = performance.now();
    exportState(core);
    const atOnce = performance.now() - startState;
    const sorted = [...times].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
    console.info(
      `Copia de 4 × 60 s: de golpe ${atOnce.toFixed(1)} ms; por tramos, ${times.length} bloques: ` +
        `mediana ${at(0.5).toFixed(3)} ms, p99 ${at(0.99).toFixed(3)} ms, peor ${at(1).toFixed(3)} ms`,
    );
    // El trabajo de la copia por bloque son centésimas de ms; el peor recoge las pausas del
    // recolector y del sistema.
    expect(at(1)).toBeLessThan(2);
  });
});
