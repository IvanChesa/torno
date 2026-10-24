// Capturas deterministas (`?captura=1`) de las páginas para los informes de fase, en escritorio
// y en móvil, servidas desde el build estático (CLAUDE.md, «Capturas»).
//
// Uso: npm run capturas -- --fase=2   (después de `npm run build`)
//      → docs/informes/img/fase-2/<página>-<escritorio|movil>.png
//        y, desde la fase 2, el instrumento HTML de cerca: en reposo y con el menú abierto.
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

/** Espera a que la página esté quieta: fuentes cargadas y, en la portada, el instrumento. */
async function settle(page, url) {
  await page.waitForLoadState('networkidle');
  if (new URL(url).pathname === '/') await page.locator('[data-control="main"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

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
      const url = `${server.url}${target.path}?captura=1`;
      await page.goto(url);
      await settle(page, url);
      const file = path.join(outDir, `${target.name}-${viewport.name}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
      console.log(`✔ ${path.relative(ROOT, file)}`);
    }
    // El instrumento de cerca: en reposo y con el menú abierto (BUCLE).
    const url = `${server.url}/?captura=1`;
    await page.goto(url);
    await settle(page, url);
    const stage = page.locator('#instrumento');
    for (const state of ['reposo', 'menu']) {
      if (state === 'menu') {
        const main = page.locator('[data-control="main"]');
        await main.focus();
        await main.press('Enter');
        await main.press('ArrowDown');
        await main.press('Enter');
        await page.locator('trn-instrument-screen').getByText('DURACIÓN').waitFor();
        await page.evaluate(() => /** @type {HTMLElement} */ (document.activeElement)?.blur());
      }
      const file = path.join(outDir, `instrumento-${state}-${viewport.name}.png`);
      await stage.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
      console.log(`✔ ${path.relative(ROOT, file)}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
