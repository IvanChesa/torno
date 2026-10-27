// Comprueba un sitio servido por Cloudflare Pages, como con `curl` (PLAN fase 4, tarea 4):
// - las tres rutas, la barra final (y `.html`) redirigida a la URL sin ella, y la 404;
// - las cabeceras de seguridad (CSP con sus hashes, Permissions-Policy…), sin COOP ni COEP;
// - la caché (el HTML se revalida; lo que lleva hash, inmutable) y el tipo de los módulos JS, del
//   worklet, de los workers y de las fuentes;
// - sin cookies y sin Cloudflare Web Analytics; en *.pages.dev, `noindex`; en HTTPS, que http://
//   redirige;
// - con --build, que el HTML servido es el de ese build y la CSP, la de su _headers: lo publicado es
//   lo que probó el CI.
//
// Lo usan el despliegue (.github/workflows/deploy.yml), tras subir, y un e2e contra
// `wrangler pages dev` (e2e/headers.spec.ts). Solo hace GET y HEAD, sin datos ni credenciales.
//
// Uso: node scripts/verify-pages.mjs https://staging.torno.pages.dev [--build dist/torno/browser]
//        [--esperar 120]   (con --build: espera hasta 120 s a que la portada sea la del build)
// Sale con código 1 si alguna comprobación falla.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { headersFor, parseHeaders } from './pages-headers.mjs';

/** Las páginas prerenderizadas y su archivo en el build (scripts/pages.mjs). */
const PAGES = [
  { path: '/', file: 'index.html' },
  { path: '/sobre-el-proyecto', file: 'sobre-el-proyecto.html' },
  { path: '/404', file: '404.html' },
];
/** Redirecciones de Pages: de la URL con barra final, `.html` o `index.html` a la buena. */
const REDIRECTS = [
  ['/sobre-el-proyecto/', '/sobre-el-proyecto'],
  ['/sobre-el-proyecto.html', '/sobre-el-proyecto'],
  ['/sobre-el-proyecto/?diagnostico=1', '/sobre-el-proyecto?diagnostico=1'],
  ['/index.html', '/'],
  ['/404.html', '/404'],
];
const NOT_FOUND_H1 = /<h1[^>]*>\s*Página no encontrada\s*<\/h1>/;
const IMMUTABLE = 'public, max-age=31536000, immutable';
/** Lo que inyecta Cloudflare si se activan sus añadidos (Web Analytics, Rocket Loader…). */
const INJECTED = /cloudflareinsights|beacon\.min\.js|data-cf-beacon|\/cdn-cgi\//;
const TIMEOUT_MS = 20_000;

/**
 * @typedef {{ name: string, ok: boolean, detail: string }} Check
 * @typedef {{ url: string, label: string, type: RegExp }} Asset
 */

/** Los archivos de una carpeta del build que cumplen un patrón, como recursos que comprobar. */
async function buildAssets(build, dir, pattern, label, type) {
  const names = await readdir(path.join(build, dir)).catch(() => []);
  return names
    .filter((name) => pattern.test(name))
    .map((name) => ({ url: `/${dir ? `${dir}/` : ''}${name}`, label, type }));
}

/**
 * Hace todas las comprobaciones contra `base` y devuelve cada una con su resultado.
 * @param {string} base dirección del sitio (https://… o, en local, http://localhost:…)
 * @param {{ build?: string }} [options] carpeta del build publicado, para compararlo
 * @returns {Promise<Check[]>}
 */
