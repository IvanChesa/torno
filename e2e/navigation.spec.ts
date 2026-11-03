import { expect, test } from '@playwright/test';

// El foco al cambiar de página dentro de la web (PLAN fase 8, tarea 3): al h1 de la página nueva,
// como en una carga completa, y nunca en la primera carga ni en un enlace a un ancla.

test.describe('el foco al navegar', () => {
  test('al pasar a otra página, va a su h1; al volver, también', async ({ page }) => {
    await page.goto('/?sin3d=1');
    await page.waitForLoadState('networkidle');
    // En la primera carga, el foco no se mueve.
    await expect(page.locator('h1')).not.toBeFocused();

    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', {
        name: 'Sobre el proyecto',
      })
      .click();
    await expect(page).toHaveURL(/\/sobre-el-proyecto$/);
    const heading = page.getByRole('heading', { level: 1, name: 'Sobre el proyecto' });
    await expect(heading).toBeFocused();

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Torno' })).toBeFocused();
  });

  test('con el teclado: Intro en el enlace y el tabulador sigue desde la página nueva', async ({
    page,
  }) => {
    await page.goto('/sobre-el-proyecto');
    await page.waitForLoadState('networkidle');
    const home = page.getByRole('navigation', { name: 'Principal' }).getByRole('link', {
      name: 'Instrumento',
    });
    await home.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Torno' })).toBeFocused();
    // Lo siguiente es lo de debajo del h1 («Tocar»), no la cabecera.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Tocar' }).first()).toBeFocused();
  });

  test('un enlace a un ancla de la misma página no lleva el foco al h1', async ({ page }) => {
    await page.goto('/?sin3d=1');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Cómo se toca' }).click();
    await expect(page).toHaveURL(/#guia$/);
    await expect(page.locator('h1')).not.toBeFocused();
  });
});
