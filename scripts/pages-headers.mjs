// Qué cabeceras de `_headers` lleva cada URL en Cloudflare Pages (PLAN D19). Lo usan el paso tras el
// build (scripts/pages.mjs), que comprueba la caché de cada archivo, y la comprobación de un
// despliegue (scripts/verify-pages.mjs). En local no hace falta para servir: el servidor es el propio
// Pages (`wrangler pages dev`).
//
// No es el analizador de Pages: entiende lo que usa el _headers del proyecto, con las reglas de su
// documentación:
// - un patrón de URL por línea, sin sangría (una ruta, `/…`, o una dirección completa, `https://…`),
//   y debajo sus cabeceras, con sangría (`Nombre: valor`);
// - `*` (uno por patrón) casa con cualquier cosa, también con `/`; `:nombre` casa con un trozo sin
//   `/` (y, en el dominio, sin `.`);
// - si varias reglas dan la misma cabecera, sus valores se unen con una coma.
// Lo que no entiende (quitar cabeceras con `!`, más de un `*`), lo rechaza.

/**
 * @typedef {{ pattern: string, host: RegExp | null, path: RegExp, headers: [string, string][] }} HeaderRule
 */

const escapeRegExp = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** Expresión de un trozo del patrón: `*`, los `:nombre` y lo demás literal. */
function compile(part, placeholder) {
  const source = part
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((token) => {
      if (token === '*') return '.*';
      if (/^:[A-Za-z]\w*$/.test(token)) return placeholder;
      return escapeRegExp(token);
    })
    .join('');
  return new RegExp(`^${source}$`);
}

/**
 * Lee las reglas de un `_headers`, en orden.
 * @param {string} text
 * @returns {HeaderRule[]}
 */
export function parseHeaders(text) {
  /** @type {HeaderRule[]} */
  const rules = [];
  /** @type {HeaderRule | null} */
  let rule = null;
  text.split(/\r?\n/).forEach((raw, index) => {
    const where = `_headers, línea ${index + 1}`;
    if (!raw.trim() || raw.trimStart().startsWith('#')) return;
    if (!/^\s/.test(raw)) {
      const pattern = raw.trim();
      if (pattern.split('*').length > 2) throw new Error(`${where}: más de un * en «${pattern}»`);
      const absolute = /^https?:\/\/([^/]+)(\/.*)?$/.exec(pattern);
      if (!absolute && !pattern.startsWith('/')) {
        throw new Error(
          `${where}: el patrón tiene que empezar por / o por https:// («${pattern}»)`,
        );
      }
      rule = {
        pattern,
        host: absolute ? compile(absolute[1] ?? '', '[^./]+') : null,
        path: compile(absolute ? (absolute[2] ?? '/') : pattern, '[^/]+'),
        headers: [],
      };
      rules.push(rule);
      return;
    }
    const line = raw.trim();
    if (line.startsWith('!')) throw new Error(`${where}: quitar cabeceras (!) no está admitido`);
    const colon = line.indexOf(':');
    if (!rule || colon <= 0) throw new Error(`${where}: cabecera sin patrón o sin «:» («${line}»)`);
    rule.headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
  });
  return rules;
}

/**
 * Las cabeceras que da `_headers` a una URL, con los nombres en minúsculas. La URL puede ser una
 * ruta (`/main-X.js`: las reglas con dominio no cuentan) o una dirección completa
 * (`https://torno.pages.dev/`).
 * @param {HeaderRule[]} rules
 * @param {string} url
 * @returns {Map<string, string>}
 */
export function headersFor(rules, url) {
  const { hostname, pathname } = url.startsWith('/')
    ? { hostname: null, pathname: url }
    : new URL(url);
  const headers = new Map();
  for (const rule of rules) {
    if (rule.host && (hostname === null || !rule.host.test(hostname))) continue;
    if (!rule.path.test(pathname)) continue;
    for (const [name, value] of rule.headers) {
      const key = name.toLowerCase();
      const previous = headers.get(key);
      headers.set(key, previous === undefined ? value : `${previous}, ${value}`);
    }
  }
  return headers;
}
