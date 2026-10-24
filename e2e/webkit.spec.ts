import { expect, test } from '@playwright/test';
import { InstrumentDriver, MENU } from './support/instrument';

// WebKit de escritorio (PLAN fase 2): reproducir, pausar y el menú, con el teclado y el puntero.
// El WebKit de Playwright para Windows no trae Web Audio: ahí se comprueba que el instrumento lo
// dice con un aviso visible y que el menú sigue funcionando. En Linux (el CI), suena.

test.describe('WebKit', () => {
  test('reproducir y pausar un sonido, y recorrer el menú', async ({ page }) => {
    const driver = new InstrumentDriver(page);
    await driver.open();
    const webAudio = await page.evaluate(() => typeof AudioContext !== 'undefined');

    // El menú: BUCLE, su primera opción y volver (no necesita audio).
    await driver.menu(MENU.loop);
    await expect(driver.screen).toContainText('BUCLE');
    await expect(driver.screen).toContainText('DURACIÓN');
    await driver.closeMenu();
    await driver.expectScreen('90 BPM · PAUSA');

    await driver.chooseSound(MENU.categories.drums);
    if (!webAudio) {
      await expect(page.getByText('Este navegador no tiene Web Audio')).toBeVisible();
      return;
    }
    await driver.expectScreen('CAPA 1 · BATERÍA · PRUEBA');
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');
    await expect(driver.control('play')).toHaveAttribute('aria-pressed', 'true');
    // El transporte avanza: la posición del disco cambia.
    const disc = driver.control('disc');
    const first = await disc.getAttribute('aria-valuenow');
    await expect.poll(() => disc.getAttribute('aria-valuenow')).not.toBe(first);
    await driver.control('play').click();
    await driver.expectScreen('PAUSA');
  });
});
