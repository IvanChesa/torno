import { expect, type Locator, type Page } from '@playwright/test';

/** Elementos del menú (índices desde la raíz), como los define src/app/instrument/menu.ts. */
export const MENU = {
  sound: 0,
  loop: 1,
  input: 2,
  session: 3,
  help: 4,
  categories: { drums: 0, bass: 1, chords: 2, texture: 3 },
  loopItems: {
    takeLength: 0,
    countIn: 1,
    metronome: 2,
    reverse: 3,
    pan: 4,
    tapTempo: 5,
    fitTempo: 6,
  },
  inputItems: { gain: 0, latency: 1 },
  latencyItems: { auto: 0, calibrate: 1, manual: 2 },
  sessionItems: {
    save: 0,
    open: 1,
    exportMix: 2,
    exportStems: 3,
    clearLayer: 4,
    newSession: 5,
    clearAutosave: 6,
  },
} as const;

/** Maneja el instrumento HTML con el teclado, como lo haría una persona. */
export class InstrumentDriver {
  constructor(readonly page: Page) {}

  control(id: string): Locator {
    return this.page.locator(`[data-control="${id}"]`);
  }

  get screen(): Locator {
    return this.page.locator('trn-instrument-screen');
  }

  /**
   * Abre la portada y espera a que el instrumento (diferido) esté listo. Sin el escenario 3D
   * (`?sin3d=1`): los e2e del audio no necesitan pintar el aparato, y el WebGL por software de
   * Chromium sin interfaz los haría más lentos. `{ stage: true }` lo deja.
   */
  async open(url = '/', { stage = false }: { stage?: boolean } = {}): Promise<void> {
    const target = new URL(url, 'http://torno.test');
    if (!stage && !target.searchParams.has('sin3d')) target.searchParams.set('sin3d', '1');
    await this.page.goto(`${target.pathname}${target.search}${target.hash}`);
    await this.control('main').waitFor();
  }

  /** Pulsa una tecla con el foco en un control. */
  async key(control: string, key: string, times = 1): Promise<void> {
    const element = this.control(control);
    await element.focus();
    for (let i = 0; i < times; i++) await element.press(key);
  }

  /** Abre el menú y entra en `path` (índices desde la raíz); la última entrada se pulsa. */
  async menu(...path: number[]): Promise<void> {
    const main = this.control('main');
    await this.closeMenu();
    await main.press('Enter');
    for (const index of path) {
      for (let i = 0; i < index; i++) await main.press('ArrowDown');
      await main.press('Enter');
    }
  }

  /** Vuelve hasta cerrar el menú (Esc con el menú cerrado no hace nada). */
  async closeMenu(): Promise<void> {
    const main = this.control('main');
    await main.focus();
    for (let i = 0; i < 5; i++) await main.press('Escape');
  }

  /** Elige el primer sonido de una categoría para la capa elegida (SONIDO → categoría → el primero). */
  async chooseSound(category = 0): Promise<void> {
    await this.menu(MENU.sound, category, 0);
    await this.closeMenu();
  }

  /** Ajusta un elemento del menú: entra a editarlo, gira `steps` y lo deja. */
  async adjust(path: number[], steps: number): Promise<void> {
    await this.menu(...path);
    const main = this.control('main');
    for (let i = 0; i < Math.abs(steps); i++) await main.press(steps > 0 ? 'ArrowUp' : 'ArrowDown');
    await main.press('Enter');
    await this.closeMenu();
  }

  /** Confirma lo que pide confirmación (gira hacia la acción y pulsa). */
  async confirm(): Promise<void> {
    const main = this.control('main');
    await main.press('ArrowRight');
    await main.press('Enter');
  }

  async expectScreen(text: string | RegExp): Promise<void> {
    await expect(this.screen).toContainText(text);
  }
}
