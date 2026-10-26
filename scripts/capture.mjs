// Capturas deterministas (`?captura=1`) de las páginas para los informes de fase, en escritorio
// y en móvil, servidas desde el build estático (CLAUDE.md, «Capturas»).
//
// Uso: npm run capturas -- --fase=2   (después de `npm run build`)
//      → docs/informes/img/fase-2/<página>-<escritorio|movil>.png
//        y, desde la fase 2, el instrumento HTML de cerca, con sus avisos: en reposo, con el menú
//        abierto, con la chuleta de atajos, cargando el audio, con el error de «Reintentar» y
//        ofreciendo recuperar la sesión anterior.
/* global document, AudioWorklet -- se usan dentro de page.evaluate() y addInitScript(), en la página */
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

/** El instrumento de cerca (la sección, con sus avisos), sin el anillo de foco. */
async function shootInstrument(page, state, viewport) {
  await page.evaluate(() => /** @type {HTMLElement} */ (document.activeElement)?.blur());
  const file = path.join(outDir, `instrumento-${state}-${viewport}.png`);
  await page
    .locator('#instrumento')
    .screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  console.log(`✔ ${path.relative(ROOT, file)}`);
}

/** Abre la portada y espera al instrumento. */
async function openHome(page, url) {
  await page.goto(url);
  await settle(page, url);
  return page.locator('[data-control="main"]');
}

const server = await startStaticServer({ port: 0 });
const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      ...viewport.options,
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
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
    // El instrumento de cerca: en reposo, con el menú abierto (BUCLE) y con la chuleta de atajos.
    const home = `${server.url}/?captura=1`;
    let main = await openHome(page, home);
    await shootInstrument(page, 'reposo', viewport.name);
    await main.focus();
    await main.press('Enter');
    await main.press('ArrowDown');
    await main.press('Enter');
    await page.locator('trn-instrument-screen').getByText('DURACIÓN').waitFor();
    await shootInstrument(page, 'menu', viewport.name);
    main = await openHome(page, home);
    await main.focus();
    await page.keyboard.press('?');
    await page.getByRole('heading', { name: 'Atajos de teclado' }).waitFor();
    await shootInstrument(page, 'atajos', viewport.name);

    // El módulo de audio que no llega: «Preparando el audio…» y, a los 5 s, el error.
    const stuck = await context.newPage();
    await stuck.addInitScript(() => {
      AudioWorklet.prototype.addModule = () => new Promise(() => undefined);
    });
    await openHome(stuck, home);
    await stuck.locator('[data-control="play"]').click();
    await stuck.getByText('Preparando el audio…').waitFor();
    await shootInstrument(stuck, 'cargando', viewport.name);
    await stuck.getByText('El audio no ha cargado en 5 segundos.').waitFor({ timeout: 10_000 });
    await shootInstrument(stuck, 'error', viewport.name);
    await stuck.close();

    // Una sesión autoguardada (con la fecha fija) que se ofrece recuperar al volver.
    await page.clock.setFixedTime(new Date('2026-10-24T19:30:00+02:00'));
    main = await openHome(page, home);
    // SONIDO → BATERÍA → ALFAR, y fuera del menú.
    await main.focus();
    for (let i = 0; i < 4; i++) await main.press('Enter');
    for (let i = 0; i < 5; i++) await main.press('Escape');
    await page.locator('trn-instrument-screen').getByText('BATERÍA · ALFAR').waitFor();
    // El autoguardado espera 1,5 s tras la última edición.
    await page.waitForTimeout(2500);
    await openHome(page, home);
    await page.getByRole('button', { name: 'Recuperar la sesión anterior' }).waitFor();
    await shootInstrument(page, 'recuperar', viewport.name);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
