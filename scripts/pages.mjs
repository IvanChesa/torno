// Tras el build (postbuild): lo prepara para Cloudflare Pages (PLAN D19 y fase 4, tarea 2).
//
// 1. Las rutas prerenderizadas pasan de `ruta/index.html` a `ruta.html`. Pages sirve `ruta.html` en
//    `/ruta` y redirige `/ruta/` y `/ruta.html` a `/ruta`: URLs sin barra final (CLAUDE.md). Con
//    `ruta/index.html`, la URL buena para Pages sería `/ruta/`.
// 2. `404.html` en la raíz (la página prerenderizada de `/404`): sin él, Pages toma la web por una
//    aplicación de una sola página y responde con la portada, y un 200, a cualquier URL. Fuera
//    `index.csr.html`, la página sin prerenderizar de Angular: aquí se prerenderiza todo.
// 3. El HTML prerenderizado lleva scripts en línea (el contrato de la repetición de eventos de
//    Angular, su arranque y el que activa el CSS no crítico de Beasties). La CSP solo deja pasar los
//    del propio sitio y los que tengan su hash: aquí se calculan (SHA-256 de cada script de todas las
//    páginas) y se escriben en el `_headers` del build, en lugar del marcador de la plantilla
//    (public/_headers). Un atributo de evento en línea (onclick…) o un enlace javascript: rompen el
//    build: la CSP los bloquearía.
// 4. Cada archivo tiene que caer en su regla de caché, por la URL en la que lo sirve Pages: el JS, el
//    CSS y las fuentes, con hash y `immutable`; el HTML, sin caché (se revalida siempre); nada sin
//    hash, `immutable`. Y nada que empiece por punto: Pages lo publicaría.
//
// Es idempotente: la plantilla se lee de public/_headers, no del build.
// Uso: node scripts/pages.mjs   (lo lanza `npm run build`)
import { createHash } from 'node:crypto';
import { readdir, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { headersFor, parseHeaders } from './pages-headers.mjs';

export const PLACEHOLDER = '__SCRIPT_HASHES__';
const ROOT = fileURLToPath(new URL('../dist/torno/browser/', import.meta.url));
const TEMPLATE = fileURLToPath(new URL('../public/_headers', import.meta.url));

/** Los archivos de Pages que no se sirven: los lee al desplegar. */
export const PAGES_CONFIG = new Set(['_headers', '_redirects']);

/**
 * Límites de `_headers` en Pages (plan gratuito): 100 reglas y 2000 caracteres por línea. La CSP
 * crece con cada script en línea nuevo.
 */
export const HEADERS_LIMITS = { rules: 100, lineLength: 2000 };

/** Tipos de <script> que el navegador ejecuta (los JSON de Angular, no). */
const EXECUTABLE = new Set(['', 'text/javascript', 'application/javascript', 'module']);

/**
 * Si un archivo del build lleva hash en el nombre. El JS y el CSS, el de Angular (`chunk-DJVAsKa_.js`,
 * con minúsculas y `_`) o el de esbuild (`processor.JUKLXABX.js`, el worklet); lo demás (fuentes e
 * imágenes que cita el CSS, en `media/`), el de Angular para los recursos, en mayúsculas
 * (`…-2NUMMRN6.woff2`): así una página como `sobre-el-proyecto.html` no pasa por tener hash.
 * @param {string} file ruta relativa al build, con `/`
 */
export function isHashed(file) {
  const name = file.split('/').pop() ?? file;
  return /\.(js|css)$/.test(name)
    ? /[.-][A-Za-z0-9_-]{8}\.(js|css)$/.test(name)
    : /[.-][A-Z0-9]{8}\.[a-z0-9]+$/.test(name);
}

/**
 * El código de los scripts en línea ejecutables de una página, tal cual (sin los de `src`).
 * @param {string} html
 * @returns {string[]}
 */
export function inlineScripts(html) {
  const scripts = [];
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(` ${attributes}`)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(` ${attributes}`)?.[1]?.toLowerCase() ?? '';
    if (EXECUTABLE.has(type)) scripts.push(body);
  }
  return scripts;
}

