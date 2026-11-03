// El ajuste de métricas de las fuentes de reserva de Fraunces (DISENO.md §3, PLAN fase 8): mide en
// Chromium el ancho de los textos de la portada en Fraunces y en cada reserva local, a los tamaños
// del texto (17 px) y de la entradilla (20 px), con los ejes de la web (SOFT 0, opsz automático), y
// escribe el `size-adjust` y los `ascent-override` y `descent-override` de cada una. Mientras llega
// Fraunces, la reserva ocupa casi lo mismo: el texto no cambia de líneas al llegar y no mueve la
// página (el CLS de 0,098 del CI, con DejaVu Serif en Linux).
//
// Necesita las reservas instaladas en el equipo que lo ejecuta (en el PC de desarrollo: Palatino
// Linotype, Georgia, DejaVu Serif y Liberation Serif). Las cifras se copian a src/styles/fonts.css.
//
// Uso: node scripts/font-fallbacks.mjs
/* global document, FontFace -- dentro de page.evaluate(), en la página */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const FRAUNCES = fileURLToPath(
  new URL(
    '../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2',
    import.meta.url,
  ),
);
/** Las reservas de la pila de `--font-text`, con su nombre local (las de Apple no están aquí). */
export const FALLBACKS = ['Palatino Linotype', 'Georgia', 'DejaVu Serif', 'Liberation Serif'];
/** Textos de la portada (la entradilla, la nota y un párrafo), como se ven. */
const SAMPLES = [
  'Un instrumento de bucles de cuatro capas, de barro y latón, que se toca en el navegador.',
  'Nada suena hasta que tocas. Con el foco en el instrumento, Espacio reproduce y ? enseña los atajos.',
  'Cuatro capas que se repiten, un disco que arrastra el tiempo y lo que grabes, sin salir de tu navegador.',
];
const SIZES = [17, 20];

async function measure() {
  const font = (await readFile(FRAUNCES)).toString('base64');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    return await page.evaluate(
      async ({ font, fallbacks, samples, sizes }) => {
        const face = new FontFace('Medida Fraunces', `url(data:font/woff2;base64,${font})`, {
          weight: '100 900',
        });
        await face.load();
        document.fonts.add(face);
        const span = document.createElement('span');
        span.style.cssText =
          "white-space: nowrap; font-weight: 400; font-variation-settings: 'SOFT' 0; font-optical-sizing: auto; font-kerning: normal";
        document.body.append(span);
        const width = (family, size) => {
          span.style.fontFamily = family;
          span.style.fontSize = `${size}px`;
          let total = 0;
          for (const text of samples) {
            span.textContent = text;
            total += span.getBoundingClientRect().width;
          }
          return total;
        };
        const canvas = document.createElement('canvas').getContext('2d');
        const metrics = (family) => {
          canvas.font = `100px "${family}"`;
          const m = canvas.measureText('Hxgé');
          return { ascent: m.fontBoundingBoxAscent / 100, descent: m.fontBoundingBoxDescent / 100 };
        };
        const reference = sizes.map((size) => width('"Medida Fraunces"', size));
        const target = metrics('Medida Fraunces');
        return {
          target,
          fallbacks: fallbacks.map((name) => {
            const available = document.fonts.check(`16px "${name}"`);
            const ratios = sizes.map(
              (size, i) => reference[i] / width(`"${name}", monospace`, size),
            );
            return { name, available, ratios, ...metrics(name) };
          }),
        };
      },
      { font, fallbacks: FALLBACKS, samples: SAMPLES, sizes: SIZES },
    );
  } finally {
    await browser.close();
  }
}

const { target, fallbacks } = await measure();
const pct = (value) => `${(value * 100).toFixed(2)}%`;
console.log(
  `Fraunces: ascenso ${target.ascent.toFixed(3)} em y descenso ${target.descent.toFixed(3)} em`,
);
for (const fallback of fallbacks) {
  const adjust = fallback.ratios.reduce((sum, ratio) => sum + ratio, 0) / fallback.ratios.length;
  console.log(
    `${fallback.name}${fallback.available ? '' : ' (no está instalada: cifras de otra)'}: ` +
      `size-adjust ${pct(adjust)} (${fallback.ratios.map(pct).join(' y ')} a ${SIZES.join(' y ')} px) · ` +
      `ascent-override ${pct(target.ascent / adjust)} · descent-override ${pct(target.descent / adjust)}`,
  );
}
