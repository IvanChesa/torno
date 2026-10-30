// Capturas deterministas (`?captura=1`) de las páginas para los informes de fase, en escritorio
// y en móvil, del build estático servido como en Cloudflare Pages (CLAUDE.md, «Capturas»).
//
// Uso: npm run capturas -- --fase=2   (después de `npm run build`)
//      → docs/informes/img/fase-2/<página>-<escritorio|movil>.png
//        y, desde la fase 2, el instrumento HTML de cerca, con sus avisos: en reposo, con el menú
//        abierto, con la chuleta de atajos, cargando el audio, con el error de «Reintentar» y
//        ofreciendo recuperar la sesión anterior; desde la fase 3, el menú SONIDO con la colección,
//        MARCAR TEMPO, un cambio EN COLA y el panel de recuperar con los dos huecos y su
//        confirmación; desde la fase 4, el panel de diagnóstico (`?diagnostico=1`).
//
//      npm run capturas -- --fase=5 --solo=maqueta
//      → solo la maqueta 3D (`?maqueta=1`, fase 5.a): las 3 variantes desde 4 ángulos y la prueba
//        de mapeo de tonos (Neutral frente a AgX), en JPEG, más una hoja de contactos de cada cosa
//        y la sección de la maqueta entera. Escribe en la consola lo que cuesta pintarla.
/* global document, AudioWorklet -- se usan dentro de page.evaluate() y addInitScript(), en la página */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';
import { startPagesServer } from './serve-pages.mjs';

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

/** La maqueta (fase 5.a): variantes, vistas y mapeos de tonos, con sus nombres en la interfaz. */
const MOCKUP = {
  variants: [
    ['terracota', 'Terracota'],
    ['barro-oscuro', 'Barro oscuro'],
    ['arcilla-clara', 'Arcilla clara'],
  ],
  views: [
    ['frente', 'Frente'],
    ['tres-cuartos', 'Tres cuartos'],
    ['cenital', 'Cenital'],
    ['perfil', 'Perfil'],
  ],
  tones: [
    ['neutral', 'Neutral'],
    ['agx', 'AgX'],
  ],
  /** La vista de la prueba de mapeo de tonos. */
  toneView: 'tres-cuartos',
};

const onlyArg = process.argv.find((arg) => arg.startsWith('--solo='))?.slice('--solo='.length);
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

/**
 * Una imagen de la maqueta: la página con `?captura=1` y lo elegido en la URL; se espera a que el
 * visor haya pintado (`data-listo`). Devuelve lo que costó pintarla (`data-estadisticas`).
 */
async function shootMockup(page, base, choice, file) {
  const viewer = await openMockup(page, base, choice);
  await viewer.screenshot({
    path: file,
    type: 'jpeg',
    quality: 88,
    animations: 'disabled',
    caret: 'hide',
  });
  console.log(`✔ ${path.relative(ROOT, file)}`);
  return viewer.getAttribute('data-estadisticas');
}

/** Abre la portada con la maqueta y lo elegido, y espera a que el visor haya pintado. */
async function openMockup(page, base, { variant, view, tone }) {
  const params = new URLSearchParams({
    captura: '1',
    maqueta: '1',
    variante: variant,
    vista: view,
    tono: tone,
  });
  await page.goto(`${base}/?${params}`);
  await page.evaluate(() => document.fonts.ready);
  const viewer = page.locator('trn-mockup-stage .viewer[data-listo]');
  await viewer.waitFor({ timeout: 60_000 });
  await viewer.scrollIntoViewIfNeeded();
  return viewer;
}

/**
 * Hoja de contactos: las imágenes en una rejilla, con su nombre encima, pintada por el propio
 * navegador (sin dependencias para componer imágenes).
 */
