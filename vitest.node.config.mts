import { defineConfig } from 'vitest/config';

// Tests en Node puro (sin jsdom ni Angular) de las capas de TS puro y de los scripts del repo.
// Si una de estas capas usara el DOM o Web Audio, sus tests fallarían aquí (PLAN §4.2).
// Los componentes de Angular se prueban aparte con `ng test` (jsdom).
const PURE_LAYERS = ['audio/core', 'audio/synth', 'audio/files', 'instrument'];

export default defineConfig({
  test: {
    environment: 'node',
    // Los tests del DSP renderizan minutos de audio y, con la cobertura instrumentada, tardan unas
    // 3 veces más: el más pesado, 19 s en el PC de Iván. En un runner compartido del CI pueden ir
    // el doble de lentos (con 30 s, uno se pasó). El límite solo está para cazar un test colgado.
    testTimeout: 120_000,
    include: [
      ...PURE_LAYERS.map((layer) => `src/app/${layer}/**/*.spec.ts`),
      // El adaptador del worklet, con el AudioWorkletGlobalScope simulado.
      'src/app/audio/worklet/**/*.spec.ts',
      // La geometría del 3D (sin WebGL ni DOM: las texturas de canvas no entran en estos tests).
      'src/app/scene/**/*.spec.ts',
      'scripts/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      include: PURE_LAYERS.map((layer) => `src/app/${layer}/**/*.ts`),
      exclude: ['**/*.spec.ts', '**/index.ts'],
      reporter: ['text-summary', ['text', { skipFull: true }]],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
