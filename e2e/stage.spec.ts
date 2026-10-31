import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { InstrumentDriver, MENU } from './support/instrument';

// El escenario 3D de la portada (PLAN fases 5.b y 6): llega en `@defer` con su póster y se funde al
// primer fotograma; con `?sin3d=1` no se carga; sin WebGL, la portada pone el instrumento HTML. En el
// servidor de desarrollo, su panel deja probar la pérdida del contexto, 10 cambios de calidad sin
// fugas y 0 fotogramas en reposo. Desde la fase 6 es el instrumento: se toca con el ratón, el dedo y
// el teclado. El WebGL de Chromium sin interfaz es por software: se espera a `data-listo`.

const READY_MS = 60_000;
const stage = (page: Page) => page.locator('.stage3d');

/** Los errores de la consola, sin los avisos de rendimiento del WebGL por software (SwiftShader). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/GPU stall|WebGL-/.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function openStage(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.locator('#instrumento').scrollIntoViewIfNeeded();
  await expect(stage(page)).toHaveAttribute('data-listo', '', { timeout: READY_MS });
}

test.describe('escenario 3D', () => {
  test('llega con su póster, se funde al primer fotograma, pasa axe y no da errores', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto('/');
    // Antes del 3D, el póster en la misma caja (5:4).
    const poster = page.locator('.stage3d-placeholder img, .stage3d__poster').first();
    await expect(poster).toHaveAttribute('src', '/img/escenario.webp');
    await page.locator('#instrumento').scrollIntoViewIfNeeded();
    await expect(stage(page)).toHaveAttribute('data-listo', '', { timeout: READY_MS });
    const canvas = stage(page).locator('canvas');
    await expect(canvas).toHaveAttribute('role', 'img');
    await expect(canvas).toHaveAttribute('aria-label', /Torno en 3D/);
    await expect(canvas).toHaveClass(/is-shown/);
    await expect(stage(page).locator('.stage3d__poster')).toHaveClass(/is-gone/);
    // La caja no cambia de tamaño al llegar el lienzo: 5:4.
    const box = (await stage(page).boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(1.25, 2);
    const results = await new AxeBuilder({ page })
      .include('#instrumento')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => `${v.id} (${v.impact})`)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('con ?sin3d=1 no hay escenario ni lienzo: solo el instrumento HTML', async ({ page }) => {
    const driver = new InstrumentDriver(page);
    await driver.open('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('trn-instrument-stage')).toHaveCount(0);
    await expect(page.locator('.stage3d-placeholder')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('sin WebGL, la portada lo dice y pone el instrumento HTML, que funciona igual', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (/webgl/.test(type)) return null;
        return (original as (...args: unknown[]) => RenderingContext | null).call(
          this,
          type,
          ...rest,
        );
      } as typeof original;
    });
    await page.goto('/');
    await page.locator('#instrumento').scrollIntoViewIfNeeded();
    await expect(page.getByText('Este navegador no puede mostrar el 3D')).toBeVisible({
      timeout: READY_MS,
    });
    await expect(page.locator('trn-instrument-stage')).toHaveCount(0);
    await expect(page.locator('trn-html-instrument')).toHaveCount(1);
    const driver = new InstrumentDriver(page);
    await driver.control('layer-1').focus();
    await page.keyboard.press('ArrowDown');
    await expect(driver.control('layer-1')).toHaveAttribute('aria-valuenow', '99');
  });

  test('el 3D sigue lo que se toca (pose) sin pintar en reposo', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'escena-dev',
      'El panel de la escena solo está en desarrollo',
    );
    test.setTimeout(90_000);
    await openStage(page);
    const panel = page.locator('trn-stage-dev .dev');
    const frames = async () => Number(await panel.getAttribute('data-fotogramas'));
    await expect.poll(frames).toBeGreaterThan(0);
    // En reposo: 0 fotogramas (el panel se lee dos veces por segundo).
    const before = await frames();
    await page.waitForTimeout(2000);
    expect(await frames()).toBe(before);
    // Un cambio que se ve (el nivel de una capa, y el anillo del foco) pinta; luego, nada más.
    const driver = new InstrumentDriver(page);
    await driver.control('layer-2').focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(frames).toBeGreaterThan(before);
    // Con el WebGL por software (el del CI), el anillo y la pose pueden ir en dos fotogramas
    // separados: se espera a que el contador se quede quieto.
    let after = await frames();
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(700);
      const now = await frames();
      if (now === after) break;
      after = now;
    }
    await page.waitForTimeout(1500);
    expect(await frames()).toBe(after);
  });

  test('el contexto se pierde y se recupera, y 10 cambios de calidad no dejan memoria', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'escena-dev',
      'El panel de la escena solo está en desarrollo',
    );
    test.setTimeout(180_000);
    // Un lienzo pequeño: el WebGL por software pinta menos y no frena a los demás tests.
    await page.setViewportSize({ width: 560, height: 700 });
    const errors = collectErrors(page);
    await openStage(page);
    const panel = page.locator('trn-stage-dev .dev');
    const memory = async () => ({
      geometries: Number(await panel.getAttribute('data-geometrias')),
      textures: Number(await panel.getAttribute('data-texturas')),
    });
    const quality = (level: string) =>
      panel.getByRole('group', { name: 'Calidad' }).getByRole('button', { name: level });

    // Contexto: perdido (el lienzo se esconde y se ve el aviso) y recuperado (vuelve a pintar).
    await panel.getByRole('button', { name: 'Perder el contexto' }).click();
    await expect(stage(page)).toHaveAttribute('data-contexto', 'perdido');
    await expect(page.getByText('El 3D se ha detenido')).toBeVisible();
    await panel.getByRole('button', { name: 'Recuperarlo' }).click();
    // Al recuperarlo se vuelven a compilar los shaders: por software, varios segundos.
    await expect(stage(page)).toHaveAttribute('data-contexto', 'activo', { timeout: 30_000 });
    await expect(stage(page)).toHaveAttribute('data-listo', '');

    // Calidad: la de partida, 10 cambios y vuelta a ella; la memoria, igual que al principio.
    const start = (await stage(page).getAttribute('data-calidad'))!;
    const names = { low: 'Baja', medium: 'Media', high: 'Alta' } as const;
    const startName = names[start as keyof typeof names];
    await quality(startName).click();
    await expect.poll(async () => (await memory()).geometries).toBeGreaterThan(0);
    const initial = await memory();
    const cycle = [
      'Baja',
      'Media',
      'Alta',
      'Baja',
      'Alta',
      'Media',
      'Baja',
      'Media',
      'Alta',
      'Baja',
    ];
    for (const name of cycle) {
      await quality(name).click();
      await expect(quality(name)).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });
    }
    await quality(startName).click();
    await expect(quality(startName)).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });
    await expect.poll(memory, { timeout: 10_000 }).toEqual(initial);
    expect(errors).toEqual([]);
  });
});

// --- Fase 6: el instrumento 3D se toca ------------------------------------------------------------
//
// Los controles van encima de sus piezas (`trn-stage-controls`): con el ratón, con el dedo y con el
// teclado, todo llega al audio igual que en el plato HTML. Con `?diagnostico=1` (en desarrollo,
// siempre), el panel de la escena dice cuántos fotogramas lleva, cuánto ha girado el disco y qué
// control tiene el anillo de luz.

declare global {
  interface Window {
    __mensajes?: { type: string; t: number }[];
    __teclas?: number[];
  }
}

const zone = (page: Page, id: string) => page.locator(`trn-stage-controls [data-control="${id}"]`);
const panel = (page: Page) => page.locator('trn-stage-dev .dev');
const numberOf = async (locator: Locator, attribute: string) =>
  Number(await locator.getAttribute(attribute));

/** Abre la portada y espera al 3D con sus controles ya encima de las piezas. */
async function openInstrument(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.locator('#instrumento').scrollIntoViewIfNeeded();
  await expect(stage(page)).toHaveAttribute('data-listo', '', { timeout: READY_MS });
  await expect(page.locator('trn-stage-controls')).toHaveClass(/is-placed/);
}

