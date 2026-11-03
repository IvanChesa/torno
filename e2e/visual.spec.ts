import { expect, test, type Page } from '@playwright/test';

// Regresión visual (PLAN fase 8, tarea 6): capturas deterministas (`?captura=1`: sin animaciones,
// sin cursor y con el 3D en un estado fijo) comparadas con sus referencias. Las referencias dependen
// del sistema (las fuentes se pintan distinto en cada uno), así que **solo se generan en el CI**
// (Linux), con el flujo «Referencias visuales» (.github/workflows/visual-refs.yml), y van al
// repositorio en e2e/visual.spec.ts-snapshots/. En local, este proyecto solo corre con VISUAL=1.

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** Espera a lo que se ve: las fuentes, la red y, si lo hay, el primer fotograma del 3D. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator('trn-instrument-stage').count()) {
    await page.locator('.stage3d[data-listo]').waitFor({ timeout: 60_000 });
  }
  if (await page.locator('trn-html-instrument').count()) {
    await page.locator('[data-control="main"]').waitFor();
  }
}

const PAGES = [
  // La portada con el plato HTML: sin WebGL, lo más estable.
  { name: 'portada-plato', path: '/?sin3d=1&captura=1' },
  { name: 'sobre-el-proyecto', path: '/sobre-el-proyecto?captura=1' },
  { name: '404', path: '/404?captura=1' },
];

for (const [device, viewport] of [
  ['escritorio', DESKTOP],
  ['movil', MOBILE],
] as const) {
  test.describe(`regresión visual en el ${device}`, () => {
    test.use({ viewport, deviceScaleFactor: 1 });

    for (const { name, path } of PAGES) {
      test(`${name}: la primera pantalla`, async ({ page }) => {
        await page.goto(path);
        await settle(page);
        await expect(page).toHaveScreenshot(`${name}-${device}.png`, {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: 0.002,
        });
      });
    }

    test('las secciones de la portada: la guía, los detalles y la ficha técnica', async ({
      page,
    }) => {
      await page.goto('/?sin3d=1&captura=1');
      await settle(page);
      for (const [section, label] of [
        ['guia', 'guia-titulo'],
        ['detalles', 'detalles'],
        ['ficha', 'ficha'],
      ] as const) {
        const locator = page.locator(`section[aria-labelledby="${label}"]`);
        await locator.scrollIntoViewIfNeeded();
        await page.waitForLoadState('networkidle');
        await expect(locator).toHaveScreenshot(`seccion-${section}-${device}.png`, {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: 0.002,
        });
      }
    });

    // El 3D por software (SwiftShader) en el CI: determinista en la misma imagen del sistema, con
    // algo más de margen por el suavizado.
    test('el instrumento 3D en el encuadre «Completo»', async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto('/?captura=1');
      await settle(page);
      await expect(page.locator('#instrumento')).toHaveScreenshot(`instrumento3d-${device}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.02,
      });
    });
  });
}
