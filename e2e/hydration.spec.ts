import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { audioCalls, contextStates, instrumentAudio } from './support/audio';
import { InstrumentDriver } from './support/instrument';

// Un toque sobre el instrumento antes de la hidratación (PLAN §4.9, fase 2): acaba con el audio
// desbloqueado en el gesto real o con el aviso «Toca para activar el sonido», nunca con un error ni
// en silencio sin explicación. Solo contra el build estático (los nombres de los archivos salen de
// sus estadísticas).

const NEEDS_GESTURE = 'Toca el instrumento para activar el sonido.';

/** Archivo JS de la portada (su chunk diferido por la ruta). */
async function homeChunk(): Promise<string> {
  const stats = JSON.parse(await readFile('dist/torno/browser-stats.json', 'utf8')) as {
    outputs: Record<string, { entryPoint?: string }>;
  };
  const [file] = Object.entries(stats.outputs).find(
    ([, output]) => output.entryPoint === 'src/app/pages/home/home-page.ts',
  )!;
  return file;
}

/** Retiene las peticiones que cumplen `pattern` hasta que se llame a la función devuelta. */
async function hold(page: Page, pattern: RegExp): Promise<() => void> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

test.describe('desbloqueo robusto', () => {
  test('si el sistema no toma `pointerup` como gesto, el `click` del mismo toque desbloquea el audio', async ({
    page,
  }) => {
    await instrumentAudio(page, { pointerupIsNotAGesture: true });
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.control('layer-0').click();
    await expect.poll(() => contextStates(page)).toEqual(['running']);
    const calls = await audioCalls(page);
    expect(calls.slice(0, 2)).toEqual(['new:pointerup', 'resume:pointerup']);
    expect(calls).toContain('resume:click');
    await expect(page.getByText(NEEDS_GESTURE)).toBeHidden();
  });
});

test.describe('toques antes de la hidratación', () => {
  test('con el JS principal ya cargado, el audio se desbloquea en el gesto real', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const release = await hold(page, new RegExp(`/${(await homeChunk()).replace('.', '\\.')}$`));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // La escucha nativa ya está, pero la portada aún no se ha hidratado.
    await page.waitForFunction(() => window.__torno?.unlockReady === true);
    await page.locator('.stage').click();
    expect((await audioCalls(page))[0]).toMatch(/^new:(pointerup|click)$/);
    await expect.poll(() => contextStates(page)).toEqual(['running']);
    release();
    const driver = new InstrumentDriver(page);
    await driver.control('main').waitFor();
    await page.waitForTimeout(500);
    await expect(page.getByText(NEEDS_GESTURE)).toBeHidden();
    expect(await contextStates(page)).toEqual(['running']);
  });

  test('si el toque llegó antes que el JS, el instrumento pide otro y el siguiente lo desbloquea', async ({
    page,
  }) => {
    await instrumentAudio(page);
    const release = await hold(page, /\/main-[A-Z0-9]+\.js$/);
    // Sin el JS principal no llega `DOMContentLoaded` (espera a los módulos): basta con el HTML.
    await page.goto('/', { waitUntil: 'commit' });
    await page.locator('.stage').waitFor();
    await page.locator('.stage').click();
    expect(await audioCalls(page)).toEqual([]);
    release();
    const driver = new InstrumentDriver(page);
    await driver.control('main').waitFor();
    // Angular repite el toque tras la hidratación: no pudo activar el sonido, y lo dice.
    await expect(page.getByText(NEEDS_GESTURE)).toBeVisible();
    expect(await contextStates(page)).toEqual([]);
    // Otro toque (ya con el JS) lo desbloquea en el gesto.
    await driver.control('layer-0').click();
    await expect(page.getByText(NEEDS_GESTURE)).toBeHidden();
    expect((await audioCalls(page))[0]).toMatch(/^new:(pointerup|click)$/);
    await expect.poll(() => contextStates(page)).toEqual(['running']);
  });
});
