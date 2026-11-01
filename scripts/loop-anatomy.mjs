// Las formas de onda de «Anatomía de un bucle» (PLAN fase 7): los cuatro sonidos de la portada,
// renderizados en Node con la misma síntesis que el worker (`audio/synth/library.ts`, determinista)
// y reducidos a un pico por tramo con la misma función que la pantalla del aparato
// (`audio/core/waveform.ts`). Se guardan como datos en src/app/features/product/loop-anatomy.data.ts:
// la portada los pinta sin cargar la síntesis. `scripts/loop-anatomy.spec.ts` comprueba que siguen
// siendo los de la síntesis.
//
// Uso: node scripts/loop-anatomy.mjs
import { build } from 'esbuild';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'src/app/features/product/loop-anatomy.data.ts');

/** Los sonidos de la anatomía (uno de cada papel, los de la primera combinación) y sus tramos. */
const ANATOMY_SOUNDS = ['alfar', 'raiz', 'olivo', 'cierzo'];
const ANATOMY_BINS = 96;
/** A 48 kHz, la frecuencia más común; la forma no cambia con ella. */
const ANATOMY_RATE = 48_000;

const bundle = path.join(tmpdir(), `torno-loop-anatomy-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `
      export { renderLibraryLoop } from './src/app/audio/synth/library';
      export { waveformPeaks } from './src/app/audio/core/waveform';
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundle,
  logLevel: 'error',
});
const { renderLibraryLoop, waveformPeaks } = await import(pathToFileURL(bundle).href);
await rm(bundle, { force: true });

const waves = ANATOMY_SOUNDS.map((id) =>
  Array.from(waveformPeaks(renderLibraryLoop(id, ANATOMY_RATE), ANATOMY_BINS), (peak) =>
    Number(peak.toFixed(2)),
  ),
);
const source = `// Generado por scripts/loop-anatomy.mjs: no se edita a mano.
/** Las formas de onda de «Anatomía de un bucle»: un pico por tramo, de 0 a 1, de cada sonido. */
export const LOOP_ANATOMY_WAVES: Readonly<Record<string, readonly number[]>> = {
${ANATOMY_SOUNDS.map((id, i) => `  ${id}: [${waves[i].join(', ')}],`).join('\n')}
};
`;
const options = (await resolveConfig(OUT)) ?? {};
await writeFile(OUT, await format(source, { ...options, filepath: OUT }));
console.log(
  `✔ ${path.relative(root, OUT)} (${ANATOMY_SOUNDS.length} sonidos × ${ANATOMY_BINS} tramos)`,
);
