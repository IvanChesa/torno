import { expect, test } from '@playwright/test';
import {
  audioCalls,
  contextStates,
  instrumentAudio,
  outputPeak,
  workletCommands,
} from './support/audio';

// «Anatomía de un bucle» (PLAN fase 7): escuchar solo tras pulsar. Antes de pulsar no hay contexto
// de audio; al pulsar, nace en el propio gesto y suena la vuelta del bucle, sin tocar la sesión del
// instrumento (ningún comando al núcleo cambia sus capas). «Parar» la corta.

test.describe('la anatomía de un bucle', () => {
  test('no suena hasta pulsar «Escuchar»; suena sin tocar la sesión y se para', async ({
    page,
  }) => {
    await instrumentAudio(page);
    await page.goto('/?sin3d=1');
    // El título del marcador se cambia por el de la sección al llegar su `@defer`: se espera al botón.
    const listen = page.getByRole('button', { name: 'Escuchar batería: Alfar' });
    await listen.scrollIntoViewIfNeeded();
    await expect(listen).toBeVisible();
    expect(await audioCalls(page)).toEqual([]);

    await listen.click();
    // El contexto nace en el gesto (el desbloqueo nativo) y está en marcha.
    expect((await audioCalls(page))[0]).toMatch(/^new:(pointerup|click)$/);
    await expect(page.getByText('Suena: Alfar.')).toBeVisible();
    expect(await contextStates(page)).toEqual(['running']);
    expect(await outputPeak(page)).toBeGreaterThan(0.05);
    // La sesión, intacta: ni un sonido puesto en una capa ni una reproducción.
    expect(await workletCommands(page)).not.toContain('set-sound');
    expect(await workletCommands(page)).not.toContain('play');

    const stop = page.getByRole('button', { name: 'Parar' });
    await stop.click();
    await expect(page.getByText('Parado.')).toBeVisible();
    await page.waitForTimeout(100);
    expect(await outputPeak(page, 300)).toBeLessThan(0.001);
  });

  test('«Escuchar las cuatro» suena las cuatro capas a la vez', async ({ page }) => {
    await instrumentAudio(page);
    await page.goto('/?sin3d=1');
    const all = page.getByRole('button', { name: 'Escuchar las cuatro' });
    await all.scrollIntoViewIfNeeded();
    await all.click();
    await expect(page.getByText('Suena: Alfar, Raíz, Olivo, Cierzo.')).toBeVisible();
    expect(await outputPeak(page)).toBeGreaterThan(0.05);
  });
});
