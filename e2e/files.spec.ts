import { expect, test, type Page } from '@playwright/test';
import { renderOffline } from '../src/app/audio/core/offline';
import { EMPTY_LAYER, type SessionState } from '../src/app/audio/core/session';
import { DEFAULT_SETTINGS, writeTorno } from '../src/app/audio/files/torno-format';
import { readWav } from '../src/app/audio/files/wav';
import { readZip } from '../src/app/audio/files/zip';
import { downloadBytes, instrumentAudio } from './support/audio';
import { InstrumentDriver, MENU } from './support/instrument';
import { saveSession } from './support/torno';

// Archivos y persistencia (PLAN §4.8, fase 2): .torno de ida y vuelta, archivos que no valen,
// remuestreo, WAV de la mezcla y de las pistas con el mismo núcleo, autoguardado y privacidad.

const LSB = 1 / 8_388_607;

/** Una sesión con dos capas de la biblioteca (capa 1: batería; capa 2: bajo, a la izquierda). */
async function twoLayers(driver: InstrumentDriver): Promise<void> {
  await driver.chooseSound(MENU.categories.drums);
  await driver.key('main', '2');
  await driver.chooseSound(MENU.categories.bass);
  await driver.adjust([MENU.loop, MENU.loopItems.pan], -8);
  await driver.expectScreen('CAPA 2 · BAJO · PRUEBA');
}

/** Abre un archivo con SESIÓN → CARGAR. */
async function openFile(driver: InstrumentDriver, name: string, bytes: Uint8Array): Promise<void> {
  const chooser = driver.page.waitForEvent('filechooser');
  await driver.menu(MENU.session, MENU.sessionItems.open);
  await (
    await chooser
  ).setFiles({
    name,
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(bytes),
  });
  await driver.closeMenu();
}

const contextRate = (page: Page) =>
  page.evaluate(() => window.__torno?.contexts[0]?.sampleRate ?? 0);

/** Amplitud de la componente de `frequency` Hz (DFT de una vuelta que es periódica). */
function amplitudeAt(pcm: Float32Array, rate: number, frequency: number): number {
  const w = (2 * Math.PI * frequency) / rate;
  let re = 0;
  let im = 0;
  for (let i = 0; i < pcm.length; i++) {
    re += pcm[i]! * Math.cos(w * i);
    im -= pcm[i]! * Math.sin(w * i);
  }
  return (2 * Math.hypot(re, im)) / pcm.length;
}

async function decodeInPage(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const context = new OfflineAudioContext(1, 1, 48_000);
    const buffer = await context.decodeAudioData(data.buffer);
    return { channels: buffer.numberOfChannels, length: buffer.length, rate: buffer.sampleRate };
  }, Buffer.from(bytes).toString('base64'));
}

