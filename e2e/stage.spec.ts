import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { InstrumentDriver } from './support/instrument';

// El escenario 3D de la portada (PLAN fase 5.b): llega en `@defer` con su póster y se funde al primer
// fotograma; con `?sin3d=1` no se carga; sin WebGL se queda el instrumento HTML. En el servidor de
// desarrollo, su panel deja probar la pérdida del contexto, 10 cambios de calidad sin fugas y 0
// fotogramas en reposo. El WebGL de Chromium sin interfaz es por software: se espera a `data-listo`.

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

  test('sin WebGL, el escenario lo dice y el instrumento HTML funciona igual', async ({ page }) => {
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
    await expect(stage(page)).not.toHaveAttribute('data-listo');
    const driver = new InstrumentDriver(page);
    await driver.control('layer-1').focus();
    await page.keyboard.press('ArrowDown');
    await expect(driver.control('layer-1')).toHaveAttribute('aria-valuenow', '99');
  });

  test('el 3D sigue lo que se toca en el instrumento HTML (pose) sin pintar en reposo', async ({
    page,
  }, testInfo) => {
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
    // Un cambio que se ve (el nivel de una capa) pinta; uno que no (otra vez el mismo), no.
    const driver = new InstrumentDriver(page);
    await driver.control('layer-2').focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(frames).toBeGreaterThan(before);
    const after = await frames();
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
