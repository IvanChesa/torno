import { expect, test } from '@playwright/test';
import { audioCalls, instrumentAudio, streamCount } from './support/audio';

// La guía de la portada (PLAN fase 7): «Ver en el instrumento» lleva al control y le pasa el foco,
// y **nunca inicia el audio ni pide el micrófono** (criterio de aceptación). Aquí, con el plato HTML
// (`?sin3d=1`); con el 3D, en stage.spec.ts (la cámara viaja hasta el control).

const ENTRIES = [
  ['reproducir y pausar', 'play'],
  ['grabar', 'record'],
  ['mezclar las capas', 'layer-0'],
  ['tempo', 'main'],
  ['el disco', 'disc'],
  ['el brazo', 'arm'],
  ['ajustes del bucle', 'main'],
  ['sonidos', 'main'],
  ['sesión', 'main'],
] as const;

test.describe('la guía', () => {
  test('los 9 controles llevan al instrumento sin que suene nada ni se pida el micrófono', async ({
    page,
  }) => {
    await instrumentAudio(page);
    await page.goto('/?sin3d=1');
    await expect(page.getByRole('heading', { name: 'Conoce tu instrumento' })).toBeVisible();
    const buttons = page.getByRole('button', { name: /^Ver en el instrumento: / });
    await expect(buttons).toHaveCount(9);
    // Sin esperar a que la guía se hidrate: un clic en plena hidratación no llevaba el foco al
    // control (CI de main tras la fusión de la fase 7; revisión del bloque D, #3).
    await buttons.first().scrollIntoViewIfNeeded();
    for (const [name, control] of ENTRIES) {
      await page.getByRole('button', { name: `Ver en el instrumento: ${name}` }).click();
      await expect(page.locator(`[data-control="${control}"]`)).toBeFocused();
      await expect(page.locator(`[data-control="${control}"]`)).toBeInViewport();
    }
    // Ni un AudioContext, ni un `resume`, ni una pista del micrófono.
    expect(await audioCalls(page)).toEqual([]);
    expect(await streamCount(page)).toBe(0);
  });

  // Revisión del bloque D, #3: una persona puede pulsar mientras la guía se hidrata. Con la CPU
  // frenada (como un móvil lento) la ventana es más ancha; aquí no se espera a nada.
  for (const how of ['clic', 'Intro'] as const) {
    test(`un ${how} en plena hidratación de la guía también lleva el foco al control`, async ({
      page,
    }) => {
      await instrumentAudio(page);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      await page.goto('/?sin3d=1', { waitUntil: 'commit' });
      const disc = page.getByRole('button', { name: 'Ver en el instrumento: el disco' });
      await disc.scrollIntoViewIfNeeded();
      if (how === 'clic') {
        await disc.click();
      } else {
        await disc.focus();
        await page.keyboard.press('Enter');
      }
      await expect(page.locator('[data-control="disc"]')).toBeFocused({ timeout: 20_000 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      expect(await audioCalls(page)).toEqual([]);
    });
  }

  test('con el teclado: Intro en el botón lleva el foco al control, sin audio', async ({
    page,
  }) => {
    await instrumentAudio(page);
    await page.goto('/?sin3d=1');
    // Sin esperar a que la guía se hidrate (revisión de la fase 7, #2, y del bloque D, #3).
    const tempo = page.getByRole('button', { name: 'Ver en el instrumento: tempo' });
    await tempo.scrollIntoViewIfNeeded();
    await tempo.focus();
    await page.keyboard.press('Enter');
    const main = page.locator('[data-control="main"]');
    await expect(main).toBeFocused();
    expect(await audioCalls(page)).toEqual([]);
  });
});
