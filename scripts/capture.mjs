// Capturas deterministas (`?captura=1`) de las páginas para los informes de fase, en escritorio
// y en móvil, del build estático servido como en Cloudflare Pages (CLAUDE.md, «Capturas»).
//
// Uso: npm run capturas -- --fase=2   (después de `npm run build`)
//      → docs/informes/img/fase-2/<página>-<escritorio|movil>.png
//        y, desde la fase 2, el instrumento HTML de cerca (con `?sin3d=1`), con sus avisos: en
//        reposo, con el menú abierto, con la chuleta de atajos, cargando el audio, con el error de
//        «Reintentar» y ofreciendo recuperar la sesión anterior; desde la fase 3, el menú SONIDO con
//        la colección, MARCAR TEMPO, un cambio EN COLA y el panel de recuperar con los dos huecos y
//        su confirmación; desde la fase 4, el panel de diagnóstico (`?diagnostico=1`).
//
//      npm run capturas -- --fase=5 --solo=escenario
//      → solo el escenario 3D (fase 5.b): el aparato desde 4 ángulos, en JPEG, con una hoja de
//        contactos. Escribe en la consola lo que cuesta pintarlo, por nivel de calidad.
//
//      npm run capturas -- --poster
//      → el póster provisional del escenario (public/img/escenario.webp, 1200×960): una captura del
//        propio motor, para que el fundido al primer fotograma no mueva nada.
/* global document, AudioWorklet, Image -- se usan dentro de page.evaluate() y addInitScript(), en la página */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

/** Las vistas del escenario 3D (fase 5.b), con sus nombres para la hoja de contactos. */
const STAGE_VIEWS = [
  ['frente', 'Frente'],
  ['tres-cuartos', 'Tres cuartos'],
  ['cenital', 'Cenital'],
  ['perfil', 'Perfil'],
];
/** El póster: 1200×960 (5:4, como el lienzo). */
const POSTER = { file: 'public/img/escenario.webp', width: 1200, height: 960, quality: 0.8 };

const onlyArg = process.argv.find((arg) => arg.startsWith('--solo='))?.slice('--solo='.length);
const posterArg = process.argv.includes('--poster');
const phaseArg = process.argv.find((arg) => arg.startsWith('--fase='));
if (!phaseArg && !posterArg) {
  console.error('Indica la fase: npm run capturas -- --fase=N (o --poster)');
  process.exit(1);
}
const outDir = path.join(ROOT, 'docs/informes/img', `fase-${phaseArg?.slice('--fase='.length)}`);
if (phaseArg) await mkdir(outDir, { recursive: true });

/**
 * Espera a que la página esté quieta: fuentes cargadas y, en la portada, el instrumento y (sin
 * `?sin3d=1`) el primer fotograma del escenario 3D.
 */
async function settle(page, url) {
  await page.waitForLoadState('networkidle');
  const { pathname, searchParams } = new URL(url);
  if (pathname === '/') {
    await page.locator('[data-control="main"]').waitFor();
    if (searchParams.get('sin3d') !== '1') {
      await page.locator('.stage3d[data-listo]').waitFor({ timeout: 60_000 });
    }
  }
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
 * El escenario 3D con `?captura=1` y lo elegido en la URL (vista y calidad): se espera a su primer
 * fotograma (`data-listo`). Devuelve el escenario y lo que costó pintarlo (`data-estadisticas`).
 */
async function openStage(page, base, params) {
  await page.goto(`${base}/?${new URLSearchParams({ captura: '1', ...params })}`);
  await page.evaluate(() => document.fonts.ready);
  const stage = page.locator('.stage3d[data-listo]');
  await stage.waitFor({ timeout: 60_000 });
  await stage.scrollIntoViewIfNeeded();
  return { stage, stats: await stage.getAttribute('data-estadisticas') };
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

/** El escenario 3D en un tamaño de pantalla: el aparato desde 4 ángulos y su hoja de contactos. */
async function captureStage(browser, context, base, viewport) {
  const page = await context.newPage();
  const cells = [];
  for (const [view, viewName] of STAGE_VIEWS) {
    const { stage, stats } = await openStage(page, base, { vista: view });
    const file = path.join(outDir, `escenario-${view}-${viewport}.jpg`);
    await stage.screenshot({ path: file, type: 'jpeg', quality: 88, animations: 'disabled' });
    console.log(`✔ ${path.relative(ROOT, file)}`);
    if (view === 'frente') console.log(`  Coste de pintarlo (${viewport}, alta): ${stats}`);
    cells.push({ file, label: viewName });
  }
  await contactSheet(browser, cells, 2, path.join(outDir, `escenario-vistas-${viewport}.jpg`));
  for (const quality of ['medium', 'low']) {
    const { stats } = await openStage(page, base, { calidad: quality });
    console.log(`  Coste de pintarlo (${viewport}, ${quality}): ${stats}`);
  }
  await page.close();
}

/**
 * El póster del escenario: el lienzo en `?captura=1` (con el fondo de la página), llevado a
 * 1200×960 y codificado en WebP por el propio navegador (sin dependencias para imágenes).
 */
async function capturePoster(browser, base) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  const { stage } = await openStage(page, base, {});
  const png = await stage.locator('canvas').screenshot({ type: 'png', animations: 'disabled' });
  await page.close();
  // En una página en blanco: la de Torno no deja cargar imágenes `data:` (CSP, `img-src 'self'`).
  const encoder = await browser.newPage();
  await encoder.setContent('<!doctype html><title>póster</title>');
  const webp = await encoder.evaluate(
    async ({ src, width, height, quality }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/webp', quality).split(',')[1];
    },
    {
      src: `data:image/png;base64,${png.toString('base64')}`,
      width: POSTER.width,
      height: POSTER.height,
      quality: POSTER.quality,
    },
  );
  const file = path.join(ROOT, POSTER.file);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(webp, 'base64'));
  console.log(`✔ ${POSTER.file} (${Math.round(Buffer.from(webp, 'base64').length / 1024)} kB)`);
  await encoder.close();
}

const server = await startPagesServer();
/** @type {import('@playwright/test').Browser | undefined} */
let browser;
try {
  // Dentro del `try`: si el navegador no arranca, el servidor también se cierra.
  browser = await chromium.launch();
  if (posterArg) {
    await capturePoster(browser, server.url);
  }
  for (const viewport of phaseArg ? VIEWPORTS : []) {
    const context = await browser.newContext({
      ...viewport.options,
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    if (onlyArg === 'escenario') {
      await captureStage(browser, context, server.url, viewport.name);
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
    // El instrumento HTML de cerca (sin el 3D): en reposo, con el menú abierto (BUCLE) y con la
    // chuleta de atajos.
    const home = `${server.url}/?captura=1&sin3d=1`;
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
