import { Component, inject } from '@angular/core';
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
 */
@Component({
  selector: 'trn-instrument-tools',
  host: { 'data-sin-atajos': '' },
  template: `
    <button
      type="button"
      class="toggle"
      [attr.aria-pressed]="motion.paused()"
      [attr.aria-describedby]="motion.reduced() ? 'trn-movimiento-sistema' : null"
      [attr.title]="motion.reduced() ? text.reducedBySystem : null"
      (click)="motion.toggle()"
    >
      {{ text.pauseMotion }}
    </button>
    @if (motion.reduced()) {
      <span id="trn-movimiento-sistema" hidden>{{ text.reducedBySystem }}</span>
    }
    <button
      type="button"
      class="toggle"
      [attr.aria-pressed]="store.state().help"
      (click)="toggleHelp()"
    >
      {{ text.shortcuts }}
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class InstrumentTools {
  protected readonly text = INSTRUMENT_COMMON_CONTENT.tools;
  protected readonly motion = inject(MotionPreference);
  protected readonly store = inject(SessionStore);

  protected toggleHelp(): void {
    this.store.input({ type: 'toggle-help' });
  }
}
