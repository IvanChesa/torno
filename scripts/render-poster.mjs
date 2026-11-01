// Las imágenes de la web, renderizadas con el propio motor (PLAN fase 7, tarea 5): el lienzo del
// escenario 3D en `?captura=1` (todo fijo) del build servido como en Cloudflare Pages.
// - Los pósteres del escenario: el del escritorio (5:4) y el del móvil (1:1), del mismo tamaño que
//   su lienzo, para que el fundido al primer fotograma no mueva nada.
// - Los renders de las secciones: los diales de «Qué es» (encuadre «Capas») y el aparato despiezado
//   de «Los detalles».
// - La imagen Open Graph (D18), 1200×630: el aparato con su nombre al lado, en JPEG (la que leen
//   todas las apps al enseñar un enlace).
//
// Las codifica el propio navegador (WebP con un lienzo y JPEG con la captura de una página), sin
// dependencias para imágenes.
//
// Uso: node scripts/render-poster.mjs   (después de `npm run build`; luego, otro build para que
//      entren en dist/)
/* global document, Image -- dentro de page.evaluate(), en la página */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startPagesServer } from './serve-pages.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Los del escenario, cada uno en un tamaño de pantalla en el que la caja tiene esa proporción. */
const POSTERS = [
  {
    file: 'public/img/escenario.webp',
    width: 1200,
    height: 960,
    viewport: { width: 1440, height: 1100 },
    mobile: false,
  },
  {
    file: 'public/img/escenario-movil.webp',
    width: 800,
    height: 800,
    viewport: { width: 400, height: 860 },
    mobile: true,
  },
  {
    file: 'public/img/capas.webp',
    width: 1000,
    height: 800,
    viewport: { width: 1440, height: 1100 },
    mobile: false,
    params: { encuadre: 'capas' },
  },
  {
    file: 'public/img/despiezado.webp',
    width: 1200,
    height: 960,
    viewport: { width: 1440, height: 1100 },
    mobile: false,
    params: { encuadre: 'despiezado' },
  },
];
const WEBP_QUALITY = 0.8;
const SHARE = { file: 'public/img/og.jpg', width: 1200, height: 630, quality: 86 };

/** El lienzo del escenario en `?captura=1`, sin el espejo de la pantalla que va encima. */
async function renderStage(browser, base, { viewport, mobile, params = {} }) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  await page.goto(`${base}/?${new URLSearchParams({ captura: '1', ...params })}`);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const stage = page.locator('.stage3d[data-listo]');
  await stage.waitFor({ timeout: 60_000 });
  await stage.scrollIntoViewIfNeeded();
  await page.addStyleTag({ content: '.mirror { visibility: hidden; }' });
  const png = await stage.locator('canvas').screenshot({ type: 'png', animations: 'disabled' });
  await page.close();
  return png;
}

/** Una imagen llevada a un tamaño y pasada a WebP, en una página en blanco (sin la CSP de Torno). */
async function toWebp(browser, png, width, height) {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>póster</title>');
  const webp = await page.evaluate(
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
      width,
      height,
      quality: WEBP_QUALITY,
    },
  );
  await page.close();
  return Buffer.from(webp, 'base64');
}

async function save(file, bytes) {
  const target = path.join(ROOT, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  console.log(`✔ ${file} (${Math.round(bytes.length / 1024)} kB)`);
}

/** Una fuente del proyecto como `data:` (la página de la composición no tiene servidor). */
async function fontData(file) {
  const bytes = await readFile(path.join(ROOT, 'node_modules', file));
  return `data:font/woff2;base64,${bytes.toString('base64')}`;
}

/**
 * La imagen Open Graph: el aparato (el póster del escritorio, recortado) a la derecha y su nombre y
 * lo que es a la izquierda, con las fuentes y los colores de la web (tokens.css).
 */
async function renderShare(browser, posterPng) {
  const tokens = await readFile(path.join(ROOT, 'src/styles/tokens.css'), 'utf8');
  const fraunces = await fontData(
    '@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2',
  );
  const page = await browser.newPage({
    viewport: { width: SHARE.width, height: SHARE.height },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
${tokens}
@font-face { font-family: 'Fraunces Variable'; font-weight: 100 900; src: url(${fraunces}) format('woff2-variations'); }
* { margin: 0; box-sizing: border-box; }
body {
  display: grid; grid-template-columns: 430px 1fr; align-items: center;
  inline-size: ${SHARE.width}px; block-size: ${SHARE.height}px; overflow: hidden;
  padding-inline: 64px 24px; background: var(--color-bg); color: var(--color-ink);
  font-family: var(--font-text);
}
h1 { font-size: 132px; line-height: 0.9; letter-spacing: -0.03em; font-weight: 640;
  font-variation-settings: 'SOFT' 100; }
p { margin-block-start: 28px; font-size: 34px; line-height: 1.25; }
img { inline-size: 100%; block-size: ${SHARE.height}px; object-fit: contain; }
</style></head><body>
<div><h1>Torno</h1><p>Un instrumento de bucles que se toca en el navegador.</p></div>
<img src="data:image/png;base64,${posterPng.toString('base64')}" alt="">
</body></html>`);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const jpeg = await page.screenshot({ type: 'jpeg', quality: SHARE.quality });
  await page.close();
  return jpeg;
}

const server = await startPagesServer();
/** @type {import('@playwright/test').Browser | undefined} */
let browser;
try {
  browser = await chromium.launch();
  let desktop;
  for (const poster of POSTERS) {
    const png = await renderStage(browser, server.url, poster);
    if (poster.file === 'public/img/escenario.webp') desktop = png;
    await save(poster.file, await toWebp(browser, png, poster.width, poster.height));
  }
  await save(SHARE.file, await renderShare(browser, desktop));
} finally {
  await browser?.close();
  await server.close();
}
