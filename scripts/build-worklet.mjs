// Compila el AudioWorklet con esbuild (PLAN D5):
//   src/app/audio/worklet/processor.ts → public/audio/processor.<hash>.js
//   y escribe su ruta en src/app/audio/engine/worklet-url.generated.ts (los dos, fuera de git).
// El builder de Angular empaqueta los workers de `new Worker(new URL(...))`, pero no los módulos
// de `audioWorklet.addModule()`. Por eso este paso va antes de start, build, test, lint y e2e.
//
// Uso:
//   node scripts/build-worklet.mjs                       una vez, minificado
//   node scripts/build-worklet.mjs --watch -- ng serve   vigila los cambios y lanza el comando
import { spawn } from 'node:child_process';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENTRY = path.join(ROOT, 'src/app/audio/worklet/processor.ts');
const OUT_DIR = path.join(ROOT, 'public/audio');
const URL_FILE = path.join(ROOT, 'src/app/audio/engine/worklet-url.generated.ts');
const OUTPUT_NAME = /^processor\.[A-Z0-9]+\.js$/;

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const separator = args.indexOf('--');
const command = separator >= 0 ? args.slice(separator + 1) : [];

async function writeIfChanged(file, contents) {
  const current = await readFile(file, 'utf8').catch(() => undefined);
  if (current !== contents) await writeFile(file, contents);
}

const urlModule = (file) =>
  [
    '// Generado por scripts/build-worklet.mjs: no lo edites (está en .gitignore).',
    '',
    '/** Ruta del módulo del AudioWorklet, relativa a la base del documento (lleva hash). */',
    `export const WORKLET_PATH = 'audio/${file}';`,
    '',
  ].join('\n');

/** Tras cada build: escribe la ruta con hash y borra las versiones anteriores. */
const publish = {
  name: 'torno-worklet-url',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0 || !result.metafile) return;
      const [output] = Object.keys(result.metafile.outputs).filter((f) => f.endsWith('.js'));
      const file = path.basename(output);
      await writeIfChanged(URL_FILE, urlModule(file));
      for (const old of await readdir(OUT_DIR)) {
        if (old !== file && OUTPUT_NAME.test(old)) await rm(path.join(OUT_DIR, old));
      }
      const { size } = await stat(path.join(OUT_DIR, file));
      console.log(`✔ Worklet: public/audio/${file} (${(size / 1024).toFixed(1)} kB)`);
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [ENTRY],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outdir: OUT_DIR,
  entryNames: 'processor.[hash]',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
  tsconfig: path.join(ROOT, 'tsconfig.worklet.json'),
  plugins: [publish],
};

if (!watch) {
  await esbuild.build(options);
} else {
  const context = await esbuild.context(options);
  await context.rebuild();
  await context.watch();
  if (command.length === 0) {
    console.log('Vigilando el worklet (Ctrl+C para salir)…');
  } else {
    // Un solo string: con `shell: true`, Node no admite argumentos sueltos sin escapar.
    const child = spawn(command.join(' '), { stdio: 'inherit', shell: true });
    const stop = async (code) => {
      await context.dispose();
      process.exit(code);
    };
    child.on('exit', (code) => stop(code ?? 0));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  }
}
