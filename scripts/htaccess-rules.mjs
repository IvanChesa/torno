// Lo que el servidor hace con cada archivo según el .htaccess del proyecto (public/.htaccess): las
// cabeceras globales (`Header [always] set`), las de cada bloque <FilesMatch>/<Files> y los
// archivos denegados (`Require all denied`). Lo usan el paso tras el build (scripts/htaccess.mjs),
// que comprueba la caché de cada archivo, y el servidor local de los e2e (scripts/serve-static.mjs),
// que sirve el build con esas cabeceras.
//
// No es un intérprete de Apache: entiende solo las directivas que usa este .htaccess. Los bloques
// <IfModule> se toman como activos. Las expresiones de <FilesMatch> son PCRE sencillas, iguales en
// JavaScript, y se comparan con el nombre del archivo (sin carpetas), como hace Apache.

/**
 * @typedef {{ pattern: RegExp, headers: [string, string][], deny: boolean }} FileRule
 * @typedef {{ headers: [string, string][], files: FileRule[] }} HtaccessRules
 */

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lee las cabeceras y los bloques de archivos de un .htaccess.
 * @param {string} text
 * @returns {HtaccessRules}
 */
export function parseHtaccess(text) {
  /** @type {HtaccessRules} */
  const rules = { headers: [], files: [] };
  /** @type {FileRule | null} */
  let block = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let match;
    if ((match = /^<FilesMatch\s+"(.+)">$/i.exec(line))) {
      block = { pattern: new RegExp(match[1]), headers: [], deny: false };
    } else if ((match = /^<Files\s+"(.+)">$/i.exec(line))) {
      block = { pattern: new RegExp(`^${escapeRegExp(match[1])}$`), headers: [], deny: false };
    } else if (/^<\/Files(Match)?>$/i.test(line)) {
      if (!block) throw new Error('Cierre de <Files> sin apertura en el .htaccess');
      rules.files.push(block);
      block = null;
    } else if ((match = /^Header\s+(?:always\s+)?set\s+([A-Za-z0-9-]+)\s+"(.*)"$/i.exec(line))) {
      (block ? block.headers : rules.headers).push([match[1], match[2]]);
    } else if (block && /^Require\s+all\s+denied$/i.test(line)) {
      block.deny = true;
    }
  }
  if (block) throw new Error('Un bloque <Files> sin cerrar en el .htaccess');
  return rules;
}

/**
 * Cabeceras que lleva un archivo (las globales y las de sus bloques; las de un bloque mandan sobre
 * las globales con el mismo nombre) y si está denegado.
 * @param {HtaccessRules} rules
 * @param {string} file ruta del archivo (se usa solo el nombre)
 * @returns {{ headers: Map<string, string>, deny: boolean }}
 */
export function headersFor(rules, file) {
  const name = file.replaceAll('\\', '/').split('/').pop() ?? '';
  const headers = new Map(rules.headers.map(([key, value]) => [key.toLowerCase(), value]));
  let deny = false;
  for (const rule of rules.files) {
    if (!rule.pattern.test(name)) continue;
    for (const [key, value] of rule.headers) headers.set(key.toLowerCase(), value);
    deny ||= rule.deny;
  }
  return { headers, deny };
}
