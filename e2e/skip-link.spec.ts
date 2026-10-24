import { expect, test } from '@playwright/test';

// «Saltar al contenido» (WCAG 2.4.1) con el teclado, en cada página: con `<base href="/">`, un
// `#contenido` suelto llevaría a la portada.

for (const path of ['/', '/sobre-el-proyecto', '/404', '/?captura=1']) {
  test(`en ${path}, Tab + Intro lleva el foco al contenido sin salir de la página`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const heading = await page.getByRole('heading', { level: 1 }).textContent();

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await page.keyboard.press('Enter');

    await expect(page.locator('main#contenido')).toBeFocused();
    const url = new URL(page.url());
    expect(`${url.pathname}${url.search}`).toBe(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading ?? '');
  });
}

test('sin JS, el enlace prerenderizado ya apunta a la página actual', async ({ request }) => {
  const html = await (await request.get('/sobre-el-proyecto')).text();
  expect(html).toMatch(/<a\b[^>]*class="skip-link"[^>]*href="\/sobre-el-proyecto#contenido"/);
});
