import { expect, test } from '@playwright/test';
import { contextStates, instrumentAudio, outputPeak, streamCount } from './support/audio';
import { InstrumentDriver, MENU } from './support/instrument';

// Errores visibles (PLAN fase 2, tarea 1): el motor devuelve códigos y la interfaz los cuenta con
// texto; ninguno deja el instrumento en silencio sin explicación.

test.describe('errores', () => {
  test('si el módulo de audio no carga en 5 s, lo dice y «Reintentar» lo arregla', async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await instrumentAudio(page, { moduleDelayMs: 7000, moduleDelayOnce: true });
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.chooseSound(MENU.categories.texture);
    const retry = page.getByRole('button', { name: 'Reintentar' });
    await expect(page.getByText('El audio no ha cargado en 5 segundos.')).toBeVisible({
      timeout: 8000,
    });
    // El contexto está en marcha (se creó en el gesto): lo que falta es el módulo.
    expect(await contextStates(page)).toEqual(['running']);
    await retry.click();
    await expect(retry).toBeHidden({ timeout: 10_000 });
    await driver.chooseSound(MENU.categories.texture);
    await driver.control('play').click();
    await expect.poll(() => outputPeak(page, 200), { timeout: 5000 }).toBeGreaterThan(0.05);
  });

  test('con el micrófono denegado, lo explica y no graba nada', async ({ page }) => {
    await instrumentAudio(page, { micDenied: true });
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.control('record').click();
    await expect(page.getByRole('alert')).toContainText('El navegador no deja usar el micrófono');
    await driver.expectScreen('SIN PERMISO DEL MICRÓFONO');
    await driver.expectScreen('CAPA 1 · VACÍA');
    expect(await streamCount(page)).toBe(0);
  });
});
