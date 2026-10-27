// Presupuestos de tamaño (PLAN §5) y fronteras del bundle inicial (PLAN §4.9), comprobados con
// el metafile de esbuild que deja `ng build` (dist/torno/browser-stats.json, opción statsJson).
// También los límites de Cloudflare Pages para lo que se despliega (PLAN fase 4, tarea 2).
//
// Uso: node scripts/check-bundles.mjs   (después de `npm run build`)
// Sale con código 1 si se rompe un límite de error; los avisos se imprimen pero no fallan.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAGES_CONFIG, routeFile } from './pages.mjs';

const KB = 1000;
const MIB = 1024 * 1024;

/** Límites de Cloudflare Pages en el plan gratuito: tamaño por archivo y archivos por sitio. */
export const PAGES_LIMITS = { fileBytes: 25 * MIB, files: 20_000 };

/**
 * Límites en bytes, en bruto (PLAN §5). `warn` avisa; `error` falla. El «JS inicial» es el de la
 * primera visita a cada ruta: `main`, los chunks iniciales y los `modulepreload` de su página.
 */
export const LIMITS = {
  initialJs: { warn: 330 * KB, error: 400 * KB },
  unlock: { error: 2 * KB },
  engine: { error: 60 * KB },
  // El worklet y el worker de exportación llevan el núcleo entero (revisión del bloque A, #2).
  worklet: { error: 60 * KB },
  worker: { error: 60 * KB },
  scene: { warn: 800 * KB },
  fonts: { error: 150 * KB },
};

/** Lo que el desbloqueo de audio puede llevar al bundle inicial (PLAN §4.9). */
const ENGINE_PUBLIC = ['src/app/audio/engine/index.ts', 'src/app/audio/engine/unlock.ts'];
const SCENE_PUBLIC = ['src/app/scene/index.ts'];

/** Código que nunca puede ir en el bundle inicial: motor de audio, síntesis, archivos y 3D. */
export function forbiddenInInitial(input) {
  const file = input.replaceAll('\\', '/');
  if (/(^|\/)node_modules\/three\//.test(file)) return 'three';
  if (/^src\/app\/audio\/(core|synth|files|worklet|workers)\//.test(file)) return 'audio';
  if (file.startsWith('src/app/audio/engine/') && !ENGINE_PUBLIC.includes(file)) return 'motor';
  if (file.startsWith('src/app/scene/') && !SCENE_PUBLIC.includes(file)) return 'escena';
  return undefined;
}

/** Scripts que carga una página prerenderizada: `<script src>` y `<link rel="modulepreload">`. */
export function initialScripts(html) {
  const found = [
    ...html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g),
    ...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+\.js)"/g),
  ].map((match) => match[1]);
  return [...new Set(found)];
}

/**
 * Revisa el metafile, las páginas prerenderizadas y lo que se despliega. Devuelve filas para la
 * tabla, errores y avisos.
 * @param {{ outputs: Record<string, { bytes: number, entryPoint?: string, inputs: Record<string, { bytesInOutput: number }> }> }} metafile
 * @param {Record<string, string>} pages ruta → HTML prerenderizado
 * @param {{ worklet: { file: string, bytes: number }[], files?: { file: string, bytes: number }[] }} extra
 *   archivos fuera del metafile: el worklet y todo lo que se despliega
 */
