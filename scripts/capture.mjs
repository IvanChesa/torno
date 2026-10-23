// Capturas deterministas (`?captura=1`) de las páginas para los informes de fase, en escritorio
// y en móvil, servidas desde el build estático (CLAUDE.md, «Capturas»).
//
// Uso: npm run capturas -- --fase=0   (después de `npm run build`)
//      → docs/informes/img/fase-0/<página>-<escritorio|movil>.png
/* global document -- se usa dentro de page.evaluate(), que se ejecuta en la página */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';
import { startStaticServer } from './serve-static.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'sobre-el-proyecto', path: '/sobre-el-proyecto' },
  { name: '404', path: '/404' },
];
const VIEWPORTS = [
  { name: 'escritorio', options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: 'movil', options: { ...devices['Pixel 7'], deviceScaleFactor: 2 } },
];

const phaseArg = process.argv.find((arg) => arg.startsWith('--fase='));
if (!phaseArg) {
  console.error('Indica la fase: npm run capturas -- --fase=N');
  process.exit(1);
}
const outDir = path.join(ROOT, 'docs/informes/img', `fase-${phaseArg.slice('--fase='.length)}`);
await mkdir(outDir, { recursive: true });

const server = await startStaticServer({ port: 0 });
const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      ...viewport.options,
      locale: 'es-ES',
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    for (const target of PAGES) {
      await page.goto(`${server.url}${target.path}?captura=1`);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(outDir, `${target.name}-${viewport.name}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
      console.log(`✔ ${path.relative(ROOT, file)}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