/**
 * Abre el 3D con el panel de la escena (`?diagnostico=1`) y en calidad baja: el WebGL por software
 * del CI pinta mucho menos, y las pruebas que tocan mucho no se pasan de tiempo.
 */
async function openLight(page: Page): Promise<void> {
  await openInstrument(page, '/?diagnostico=1');
  await panel(page)
    .getByRole('group', { name: 'Calidad' })
    .getByRole('button', { name: 'Baja' })
    .click();
  await expect(stage(page)).toHaveAttribute('data-calidad', 'low', { timeout: 30_000 });
  await expect(page.locator('trn-stage-controls')).toHaveClass(/is-placed/);
  // Cambiar de calidad rehace el aparato y su entorno: hasta que el 3D se queda quieto, el hilo
  // principal está ocupado y un arrastre llegaría tarde (y se tomaría por «mantener»).
  const frames = () => numberOf(panel(page), 'data-fotogramas');
  let last = await frames();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(600);
    const now = await frames();
    if (now === last) break;
    last = now;
  }
}

/** Arrastra con el ratón desde el centro de un control. */
async function drag(page: Page, target: Locator, dx: number, dy: number): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
}

/** Mantiene pulsado un control con el ratón (más que los 500 ms de «mantener»). */
async function hold(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

/** Lo que la página se sale a lo ancho (0: nada). */
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Reproduce desde la tecla del 3D (la primera vez, ALFAR en la capa 1) y espera a que suene. */
async function play(page: Page, how: 'click' | 'tap' = 'click'): Promise<void> {
  const key = zone(page, 'play');
  await (how === 'tap' ? key.tap() : key.click());
  await expect(key).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
}

interface ZoneBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly visible: boolean;
}