export function checkBundles(metafile, pages, extra) {
  const rows = [];
  const errors = [];
  const warnings = [];
  const outputs = Object.entries(metafile.outputs);
  const bytesOf = (file) => metafile.outputs[file]?.bytes ?? 0;
  const judge = (label, bytes, limit, detail = '', format = fmt) => {
    let verdict = 'ok';
    if (limit.error !== undefined && bytes > limit.error) {
      verdict = 'ERROR';
      errors.push(
        `${label}: ${format(bytes)} > ${format(limit.error)}${detail ? ` (${detail})` : ''}`,
      );
    } else if (limit.warn !== undefined && bytes > limit.warn) {
      verdict = 'aviso';
      warnings.push(`${label}: ${format(bytes)} > ${format(limit.warn)}`);
    }
    rows.push({ label, bytes, limit, verdict, detail, format });
  };

  // 1. JS inicial de cada página, y nada prohibido dentro.
  let unlockBytes = 0;
  for (const [route, html] of Object.entries(pages)) {
    const scripts = initialScripts(html);
    if (scripts.length === 0) errors.push(`${route}: no encuentro los scripts iniciales`);
    for (const script of scripts) {
      if (!metafile.outputs[script]) errors.push(`${route}: ${script} no está en el metafile`);
    }
    judge(
      `JS inicial de ${route}`,
      scripts.reduce((sum, s) => sum + bytesOf(s), 0),
      LIMITS.initialJs,
      `${scripts.length} archivos`,
    );
    for (const script of scripts) {
      for (const [input, { bytesInOutput }] of Object.entries(
        metafile.outputs[script]?.inputs ?? {},
      )) {
        const reason = forbiddenInInitial(input);
        if (reason)
          errors.push(`${route}: ${input} (${reason}) está en el bundle inicial (${script})`);
        if (route === '/' && ENGINE_PUBLIC.includes(input)) unlockBytes += bytesInOutput;
      }
    }
  }
  if (pages['/'])
    judge(
      'Desbloqueo de audio en el inicial',
      unlockBytes,
      LIMITS.unlock,
      ENGINE_PUBLIC.join(' + '),
    );

  // 2. Motor de audio diferido: cada chunk cuyo punto de entrada está en audio/engine.
  for (const [file, output] of outputs) {
    if (output.entryPoint?.startsWith('src/app/audio/engine/') && file.endsWith('.js')) {
      judge(
        `Motor de audio (${path.basename(output.entryPoint)})`,
        output.bytes,
        LIMITS.engine,
        file,
      );
    }
  }

  // 3. Workers (con sus chunks propios) y worklet.
  for (const [file, output] of outputs) {
    if (/^worker-[A-Z0-9]+\.js$/.test(file)) {
      judge(
        `Worker ${path.basename(output.entryPoint ?? file)}`,
        output.bytes,
        LIMITS.worker,
        file,
      );
    }
  }
  if (extra.worklet.length !== 1)
    errors.push(`Esperaba un worklet en audio/ y hay ${extra.worklet.length}`);
  for (const { file, bytes } of extra.worklet) judge('Worklet', bytes, LIMITS.worklet, file);

  // 4. 3D: chunks con three o con la escena (aviso).
  const sceneBytes = outputs
    .filter(([, output]) =>
      Object.keys(output.inputs).some((i) =>
        /node_modules\/three\/|^src\/app\/scene\//.test(i.replaceAll('\\', '/')),
      ),
    )
    .reduce((sum, [, output]) => sum + output.bytes, 0);
  judge(
    'Chunk 3D (three + escena)',
    sceneBytes,
    LIMITS.scene,
    sceneBytes === 0 ? 'aún no existe' : '',
  );

  // 5. Fuentes.
  const fonts = outputs.filter(([file]) => file.endsWith('.woff2'));
  judge(
    'Fuentes',
    fonts.reduce((sum, [, output]) => sum + output.bytes, 0),
    LIMITS.fonts,
    `${fonts.length} archivos`,
  );

  // 6. Cloudflare Pages: ningún archivo de más de 25 MiB y 20 000 archivos como mucho.
  if (extra.files) {
    const largest = extra.files.reduce((max, file) => (file.bytes > max.bytes ? file : max), {
      file: '',
      bytes: 0,
    });
    for (const { file, bytes } of extra.files) {
      if (bytes > PAGES_LIMITS.fileBytes && file !== largest.file) {
        errors.push(`Pages: ${file}: ${fmtMib(bytes)} > ${fmtMib(PAGES_LIMITS.fileBytes)}`);
      }
    }
    judge(
      'Archivo más grande (Pages)',
      largest.bytes,
      { error: PAGES_LIMITS.fileBytes },
      largest.file,
      fmtMib,
    );
    judge(
      'Archivos del despliegue (Pages)',
      extra.files.length,
      { error: PAGES_LIMITS.files },
      '',
      (count) => `${count} archivos`,
    );
  }

  return { rows, errors, warnings };
}

function fmt(bytes) {
  return `${(bytes / KB).toFixed(1)} kB`;
}

function fmtMib(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

/** Todos los archivos que se despliegan (sin `_headers` ni `_redirects`), con su tamaño. */
async function deployedFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await deployedFiles(full, base)));
    else {
      const file = path.relative(base, full).replaceAll('\\', '/');
      if (!PAGES_CONFIG.has(file)) out.push({ file, bytes: (await stat(full)).size });
    }
  }
  return out;
}

async function main() {
  const root = fileURLToPath(new URL('../dist/torno/', import.meta.url));
  const browser = path.join(root, 'browser');
  const metafile = JSON.parse(await readFile(path.join(root, 'browser-stats.json'), 'utf8'));
  const { routes } = JSON.parse(await readFile(path.join(root, 'prerendered-routes.json'), 'utf8'));
  const pages = {};
  // Las páginas, donde las deja scripts/pages.mjs para Pages (`/ruta` → `ruta.html`).
  for (const route of Object.keys(routes)) {
    pages[route] = await readFile(path.join(browser, routeFile(route)), 'utf8');
  }
  const audioDir = path.join(browser, 'audio');
  const worklet = [];
  for (const file of await readdir(audioDir)) {
    if (/^processor\.[A-Z0-9]+\.js$/.test(file)) {
      worklet.push({ file: `audio/${file}`, bytes: (await stat(path.join(audioDir, file))).size });
    }
  }
  const files = await deployedFiles(browser);

  const { rows, errors, warnings } = checkBundles(metafile, pages, { worklet, files });
  const width = Math.max(...rows.map((row) => row.label.length));
  console.log('Presupuestos (PLAN §5), en bruto, y límites de Cloudflare Pages:');
  for (const row of rows) {
    const limits = [
      row.limit.warn === undefined ? '' : `aviso > ${row.format(row.limit.warn)}`,
      row.limit.error === undefined ? '' : `error > ${row.format(row.limit.error)}`,
    ].filter(Boolean);
    const mark = row.verdict === 'ok' ? '✔' : row.verdict === 'aviso' ? '⚠' : '✖';
    console.log(
      `${mark} ${row.label.padEnd(width)}  ${row.format(row.bytes).padStart(13)}  (${limits.join(' · ')})  ${row.detail}`,
    );
  }
  for (const warning of warnings) console.warn(`⚠ AVISO: ${warning}`);
  for (const error of errors) console.error(`✖ ERROR: ${error}`);
  if (errors.length > 0) process.exit(1);
  console.log('✔ Bundle inicial sin motor de audio, síntesis, worklet ni 3D.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
