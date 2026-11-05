// El GIF del README (PLAN fase 9, tarea 3): el instrumento 3D sonando, con el disco girando al
// compás y un viaje de cámara por los encuadres de la barra. Del build servido como en Cloudflare
// Pages, con la GPU de verdad (como `npm run capturas -- --medir`) y sin `?captura=1`, que congela la
// animación. Los fotogramas los monta `sharp` (ya en la lista de PLAN §1) en un GIF que se repite,
// con el tiempo real entre fotogramas: lo que se ve va a la velocidad a la que sonó.
//
// Uso: node scripts/readme-gif.mjs   (después de `npm run build`) → docs/img/torno.gif
// No es determinista (es una grabación): se vuelve a generar a mano si cambia el aparato.
/* global document -- se usa dentro de page.evaluate(), en la página */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { startPagesServer } from './serve-pages.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'docs/img/torno.gif');
/** Ancho del GIF: se lee bien en el README sin pesar demasiado. */
const WIDTH = 560;
/** Cada cuánto se toma un fotograma (lo que tarde la captura, si es más). */
const STEP_MS = 90;

/** Fotogramas del escenario durante `ms`, con el momento de cada uno. */
async function record(page, stage, ms, frames) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const at = Date.now();
    frames.push({ at, png: await stage.screenshot({ type: 'png' }) });
    const wait = STEP_MS - (Date.now() - at);
    if (wait > 0) await page.waitForTimeout(wait);
  }
}

const server = await startPagesServer();
/** @type {import('@playwright/test').Browser | undefined} */
let browser;
try {
  // Dentro del `try`: si el navegador no arranca, el servidor también se cierra.
  browser = await chromium.launch({
    channel: 'chromium',
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
      ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 1,
    locale: 'es-ES',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  await page.goto(`${server.url}/`);
  await page.evaluate(() => document.fonts.ready);
  const main = page.locator('[data-control="main"]');
  await main.waitFor();
  // El 3D llega con el primer gesto (o con la página quieta 6 s): el foco en el dial principal.
  await main.focus();
  const stage = page.locator('.stage3d[data-listo]');
  await stage.waitFor({ timeout: 60_000 });
  await page.locator('trn-instrument-stage').scrollIntoViewIfNeeded();

  // La primera reproducción: la batería en la capa 1 y la capa 2 seleccionada.
  const screen = page.locator('trn-instrument-screen');
  await page.locator('[data-control="play"]').click();
  await screen.getByText('EN MARCHA').waitFor({ timeout: 30_000 });
  // Un bajo en la capa 2 (SONIDO → BAJO → el primero), que entra en el compás siguiente.
  await main.focus();
  await main.press('2');
  for (const key of ['Enter', 'Enter', 'ArrowDown', 'Enter', 'Enter']) await main.press(key);
  for (let i = 0; i < 5; i++) await main.press('Escape');
  await page.evaluate(() => /** @type {HTMLElement} */ (document.activeElement)?.blur());
  await page.mouse.move(0, 0);

  /** @type {{ at: number, png: Buffer }[]} */
  const frames = [];
  await record(page, stage, 2600, frames);
  for (const shot of ['Capas', 'Controles', 'Completo']) {
    await page.getByRole('button', { name: shot, exact: true }).click();
    await page.mouse.move(0, 0);
    await record(page, stage, shot === 'Completo' ? 2200 : 1800, frames);
  }

  const delays = frames.map((frame, i) => {
    const next = frames[i + 1];
    return next ? Math.round(next.at - frame.at) : STEP_MS;
  });
  const resized = await Promise.all(
    frames.map(({ png }) => sharp(png).resize({ width: WIDTH }).png().toBuffer()),
  );
  await mkdir(path.dirname(OUT), { recursive: true });
  await sharp(resized, { join: { animated: true } })
    .gif({ delay: delays, loop: 0, colours: 128, effort: 10, dither: 0.6 })
    .toFile(OUT);
  const { size } = await stat(OUT);
  const seconds = delays.reduce((sum, delay) => sum + delay, 0) / 1000;
  console.log(
    `✔ ${path.relative(ROOT, OUT)}: ${frames.length} fotogramas, ${seconds.toFixed(1)} s, ${(size / 1024).toFixed(0)} KiB`,
  );
} finally {
  await browser?.close();
  await server.close();
}