const zoneBoxes = (page: Page): Promise<ZoneBox[]> =>
  page.$$eval('trn-stage-controls .zone', (zones) =>
    zones.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        id: (element as HTMLElement).dataset['control'] ?? '',
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        width: box.width,
        height: box.height,
        visible: getComputedStyle(element).visibility !== 'hidden',
      };
    }),
  );

/** Dos zonas se pisan (la del disco es una elipse, también para el puntero). */
function overlap(a: ZoneBox, b: ZoneBox): boolean {
  if (a.id === 'disc' || b.id === 'disc') {
    const [disc, other] = a.id === 'disc' ? [a, b] : [b, a];
    const nearX = Math.max(other.x - other.width / 2, Math.min(disc.x, other.x + other.width / 2));
    const nearY = Math.max(
      other.y - other.height / 2,
      Math.min(disc.y, other.y + other.height / 2),
    );
    const dx = (nearX - disc.x) / (disc.width / 2);
    const dy = (nearY - disc.y) / (disc.height / 2);
    return dx * dx + dy * dy < 1;
  }
  // Medio píxel de tolerancia: las cajas vienen con decimales.
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 0.5 &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 - 0.5
  );
}

test.describe('el instrumento 3D: ratón y teclado', () => {
  // Una ventana más pequeña que la de siempre, aún de escritorio (desde 768 px): el WebGL por
  // software (el del CI, más lento) pinta la mitad de píxeles por fotograma y deja libre el hilo
  // principal; cada tecla espera a uno.
  test.use({ viewport: { width: 800, height: 600 } });

  test('cada control, con el ratón sobre su pieza', async ({ page }) => {
    test.setTimeout(180_000);
    await openLight(page);
    // Antes de reproducir: con el WebGL por software, pintar seguido ocupa el hilo principal y los
    // movimientos del ratón llegarían después de los 500 ms de «mantener».
    // Los diales: hacia abajo, menos nivel; hacia arriba, más tempo.
    await drag(page, zone(page, 'layer-0'), 0, 40);
    await expect.poll(() => numberOf(zone(page, 'layer-0'), 'aria-valuenow')).toBeLessThan(100);
    await drag(page, zone(page, 'main'), 0, -40);
    await expect.poll(() => numberOf(zone(page, 'main'), 'aria-valuenow')).toBeGreaterThan(90);
    // El brazo, por su recorrido: de fuera (sin filtro) hacia el disco, a la izquierda.
    await drag(page, zone(page, 'arm'), -70, 10);
    await expect.poll(() => numberOf(zone(page, 'arm'), 'aria-valuenow')).toBeGreaterThan(0);
    // La rueda: hacia dentro (abajo y a la derecha), menos volumen.
    await drag(page, zone(page, 'volume'), 30, 30);
    await expect.poll(() => numberOf(zone(page, 'volume'), 'aria-valuenow')).toBeLessThan(100);
    // Reproducir (la primera vez, ALFAR en la capa 1).
    await play(page);
    // El disco, con la capa 1 elegida (la de ALFAR): mantener y girar la congela; soltar, la suelta.
    await zone(page, 'layer-0').click();
    const disc = zone(page, 'disc');
    await disc.scrollIntoViewIfNeeded();
    const box = (await disc.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx + box.width * 0.35, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + box.height * 0.35, { steps: 10 });
    await expect(disc).toHaveAttribute('aria-valuetext', /Congelado/);
    await page.mouse.up();
    await expect(disc).not.toHaveAttribute('aria-valuetext', /Congelado/);
    // Pausar. En pausa (sin pintar seguido: los clics no se confunden con «mantener»), deshacer
    // vacía la capa 1 y mantener deshacer la rehace.
    await zone(page, 'play').click();
    await expect(zone(page, 'play')).toHaveAttribute('aria-pressed', 'false');
    const screen = page.locator('trn-instrument-screen');
    await zone(page, 'undo').click();
    await expect(screen).toContainText('CAPA 1 · VACÍA');
    await hold(page, zone(page, 'undo'));
    await expect(screen).toContainText('CAPA 1 · BATERÍA');
    // Mantener reproducir, sonando: para y vuelve al principio.
    await zone(page, 'play').click();
    await expect(zone(page, 'play')).toHaveAttribute('aria-pressed', 'true');
    await hold(page, zone(page, 'play'));
    await expect(zone(page, 'play')).toHaveAttribute('aria-pressed', 'false');
    // Con el reposo, parar el audio (y volver de él).
    await zone(page, 'standby').click();
    await expect(zone(page, 'standby')).toHaveAttribute('aria-pressed', 'true');
    await zone(page, 'standby').click();
    await expect(zone(page, 'standby')).toHaveAttribute('aria-pressed', 'false');
  });

  test('con el teclado: el orden de siempre, las teclas de cada control y lo de §0.1', async ({
    page,
  }) => {
    // Muchas teclas, y cada una repinta el 3D por software (en el servidor de desarrollo, más lento).
    test.setTimeout(240_000);
    const driver = new InstrumentDriver(page);
    await openLight(page);
    // El orden del tabulador: el del plato HTML.
    await zone(page, 'main').focus();
    const order: (string | null)[] = [];
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => document.activeElement?.getAttribute('data-control') ?? null),
      );
    }
    expect(order).toEqual([
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
    // Un sonido desde el menú del dial principal (el primero se renderiza: con el WebGL por software
    // ocupando la máquina, puede tardar), reproducir, y otra capa con su sonido.
    const screen = (text: string) => expect(driver.screen).toContainText(text, { timeout: 20_000 });
    await driver.chooseSound(MENU.categories.drums);
    await screen('CAPA 1 · BATERÍA');
    await driver.key('play', 'Enter');
    await expect(zone(page, 'play')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
    await driver.key('main', '2');
    await screen('CAPA 2');
    await driver.chooseSound(MENU.categories.bass);
    // Entra en el compás siguiente (la cola, en sounds.spec).
    await screen('CAPA 2 · BAJO');
    // Deshacer: la capa vuelve a estar vacía.
    await driver.key('undo', 'Enter');
    await screen('CAPA 2 · VACÍA');
    // Mantener una capa la silencia; el tempo con las flechas; el filtro con el brazo.
    await driver.key('layer-0', 'Shift+Enter');
    await expect(zone(page, 'layer-0')).toHaveAttribute('aria-valuetext', /en silencio/);
    // De diez en diez (Re Pág): menos teclas, cada una con su fotograma.
    await driver.key('main', 'PageUp');
    await driver.expectScreen('100 BPM');
    await driver.key('main', '1');
    await driver.key('arm', 'PageUp');
    await expect(zone(page, 'arm')).toHaveAttribute('aria-valuetext', 'Filtro al 10 %');
    // Espacio en el disco lo mantiene; al soltarlo, se suelta.
    await zone(page, 'disc').focus();
    await page.keyboard.down(' ');
    await expect(zone(page, 'disc')).toHaveAttribute('aria-valuetext', /Congelado/);
    await page.keyboard.up(' ');
    await expect(zone(page, 'disc')).not.toHaveAttribute('aria-valuetext', /Congelado/);
    // El reposo.
    await driver.key('standby', 'Enter');
    await expect(zone(page, 'standby')).toHaveAttribute('aria-pressed', 'true');
  });

  test('grabar una toma con el micrófono desde la tecla del 3D', async ({ page }) => {
    test.setTimeout(150_000);
    await openLight(page);
    // Con la pausa de movimiento, el 3D no pinta seguido en la cuenta ni en la toma: los clics no se
    // confunden con «mantener» (que cancelaría la toma) con el WebGL por software.
    await page.getByRole('button', { name: 'Pausar movimiento' }).click();
    const screen = page.locator('trn-instrument-screen');
    // La capa 2 (vacía), grabar (cuenta previa y toma libre) y grabar otra vez para cerrarla.
    await zone(page, 'layer-1').click();
    await expect(screen).toContainText('CAPA 2');
    await zone(page, 'record').click();
    await expect(screen).toContainText('GRABANDO', { timeout: 30_000 });
    await page.waitForTimeout(1000);
    await zone(page, 'record').click();
    await expect(screen).toContainText('CAPA 2 · GRABACIÓN', { timeout: 20_000 });
    await expect(zone(page, 'record')).toHaveAttribute('aria-pressed', 'false');
  });

  test('el anillo de luz del 3D sigue al foco del teclado y al puntero', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'escena-dev', 'El panel de la escena, en desarrollo');
    test.setTimeout(90_000);
    await openInstrument(page);
    const shown = () => panel(page).getAttribute('data-resaltado');
    await zone(page, 'main').focus();
    await page.keyboard.press('Tab');
    await expect.poll(shown).toBe('layer-0');
    await page.keyboard.press('Tab');
    await expect.poll(shown).toBe('layer-1');
    // Con el ratón encima de otro, manda el foco del teclado; sin foco, el del puntero.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await zone(page, 'arm').hover();
    await expect.poll(shown).toBe('arm');
    await page.mouse.move(2, 2);
    await expect.poll(shown).toBe('');
  });

  test('los encuadres cambian la cámara; «Inspeccionar» gira y oculta lo que tapa la bandeja', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openInstrument(page);
    // El tamaño de la pieza proyectada (`--w`), no el de su zona, que nunca baja de 44 px.
    const layer = () =>
      zone(page, 'layer-0').evaluate((element) =>
        parseFloat((element as HTMLElement).style.getPropertyValue('--w')),
      );
    const before = await layer();
    // Ningún encuadre ensancha la página: lo que se sale del lienzo se recorta.
    for (const [name, camera] of [
      ['Controles', 'controles'],
      ['Inspeccionar', 'inspeccionar'],
      ['Completo', 'completo'],
    ] as const) {
      await page.getByRole('button', { name }).click();
      await expect(stage(page)).toHaveAttribute('data-camara', camera);
      await expect.poll(() => overflowX(page)).toBe(0);
    }
    await page.getByRole('button', { name: 'Capas' }).click();
    await expect(stage(page)).toHaveAttribute('data-camara', 'capas');
    await expect.poll(() => overflowX(page)).toBe(0);
    // De cerca, los diales de las capas se ven (y se tocan) más grandes.
    await expect.poll(layer).toBeGreaterThan(before * 1.3);
    await page.getByRole('button', { name: 'Inspeccionar' }).click();
    await expect(stage(page)).toHaveAttribute('data-camara', 'inspeccionar');
    const orbit = page.getByRole('slider', { name: 'Girar el aparato' });
    await orbit.focus();
    // Desde el frente (Inicio: 0° y 40°), a 150° y 10° de altura.
    await orbit.press('Home');
    for (let i = 0; i < 15; i++) await orbit.press('ArrowRight');
    for (let i = 0; i < 6; i++) await orbit.press('ArrowDown');
    await expect(orbit).toHaveAttribute('aria-valuenow', '150');
    await expect(orbit).toHaveAttribute('aria-valuetext', /10° de altura/);
    await expect(orbit).toHaveAttribute('aria-valuetext', /a la derecha/);
    // Desde detrás, la bandeja tapa el reposo: su control se oculta (y deja de recibir el foco).
    await expect(zone(page, 'standby')).toBeHidden();
    await orbit.press('Home');
    await expect(orbit).toHaveAttribute('aria-valuetext', /De frente/);
    await expect(zone(page, 'standby')).toBeVisible();
    await page.getByRole('button', { name: 'Completo' }).click();
    await expect(stage(page)).toHaveAttribute('data-camara', 'completo');
  });

  test('el disco va a la velocidad del transporte y un gesto llega al audio en ≤ 20 ms', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      window.__mensajes = [];
      window.__teclas = [];
      const original = MessagePort.prototype.postMessage;
      MessagePort.prototype.postMessage = function (
        this: MessagePort,
        message: unknown,
        ...rest: unknown[]
      ) {
        const type = (message as { type?: unknown } | null)?.type;
        if (typeof type === 'string') window.__mensajes!.push({ type, t: performance.now() });
        return (original as (...args: unknown[]) => void).call(this, message, ...rest);
      } as typeof original;
      addEventListener('keydown', (event) => window.__teclas!.push(event.timeStamp), {
        capture: true,
      });
    });
    await openLight(page);
    await play(page);
    // La velocidad del disco frente a la del transporte, en el mismo rato (con el tempo no vale: en
    // una máquina cargada, el reloj del audio puede ir más despacio que el de la página). El panel
    // da el giro del disco con la hora de su fotograma y el pulso con la hora a la que suena; cada
    // velocidad es la pendiente de la recta que mejor pasa por una docena de lecturas, cada una
    // de una vez (con el hilo principal ocupado, cada vuelta al navegador cuesta).
    const read = () =>
      page.evaluate(() => {
        const dev = document.querySelector('trn-stage-dev .dev')!;
        const value = (name: string) => Number(dev.getAttribute(name));
        return {
          disc: value('data-disco'),
          discAt: value('data-disco-ms'),
          beat: value('data-pulso'),
          beatAt: value('data-pulso-ms'),
        };
      });
    await expect.poll(async () => (await read()).disc, { timeout: 20_000 }).toBeGreaterThan(0);
    const discs = new Map<number, number>();
    const beats = new Map<number, number>();
    for (let i = 0; i < 14; i++) {
      const sample = await read();
      discs.set(sample.discAt, sample.disc);
      beats.set(sample.beatAt, sample.beat);
      await page.waitForTimeout(520);
    }
    const slope = (points: Map<number, number>) => {
      const list = [...points];
      const mx = list.reduce((sum, [x]) => sum + x, 0) / list.length;
      const my = list.reduce((sum, [, y]) => sum + y, 0) / list.length;
      let num = 0;
      let den = 0;
      for (const [x, y] of list) {
        num += (x - mx) * (y - my);
        den += (x - mx) ** 2;
      }
      return num / den;
    };
    expect(discs.size).toBeGreaterThan(8);
    const ratio = slope(discs) / (slope(beats) / 4);
    // El criterio es ±1 % (§5): lo fijan el test de `InstrumentMotion` (con estados que llegan tarde)
    // y la medida con la GPU del informe (0,0–0,3 %). Aquí, con el WebGL por software a unos 6
    // fotogramas por segundo y la máquina cargada, cada lectura llega con su retraso: un 3 % de
    // margen. Un fallo de verdad (otra escala, una deriva, un disco que no vuelve) se sale de largo.
    expect(Math.abs(ratio - 1)).toBeLessThan(0.03);
    // La respuesta: de la tecla al mensaje del nivel al audio. En pausa: con el WebGL por software,
    // pintar seguido ocupa el hilo principal y la tecla esperaría su turno (con la GPU, no: medido
    // en el informe).
    await zone(page, 'play').click();
    await expect(zone(page, 'play')).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(500);
    await zone(page, 'layer-1').focus();
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(() =>
        page.evaluate(() => window.__mensajes!.filter((m) => m.type === 'set-level').length),
      )
      .toBeGreaterThan(0);
    const delay = await page.evaluate(() => {
      const key = window.__teclas!.at(-1)!;
      const message = window.__mensajes!.find((m) => m.type === 'set-level' && m.t >= key);
      return message ? message.t - key : Infinity;
    });
    expect(delay).toBeLessThanOrEqual(20);
  });

  for (const mode of ['movimiento reducido', '«Pausar movimiento»'] as const) {
    test(`con ${mode}, nada se mueve solo: ni el disco ni un fotograma de más`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      if (mode === 'movimiento reducido') await page.emulateMedia({ reducedMotion: 'reduce' });
      await openInstrument(page, '/?diagnostico=1');
      if (mode === '«Pausar movimiento»') {
        const pause = page.getByRole('button', { name: 'Pausar movimiento' });
        await pause.click();
        await expect(pause).toHaveAttribute('aria-pressed', 'true');
      }
      await play(page);
      await page.waitForTimeout(1500);
      const frames = () => numberOf(panel(page), 'data-fotogramas');
      const disc = () => numberOf(panel(page), 'data-disco');
      const startFrames = await frames();
      const startDisc = await disc();
      await page.waitForTimeout(2500);
      expect((await frames()) - startFrames).toBeLessThanOrEqual(2);
      expect(await disc()).toBe(startDisc);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    });
  }
});

