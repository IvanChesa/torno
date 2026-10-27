import { expect, test } from '@playwright/test';
import { InstrumentDriver, MENU } from './support/instrument';

// WebKit de escritorio (PLAN fase 2): reproducir, pausar y el menú, con el teclado y el puntero.
// El WebKit de Playwright para Windows no trae Web Audio: ahí se comprueba que el instrumento lo
// dice con un aviso visible y que el menú sigue funcionando. En Linux (el CI), suena.
// Es el build servido como en Cloudflare Pages, con su _headers: también sin violaciones de la CSP
// en WebKit (fase 4).

test.describe('WebKit', () => {
  test('reproducir y pausar un sonido, y recorrer el menú', async ({ page }) => {
    await page.addInitScript(() => {
      const found: string[] = [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations = found;
      document.addEventListener('securitypolicyviolation', (event) => {
        found.push(`${event.effectiveDirective} ${event.blockedURI || 'inline'}`);
      });
    });
    const violations = () =>
      page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations);
    const driver = new InstrumentDriver(page);
    await driver.open();
    const webAudio = await page.evaluate(() => typeof AudioContext !== 'undefined');
    // Solo el de Windows viene sin Web Audio: en Linux (el CI) y en macOS, la prueba tiene que sonar
    // (si no, pasaría por la rama del aviso sin haber probado el audio).
    if (process.platform !== 'win32') {
      expect(webAudio, `WebKit sin Web Audio en ${process.platform}`).toBe(true);
    }

    // El menú: BUCLE, su primera opción y volver (no necesita audio).
    await driver.menu(MENU.loop);
    await expect(driver.screen).toContainText('BUCLE');
    await expect(driver.screen).toContainText('DURACIÓN');
    await driver.closeMenu();
    await driver.expectScreen('90 BPM · PAUSA');

    await driver.chooseSound(MENU.categories.drums);
    if (!webAudio) {
      await expect(page.getByText('Este navegador no tiene Web Audio')).toBeVisible();
      expect(await violations()).toEqual([]);
      return;
    }
    await driver.expectScreen('CAPA 1 · BATERÍA · ALFAR');
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');
    await expect(driver.control('play')).toHaveAttribute('aria-pressed', 'true');
    // El transporte avanza: la marca del disco (una vuelta por compás) gira.
    const disc = driver.control('disc');
    const turn = () => disc.evaluate((element) => element.style.getPropertyValue('--turn'));
    const first = await turn();
    await expect.poll(turn).not.toBe(first);
    await driver.control('play').click();
    await driver.expectScreen('PAUSA');
    expect(await violations()).toEqual([]);
  });
});
