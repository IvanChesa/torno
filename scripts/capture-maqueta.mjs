// Capturas de la maqueta de alta fidelidad de la portada (PLAN fase 7, tarea 2): docs/maqueta/
// abierta desde el disco, en escritorio y en móvil, con las dos opciones del espejo de la pantalla
// (propuesta 2 de la fase 6). No necesita el build.
//
// Uso: node scripts/capture-maqueta.mjs
//      → docs/informes/img/fase-7/maqueta-espejo-<a|b>-<escritorio|movil>.png
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, devices } from '@playwright/test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE = pathToFileURL(path.join(ROOT, 'docs/maqueta/index.html')).href;
const OUT = path.join(ROOT, 'docs/informes/img/fase-7');
const VIEWPORTS = [
  { name: 'escritorio', options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: 'movil', options: { ...devices['Pixel 7'], deviceScaleFactor: 2 } },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ ...viewport.options, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const option of ['a', 'b']) {
      await page.goto(`${PAGE}?espejo=${option}`);
      await page.evaluate(() => document.fonts.ready.then(() => true));
      const file = path.join(OUT, `maqueta-espejo-${option}-${viewport.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`✔ ${path.relative(ROOT, file)}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
