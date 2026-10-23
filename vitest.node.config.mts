import { defineConfig } from 'vitest/config';

// Tests en Node puro (sin jsdom ni Angular) de las capas de TS puro y de los scripts del repo.
// Si una de estas capas usara el DOM o Web Audio, sus tests fallarían aquí (PLAN §4.2).
// Los componentes de Angular se prueban aparte con `ng test` (jsdom).
const PURE_LAYERS = ['audio/core', 'audio/synth', 'audio/files', 'instrument'];

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      ...PURE_LAYERS.map((layer) => `src/app/${layer}/**/*.spec.ts`),
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
