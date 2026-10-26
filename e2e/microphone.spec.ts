import { expect, test } from '@playwright/test';
import { ACCENT_CLICK, NORMAL_CLICK } from '../src/app/audio/core/metronome';
import { instrumentAudio, streamCount, tracksEnded, workletCommands } from './support/audio';
import { InstrumentDriver, MENU } from './support/instrument';
import { clickOnsetOffset, hideTab, onsets, saveSession } from './support/torno';

// Grabación con micrófono (PLAN fase 2): el micrófono se pide solo al grabar, la toma entra en la
// capa, queda alineada con lo que sonó y la pista se para siempre.

/** BUCLE → CUENTA PREVIA: de SÍ a NO (para que las tomas empiecen ya). */
async function withoutCountIn(driver: InstrumentDriver): Promise<void> {
  await driver.adjust([MENU.loop, MENU.loopItems.countIn], -1);
}

test.describe('micrófono', () => {
  test('una toma con el micrófono sintético entra en la capa, con sus ataques cada 500 ms', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await withoutCountIn(driver);
    expect(await streamCount(page)).toBe(0);
    await driver.control('record').click();
    await driver.expectScreen('GRABANDO');
    await page.waitForTimeout(2600);
    await driver.control('record').click();
    await driver.expectScreen('CAPA 1 · GRABACIÓN');
    // Terminada la toma, el micrófono se suelta.
    await expect.poll(() => tracksEnded(page)).toBe(true);
    expect(await streamCount(page)).toBe(1);
    const { file } = await saveSession(driver);
    const rate = file.session.sampleRate;
    const pcm = file.session.layers[0]!.pcm!;
    expect(pcm.length).toBeGreaterThan(1.5 * rate);
    // Las ráfagas del micrófono sintético: 500 ms entre ataques (±2 ms).
    // (Los primeros 10 ms son la junta: el final de la toma cruzado con su principio.)
    // Con la máquina muy cargada, la captura falsa de Chromium pierde o repite a veces un bloque
    // de 10 ms antes de llegar al worklet: visto en local (480 muestras a 48 kHz) y en el CI (441 a
    // 44,1 kHz). Se admite como mucho un salto así, de 10 ms justos. El worklet y el núcleo van en
    // bloques de 128 muestras: si perdieran algo, no saldrían 10 ms.
    const found = onsets(pcm, rate, { floor: 0.05 }).filter((onset) => onset > 0.02 * rate);
    expect(found.length).toBeGreaterThanOrEqual(3);
    const errors = found.slice(1).map((onset, i) => Math.abs(onset - found[i]! - 0.5 * rate));
    const exact = errors.filter((error) => error <= 0.002 * rate).length;
    const slips = errors.filter((error) => Math.abs(error - 0.01 * rate) <= 0.002 * rate).length;
    if (slips > 0)
      console.info(`Captura de Chromium: ${slips} salto de 10 ms (${errors.join(', ')})`);
    expect(slips).toBeLessThanOrEqual(1);
    expect(exact + slips, `desviaciones en muestras: ${errors.join(', ')}`).toBe(errors.length);
  });

  test('reproducir y grabar con el audio aún cargando: la toma espera al audio y no se pierde', async ({
    page,
  }) => {
    await instrumentAudio(page, { moduleDelayMs: 2000 });
    const driver = new InstrumentDriver(page);
    await driver.open();
    // La primera reproducción pone la batería en la capa 1 y elige la 2: se graba encima.
    await driver.control('play').click();
    await driver.control('record').click();
    await expect(driver.screen).toContainText('GRABANDO', { timeout: 10_000 });
    await page.waitForTimeout(1000);
    await driver.control('record').click();
    await driver.expectScreen('CAPA 2 · GRABACIÓN');
    expect(await streamCount(page)).toBe(1);
  });

  test('el reposo durante la calibración la cancela sin aviso de error y suelta el micrófono', async ({
    page,
  }) => {
    test.setTimeout(40_000);
    await instrumentAudio(page, { loopback: true });
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.menu(MENU.input, MENU.inputItems.latency, MENU.latencyItems.calibrate);
    // Con la calibración ya en el núcleo (sonando los clics), el reposo.
    await expect.poll(() => workletCommands(page)).toContain('calibrate');
    await driver.control('standby').click();
    // Con el menú abierto, la pantalla sigue en el menú: el reposo se ve en su botón.
    await expect(driver.control('standby')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => tracksEnded(page)).toBe(true);
    // Ningún aviso de error en los 11 s siguientes (antes llegaba a los 10 s, al vencer la espera).
    const error = page.getByText('No se han oído bien los clics');
    for (let waited = 0; waited < 11_000; waited += 250) {
      expect(await error.count()).toBe(0);
      await page.waitForTimeout(250);
    }
  });

  test('calibrada la latencia, la toma queda alineada con los pulsos (±2 ms)', async ({ page }) => {
    test.setTimeout(60_000);
    // El micrófono es la propia salida retrasada 20 ms (bucle de retorno): se sabe cuándo suena
    // cada ataque.
    await instrumentAudio(page, { loopback: true });
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.menu(MENU.input, MENU.inputItems.latency, MENU.latencyItems.calibrate);
    await expect(driver.screen).toContainText(/LATENCIA [\d,]+ MS/, { timeout: 15_000 });
    await driver.closeMenu();
    await withoutCountIn(driver);
    await driver.adjust([MENU.loop, MENU.loopItems.metronome], 1);
    await driver.adjust([MENU.loop, MENU.loopItems.takeLength], 1);
    await driver.expectScreen('TOMA DE 1 COMPÁS');
    // Grabar con el transporte parado: arranca y la toma (1 compás) empieza en el pulso 0.
    await driver.control('record').click();
    await driver.expectScreen('CAPA 1 · GRABACIÓN');
    await driver.control('play').click();
    const { file } = await saveSession(driver);
    const rate = file.session.sampleRate;
    const pcm = file.session.layers[0]!.pcm!;
    const beat = pcm.length / 4;
    const found = onsets(pcm, rate, { floor: 0.01, quietMs: 200 });
    // Los cuatro clics del metrónomo, grabados por el bucle de retorno, caen en sus pulsos.
    expect(found).toHaveLength(4);
    found.forEach((onset, k) => {
      const click = k === 0 ? ACCENT_CLICK : NORMAL_CLICK;
      const expected = k * beat + clickOnsetOffset(rate, click.frequency, click.gain);
      expect(Math.abs(onset - expected) / rate).toBeLessThanOrEqual(0.002);
    });
  });

  test('la pista acaba `ended` al cancelar, en reposo y con la pestaña oculta', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await withoutCountIn(driver);

    // Cancelar (mantener grabar): la toma se descarta.
    await driver.control('record').click();
    await driver.expectScreen('GRABANDO');
    await driver.key('record', 'Shift+Enter');
    await expect.poll(() => tracksEnded(page)).toBe(true);
    await driver.expectScreen('CAPA 1 · VACÍA');

    // Reposo.
    await driver.control('record').click();
    await driver.expectScreen('GRABANDO');
    await driver.control('standby').click();
    await expect.poll(() => tracksEnded(page)).toBe(true);
    await driver.expectScreen('REPOSO');
    await driver.control('standby').click();
    await driver.expectScreen('PAUSA');

    // Pestaña oculta: toma cancelada, pausa y micrófono suelto.
    await driver.control('record').click();
    await driver.expectScreen('GRABANDO');
    await hideTab(page);
    await expect.poll(() => tracksEnded(page)).toBe(true);
    await driver.expectScreen('PAUSA');
    await driver.expectScreen('CAPA 1 · VACÍA');
    expect(await streamCount(page)).toBe(3);
  });
});
