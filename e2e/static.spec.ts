import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Solo contra el build estático: el HTML prerenderizado y la accesibilidad de las tres rutas.

const ROUTES = [
  { path: '/', h1: 'Torno', title: 'Torno' },
  { path: '/sobre-el-proyecto', h1: 'Sobre el proyecto', title: 'Sobre el proyecto · Torno' },
  { path: '/404', h1: 'Página no encontrada', title: 'Página no encontrada · Torno' },
];

test.describe('build estático', () => {
  for (const route of ROUTES) {
    test(`${route.path} llega prerenderizado, con su h1 y su título, sin ejecutar JS`, async ({
      request,
    }) => {
      const response = await request.get(route.path);
      // /404 es un archivo real (404.html, que Pages sirve en /404): 200 si se pide directamente;
      // el 404 lo da cualquier URL desconocida (último test).
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<title>${route.title}</title>`);
      expect(html).toMatch(new RegExp(`<h1[^>]*>\\s*${route.h1}\\s*</h1>`));
      expect(html).toContain('<html lang="es"');
      expect(html).toContain('name="robots" content="noindex"');
    });

    test(`${route.path} pasa axe sin violaciones graves ni críticas`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
      // Las leves y moderadas también se cuentan: en la fase 0 no debe haber ninguna.
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  }

  test('una URL desconocida devuelve la página 404', async ({ page }) => {
    const response = await page.goto('/no-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página no encontrada');
  });

  test('las fuentes son solo las dos del subconjunto latino y no hay peticiones a terceros', async ({
    page,
  }) => {
    const external: string[] = [];
    const fonts: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== 'localhost') external.push(url.href);
      if (url.pathname.endsWith('.woff2')) fonts.push(url.pathname);
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    expect(external).toEqual([]);
    expect(fonts.map((font) => font.replace(/-[A-Z0-9]+\.woff2$/, ''))).toEqual(
      expect.arrayContaining([
        '/media/fraunces-latin-full-normal',
        '/media/geist-mono-latin-wght-normal',
      ]),
    );
    expect(fonts).toHaveLength(2);
    expect(await page.context().cookies()).toEqual([]);
  });

  test('los textos de las licencias de terceros se publican con la web', async ({ request }) => {
    const thirdParty = await request.get('/licencias/terceros.txt');
    expect(thirdParty.status()).toBe(200);
    expect(await thirdParty.text()).toContain('@angular/core');
    for (const font of ['fraunces', 'geist-mono']) {
      const license = await request.get(`/licencias/${font}-OFL.txt`);
      expect(license.status()).toBe(200);
      expect(await license.text()).toContain('SIL Open Font License, Version 1.1');
    }
  });
});
