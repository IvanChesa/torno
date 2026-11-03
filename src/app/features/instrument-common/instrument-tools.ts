import { Component, computed, inject, input } from '@angular/core';
import { MotionPreference } from '../../core/motion';
import { SessionStore } from '../../state';
import { INSTRUMENT_COMMON_CONTENT } from './instrument-common.content';

/**
 * Lo que llevan las barras de los dos instrumentos, el 3D y el HTML (CLAUDE.md: «Pausar
 * movimiento» en todas las animaciones): «Pausar movimiento» y la chuleta de atajos.
 *
 * Si el sistema ya pide movimiento reducido, nada se mueve solo aunque el botón no esté pulsado: lo
 * dice su descripción (y su `title`), sin ocupar sitio en la página.
 *
 * Lleva `data-sin-atajos`: dentro del instrumento, Espacio e Intro pulsan estos botones y no
 * reproducen.
 *
 * Con `icons` (la barra del 3D, fase 8), cada botón es un icono con su nombre para los lectores de
 * pantalla y en el `title`: así la barra cabe en una fila en el escritorio.
 */
@Component({
  selector: 'trn-instrument-tools',
  host: { 'data-sin-atajos': '' },
  template: `
    <button
      type="button"
      class="toggle"
      [class.toggle--icon]="icons()"
      [attr.aria-pressed]="motion.paused()"
      [attr.aria-describedby]="motion.reduced() ? 'trn-movimiento-sistema' : null"
      [attr.title]="pauseTitle()"
      (click)="motion.toggle()"
    >
      @if (icons()) {
        <!-- El disco con las dos barras de pausa. -->
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M8 7v6M12 7v6" />
        </svg>
        <span class="visually-hidden">{{ text.pauseMotion }}</span>
      } @else {
        {{ text.pauseMotion }}
      }
    </button>
    @if (motion.reduced()) {
      <span id="trn-movimiento-sistema" hidden>{{ text.reducedBySystem }}</span>
    }
    <button
      type="button"
      class="toggle"
      [class.toggle--icon]="icons()"
      [attr.aria-pressed]="store.state().help"
      [attr.title]="icons() ? text.shortcuts : null"
      (click)="toggleHelp()"
    >
      @if (icons()) {
        <!-- Una tecla con la interrogación (la de la chuleta). -->
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
          <path d="M8 8.3a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6M10 13.6v.2" />
        </svg>
        <span class="visually-hidden">{{ text.shortcuts }}</span>
      } @else {
        {{ text.shortcuts }}
      }
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class InstrumentTools {
  /** Botones de icono (la barra del 3D) en lugar de con su texto (el plato HTML). */
  readonly icons = input(false);
  protected readonly text = INSTRUMENT_COMMON_CONTENT.tools;
  protected readonly motion = inject(MotionPreference);
  protected readonly store = inject(SessionStore);

  /** El `title` de «Pausar movimiento»: su nombre (con icono) y, si el sistema ya lo pide, el aviso. */
  protected readonly pauseTitle = computed(() => {
    const parts: (string | null)[] = [this.icons() ? this.text.pauseMotion : null];
    if (this.motion.reduced()) parts.push(this.text.reducedBySystem);
    return parts.filter(Boolean).join('. ') || null;
  });

  protected toggleHelp(): void {
    this.store.input({ type: 'toggle-help' });
  }
}
