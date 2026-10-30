import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// La maqueta 3D del instrumento (`?maqueta=1`, PLAN fase 5.a): solo se carga si se pide, pinta con
// WebGL (en Chromium sin interfaz, por software), cambia de variante, mapeo de tonos y vista con
// botones nativos, lo deja en la URL y pasa axe. Sin errores en la consola (la CSP incluida).

const viewer = (page: import('@playwright/test').Page) => page.locator('trn-mockup-stage .viewer');

test.describe('maqueta', () => {
  test('sin ?maqueta=1 no hay maqueta ni lienzo 3D', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-control="main"]').waitFor();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('trn-mockup-stage')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('pinta el aparato, cambia lo elegido, lo lleva a la URL y pasa axe', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?maqueta=1');
    await expect(viewer(page)).toHaveAttribute('data-listo', '', { timeout: 60_000 });
    const canvas = viewer(page).locator('canvas');
    await expect(canvas).toHaveAttribute('aria-label', /variante Terracota, vista frente/);
    // El lienzo lleva el tamaño de su caja (sin estirar): un píxel por píxel CSS o más.
    const size = await canvas.evaluate((element: HTMLCanvasElement) => ({
      width: element.width,
      css: element.getBoundingClientRect().width,
    }));
    expect(size.width).toBeGreaterThanOrEqual(Math.floor(size.css));

    const group = (name: string) => page.getByRole('group', { name });
    await group('Variante de color').getByRole('button', { name: 'Barro oscuro' }).click();
    await group('Mapeo de tonos').getByRole('button', { name: 'AgX' }).click();
    await group('Vista').getByRole('button', { name: 'Cenital' }).click();
    await expect(
      group('Variante de color').getByRole('button', { name: 'Barro oscuro' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      group('Variante de color').getByRole('button', { name: 'Terracota' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas).toHaveAttribute('aria-label', /variante Barro oscuro, vista cenital/);
    await expect(page).toHaveURL(/variante=barro-oscuro/);
    await expect(page).toHaveURL(/tono=agx/);
    await expect(page).toHaveURL(/vista=cenital/);

    // Lo elegido vuelve con la URL.
    await page.reload();
    await expect(viewer(page)).toHaveAttribute('data-listo', '', { timeout: 60_000 });
    await expect(group('Vista').getByRole('button', { name: 'Cenital' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const results = await new AxeBuilder({ page })
      .include('trn-mockup-stage')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => `${v.id} (${v.impact})`)).toEqual([]);
    // Los avisos de rendimiento de WebGL por software (SwiftShader) no son errores de la página.
    expect(errors.filter((error) => !/GPU stall|WebGL-/.test(error))).toEqual([]);
  });
});
