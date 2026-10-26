// Escucha de la colección (PLAN fase 3, tarea 8): renderiza los 12 bucles y 3 combinaciones a WAV
// de 24 bits en `demo-sounds/` (ignorada por git), con el mismo código que el navegador: la
// síntesis de `audio/synth` y la mezcla del núcleo (`renderMixWav`, la de «Exportar mezcla»).
// Imprime el nivel, el pico y el tiempo de render de cada bucle.
//
// Uso: npm run demo:sounds [-- --rate 44100]
import { build } from 'esbuild';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rateArg = process.argv.indexOf('--rate');
const RATE = rateArg > 0 ? Number(process.argv[rateArg + 1]) : 48_000;
const OUT = path.join(root, 'demo-sounds');

/** Las tres combinaciones: un sonido de cada papel. */
const COMBOS = [
  ['alfar', 'raiz', 'olivo', 'cierzo'],
  ['horno', 'surco', 'vega', 'brasa'],
  ['adobe', 'cinca', 'almendro', 'acequia'],
];

// El TS del proyecto, empaquetado en un módulo temporal para Node.
const bundle = path.join(tmpdir(), `torno-demo-sounds-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `
      export { LIBRARY_IDS, LIBRARY_BPM, libraryCategory, renderLibraryLoop } from './src/app/audio/synth/library';
      export { renderMixWav } from './src/app/audio/files/export';
      export { EMPTY_LAYER } from './src/app/audio/core/session';
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
const synth = await import(pathToFileURL(bundle).href);
await rm(bundle, { force: true });

const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '−∞');
await mkdir(OUT, { recursive: true });

const loops = new Map();
console.log(`Colección a ${RATE} Hz (${synth.LIBRARY_BPM} BPM, 2 compases):`);
for (const [index, id] of synth.LIBRARY_IDS.entries()) {
  const start = performance.now();
  const pcm = synth.renderLibraryLoop(id, RATE);
  const ms = performance.now() - start;
  loops.set(id, pcm);
  let sum = 0;
  let peak = 0;
  for (const x of pcm) {
    sum += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  const rms = Math.sqrt(sum / pcm.length);
  const name = `${String(index + 1).padStart(2, '0')}-${synth.libraryCategory(id)}-${id}.wav`;
  await writeFile(path.join(OUT, name), session([id], 4, false));
  console.log(
    `  ${id.padEnd(9)} ${synth.libraryCategory(id).padEnd(8)} RMS ${db(rms).padStart(6)} dBFS · ` +
      `pico ${db(peak).padStart(5)} dBFS · ${ms.toFixed(1).padStart(5)} ms`,
  );
}
for (const [index, ids] of COMBOS.entries()) {
  await writeFile(
    path.join(OUT, `combinacion-${index + 1}-${ids.join('-')}.wav`),
    session(ids, 4, true),
  );
}
console.log(
  `\n${synth.LIBRARY_IDS.length} bucles y ${COMBOS.length} combinaciones en ${path.relative(root, OUT)}/`,
);

/** Un WAV estéreo con estas capas a 90 BPM (mezcla del núcleo, como «Exportar mezcla»). */
function session(ids, repeats, fadeOut) {
  const layers = [0, 1, 2, 3].map((i) => {
    const id = ids[i];
    if (!id) return synth.EMPTY_LAYER;
    return {
      ...synth.EMPTY_LAYER,
      pcm: loops.get(id),
      lengthBeats: 8,
      source: { kind: 'library', id },
    };
  });
  return synth.renderMixWav(
    { sampleRate: RATE, bpm: synth.LIBRARY_BPM, layers },
    { repeats, fadeOut },
  );
}
