// Banco de la síntesis (PLAN fase 3: «render ≤ 50 ms por bucle en escritorio»). Mide el código tal
// como lo carga el worker de síntesis: empaquetado con esbuild (en Vitest, cada importación pasa
// por un objeto y los bucles calientes van hasta 2,5 veces más lentos). Cada bucle se renderiza 4
// veces: la primera, en frío (con el JIT compilando); el criterio es la mejor de las otras tres.
//
// Mide tiempo de pared: va en `npm run test:bench`, fuera de `check`. En el CI, la cota ×3
// (revisión del bloque A, #1). Sale con código 1 si un bucle se pasa.
import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rateArg = process.argv.indexOf('--rate');
const RATE = rateArg > 0 ? Number(process.argv[rateArg + 1]) : 48_000;
const LIMIT_MS = 50 * (process.env['CI'] ? 3 : 1);

const bundle = path.join(tmpdir(), `torno-bench-synth-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, 'src/app/audio/synth/library.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundle,
  logLevel: 'error',
});
const { LIBRARY_IDS, renderLibraryLoop } = await import(pathToFileURL(bundle).href);
await rm(bundle, { force: true });

let failed = false;
console.log(`Render de la colección a ${RATE} Hz (límite ${LIMIT_MS} ms en caliente):`);
for (const id of LIBRARY_IDS) {
  const times = [];
  for (let round = 0; round < 4; round++) {
    const start = performance.now();
    renderLibraryLoop(id, RATE);
    times.push(performance.now() - start);
  }
  const warm = Math.min(...times.slice(1));
  const ok = warm <= LIMIT_MS;
  failed ||= !ok;
  console.log(
    `  ${ok ? '✔' : '✖'} ${id.padEnd(9)} en frío ${times[0].toFixed(1).padStart(5)} ms · ` +
      `en caliente ${warm.toFixed(1).padStart(5)} ms`,
  );
}
process.exit(failed ? 1 : 0);
