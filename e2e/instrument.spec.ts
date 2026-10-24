import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  audioCalls,
  contextStates,
  instrumentAudio,
  loadedModules,
  outputPeak,
} from './support/audio';
import { InstrumentDriver, MENU } from './support/instrument';

// El instrumento HTML con el motor de audio de verdad (PLAN fase 2): nada se crea antes del gesto,
// el contexto se crea y se reanuda dentro de él, suena lo que se toca y todo funciona con teclado.

const WORKLET = /\/audio\/processor\.[A-Z0-9]+\.js$/;
/** Lo que se oye en el gesto (Playwright hace un clic con puntero: `pointerup` o `click`). */
const GESTURE = /^(new|resume):(pointerup|click|keydown)$/;

test.describe('instrumento HTML', () => {
  test('nada se crea ni se carga antes del gesto', async ({ page }) => {
    const workers: string[] = [];
    page.on('worker', (worker) => workers.push(worker.url()));
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await page.waitForTimeout(500);
    expect(await contextStates(page)).toEqual([]);
    expect(await audioCalls(page)).toEqual([]);
    expect(await loadedModules(page)).toEqual([]);
    expect(workers).toEqual([]);
  });

  test('la instrumentación distingue un contexto creado fuera del gesto', async ({ page }) => {
    await instrumentAudio(page);
    await new InstrumentDriver(page).open();
    // Control negativo: tras un await de verdad (una tarea nueva), ya no hay evento en curso.
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new AudioContext().close();
    });
    expect(await audioCalls(page)).toEqual(['new:ninguno']);
  });

  test('el módulo del worklet se sirve con hash y como JavaScript', async ({ request }) => {
    const generated = await readFile('src/app/audio/engine/worklet-url.generated.ts', 'utf8');
    const workletPath = /WORKLET_PATH = '([^']+)'/.exec(generated)?.[1] ?? '';
    expect(`/${workletPath}`).toMatch(WORKLET);
    const response = await request.get(`/${workletPath}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/javascript/);
    expect(await response.text()).toContain('registerProcessor');
  });

  test('elegir un sonido y reproducir: la salida no es silencio; pausar la apaga', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.chooseSound(MENU.categories.chords);
    await driver.expectScreen('CAPA 1 · ACORDES · PRUEBA');
    // Antes de reproducir, nada suena.
    expect(await outputPeak(page, 300)).toBe(0);
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');
    await expect(driver.control('play')).toHaveAttribute('aria-pressed', 'true');
    // El bucle de prueba tiene su pico a −6 dBFS; centrado, sale a −9 dBFS.
    const peak = await outputPeak(page, 1500);
    console.info(`Pico de la salida: ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
    expect(20 * Math.log10(peak)).toBeGreaterThan(-12);
    expect(20 * Math.log10(peak)).toBeLessThan(-0.3);
    // El contexto se creó y se reanudó dentro del gesto (el primer toque del instrumento).
    const calls = await audioCalls(page);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) expect(call).toMatch(GESTURE);
    expect(await contextStates(page)).toEqual(['running']);
    expect((await loadedModules(page)).map((url) => new URL(url).pathname)).toEqual([
      expect.stringMatching(WORKLET),
    ]);
    // Pausar: 10 ms de fundido y silencio.
    await page.keyboard.press('Space');
    await driver.expectScreen('PAUSA');
    await page.waitForTimeout(200);
    expect(await outputPeak(page, 300)).toBe(0);
  });

  test('con el motor cargado, el primer sonido llega antes de 100 ms tras pulsar (PLAN §5)', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.chooseSound(MENU.categories.drums);
    await driver.expectScreen('CAPA 1 · BATERÍA · PRUEBA');
    // En la página: se mide desde el `pointerdown` de la tecla hasta la primera muestra que suena
    // en el analizador de la salida (5 ms de resolución). Cinco veces, parando entre medias.
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const elapsed = page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const analyser = window.__torno!.analysers[0]!;
            const data = new Float32Array(analyser.fftSize);
            const play = document.querySelector('[data-control="play"]')!;
            play.addEventListener(
              'pointerdown',
              (event) => {
                const start = event.timeStamp;
                const poll = () => {
                  analyser.getFloatTimeDomainData(data);
                  if (data.some((x) => Math.abs(x) > 0.001)) resolve(performance.now() - start);
                  else setTimeout(poll, 5);
                };
                poll();
              },
              { once: true },
            );
          }),
      );
      await driver.control('play').click();
      times.push(await elapsed);
      await driver.control('play').click({ delay: 700 });
      await driver.expectScreen('PAUSA');
      await page.waitForTimeout(150);
    }
    console.info(`Primer sonido tras pulsar: ${times.map((t) => t.toFixed(0)).join(', ')} ms`);
    expect(Math.max(...times)).toBeLessThanOrEqual(100);
  });

  test('con el módulo retrasado 1,5 s, el contexto ya está en marcha desde el gesto y suena al cargar', async ({
    page,
  }) => {
    await instrumentAudio(page, { moduleDelayMs: 1500 });
    const driver = new InstrumentDriver(page);
    await driver.open();
    const clickedAt = Date.now();
    // El primer gesto: pulsar el dial principal (abre el menú).
    await driver.control('main').click();
    await expect.poll(() => contextStates(page), { timeout: 1000 }).toEqual(['running']);
    expect(Date.now() - clickedAt).toBeLessThan(1500);
    const calls = await audioCalls(page);
    expect(calls[0]).toMatch(/^new:(pointerup|click)$/);
    for (const call of calls) expect(call).toMatch(GESTURE);
    // Mientras carga el módulo, se elige el sonido y se pulsa reproducir: esperan en la cola.
    await driver.closeMenu();
    await driver.chooseSound(MENU.categories.bass);
    await driver.control('play').click();
    await expect.poll(() => outputPeak(page, 200), { timeout: 10_000 }).toBeGreaterThan(0.05);
    expect(Date.now() - clickedAt).toBeGreaterThanOrEqual(1500);
  });

  test('todo con teclado: cada control es enfocable, con nombre, valor y atajos', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    // Los 12 controles, en el orden del tabulador.
    const order: string[] = [];
    await driver.control('main').focus();
    for (let i = 0; i < 12; i++) {
      order.push(
        (await page.evaluate(() => document.activeElement?.getAttribute('data-control'))) ?? '',
      );
      await page.keyboard.press('Tab');
    }
    expect(order).toEqual([
      'main',
      'layer-0',
      'layer-1',
      'layer-2',
      'layer-3',
      'play',
      'record',
      'undo',
      'disc',
      'arm',
      'volume',
      'standby',
    ]);
    // Un dial: flechas, Mayús ×10, Inicio y Fin; su valor en voz.
    const layer = driver.control('layer-1');
    await layer.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(layer).toHaveAttribute('aria-valuenow', '89');
    await expect(layer).toHaveAttribute('aria-valuetext', '89 %');
    await page.keyboard.press('Home');
    await expect(layer).toHaveAttribute('aria-valuenow', '0');
    // Mantener (Mayús+Intro) silencia; pulsar (Intro) elige la capa.
    await page.keyboard.press('Shift+Enter');
    await expect(layer).toHaveAttribute('aria-valuetext', '0 %, en silencio');
    await page.keyboard.press('Enter');
    await driver.expectScreen('CAPA 2');
    // Atajos con el foco dentro: 3 elige la capa 3; ? abre la chuleta; Esc la cierra.
    await page.keyboard.press('3');
    await driver.expectScreen('CAPA 3');
    await page.keyboard.press('?');
    await expect(page.getByRole('heading', { name: 'Atajos de teclado' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Atajos de teclado' })).toBeHidden();
    // Espacio sobre un botón de los avisos lo pulsa (no es el atajo de reproducir).
    await page.keyboard.press('?');
    await page.getByRole('button', { name: 'Cerrar' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('heading', { name: 'Atajos de teclado' })).toBeHidden();
    await expect(driver.control('play')).toHaveAttribute('aria-pressed', 'false');
    // El tempo con el dial principal (menú cerrado).
    const main = driver.control('main');
    await main.focus();
    await page.keyboard.press('Shift+ArrowUp');
    await expect(main).toHaveAttribute('aria-valuetext', '100 pulsos por minuto');
    await driver.expectScreen('100 BPM');
    // Los botones tienen nombre y descripción; los diales, rol de slider.
    await expect(driver.control('record')).toHaveAccessibleName('Grabar');
    await expect(driver.control('record')).toHaveAccessibleDescription(/mantén para cancelar/);
    await expect(page.getByRole('slider', { name: 'Disco' })).toBeVisible();
  });

  test('con el puntero: arrastrar un dial, mantener una tecla y girar el disco', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.chooseSound(MENU.categories.bass);
    // Arrastrar hacia abajo un dial baja su nivel (4 px por paso).
    const layer = driver.control('layer-0');
    const box = (await layer.boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x, center.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(layer).toHaveAttribute('aria-valuenow', '90');
    // Tocar sin mover es pulsar (elige la capa); mantener medio segundo, silenciar.
    await driver.control('layer-2').click();
    await driver.expectScreen('CAPA 3');
    await driver.control('layer-0').click({ delay: 700 });
    await expect(layer).toHaveAttribute('aria-valuetext', '90 %, en silencio');
    // Mantener reproducir para (vuelve al principio); pulsarlo reproduce.
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');
    await driver.control('play').click({ delay: 700 });
    await driver.expectScreen('PAUSA');
    // El disco: con el teclado, Espacio lo mantiene y las flechas lo mueven 1/16 de vuelta.
    await driver.key('layer-0', 'Enter');
    const disc = driver.control('disc');
    await disc.focus();
    await page.keyboard.down('Space');
    await driver.expectScreen('DISCO');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(disc).toHaveAttribute('aria-valuetext', /^Congelado en el pulso 1,5 de 8$/);
    await page.keyboard.up('Space');
    await expect(disc).toHaveAttribute('aria-valuetext', 'Capa 1, 8 pulsos');
  });

  test('con el foco en el disco y el transporte en marcha, su valor en voz no cambia solo', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.chooseSound(MENU.categories.drums);
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');
    const disc = driver.control('disc');
    await disc.focus();
    const values = new Set<string | null>();
    for (let i = 0; i < 20; i++) {
      values.add(await disc.getAttribute('aria-valuetext'));
      await page.waitForTimeout(100);
    }
    expect([...values]).toEqual(['Capa 1, 8 pulsos']);
  });

  test('pasa axe sin violaciones, también con el menú abierto', async ({ page }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    const check = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      return results.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      );
    };
    expect(await check()).toEqual([]);
    await driver.menu(MENU.loop);
    expect(await check()).toEqual([]);
  });
});