async function contactSheet(browser, cells, columns, file) {
  const images = await Promise.all(
    cells.map(async ({ file: image, label }) => ({
      label,
      src: `data:image/jpeg;base64,${(await readFile(image)).toString('base64')}`,
    })),
  );
  const page = await browser.newPage({
    viewport: { width: 1800, height: 600 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
    <style>
      body { margin: 0; padding: 24px; background: #252712; color: #f1ece0;
        font: 500 20px ui-monospace, Consolas, monospace; }
      main { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 24px 16px; }
      figure { margin: 0; display: grid; gap: 8px; }
      img { inline-size: 100%; display: block; }
    </style>
    <main>${images.map(({ label, src }) => `<figure><figcaption>${label}</figcaption><img src="${src}"></figure>`).join('')}</main>`);
  await page.locator('main').screenshot({ path: file, type: 'jpeg', quality: 86 });
  await page.close();
  console.log(`✔ ${path.relative(ROOT, file)}`);
}

/** La maqueta en un tamaño de pantalla: variantes × vistas, mapeo de tonos y la sección entera. */
async function captureMockup(browser, context, base, viewport) {
  const page = await context.newPage();
  const variants = [];
  let stats = null;
  for (const [variant, variantName] of MOCKUP.variants) {
    for (const [view, viewName] of MOCKUP.views) {
      const file = path.join(outDir, `maqueta-${variant}-${view}-${viewport}.jpg`);
      const shot = await shootMockup(page, base, { variant, view, tone: 'neutral' }, file);
      stats ??= shot;
      variants.push({ file, label: `${variantName} · ${viewName}` });
    }
  }
  const tones = [];
  for (const [tone, toneName] of MOCKUP.tones) {
    for (const [variant, variantName] of MOCKUP.variants) {
      const file = path.join(outDir, `maqueta-tono-${tone}-${variant}-${viewport}.jpg`);
      if (tone === 'neutral') {
        // La misma que la de la vista de tres cuartos: no hace falta otra.
        tones.push({
          file: path.join(outDir, `maqueta-${variant}-${MOCKUP.toneView}-${viewport}.jpg`),
          label: `${toneName} · ${variantName}`,
        });
        continue;
      }
      await shootMockup(page, base, { variant, view: MOCKUP.toneView, tone }, file);
      tones.push({ file, label: `${toneName} · ${variantName}` });
    }
  }
  await contactSheet(
    browser,
    variants,
    MOCKUP.views.length,
    path.join(outDir, `maqueta-variantes-${viewport}.jpg`),
  );
  await contactSheet(
    browser,
    tones,
    MOCKUP.variants.length,
    path.join(outDir, `maqueta-tono-${viewport}.jpg`),
  );
  // La sección entera, con los botones y las medidas.
  await openMockup(page, base, { variant: 'terracota', view: 'frente', tone: 'neutral' });
  const section = path.join(outDir, `maqueta-seccion-${viewport}.png`);
  await page
    .locator('trn-mockup-stage')
    .screenshot({ path: section, animations: 'disabled', caret: 'hide' });
  console.log(`✔ ${path.relative(ROOT, section)}`);
  console.log(`  Coste de pintar la maqueta (${viewport}): ${stats}`);
  await page.close();
}

const server = await startPagesServer();
/** @type {import('@playwright/test').Browser | undefined} */
let browser;
try {
  // Dentro del `try`: si el navegador no arranca, el servidor también se cierra.
  browser = await chromium.launch();
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      ...viewport.options,
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    if (onlyArg === 'maqueta') {
      await captureMockup(browser, context, server.url, viewport.name);
      await context.close();
      continue;
    }
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

    // El panel de diagnóstico, antes de tocar (sin cifras que cambien de una vez a otra).
    await openHome(page, `${home}&diagnostico=1`);
    await page.getByRole('region', { name: 'Diagnóstico del audio' }).waitFor();
    await shootInstrument(page, 'diagnostico', viewport.name);

    // SONIDO → BATERÍA: los tres bucles y APAGADO.
    main = await openHome(page, home);
    await main.focus();
    for (let i = 0; i < 3; i++) await main.press('Enter');
    await page.locator('trn-instrument-screen').getByText('HORNO').waitFor();
    await shootInstrument(page, 'sonido', viewport.name);
    // BUCLE → MARCAR TEMPO.
    main = await openHome(page, home);
    await main.focus();
    await main.press('Enter');
    await main.press('ArrowDown');
    await main.press('Enter');
    for (let i = 0; i < 5; i++) await main.press('ArrowDown');
    await page.locator('trn-instrument-screen').getByText('MARCAR TEMPO').waitFor();
    await shootInstrument(page, 'marcar-tempo', viewport.name);

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

    // Sin contestar, un cambio en marcha: ALFAR suena y el bajo de la capa 2 espera EN COLA.
    main = page.locator('[data-control="main"]');
    await page.locator('[data-control="play"]').click();
    await page.locator('trn-instrument-screen').getByText('EN MARCHA').waitFor();
    await main.focus();
    await main.press('2');
    await main.press('Enter');
    await main.press('Enter');
    await main.press('ArrowDown');
    await main.press('Enter');
    await main.press('Enter');
    for (let i = 0; i < 5; i++) await main.press('Escape');
    await page.locator('trn-instrument-screen').getByText('EN COLA').waitFor();
    await shootInstrument(page, 'en-cola', viewport.name);
    // Lo tocado va al segundo hueco: al volver, el panel ofrece las dos sesiones.
    await page.locator('[data-control="play"]').click();
    await page.waitForTimeout(4000);
    await openHome(page, home);
    await page.getByRole('button', { name: 'Recuperar lo que tocaste después' }).waitFor();
    await shootInstrument(page, 'recuperar-dos', viewport.name);
    // Con sonido en la sesión actual, «Recuperar» pide confirmación («Cancelar» primero).
    main = page.locator('[data-control="main"]');
    await main.focus();
    for (let i = 0; i < 4; i++) await main.press('Enter');
    for (let i = 0; i < 5; i++) await main.press('Escape');
    await page.locator('trn-instrument-screen').getByText('BATERÍA · ALFAR').waitFor();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Recuperar la sesión anterior' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).waitFor();
    await shootInstrument(page, 'recuperar-confirmar', viewport.name);
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