test.describe('el instrumento 3D en el móvil', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  test('zonas táctiles de 44 px como poco, sin pisarse, en el encuadre del móvil', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openInstrument(page);
    // La caja es cuadrada y de borde a borde.
    const box = (await stage(page).boundingBox())!;
    expect(box.width).toBeCloseTo(360, 0);
    expect(box.width / box.height).toBeCloseTo(1, 2);
    const zones = await zoneBoxes(page);
    expect(zones).toHaveLength(12);
    for (const zone of zones) {
      expect(zone.visible, zone.id).toBe(true);
      expect(zone.width, zone.id).toBeGreaterThanOrEqual(43.9);
      expect(zone.height, zone.id).toBeGreaterThanOrEqual(43.9);
    }
    const pairs: string[] = [];
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        if (overlap(zones[i]!, zones[j]!)) pairs.push(`${zones[i]!.id}–${zones[j]!.id}`);
      }
    }
    expect(pairs).toEqual([]);
  });

  test('en el móvil, ningún encuadre ensancha la página', async ({ page }) => {
    test.setTimeout(90_000);
    await openInstrument(page);
    for (const [name, camera] of [
      ['Capas', 'capas'],
      ['Controles', 'controles'],
      ['Inspeccionar', 'inspeccionar'],
      ['Completo', 'completo'],
    ] as const) {
      await page.getByRole('button', { name }).click();
      await expect(stage(page)).toHaveAttribute('data-camara', camera);
      await expect.poll(() => overflowX(page)).toBe(0);
    }
  });

  test('con el dedo: tocar y arrastrar los controles; fuera de ellos, la página se desplaza', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openInstrument(page);
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (x: number, y: number, dx: number, dy: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }],
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // Un dial con el dedo: hacia abajo, menos nivel, sin mover la página (antes de reproducir: ver
    // el test del ratón). Luego, una tecla con un toque; y después el desplazamiento: un toque
    // mientras la página aún se desliza solo la para.
    const scroll = () => page.evaluate(() => Math.round(window.scrollY));
    const before = await scroll();
    const dial = (await zone(page, 'layer-1').boundingBox())!;
    await swipe(dial.x + dial.width / 2, dial.y + dial.height / 2, 0, 50);
    await expect.poll(() => numberOf(zone(page, 'layer-1'), 'aria-valuenow')).toBeLessThan(100);
    expect(await scroll()).toBe(before);
    // Mantener una capa con el dedo la silencia (sin abrir la selección de texto).
    const layer = (await zone(page, 'layer-0').boundingBox())!;
    const point = { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(zone(page, 'layer-0')).toHaveAttribute('aria-valuetext', /en silencio/);
    expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');
    await play(page, 'tap');
    // Fuera de los controles (la esquina de abajo a la izquierda del lienzo), la página se desplaza.
    const box = (await stage(page).boundingBox())!;
    await swipe(box.x + 12, box.y + box.height - 12, 0, -150);
    await expect.poll(scroll).toBeGreaterThan(before + 50);
  });
});
