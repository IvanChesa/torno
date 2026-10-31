/**
 * «Pausar movimiento» (PLAN fase 6; CLAUDE.md: en todas las animaciones). Mira dos cosas:
 * - la preferencia de quien toca, guardada en `localStorage` con `try/catch`;
 * - la del sistema, `prefers-reduced-motion`.
 *
 * Con cualquiera de las dos, nada se mueve solo:
 * - el disco no gira, los pilotos no laten y los medidores se quedan quietos;
 * - las cámaras cortan;
 * - no hay transiciones: el documento lleva `data-movimiento="pausado"` y `base.css` las anula,
 *   como con el movimiento reducido.
 */
import { computed, DOCUMENT, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'torno.movimiento';
const PAUSED = 'pausado';

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === PAUSED;
  } catch {
    return false;
  }
}

function save(paused: boolean): void {
  try {
    if (paused) localStorage.setItem(STORAGE_KEY, PAUSED);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento (modo privado, cuota): la preferencia dura lo que dure la página.
  }
}

@Service()
export class MotionPreference {
  readonly #document = inject(DOCUMENT);
  readonly #paused = signal(false);
  readonly #reduced = signal(false);

  /** Quien toca ha pulsado «Pausar movimiento». */
  readonly paused = this.#paused.asReadonly();
  /** El sistema pide movimiento reducido. */
  readonly reduced = this.#reduced.asReadonly();
  /** Nada se mueve solo (por una cosa o por la otra). */
  readonly still = computed(() => this.#paused() || this.#reduced());

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.#paused.set(load());
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    this.#reduced.set(query.matches);
    query.addEventListener('change', (event) => this.#reduced.set(event.matches));
    this.#mark();
  }

  toggle(): void {
    this.#paused.update((paused) => !paused);
    save(this.#paused());
    this.#mark();
  }

  #mark(): void {
    const root = this.#document.documentElement;
    if (this.#paused()) root.setAttribute('data-movimiento', PAUSED);
    else root.removeAttribute('data-movimiento');
  }
}
