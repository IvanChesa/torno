import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { CONTROLS, control, shortcutFor, type ControlId, type ControlSpec } from '../../instrument';
import { SessionStore } from '../../state';
import { INSTRUMENT_COMMON_CONTENT } from './instrument-common.content';
import { InstrumentNotices } from './instrument-notices';

/** «Acercarse» con la vista: el instrumento está a media pantalla de entrar en ella. */
const APPROACH_MARGIN = '50% 0px';
/** Lo más que se espera a que el navegador esté libre para preparar la primera reproducción. */
const IDLE_TIMEOUT_MS = 2000;

/** El `id` de la pista (lo que hace cada gesto) de un control, para su `aria-describedby`. */
export function controlHintId(id: ControlId): string {
  return `trn-pista-${id}`;
}

/**
 * Lo común a los dos instrumentos, el 3D y el HTML (PLAN §4.7):
 * - el grupo con su nombre y las pistas de cada control;
 * - los atajos con el foco dentro (las teclas que no ha usado el control);
 * - los avisos y la región viva;
 * - el selector de archivos, que tiene que abrirse en el gesto;
 * - recuperar el autoguardado;
 * - preparar la primera reproducción en silencio al acercarse el puntero, el foco o la vista.
 *
 * Cada instrumento pone dentro lo suyo: la pantalla y el plato, o el escenario 3D.
 */
@Component({
  selector: 'trn-instrument-shell',
  imports: [InstrumentNotices],
  host: {
    '(pointerenter)': 'store.preload()',
    '(focusin)': 'store.preload()',
  },
  template: `
    <div
      class="instrument"
      data-audio-unlock
      role="group"
      [attr.aria-label]="text.label"
      (keydown)="onKeydown($event)"
    >
      <ng-content />
      @for (spec of controls; track spec.id) {
        <span [id]="hintId(spec.id)" hidden>{{ spec.hint }}</span>
      }
    </div>

    <trn-instrument-notices />

    <p class="visually-hidden" aria-live="polite">{{ store.announcement() }}</p>
    <input
      #file
      type="file"
      accept=".torno,application/x-torno"
      class="visually-hidden"
      tabindex="-1"
      aria-hidden="true"
      [attr.aria-label]="text.fileInputLabel"
      (change)="onFile($event)"
    />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
    }

    .instrument {
      display: grid;
      justify-items: center;
      gap: var(--space-5);
    }

    /*
     * El instrumento HTML va en un panel (DISENO.md §7.1): con el plato en --instrument-plate, los
     * rótulos y los controles cumplen AA (§2.1).
     */
    :host(.is-panel) .instrument {
      padding: var(--space-6) var(--space-4);
      border-radius: var(--radius-panel);
      background: var(--color-surface);
      color: var(--color-ink);
    }

    @media (max-width: 47.99rem) {
      :host(.is-panel) .instrument {
        padding: var(--space-4) 0 var(--space-5);
      }
    }
  `,
})
export class InstrumentShell {
  protected readonly store = inject(SessionStore);
  protected readonly text = INSTRUMENT_COMMON_CONTENT;
  protected readonly controls = CONTROLS;
  protected readonly hintId = controlHintId;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.store.setFilePicker(() => this.fileInput().nativeElement.click());
      void this.store.checkAutosave();
      this.watchApproach(destroyRef);
    });
    destroyRef.onDestroy(() => this.store.setFilePicker(null));
  }

  /**
   * Acercarse al instrumento (PLAN §5, «Síntesis») es también verlo llegar: en el móvil no hay
   * puntero que se acerque, y el primer toque ya es el gesto. Cuando está a punto de entrar en
   * pantalla, la primera reproducción se prepara en silencio en cuanto el navegador está libre.
   */
  private watchApproach(destroyRef: DestroyRef): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => this.store.preload(), { timeout: IDLE_TIMEOUT_MS });
        } else {
          setTimeout(() => this.store.preload());
        }
      },
      { rootMargin: APPROACH_MARGIN },
    );
    observer.observe(this.host.nativeElement);
    destroyRef.onDestroy(() => observer.disconnect());
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.store.openFile(file);
  }

  /**
   * Atajos con el foco dentro del grupo de controles (las teclas que no ha usado el control). Los
   * botones de los avisos quedan fuera: ahí Espacio e Intro los pulsan, como a cualquier botón. Los
   * de la barra del escenario 3D, también (llevan `data-sin-atajos`).
   */
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-sin-atajos]')) return;
    const id = target?.closest<HTMLElement>('[data-control]')?.dataset['control'] as
      ControlId | undefined;
    const focused: ControlSpec | null = id ? control(id) : null;
    const shortcut = shortcutFor(event, focused);
    if (!shortcut) return;
    event.preventDefault();
    switch (shortcut.type) {
      case 'play':
      case 'record':
      case 'undo':
        this.store.input({ type: 'press', control: shortcut.type, at: event.timeStamp });
        return;
      case 'select':
        this.store.input({ type: 'select', layer: shortcut.layer });
        return;
      case 'help':
        this.store.input({ type: 'toggle-help' });
        return;
    }
  }
}