/**
 * Lo que la CSP bloquearía sin `'unsafe-inline'`: atributos de evento (`onclick="…"`) y enlaces
 * `javascript:`. Devuelve cada uno encontrado.
 * @param {string} html
 * @returns {string[]}
 */
export function inlineHandlers(html) {
  // Solo dentro de las etiquetas (no en el texto ni en los scripts).
  const tags = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').match(/<[a-z][^>]*>/gi) ?? [];
  const found = [];
  for (const tag of tags) {
    for (const [attribute] of tag.matchAll(/\son[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi)) {
      found.push(attribute.trim());
    }
    for (const [attribute] of tag.matchAll(/\s(?:href|src|action)\s*=\s*(["'])\s*javascript:/gi)) {
      found.push(attribute.trim());
    }
  }
  return found;
}

/**
 * Fuente de la CSP para un script en línea: `'sha256-…'` sobre sus bytes en UTF-8.
 * @param {string} code
 */
export function scriptHash(code) {
  return `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;
}

/**
 * Escribe los hashes en el `_headers` (en lugar del marcador, que tiene que estar una sola vez).
 * @param {string} headers
 * @param {Iterable<string>} hashes
 */
export function applyScriptHashes(headers, hashes) {
  const count = headers.split(PLACEHOLDER).length - 1;
  if (count !== 1) {
    throw new Error(`El _headers tiene que llevar ${PLACEHOLDER} una vez (lleva ${count})`);
  }
  const sources = [...new Set(hashes)].sort();
  return headers.replace(` ${PLACEHOLDER}`, sources.map((hash) => ` ${hash}`).join(''));
}

/**
 * Lo que el `_headers` pasa de los límites de Pages (más reglas o líneas más largas de la cuenta).
 * @param {string} headers
 * @returns {string[]}
 */
export function headersLimitProblems(headers) {
  const problems = [];
  const rules = parseHeaders(headers).length;
  if (rules > HEADERS_LIMITS.rules) {
    problems.push(`_headers: ${rules} reglas (Pages admite ${HEADERS_LIMITS.rules})`);
  }
  headers.split(/\r?\n/).forEach((line, index) => {
    if (line.length > HEADERS_LIMITS.lineLength) {
      problems.push(
        `_headers, línea ${index + 1}: ${line.length} caracteres (Pages admite ${HEADERS_LIMITS.lineLength})`,
      );
    }
  });
  return problems;
}

/**
 * La URL en la que Pages sirve un archivo del build: sin `.html` y sin `index.html`.
 * @param {string} file ruta relativa al build, con `/`
 */
export function servedPath(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  if (file.endsWith('.html')) return `/${file.slice(0, -'.html'.length)}`;
  return `/${file}`;
}

/**
 * El archivo del build de una ruta prerenderizada, ya preparado para Pages (`/ruta` → `ruta.html`).
 * @param {string} route
 */
export function routeFile(route) {
  const name = route.replace(/^\/+|\/+$/g, '');
  return name === '' ? 'index.html' : `${name}.html`;
}

/**
 * Qué caché le toca a un archivo del build, o el motivo por el que no vale.
 * @param {import('./pages-headers.mjs').HeaderRule[]} rules
 * @param {string} file ruta relativa al build, con `/`
 * @returns {string | null} el problema, o `null` si está bien
 */
export function cacheProblem(rules, file) {
  const cache = headersFor(rules, servedPath(file)).get('cache-control') ?? '';
  const immutable = /\bimmutable\b/.test(cache);
  if (file.endsWith('.html')) {
    // Sin regla, Pages pone `public, max-age=0, must-revalidate`: se revalida siempre.
    return cache === '' || (!immutable && /\b(no-cache|max-age=0)\b/.test(cache))
      ? null
      : `${file}: el HTML no puede quedarse en caché (${cache})`;
  }
  // Todo lo que lleva hash, un año e inmutable; el JS, el CSS y las fuentes, siempre con hash.
  if (isHashed(file)) {
    return immutable && cache.includes('max-age=31536000')
      ? null
      : `${file}: con hash y sin caché inmutable de un año (${cache || 'la de Pages'})`;
  }
  if (/\.(js|css|woff2)$/.test(file)) return `${file}: sin hash en el nombre`;
  return immutable ? `${file}: sin hash y con caché inmutable` : null;
}

/** Los archivos de una carpeta, con `/` y ordenados (readdir no da el mismo orden en Linux). */
async function filesIn(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(dir, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'),
    )
    .sort();
}

const exists = async (file) => (await stat(file).catch(() => null)) !== null;

/**
 * Pasa cada `ruta/index.html` a `ruta.html` y quita `index.csr.html`. Devuelve las rutas movidas.
 * @param {string} root
 */
export async function reorganizeRoutes(root) {
  const moved = [];
  for (const file of (await filesIn(root)).filter((name) => name.endsWith('/index.html'))) {
    const route = file.slice(0, -'/index.html'.length);
    if (await exists(path.join(root, `${route}.html`))) {
      throw new Error(`Ya existe ${route}.html: no puedo publicar ${file} en /${route}`);
    }
    await rename(path.join(root, file), path.join(root, `${route}.html`));
    // La carpeta de la ruta, si se ha quedado vacía (si tiene rutas hijas, sigue).
    await rmdir(path.join(root, route)).catch(() => undefined);
    moved.push(`/${route}`);
  }
  await rm(path.join(root, 'index.csr.html'), { force: true });
  return moved;
}

/**
 * Prepara y comprueba un build para Pages. Devuelve un resumen para imprimirlo.
 * @param {{ root?: string, template?: string }} [options] la plantilla, como texto
 */
export async function processBuild({ root = ROOT, template } = {}) {
  const source = template ?? (await readFile(TEMPLATE, 'utf8'));
  if (!(await exists(path.join(root, 'index.html')))) {
    throw new Error(`No hay build en ${root}: ejecuta antes «ng build»`);
  }
  const moved = await reorganizeRoutes(root);
  const files = (await filesIn(root)).filter((file) => !PAGES_CONFIG.has(file));
  const problems = [];
  if (!files.includes('404.html')) {
    problems.push('Falta 404.html (la ruta /404 prerenderizada): Pages respondería 200 a todo');
  }
  const pages = files.filter((file) => file.endsWith('.html'));
  const hashes = new Set();
  for (const page of pages) {
    const html = await readFile(path.join(root, page), 'utf8');
    for (const code of inlineScripts(html)) hashes.add(scriptHash(code));
    for (const handler of inlineHandlers(html))
      problems.push(`${page}: «${handler}» (la CSP lo bloquearía)`);
  }
  const headers = applyScriptHashes(source, hashes);
  problems.push(...headersLimitProblems(headers));
  const rules = parseHeaders(headers);
  for (const file of files) {
    if (file.split('/').some((part) => part.startsWith('.'))) {
      problems.push(`${file}: empieza por punto (Pages lo publicaría)`);
      continue;
    }
    const problem = cacheProblem(rules, file);
    if (problem) problems.push(problem);
  }
  if (problems.length > 0) {
    throw new Error(`El build no vale para Pages:\n  ${problems.join('\n  ')}`);
  }
  await writeFile(path.join(root, '_headers'), headers);
  return { moved, pages: pages.length, hashes: hashes.size, files: files.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { moved, pages, hashes, files } = await processBuild();
    console.log(
      `✔ Pages: ${moved.length === 0 ? 'rutas ya preparadas' : `${moved.join(', ')} como ruta.html`}; CSP con ${hashes} hash${hashes === 1 ? '' : 'es'} de scripts en línea (${pages} páginas); caché comprobada en ${files} archivos`,
    );
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
