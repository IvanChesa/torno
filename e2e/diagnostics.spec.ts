import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { instrumentAudio } from './support/audio';
import { InstrumentDriver } from './support/instrument';

// El panel de diagnóstico (`?diagnostico=1`, PLAN fase 4, tarea 7): para las pruebas en los
// móviles. Mide del toque al primer sonido (la primera vez, en frío) y copia el informe, sin red.

const firstSoundRow = (page: Page) =>
  page.locator('trn-diagnostics-panel dl div').filter({ hasText: 'Del toque al primer sonido' });

/** Las medidas en ms que enseña el panel, en orden. */
async function measures(page: Page): Promise<number[]> {
  const value = (await firstSoundRow(page).locator('dd').textContent()) ?? '';
  return [...value.matchAll(/(\d+) ms/g)].map((match) => Number(match[1]));
}

test.describe('diagnóstico', () => {
  test('sin ?diagnostico=1 no hay panel', async ({ page }) => {
    const driver = new InstrumentDriver(page);
    await driver.open();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('trn-diagnostics-panel')).toHaveCount(0);
  });

  test('mide del toque al primer sonido (en frío y después), copia el informe y pasa axe', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await instrumentAudio(page);
    // Lo que no sea cargar el propio código (GET del mismo origen) sería sacar datos.
    const outgoing: string[] = [];
    const driver = new InstrumentDriver(page);
    await driver.open('/?diagnostico=1');
    const panel = page.getByRole('region', { name: 'Diagnóstico del audio' });
    await expect(panel).toBeVisible();
    await expect(firstSoundRow(page)).toContainText('Pulsa REPRODUCIR para medirlo');
    await expect(panel).toContainText('Sin arrancar: toca el instrumento');
    page.on('request', (request) => {
      const sameOrigin = new URL(request.url()).origin === new URL(page.url()).origin;
      if (!sameOrigin || request.method() !== 'GET') {
        outgoing.push(`${request.method()} ${request.url()}`);
      }
    });

    // La primera reproducción: arranca el audio, crea el worker y renderiza ALFAR.
    await driver.control('play').click();
    await expect(firstSoundRow(page)).toContainText(/\d+ ms \(en frío\)/, { timeout: 10_000 });
    await expect(panel).toContainText(/\d{5,6} Hz/);
    await expect(panel).toContainText('running');
    // Pausa y otra vez: ya en caliente.
    await driver.control('play').click();
    await driver.expectScreen('PAUSA');
    await page.waitForTimeout(300);
    await driver.control('play').click();
    await expect.poll(() => measures(page)).toHaveLength(2);
    const [cold, warm] = await measures(page);
    console.info(`Primer sonido (panel de diagnóstico): en frío ${cold} ms; después ${warm} ms`);
    expect(cold).toBeLessThan(3000);
    // PLAN §5: ≤ 100 ms con el motor cargado (en el CI, margen ×3).
    expect(warm).toBeLessThanOrEqual(process.env['CI'] ? 300 : 100);

    // Copiar el informe (al portapapeles, en local).
    await panel.getByRole('button', { name: 'Copiar el informe' }).click();
    await expect(panel.getByRole('status')).toHaveText('Informe copiado.');
    // El portapapeles de Windows guarda los saltos de línea como \r\n.
    const copied = (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
      '\r\n',
      '\n',
    );
    expect(copied).toMatch(
      /^Diagnóstico del audio\nDel toque al primer sonido: \d+ ms \(en frío\) · \d+ ms/,
    );
    expect(copied).toMatch(/Frecuencia de muestreo: \d{5,6} Hz/);

    const results = await new AxeBuilder({ page })
      .include('trn-diagnostics-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => `${v.id} (${v.impact})`)).toEqual([]);
    expect(outgoing).toEqual([]);
  });
});