export async function verifyPages(base, { build } = {}) {
  const site = new URL(base);
  const remote = site.protocol === 'https:';
  const pagesDev = site.hostname.endsWith('.pages.dev');
  /** @type {Check[]} */
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
  const cookies = [];
  /** GET o HEAD sin seguir redirecciones; apunta las cookies que lleguen. */
  const request = async (url, method = 'GET') => {
    const response = await fetch(new URL(url, site.origin), {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const cookie = response.headers.get('set-cookie');
    if (cookie) cookies.push(`${url}: ${cookie}`);
    return response;
  };

  // --- Las páginas: código, tipo, caché y, con --build, el mismo HTML -----------------------------
  /** @type {Record<string, string>} */
  const html = {};
  for (const page of PAGES) {
    const response = await request(page.path);
    const body = await response.text();
    html[page.path] = body;
    const type = response.headers.get('content-type') ?? '';
    const cache = response.headers.get('cache-control') ?? '';
    check(
      `${page.path} → 200, text/html`,
      response.status === 200 && /^text\/html/.test(type),
      `${response.status} · ${type}`,
    );
    check(
      `${page.path}: el HTML se revalida siempre`,
      !cache.includes('immutable') && /\b(no-cache|max-age=0)\b/.test(cache),
      cache,
    );
    if (build) {
      const local = await readFile(path.join(build, page.file), 'utf8');
      check(
        `${page.path}: el HTML es el del build`,
        body === local,
        `${body.length} caracteres servidos y ${local.length} en el build`,
      );
    }
  }

  // --- La barra final, `.html` e `index.html` redirigen a la URL buena, con la consulta ---------
  for (const [from, to] of REDIRECTS) {
    const response = await request(from, 'HEAD');
    const location = response.headers.get('location') ?? '';
    const target = location ? new URL(location, site.origin) : null;
    check(
      `${from} → ${to}`,
      [301, 308].includes(response.status) &&
        target?.origin === site.origin &&
        `${target.pathname}${target.search}` === to,
      `${response.status} → ${location || 'sin Location'}`,
    );
  }

  // --- 404: cualquier URL desconocida, con la página de error ------------------------------------
  for (const url of ['/no-existe', '/sobre-el-proyecto/no-existe']) {
    const response = await request(url);
    const body = await response.text();
    check(
      `${url} → 404 con la página de error`,
      response.status === 404 && NOT_FOUND_H1.test(body) && (!build || body === html['/404']),
      `${response.status}`,
    );
  }
  for (const url of ['/_headers', '/_redirects']) {
    const response = await request(url, 'HEAD');
    check(`${url} no se sirve`, response.status === 404, `${response.status}`);
  }

  // --- Cabeceras de seguridad (en la portada; la CSP, también en la 404) -------------------------
  const home = await request('/', 'HEAD');
  const missing = await request('/no-existe', 'HEAD');
  const header = (name) => home.headers.get(name) ?? '';
  const csp = header('content-security-policy');
  check(
    'CSP: scripts del sitio y los en línea por su hash',
    /script-src 'self'( 'sha256-[A-Za-z0-9+/]+=*')+;/.test(csp) && !csp.includes('__SCRIPT'),
    csp.length > 90 ? `${csp.slice(0, 89)}…` : csp,
  );
  check(
    "CSP: worker-src 'self', object-src y frame-ancestors 'none', sin eval",
    ["worker-src 'self'", "object-src 'none'", "frame-ancestors 'none'"].every((part) =>
      csp.includes(part),
    ) &&
      !csp.includes('unsafe-eval') &&
      !/script-src[^;]*unsafe-inline/.test(csp),
  );
  check('La 404 lleva la misma CSP', missing.headers.get('content-security-policy') === csp);
  if (build) {
    const rules = parseHeaders(await readFile(path.join(build, '_headers'), 'utf8'));
    check(
      'La CSP es la del _headers del build',
      csp === headersFor(rules, '/').get('content-security-policy'),
    );
  }
  check(
    'Permissions-Policy: el micrófono, solo para el sitio',
    header('permissions-policy').includes('microphone=(self)'),
    header('permissions-policy'),
  );
  check('X-Content-Type-Options: nosniff', header('x-content-type-options') === 'nosniff');
  check('X-Frame-Options: DENY', header('x-frame-options') === 'DENY');
  check(
    'Referrer-Policy: strict-origin-when-cross-origin',
    header('referrer-policy') === 'strict-origin-when-cross-origin',
    header('referrer-policy'),
  );
  check(
    'Strict-Transport-Security',
    /max-age=\d+/.test(header('strict-transport-security')),
    header('strict-transport-security'),
  );
  check(
    'Sin COOP ni COEP (no hay SharedArrayBuffer)',
    !header('cross-origin-opener-policy') && !header('cross-origin-embedder-policy'),
  );
  if (pagesDev) {
    check(
      'X-Robots-Tag: noindex',
      header('x-robots-tag').includes('noindex'),
      header('x-robots-tag') || 'ninguna',
    );
  }

  // --- Lo que carga la portada: tipo MIME y caché ------------------------------------------------
  const homeHtml = html['/'] ?? '';
  check('Sin Cloudflare Web Analytics ni scripts inyectados', !INJECTED.test(homeHtml));
  const main = /<script src="(main-[A-Za-z0-9_-]+\.js)"/.exec(homeHtml)?.[1];
  const styles = /href="(styles-[A-Za-z0-9_-]+\.css)"/.exec(homeHtml)?.[1];
  check('La portada carga main-….js y styles-….css', main && styles, `${main} · ${styles}`);
  /** @type {Asset[]} */
  const assets = [
    ...(main ? [{ url: `/${main}`, label: 'JavaScript', type: /javascript/ }] : []),
    ...(styles ? [{ url: `/${styles}`, label: 'CSS', type: /^text\/css/ }] : []),
  ];
  if (build) {
    assets.push(
      ...(await buildAssets(
        build,
        'audio',
        /^processor\.[A-Z0-9]+\.js$/,
        'JavaScript',
        /javascript/,
      )),
      ...(await buildAssets(build, '', /^worker-[A-Z0-9]+\.js$/, 'JavaScript', /javascript/)),
      ...(await buildAssets(build, 'media', /\.woff2$/, 'font/woff2', /^font\/woff2/)),
    );
  }
  for (const { url, label, type } of assets) {
    const response = await request(url, 'HEAD');
    const contentType = response.headers.get('content-type') ?? '';
    const cache = response.headers.get('cache-control') ?? '';
    check(
      `${url}: ${label}, inmutable`,
      response.status === 200 && type.test(contentType) && cache === IMMUTABLE,
      `${response.status} · ${contentType} · ${cache}`,
    );
  }
  const favicon = await request('/favicon.svg', 'HEAD');
  const faviconType = favicon.headers.get('content-type') ?? '';
  const faviconCache = favicon.headers.get('cache-control') ?? '';
  check(
    '/favicon.svg: image/svg+xml, un día',
    favicon.status === 200 &&
      /^image\/svg\+xml/.test(faviconType) &&
      faviconCache === 'public, max-age=86400',
    `${faviconType} · ${faviconCache}`,
  );

  // --- Sin cookies; en HTTPS, http:// redirige ---------------------------------------------------
  check('Sin cookies (ningún Set-Cookie)', cookies.length === 0, cookies.join(' · '));
  if (remote) {
    const http = await fetch(`http://${site.host}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);
    const location = http?.headers.get('location') ?? '';
    check(
      'http:// → https://',
      http && [301, 302, 307, 308].includes(http.status) && location.startsWith('https://'),
      http ? `${http.status} → ${location}` : 'sin respuesta',
    );
  }
  return checks;
}

/**
 * Espera a que la portada servida sea la del build: un alias como `staging` puede tardar un poco en
 * apuntar al despliegue nuevo. Devuelve si lo ha conseguido.
 */
async function waitForBuild(base, build, seconds) {
  const local = await readFile(path.join(build, 'index.html'), 'utf8');
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    const served = await fetch(new URL('/', base), { signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then((response) => response.text())
      .catch(() => '');
    if (served === local) return true;
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  /** @type {Record<string, string | undefined>} */
  const options = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (arg.startsWith('--')) options[arg.slice(2)] = args[++i];
    else positional.push(arg);
  }
  const [base] = positional;
  if (!base || !/^https?:\/\//.test(base)) {
    console.error(
      'Uso: node scripts/verify-pages.mjs https://staging.torno.pages.dev [--build dist/torno/browser] [--esperar 120]',
    );
    process.exit(2);
  }
  const build = options['build'];
  const wait = Number(options['esperar'] ?? 0);
  if (build && wait > 0 && !(await waitForBuild(base, build, wait))) {
    console.error(`✖ ${base} no sirve todavía el build de ${build} (tras ${wait} s)`);
  }
  const checks = await verifyPages(base, { build });
  console.log(`Comprobaciones de ${base}${build ? `, con el build de ${build}` : ''}:\n`);
  for (const { name, ok, detail } of checks) {
    console.log(`${ok ? '✔' : '✖'} ${name}${detail ? `: ${detail}` : ''}`);
  }
  const failed = checks.filter((item) => !item.ok).length;
  console.log(`\n${checks.length - failed} de ${checks.length} bien`);
  if (failed > 0) process.exitCode = 1;
}
