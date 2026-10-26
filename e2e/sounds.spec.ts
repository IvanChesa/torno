import { expect, test, type Page } from '@playwright/test';
import { coreNotices, instrumentAudio, outputPeak } from './support/audio';
import { InstrumentDriver, MENU } from './support/instrument';

// La colección y el menú SONIDO en el navegador (PLAN fase 3): la cola entra exactamente en el
// compás siguiente y deshacer la cancela; la primera reproducción arranca con la batería; el tempo
// se marca con pulsaciones.

const sampleRate = (page: Page) =>
  page.evaluate(() => window.__torno?.contexts[0]?.sampleRate ?? 0);

test.describe('sonidos', () => {
  test('la cola entra exactamente en el compás siguiente y deshacer la cancela', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    // Parado: el sonido entra al momento.
    await driver.chooseSound(MENU.categories.drums);
    await driver.expectScreen('CAPA 1 · BATERÍA · ALFAR');
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');

    // En marcha: el bajo de la capa 2 espera en la cola.
    await driver.key('main', '2');
    await driver.chooseSound(MENU.categories.bass);
    await driver.expectScreen('EN COLA · CAPA 2');
    await expect
      .poll(() => coreNotices(page, 'sound-applied').then((n) => n.filter((x) => x.layer === 1)), {
        timeout: 8000,
      })
      .toHaveLength(1);
    await driver.expectScreen('CAPA 2 · BAJO · RAÍZ');
    await expect(driver.screen).not.toContainText('EN COLA');
    // Entró en un límite de compás exacto, el siguiente al de la orden.
    const rate = await sampleRate(page);
    const bar = (4 * 60 * rate) / 90;
    const [applied] = (await coreNotices(page, 'sound-applied')).filter((n) => n.layer === 1);
    const ordered = await page.evaluate(() => window.__torno!.setSoundFrames.at(-1)!);
    console.info(
      `Cola: pedida hacia la muestra ${ordered}; entró en la ${applied!.value} (${applied!.value / bar} compases)`,
    );
    expect(Number.isInteger(bar)).toBe(true);
    expect(applied!.value % bar).toBe(0);
    // El estado que da `ordered` puede llevar hasta 33 ms de retraso (1600 muestras a 48 kHz): si la
    // orden cayó justo antes del límite, el compás siguiente es el de después.
    const next = (Math.floor(ordered / bar) + 1) * bar;
    const late = ordered % bar > bar - 0.04 * rate;
    expect(late ? [next, next + bar] : [next]).toContain(applied!.value);

    // Otro bajo en cola y deshacer antes del compás: la cola se cancela y sigue RAÍZ.
    await driver.menu(MENU.sound, MENU.categories.bass, 1);
    await driver.closeMenu();
    await driver.expectScreen('EN COLA · CAPA 2');
    await driver.control('undo').click();
    await expect(driver.screen).not.toContainText('EN COLA');
    // Pasa más de un compás (2,7 s a 90 BPM) y no entra nada más en la capa 2.
    await page.waitForTimeout(3200);
    expect((await coreNotices(page, 'sound-applied')).filter((n) => n.layer === 1)).toHaveLength(1);
    await driver.expectScreen('CAPA 2 · BAJO · RAÍZ');
  });

  test('primera reproducción: la capa 1 arranca con ALFAR, sin compás vacío, y queda elegida la 2', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.expectScreen('CAPA 1 · VACÍA');
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');
    await driver.expectScreen('CAPA 2 · VACÍA');
    // Suena ya: el primer bombo cae en el pulso 0, no un compás después.
    await expect.poll(() => outputPeak(page, 150), { timeout: 1500 }).toBeGreaterThan(0.05);
    await driver.key('main', '1');
    await driver.expectScreen('CAPA 1 · BATERÍA · ALFAR');
    // Pausa y otra vez: ya no cambia de capa.
    await driver.control('play').click();
    await driver.expectScreen('PAUSA');
    await driver.control('play').click();
    await driver.expectScreen('CAPA 1 · BATERÍA · ALFAR');
  });

  test('tempo por pulsaciones: cuatro pulsaciones cada 500 ms marcan unos 120 BPM', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.menu(MENU.loop);
    const main = driver.control('main');
    for (let i = 0; i < MENU.loopItems.tapTempo; i++) await main.press('ArrowDown');
    await driver.expectScreen('MARCAR TEMPO');
    for (let i = 0; i < 4; i++) {
      await main.press('Enter');
      if (i < 3) await page.waitForTimeout(500);
    }
    const screen = (await driver.screen.textContent()) ?? '';
    const bpm = Number(/MARCAR TEMPO\s*(\d+) BPM/.exec(screen)?.[1]);
    console.info(`Tempo marcado: ${bpm} BPM`);
    // Cada pulsación de Playwright tarda unas decenas de ms más que la espera: algo por debajo de 120.
    expect(bpm).toBeGreaterThanOrEqual(100);
    expect(bpm).toBeLessThanOrEqual(122);
    await driver.closeMenu();
    await driver.expectScreen(`${bpm} BPM`);
  });
});
