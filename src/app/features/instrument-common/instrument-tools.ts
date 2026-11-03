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
 * Con `icons` (la barra del 3D, fase 8), cada botón es un icono con su nombre dentro, oculto, para
 * los lectores de pantalla, y una etiqueta que se ve al pasar el puntero o con el foco del teclado
 * (`toggle__tip`, fuera del árbol de accesibilidad): así la barra cabe en una fila en el escritorio.
 * Sin `title`, que los lectores repetían como descripción (revisión de la fase 8, #8). Los nombres,
 * en minúsculas (`aria-label`): lo que se ve va en mayúsculas por CSS, y algún lector las deletrea.
 */
@Component({
  selector: 'trn-instrument-tools',
  host: { 'data-sin-atajos': '' },
  template: `
    <button
      type="button"
      class="toggle"
      [class.toggle--icon]="icons()"
      [attr.aria-label]="icons() ? null : text.pauseMotion"
      [attr.aria-pressed]="motion.paused()"
      [attr.aria-describedby]="motion.reduced() ? 'trn-movimiento-sistema' : null"
      [attr.title]="!icons() && motion.reduced() ? text.reducedBySystem : null"
      (click)="motion.toggle()"
    >
      @if (icons()) {
        <!--
          La pausa dentro de dos flechas de giro: lo que se para es el movimiento, no la música (dos
          barras solas se confundían con la tecla de reproducir; revisión de diseño de la fase 8).
        -->
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4.2 13.2A6.5 6.5 0 0 1 13.2 4.2M15.8 6.8a6.5 6.5 0 0 1-9 9" />
          <path d="M13 2.4l.4 2.2-2.2.4M7 17.6l-.4-2.2 2.2-.4" />
          <path d="M8.5 8v4M11.5 8v4" />
        </svg>
        <span class="visually-hidden">{{ text.pauseMotion }}</span>
        <span class="toggle__tip" aria-hidden="true">{{ pauseTip() }}</span>
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
      [attr.aria-label]="icons() ? null : text.shortcuts"
      [attr.aria-pressed]="store.state().help"
      (click)="toggleHelp()"
    >
      @if (icons()) {
        <!-- Una tecla con la interrogación (la de la chuleta). -->
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
          <path d="M8 8.3a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6M10 13.6v.2" />
        </svg>
        <span class="visually-hidden">{{ text.shortcuts }}</span>
        <span class="toggle__tip" aria-hidden="true">{{ text.shortcuts }}</span>
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

  /** La etiqueta de «Pausar movimiento» con icono: su nombre y, si el sistema ya lo pide, el aviso. */
  protected readonly pauseTip = computed(() =>
    this.motion.reduced()
      ? `${this.text.pauseMotion}. ${this.text.reducedBySystem}`
      : this.text.pauseMotion,
  );

  protected toggleHelp(): void {
    this.store.input({ type: 'toggle-help' });
  }
}