test.describe('archivos', () => {
  test('.torno: guardar, cargar y volver a guardar da los mismos bytes', async ({ page }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await twoLayers(driver);
    const first = await saveSession(driver);
    expect(first.file.session.layers.map((layer) => layer.source)).toEqual([
      { kind: 'library', id: 'prueba-bateria' },
      { kind: 'library', id: 'prueba-bajo' },
      null,
      null,
    ]);
    expect(first.file.session.layers[1]!.pan).toBe(-0.4);
    // Otra página, otra sesión: se carga el archivo y se guarda otra vez.
    const other = await page.context().newPage();
    await instrumentAudio(other);
    const second = new InstrumentDriver(other);
    await second.open();
    await second.chooseSound(MENU.categories.texture);
    await openFile(second, 'sesion.torno', first.bytes);
    await second.expectScreen('SESIÓN CARGADA');
    await second.expectScreen('CAPA 1 · BATERÍA · PRUEBA');
    const again = await saveSession(second);
    expect(Buffer.from(again.bytes).equals(Buffer.from(first.bytes))).toBe(true);
  });

  test('un archivo que no vale se rechaza con un aviso y no cambia nada', async ({ page }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await twoLayers(driver);
    const before = await saveSession(driver);
    const broken = before.bytes.slice(0, before.bytes.length - 100);
    await openFile(driver, 'roto.torno', broken);
    await expect(page.getByRole('alert')).toContainText('No se ha cambiado nada');
    await openFile(driver, 'otra-cosa.torno', new TextEncoder().encode('no soy una sesión'));
    await expect(page.getByRole('alert')).toContainText('No se ha cambiado nada');
    const after = await saveSession(driver);
    expect(Buffer.from(after.bytes).equals(Buffer.from(before.bytes))).toBe(true);
  });

  test('una sesión guardada a otra frecuencia se remuestrea al cargarla', async ({ page }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    // Un gesto antes, para que el audio esté en marcha al cargar; la sesión, a otra frecuencia.
    await driver.control('layer-0').click();
    await expect.poll(() => contextRate(page)).toBeGreaterThan(0);
    const from = (await contextRate(page)) === 44_100 ? 48_000 : 44_100;
    // 8 pulsos a 90 BPM: 441 Hz son 2352 ciclos justos; 15 kHz, 80.000 (y sus imágenes, también
    // ciclos justos: la vuelta es periódica y su DFT no tiene fugas).
    const frames = (from * 16) / 3;
    const tone = (frequency: number) =>
      Float32Array.from(
        { length: frames },
        (_, i) => 0.5 * Math.sin((2 * Math.PI * frequency * i) / from),
      );
    const recording = { ...EMPTY_LAYER, lengthBeats: 8, source: { kind: 'recording' as const } };
    const session: SessionState = {
      sampleRate: from,
      bpm: 90,
      layers: [
        { ...recording, pcm: tone(441) },
        { ...recording, pcm: tone(15_000) },
        EMPTY_LAYER,
        EMPTY_LAYER,
      ],
    };
    await openFile(driver, 'otra-frecuencia.torno', writeTorno(session, DEFAULT_SETTINGS));
    await driver.expectScreen('CAPA 1 · GRABACIÓN');
    const { file } = await saveSession(driver);
    const rate = file.session.sampleRate;
    const pcm = file.session.layers[0]!.pcm!;
    expect(pcm.length).toBe(Math.round((frames * rate) / from));
    expect(file.session.layers[0]!.lengthBeats).toBe(8);
    // El tono agudo conserva su nivel (±0,5 dB) y sus imágenes quedan por debajo de −60 dB.
    const high = file.session.layers[1]!.pcm!;
    const fold = (f: number) => (f % rate > rate / 2 ? rate - (f % rate) : f % rate);
    const level = 20 * Math.log10(amplitudeAt(high, rate, 15_000) / 0.5);
    const images = [from - 15_000, from + 15_000].map(
      (f) => 20 * Math.log10(amplitudeAt(high, rate, fold(f)) / 0.5),
    );
    console.info(
      `Remuestreo de ${from} a ${rate} Hz, tono de 15 kHz: ${level.toFixed(2)} dB; imágenes ` +
        `a ${fold(from - 15_000)} y ${fold(from + 15_000)} Hz: ` +
        images.map((db) => `${db.toFixed(1)} dB`).join(' y '),
    );
    expect(Math.abs(level)).toBeLessThan(0.5);
    for (const db of images) expect(db).toBeLessThan(-60);
    // El tono sigue siendo de 441 Hz: los mismos cruces por cero (±2) y la misma amplitud.
    let crossings = 0;
    let peak = 0;
    for (let i = 1; i < pcm.length; i++) {
      if (pcm[i - 1]! < 0 !== pcm[i]! < 0) crossings++;
      peak = Math.max(peak, Math.abs(pcm[i]!));
    }
    expect(Math.abs(crossings - 2 * 2352)).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(0.49);
    expect(peak).toBeLessThan(0.51);
  });

  test('la mezcla en WAV de 24 bits es el render del núcleo; las pistas, cada capa sola', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await twoLayers(driver);
    const { file } = await saveSession(driver);
    // EXPORTAR MEZCLA: 2 vueltas (de 4 a 2) y sin fundido.
    await driver.adjust([MENU.session, MENU.sessionItems.exportMix, 0], -2);
    await driver.adjust([MENU.session, MENU.sessionItems.exportMix, 1], -1);
    const mixDownload = page.waitForEvent('download');
    await driver.menu(MENU.session, MENU.sessionItems.exportMix, 2);
    const mixFile = await mixDownload;
    expect(mixFile.suggestedFilename()).toMatch(/^torno-mezcla-[\d-]+\.wav$/);
    const mixBytes = await downloadBytes(mixFile);
    const wav = readWav(mixBytes)!;
    const loop = Math.round((8 * 60 * file.session.sampleRate) / file.session.bpm);
    expect(wav.bitsPerSample).toBe(24);
    expect(wav.channels).toHaveLength(2);
    expect(wav.channels[0]).toHaveLength(2 * loop);
    const reference = renderOffline(file.session, 2 * loop);
    let worst = 0;
    for (let i = 0; i < 2 * loop; i += 3) {
      worst = Math.max(
        worst,
        Math.abs(wav.channels[0]![i]! - reference.left[i]!),
        Math.abs(wav.channels[1]![i]! - reference.right[i]!),
      );
    }
    expect(worst).toBeLessThanOrEqual(LSB);
    // El navegador lo lee.
    expect(await decodeInPage(page, mixBytes)).toEqual({
      channels: 2,
      length: Math.round((2 * loop * 48_000) / file.session.sampleRate),
      rate: 48_000,
    });

    // EXPORTAR PISTAS: un ZIP con un WAV mono por capa con sonido.
    await driver.closeMenu();
    const stemsDownload = page.waitForEvent('download');
    await driver.menu(MENU.session, MENU.sessionItems.exportStems);
    const stems = readZip(await downloadBytes(await stemsDownload))!;
    expect([...stems.keys()]).toEqual(['torno-capa-1.wav', 'torno-capa-2.wav']);
    for (const [index, name] of ['torno-capa-1.wav', 'torno-capa-2.wav'].entries()) {
      const stem = readWav(stems.get(name)!)!;
      expect(stem.channels).toHaveLength(1);
      expect(stem.channels[0]).toHaveLength(loop);
      const alone: SessionState = {
        ...file.session,
        layers: file.session.layers.map((layer, j) =>
          j === index ? { ...layer, pan: -1, muted: false } : EMPTY_LAYER,
        ),
      };
      const solo = renderOffline(alone, loop).left;
      let error = 0;
      for (let i = 0; i < loop; i += 5)
        error = Math.max(error, Math.abs(stem.channels[0]![i]! - solo[i]!));
      expect(error).toBeLessThanOrEqual(LSB);
    }
  });

  test('sin Web Audio, cargar una sesión avisa de que no se ha podido (no dice «cargada»)', async ({
    page,
  }) => {
    await page.addInitScript(() => Reflect.deleteProperty(window, 'AudioContext'));
    const driver = new InstrumentDriver(page);
    await driver.open();
    const session: SessionState = {
      sampleRate: 48_000,
      bpm: 90,
      layers: [
        {
          ...EMPTY_LAYER,
          pcm: new Float32Array(256_000),
          lengthBeats: 8,
          source: { kind: 'recording' },
        },
        EMPTY_LAYER,
        EMPTY_LAYER,
        EMPTY_LAYER,
      ],
    };
    await openFile(driver, 'sesion.torno', writeTorno(session, DEFAULT_SETTINGS));
    await expect(page.getByRole('alert')).toContainText('No se ha podido cargar la sesión');
    await expect(driver.screen).not.toContainText('SESIÓN CARGADA');
    await driver.expectScreen('CAPA 1 · VACÍA');
  });

  test('autoguardado: al recargar se puede recuperar la misma sesión, o empezar de cero', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await twoLayers(driver);
    const before = await saveSession(driver);
    // El autoguardado espera 1,5 s tras la última edición.
    await page.waitForTimeout(2500);
    await driver.open();
    const recover = page.getByRole('button', { name: 'Recuperar la sesión anterior' });
    await expect(recover).toBeVisible();
    // Con el teclado: Espacio pulsa el botón (no es el atajo de reproducir).
    await recover.focus();
    await page.keyboard.press('Space');
    await driver.expectScreen('SESIÓN RECUPERADA');
    await driver.expectScreen('CAPA 1 · BATERÍA · PRUEBA');
    const after = await saveSession(driver);
    expect(Buffer.from(after.bytes).equals(Buffer.from(before.bytes))).toBe(true);
    // Empezar de cero borra el autoguardado: al recargar ya no se ofrece.
    await driver.open();
    await page.getByRole('button', { name: 'Empezar de cero' }).click();
    await driver.open();
    await expect(page.getByRole('button', { name: 'Recuperar la sesión anterior' })).toBeHidden();
  });

  test('recuperar con el audio aún cargando o en reposo espera y recupera la misma sesión', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await instrumentAudio(page, { moduleDelayMs: 2500 });
    const driver = new InstrumentDriver(page);
    await driver.open();
    await twoLayers(driver);
    const before = await saveSession(driver);
    await page.waitForTimeout(2500);
    const recover = page.getByRole('button', { name: 'Recuperar la sesión anterior' });

    // Con el módulo aún cargando (2,5 s): un dial arranca el motor y se pulsa «Recuperar» ya.
    await driver.open();
    await driver.key('layer-0', 'ArrowDown');
    await recover.click();
    await expect(driver.screen).toContainText('SESIÓN RECUPERADA', { timeout: 10_000 });
    await driver.expectScreen('CAPA 1 · BATERÍA · PRUEBA');
    const loading = await saveSession(driver);
    expect(Buffer.from(loading.bytes).equals(Buffer.from(before.bytes))).toBe(true);
    await page.waitForTimeout(2500);

    // En reposo: «Recuperar» sale del reposo y recupera.
    await driver.open();
    await driver.control('layer-1').click();
    await expect(page.getByText('Preparando el audio…')).toBeHidden({ timeout: 10_000 });
    await driver.control('standby').click();
    await driver.expectScreen('REPOSO');
    await recover.click();
    await expect(driver.screen).toContainText('SESIÓN RECUPERADA', { timeout: 10_000 });
    const standby = await saveSession(driver);
    expect(Buffer.from(standby.bytes).equals(Buffer.from(before.bytes))).toBe(true);
  });

  test('recuperar con el audio en error lo reintenta y recupera la misma sesión', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await twoLayers(driver);
    const before = await saveSession(driver);
    await page.waitForTimeout(2500);

    // Otra página en la que el módulo tarda 7 s la primera vez: a los 5 s, el error.
    const other = await page.context().newPage();
    await instrumentAudio(other, { moduleDelayMs: 7000, moduleDelayOnce: true });
    const second = new InstrumentDriver(other);
    await second.open();
    const recover = other.getByRole('button', { name: 'Recuperar la sesión anterior' });
    // Primer toque: el audio no llega a tiempo. Se avisa y la sesión anterior sigue ofrecida.
    await recover.click();
    await expect(other.getByText('El audio no ha cargado en 5 segundos.')).toBeVisible({
      timeout: 8000,
    });
    await expect(other.getByRole('alert')).toContainText('la sesión anterior sigue guardada');
    await expect(recover).toBeVisible();
    // Segundo toque: reintenta la carga y recupera.
    await recover.click();
    await expect(second.screen).toContainText('SESIÓN RECUPERADA', { timeout: 10_000 });
    await expect(other.getByRole('button', { name: 'Reintentar' })).toBeHidden();
    await expect(recover).toBeHidden();
    const after = await saveSession(second);
    expect(Buffer.from(after.bytes).equals(Buffer.from(before.bytes))).toBe(true);
  });

  test('privacidad: grabar, guardar y exportar no hacen ninguna petición de red', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await twoLayers(driver);
    await driver.adjust([MENU.loop, MENU.loopItems.countIn], -1);
    const requests: string[] = [];
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    // Grabar en la capa 3 con el micrófono.
    await driver.key('main', '3');
    await driver.control('record').click();
    await driver.expectScreen('GRABANDO');
    await page.waitForTimeout(1500);
    await driver.control('record').click();
    await driver.expectScreen('CAPA 3 · GRABACIÓN');
    // Guardar y exportar la mezcla y las pistas.
    await saveSession(driver);
    const mix = page.waitForEvent('download');
    await driver.menu(MENU.session, MENU.sessionItems.exportMix, 2);
    await mix;
    await driver.closeMenu();
    const stems = page.waitForEvent('download');
    await driver.menu(MENU.session, MENU.sessionItems.exportStems);
    await stems;
    expect(requests).toEqual([]);
    expect(await page.context().cookies()).toEqual([]);
  });
});
