// Contraste WCAG 2.1 de cada combinación de color de docs/DISENO.md, leída de tokens.css.
// Lo comprueba scripts/contrast.spec.ts; este script imprime la tabla en Markdown para DISENO.md.
//
// Uso: node scripts/contrast.mjs
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/**
 * Texto o componente, fondo, mínimo AA y uso. 4,5 = texto; 3 = texto grande o componente.
 * @type {[fg: string, bg: string, min: number, use: string][]}
 */
export const PAIRS = [
  ['--color-ink', '--color-bg', 7, 'Texto principal'],
  ['--color-ink', '--color-surface', 7, 'Texto en paneles'],
  ['--color-ink', '--color-surface-2', 4.5, 'Botón secundario, teclas (`kbd`)'],
  ['--color-ink-muted', '--color-bg', 4.5, 'Texto secundario'],
  ['--color-ink-muted', '--color-surface', 4.5, 'Texto secundario en paneles'],
  ['--color-ink-muted', '--color-surface-2', 4.5, 'Texto secundario en paneles elevados'],
  ['--color-ink-faint', '--color-bg', 3, 'Solo texto grande (≥ 24 px): el nombre del pie'],
  ['--color-accent-text', '--color-bg', 4.5, 'Texto de acento'],
  ['--color-accent-text', '--color-surface', 4.5, 'Texto de acento en paneles'],
  ['--color-on-accent', '--color-accent', 4.5, 'Texto del botón principal y de la selección'],
  ['--color-on-accent', '--color-accent-hover', 4.5, 'Botón principal con el puntero encima'],
  ['--color-accent', '--color-bg', 3, 'Botón principal frente al fondo (WCAG 1.4.11)'],
  ['--color-accent', '--color-surface', 3, 'Botón principal frente a un panel'],
  ['--color-focus', '--color-bg', 3, 'Anillo de foco'],
  ['--color-focus', '--color-surface', 3, 'Anillo de foco sobre un panel'],
  ['--color-bg', '--color-ink', 7, 'Enlace «Saltar al contenido» (invertido)'],
  ['--color-error', '--color-bg', 4.5, 'Mensajes de error'],
  ['--color-error', '--color-surface', 4.5, 'Mensajes de error en paneles'],
  ['--color-warning', '--color-bg', 4.5, 'Avisos'],
  ['--color-warning', '--color-surface', 4.5, 'Avisos en paneles'],
  ['--color-phosphor', '--color-screen', 7, 'Pantalla del aparato'],
  ['--color-ink', '--instrument-plate', 4.5, 'Rótulos del instrumento HTML'],
  [
    '--instrument-brass',
    '--instrument-plate',
    3,
    'Diales y anillo del disco sobre el cuerpo (WCAG 1.4.11)',
  ],
  ['--instrument-key', '--instrument-plate', 3, 'Teclas sobre el cuerpo (WCAG 1.4.11)'],
  ['--color-bg', '--instrument-key', 7, 'Iconos y rótulos de las teclas'],
  ['--color-bg', '--instrument-brass', 3, 'Aguja de los diales'],
  ['--color-focus', '--instrument-plate', 3, 'Anillo de foco sobre el instrumento'],
];

/**
 * Lee los colores `--nombre: #rrggbb;` de una hoja de estilos.
 * @param {string} css
 * @returns {Map<string, string>}
 */
export function parseColorTokens(css) {
  const tokens = new Map();
  for (const [, name, hex] of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(name, hex.toLowerCase());
  }
  return tokens;
}

/**
 * Luminancia relativa de un color sRGB (WCAG 2.1).
 * @param {string} hex `#rrggbb`
 */
export function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} a @param {string} b */
export function contrastRatio(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Cada combinación con sus colores y su contraste. Falla si falta un token.
 * @param {Map<string, string>} tokens
 */
export function evaluatePairs(tokens, pairs = PAIRS) {
  return pairs.map(([fg, bg, min, use]) => {
    const fgHex = tokens.get(fg);
    const bgHex = tokens.get(bg);
    if (!fgHex || !bgHex) throw new Error(`Falta el token ${fgHex ? bg : fg} en tokens.css`);
    const ratio = contrastRatio(fgHex, bgHex);
    return { fg, bg, fgHex, bgHex, min, use, ratio, ok: ratio >= min };
  });
}

export async function readTokens() {
  return parseColorTokens(
    await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8'),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const rows = evaluatePairs(await readTokens());
  const ratio = (value) => value.toFixed(2).replace('.', ',');
  console.log('| Texto o componente | Fondo | Contraste | Mínimo | Uso |');
  console.log('|---|---|---|---|---|');
  for (const row of rows) {
    const mark = row.ok ? '✅' : '❌';
    console.log(
      `| \`${row.fg}\` ${row.fgHex} | \`${row.bg}\` ${row.bgHex} | ${mark} ${ratio(row.ratio)}:1 | ${ratio(row.min)}:1 | ${row.use} |`,
    );
  }
  if (rows.some((row) => !row.ok)) process.exit(1);
}
