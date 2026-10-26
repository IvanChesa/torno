// Banco de rendimiento del núcleo (PLAN §5, «CPU del audio»): 4 capas sonando con varispeed,
// filtro y panorama, más el limitador, en bloques de 128 como el worklet. Objetivo: ≥ 100× tiempo
// real en un PC sin otra carga. La cifra se imprime para el informe.
//
// Va fuera de `npm test` y de `check` (`npm run test:bench`): mide tiempo de pared y depende de la
// carga del equipo. En el CI, `BENCH_MIN_FACTOR=50` hace de suelo de regresión, y la cota de la
// copia por tramos se multiplica por 3 (revisión del bloque A, #1).
import { describe, expect, it } from 'vitest';
import { LAYER_COUNT } from './constants';
import { COPY_SAMPLES_PER_FRAME, SessionCopy } from './session-copy';
import { BLOCK, Harness, sineSound, exportState } from './test-harness';

const RATE = 48_000;
const SECONDS = 60;
const MIN_FACTOR = Number(process.env['BENCH_MIN_FACTOR'] ?? 100);
const SLACK = process.env['CI'] ? 3 : 1;

/**
 * 4 capas con filtro y panorama. Con 97 BPM sobre bucles de 90, la lectura es fraccionaria (Hermite
 * de verdad); con 240, además pasa por el filtro contra el aliasing (2,67×); y con bucles nativos de
 * 40 BPM leídos a 240 (6×), el peor caso posible del filtro.
 */
function busyCore(bpm = 97, nativeBpm = 90): Harness {
  const harness = new Harness({ sampleRate: RATE });
  for (let layer = 0; layer < LAYER_COUNT; layer++) {
    const sound = sineSound(RATE, 101 + 37 * layer, 0.6, 8, nativeBpm);
    harness.send({ type: 'set-sound', layer, sound });
    harness.send({ type: 'set-filter', layer, amount: 0.3 + 0.1 * layer });
    harness.send({ type: 'set-pan', layer, pan: -0.6 + 0.4 * layer });
  }
  harness.send({ type: 'set-tempo', bpm });
  harness.send({ type: 'play' });
  return harness;
}

/** Veces tiempo real de `seconds` s de render, tras calentar el JIT. */
function speedOf(harness: Harness, seconds: number): { factor: number; ms: number } {
  const core = harness.core;
  const outL = new Float32Array(BLOCK);
  const outR = new Float32Array(BLOCK);
  for (let i = 0; i < RATE / BLOCK; i++) core.process(null, outL, outR, BLOCK);
  const blocks = Math.round((seconds * RATE) / BLOCK);
  const start = performance.now();
  for (let i = 0; i < blocks; i++) core.process(null, outL, outR, BLOCK);
  const ms = performance.now() - start;
  return { factor: (blocks * BLOCK) / RATE / (ms / 1000), ms };
}

describe('rendimiento de LoopCore', () => {
  it(`rinde ≥ ${MIN_FACTOR}× tiempo real con 4 capas, filtros y limitador (${SECONDS} s a 48 kHz)`, () => {
    const harness = busyCore();
    const { factor, ms } = speedOf(harness, SECONDS);
    console.info(`LoopCore: ${factor.toFixed(0)}× tiempo real (${ms.toFixed(0)} ms)`);
    expect(harness.core.status.layers.every((layer) => layer.hasContent)).toBe(true);
    expect(factor).toBeGreaterThanOrEqual(MIN_FACTOR);
  });

  it('con el filtro contra el aliasing: 240 BPM sobre bucles de 90 (2,67×) y de 40 (6×)', () => {
    // Fuera del criterio de ≥ 100× (que es a 97 BPM): se mide e imprime para el informe, con un
    // suelo holgado que solo caza una regresión grave (tiempo real con mucho margen).
    const library = speedOf(busyCore(240, 90), SECONDS / 2);
    const worst = speedOf(busyCore(240, 40), SECONDS / 2);
    console.info(
      `LoopCore a 240 BPM: bucles de 90 BPM ${library.factor.toFixed(0)}× tiempo real; ` +
        `de 40 BPM (peor caso) ${worst.factor.toFixed(0)}×`,
    );
    expect(worst.factor).toBeGreaterThanOrEqual(MIN_FACTOR / 10);
  });
});

describe('copia de la sesión mientras suena', () => {
  it(`con 4 capas de 60 s, ningún bloque pasa de ${2 * SLACK} ms mientras se copia (un bloque dura 2,67)`, () => {
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
    expect(at(1)).toBeLessThan(2 * SLACK);
  });
});
