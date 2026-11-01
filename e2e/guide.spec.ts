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
    for (const [name, control] of ENTRIES) {
      await page.getByRole('button', { name: `Ver en el instrumento: ${name}` }).click();
      await expect(page.locator(`[data-control="${control}"]`)).toBeFocused();
      await expect(page.locator(`[data-control="${control}"]`)).toBeInViewport();
    }
    // Ni un AudioContext, ni un `resume`, ni una pista del micrófono.
    expect(await audioCalls(page)).toEqual([]);
    expect(await streamCount(page)).toBe(0);
  });

  test('con el teclado: Intro en el botón lleva el foco al control, sin audio', async ({
    page,
  }) => {
    await instrumentAudio(page);
    await page.goto('/?sin3d=1');
    // La guía se hidrata al verse: un Intro en pleno cambio se podía perder (revisión de la fase 7,
    // #2). Con el ratón, el clic espera solo; con el teclado, se espera a que esté hidratada.
    const tempo = page.getByRole('button', { name: 'Ver en el instrumento: tempo' });
    await tempo.scrollIntoViewIfNeeded();
    await expect(page.locator('trn-guide[data-lista]')).toBeAttached();
    await tempo.focus();
    await page.keyboard.press('Enter');
    const main = page.locator('[data-control="main"]');
    await expect(main).toBeFocused();
    expect(await audioCalls(page)).toEqual([]);
  });
});
