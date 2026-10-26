// Tras el build (postbuild): completa la CSP del .htaccess y comprueba la caché de cada archivo.
//
// 1. El HTML prerenderizado lleva scripts en línea (el contrato de la repetición de eventos de
//    Angular, su arranque y el que activa el CSS no crítico de Beasties). La CSP solo deja pasar
//    los del propio sitio y los que tengan su hash: aquí se calculan (SHA-256 de cada script de
//    todas las páginas) y se escriben en lugar de __SCRIPT_HASHES__. Un atributo de evento en línea
//    (onclick…) o un enlace javascript: rompen el build: la CSP los bloquearía.
// 2. Cada archivo del build tiene que caer en su regla de caché: el JS, el CSS y las fuentes, con
//    hash y `immutable`; el HTML, `no-cache`; nada más, `immutable`.
//
// Uso: node scripts/htaccess.mjs   (lo lanza `npm run build`)
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { headersFor, parseHtaccess } from './htaccess-rules.mjs';

export const PLACEHOLDER = '__SCRIPT_HASHES__';
const ROOT = fileURLToPath(new URL('../dist/torno/browser/', import.meta.url));

/** Tipos de <script> que el navegador ejecuta (los JSON de Angular, no). */
const EXECUTABLE = new Set(['', 'text/javascript', 'application/javascript', 'module']);

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
 * Escribe los hashes en el .htaccess (en lugar del marcador, que tiene que estar una sola vez).
 * @param {string} htaccess
 * @param {Iterable<string>} hashes
 */
export function applyScriptHashes(htaccess, hashes) {
  const count = htaccess.split(PLACEHOLDER).length - 1;
  if (count !== 1) {
    throw new Error(`El .htaccess tiene que llevar ${PLACEHOLDER} una vez (lleva ${count})`);
  }
  const sources = [...new Set(hashes)].sort();
  return htaccess.replace(` ${PLACEHOLDER}`, sources.map((hash) => ` ${hash}`).join(''));
}

/**
 * Qué caché le toca a un archivo del build, o el motivo por el que no vale.
 * @param {import('./htaccess-rules.mjs').HtaccessRules} rules
 * @param {string} file ruta relativa al build
 * @returns {string | null} el problema, o `null` si está bien
 */
export function cacheProblem(rules, file) {
  const cache = headersFor(rules, file).headers.get('cache-control') ?? '';
  const immutable = cache.includes('immutable');
  if (/\.(js|css|woff2)$/.test(file)) {
    return immutable
      ? null
      : `${file}: sin hash en el nombre o sin caché inmutable (${cache || 'ninguna'})`;
  }
  if (file.endsWith('.html')) {
    return cache === 'no-cache'
      ? null
      : `${file}: el HTML tiene que ir con no-cache (${cache || 'ninguna'})`;
  }
  return immutable ? `${file}: sin hash y con caché inmutable` : null;
}

async function filesIn(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await filesIn(full, base)));
    else out.push(path.relative(base, full).replaceAll('\\', '/'));
  }
  return out;
}

/** Completa y comprueba el .htaccess de un build. Devuelve un resumen para imprimirlo. */
export async function processBuild(root = ROOT) {
  const htaccessFile = path.join(root, '.htaccess');
  const source = await readFile(htaccessFile, 'utf8').catch(() => {
    throw new Error(`No hay .htaccess en ${root}: Angular tendría que copiar public/.htaccess`);
  });
  const files = await filesIn(root);
  const pages = files.filter((file) => file.endsWith('.html'));
  const hashes = new Set();
  const problems = [];
  for (const page of pages) {
    const html = await readFile(path.join(root, page), 'utf8');
    for (const code of inlineScripts(html)) hashes.add(scriptHash(code));
    for (const handler of inlineHandlers(html))
      problems.push(`${page}: «${handler}» (la CSP lo bloquearía)`);
  }
  const htaccess = applyScriptHashes(source, hashes);
  const rules = parseHtaccess(htaccess);
  for (const file of files) {
    if (path.basename(file).startsWith('.')) continue;
    const problem = cacheProblem(rules, file);
    if (problem) problems.push(problem);
  }
  if (problems.length > 0)
    throw new Error(`El build no vale para el servidor:\n  ${problems.join('\n  ')}`);
  await writeFile(htaccessFile, htaccess);
  return { pages: pages.length, hashes: hashes.size, files: files.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { pages, hashes, files } = await processBuild();
    console.log(
      `✔ .htaccess: CSP con ${hashes} hash${hashes === 1 ? '' : 'es'} de scripts en línea (${pages} páginas); caché comprobada en ${files} archivos`,
    );
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
