import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Accesibilidad de la fase 8 (PLAN, tarea 3), contra el build: axe en el móvil y con la chuleta
// abierta, la web a 320 px sin desplazarse a lo ancho (WCAG 1.4.10), con el zum al 200 % (1.4.4) y
// con el espaciado de texto de 1.4.12. Los estados del 3D (sus vistas, con su barra), en
// stage.spec.ts; las rutas de siempre, en static.spec.ts.

const ROUTES = ['/?sin3d=1', '/sobre-el-proyecto', '/404'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/** Baja hasta el final poco a poco (lo de abajo llega al acercarse) y vuelve arriba. */
async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(40);
  }
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

/** Lo que se sale a lo ancho: la página y, si la hay, la primera caja que se pasa del borde. */
async function overflow(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width) return null;
    const wide = [...document.querySelectorAll('body *')].find(
      (element) => element.getBoundingClientRect().right > width + 1,
    );
    return `${document.documentElement.scrollWidth} > ${width}: ${wide?.tagName.toLowerCase()}.${wide?.className}`;
  });
}

test.describe('accesibilidad (fase 8)', () => {
  test.describe('en el móvil', () => {
    test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

    for (const route of ROUTES) {
      test(`${route}: axe sin violaciones, recorrida entera`, async ({ page }) => {
        await page.goto(route);
        await scrollThrough(page);
        expect(await axe(page)).toEqual([]);
      });
    }
  });

  test('el plato HTML con la chuleta de atajos abierta pasa axe', async ({ page }) => {
    await page.goto('/?sin3d=1');
    const tools = page.getByRole('button', { name: 'Atajos' });
    await tools.click();
    await expect(page.getByRole('heading', { name: 'Atajos de teclado' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  // WCAG 1.4.10: a 320 px de ancho, nada obliga a desplazarse a lo ancho. En `/`, con el marcador
  // del 3D (aún no llega: no hay gestos); con el 3D ya llegado, en stage.spec.ts (las zonas táctiles a
  // 320 px).
  for (const route of [...ROUTES, '/']) {
    test(`${route}: a 320 px no hay desplazamiento a lo ancho`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(route);
      await scrollThrough(page);
      expect(await overflow(page)).toBeNull();
    });
  }

  // WCAG 1.4.4: el zum del navegador al 200 % en una pantalla de 1280 × 800 es una ventana de 640 ×
  // 400 px CSS con el doble de densidad.
  for (const route of ROUTES) {
    test(`${route}: con el zum al 200 %, todo cabe y se llega a todo`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 640, height: 400 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      await page.goto(route);
      await scrollThrough(page);
      expect(await overflow(page)).toBeNull();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
      await context.close();
    });
  }

  // WCAG 1.4.12: con más interlínea y más espacio entre párrafos, letras y palabras, nada se corta
  // ni se sale (el texto de los botones tampoco).
  for (const route of ROUTES) {
    test(`${route}: con el espaciado de texto de WCAG 1.4.12, nada se corta`, async ({ page }) => {
      await page.goto(route);
      await page.addStyleTag({
        content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
          p { margin-block-end: 2em !important; }`,
      });
      await scrollThrough(page);
      expect(await overflow(page)).toBeNull();
      // Ningún botón ni enlace con su texto recortado (más ancho o más alto que su caja).
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, a.button')]
          .filter((element) => element.offsetParent !== null)
          .filter(
            (element) =>
              element.scrollWidth > element.clientWidth + 1 ||
              element.scrollHeight > element.clientHeight + 1,
          )
          .map((element) => element.textContent?.trim().slice(0, 40)),
      );
      expect(clipped).toEqual([]);
    });
  }
});
