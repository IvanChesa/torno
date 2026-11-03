import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// El peso de la primera visita a cada ruta (PLAN §5: ≤ 650 kB en bruto sin el 3D, decisión de Iván
// del 01-11), medido en el navegador con todo lo que llega sin tocar nada: lo que no ve
// scripts/check-bundles.mjs (los trozos que pide la hidratación). Fuera, el 3D (que no llega en la
// carga, fase 8) y la precarga del audio (que §5 anota aparte). Solo contra el build.

const FIRST_VISIT_LIMIT = 650_000;
const ROUTES = ['/', '/sobre-el-proyecto', '/404'];

interface Metafile {
  outputs: Record<string, { entryPoint?: string; inputs: Record<string, unknown> }>;
}

/** Los archivos que no cuentan: el 3D (three, la escena y el escenario) y el motor de audio. */
async function excludedFiles(): Promise<Set<string>> {
  const stats = JSON.parse(await readFile('dist/torno/browser-stats.json', 'utf8')) as Metafile;
  const excluded = new Set<string>();
  for (const [file, output] of Object.entries(stats.outputs)) {
    const inputs = Object.keys(output.inputs).map((input) => input.replaceAll('\\', '/'));
    const entry = output.entryPoint ?? '';
    if (
      inputs.some((input) => /node_modules\/three\/|^src\/app\/scene\//.test(input)) ||
      entry.startsWith('src/app/features/instrument-stage/') ||
      entry.startsWith('src/app/audio/engine/') ||
      /^worker-/.test(file)
    ) {
      excluded.add(file);
    }
  }
  return excluded;
}

test.describe('presupuestos', () => {
  for (const route of ROUTES) {
    test(`${route}: la primera visita, sin el 3D ni la precarga del audio, pesa ≤ 650 kB`, async ({
      page,
    }) => {
      const excluded = await excludedFiles();
      await page.goto(route, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle');
      const entries = await page.evaluate(() =>
        [
          ...performance.getEntriesByType('navigation'),
          ...performance.getEntriesByType('resource'),
        ].map((entry) => ({
          path: new URL(entry.name).pathname.replace(/^\//, ''),
          bytes: (entry as PerformanceResourceTiming).decodedBodySize || 0,
        })),
      );
      const counted = entries.filter(
        (entry) => !excluded.has(entry.path) && !/^audio\/processor\./.test(entry.path),
      );
      const bytes = counted.reduce((sum, entry) => sum + entry.bytes, 0);
      test.info().annotations.push({
        type: 'peso',
        description: `${route}: ${(bytes / 1000).toFixed(1)} kB en ${counted.length} archivos`,
      });
      // Algo se ha medido (la página y su JS), y no pasa del presupuesto.
      expect(bytes).toBeGreaterThan(100_000);
      expect(bytes).toBeLessThanOrEqual(FIRST_VISIT_LIMIT);
    });
  }
});
