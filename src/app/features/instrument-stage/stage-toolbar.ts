import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { SHOTS, type CameraGoal, type Shot } from '../../scene';
import { InstrumentTools } from '../instrument-common/instrument-tools';
import { INSTRUMENT_STAGE_CONTENT } from './instrument-stage.content';

/**
 * La barra del escenario 3D (PLAN fases 6 y 8; revisión del bloque D, #4), en tres grupos:
 * - los encuadres de «Tocar» (completo, capas y controles), como un control segmentado;
 * - las otras dos maneras de mirar el aparato, «Inspeccionar» y «Despiezar», en otro (las cinco se
 *   excluyen: la cámara solo hace una cosa a la vez);
 * - la pantalla completa (si el navegador la tiene: en el iPhone no), «Pausar movimiento» y la
 *   chuleta de atajos (`InstrumentTools`, como en el plato HTML), como botones de icono con su
 *   nombre dentro (para los lectores de pantalla) y una etiqueta al pasar o con el foco.
 *
 * En el escritorio cabe en una fila; en el móvil, en horizontal y cuando la caja del instrumento no
 * da para ella (la portada en dos columnas entre 1024 y unos 1100 px), una por grupo. Son botones con `aria-pressed` y el
 * teclado de siempre (el tabulador recorre cada botón). Llevan `data-sin-atajos`: dentro del
 * instrumento, Espacio e Intro los pulsan a ellos y no reproducen.
 */
@Component({
  selector: 'trn-stage-toolbar',
  imports: [InstrumentTools],
  host: { 'data-sin-atajos': '' },
  template: `
    <div class="bar">
      <div class="segmented" role="group" [attr.aria-label]="text.framing">
        @for (item of shots; track item) {
          <button
            type="button"
            class="segment"
            [attr.aria-label]="text.shots[item]"
            [attr.aria-pressed]="isShot(item)"
            (click)="shotChange.emit(item)"
          >
            {{ text.shots[item] }}
          </button>
        }
      </div>
      <div class="segmented" role="group" [attr.aria-label]="text.look">
        <button
          type="button"
          class="segment"
          [attr.aria-label]="text.inspect"
          [attr.aria-pressed]="camera().kind === 'orbit'"
          (click)="inspect.emit()"
        >
          {{ text.inspect }}
        </button>
        <button
          #explodeButton
          type="button"
          class="segment"
          [attr.aria-label]="text.explode"
          [attr.aria-pressed]="camera().kind === 'exploded'"
          (click)="explode.emit()"
        >
          {{ text.explode }}
        </button>
      </div>
      <div class="tools" role="group" [attr.aria-label]="text.tools">
        @if (fullscreenAvailable()) {
          <button
            type="button"
            class="toggle toggle--icon"
            [attr.aria-pressed]="fullscreen()"
            (click)="fullscreenChange.emit()"
          >
            <!-- Las cuatro esquinas de la pantalla. -->
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 7.5V3h4.5M12.5 3H17v4.5M17 12.5V17h-4.5M7.5 17H3v-4.5" />
            </svg>
            <span class="visually-hidden">{{ text.fullscreen }}</span>
            <span class="toggle__tip" aria-hidden="true">{{ text.fullscreen }}</span>
          </button>
        }
        <trn-instrument-tools [icons]="true" />
      </div>
    </div>
  `,
  styles: `
    /*
     * Filas fijas: una en el escritorio y tres en el móvil (una por grupo), lo que reserva el
     * marcador de la portada (StagePlaceholder, --stage-toolbar-height): nada salta al llegar el 3D.
     */
    :host {
      display: grid;
      justify-items: center;
      min-block-size: var(--stage-toolbar-height);
    }

    .bar {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
    }

    /*
     * Un control segmentado: los botones juntos, en una sola pastilla. Su borde es una sombra por
     * dentro, para que cada botón mida los 44 px enteros (con un borde, eran 42: revisión, #12).
     */
    .segmented {
      display: inline-flex;
      border-radius: var(--radius-s);
      box-shadow: inset 0 0 0 1px var(--color-ink-faint);
    }

    .segment {
      min-block-size: var(--target-min);
      padding-inline: var(--space-3);
      border: 0;
      border-inline-start: 1px solid var(--color-ink-faint);
      background: transparent;
      color: var(--color-ink);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .segment:first-child {
      border-inline-start: 0;
      border-start-start-radius: var(--radius-s);
      border-end-start-radius: var(--radius-s);
    }

    .segment:last-child {
      border-start-end-radius: var(--radius-s);
      border-end-end-radius: var(--radius-s);
    }

    .segment[aria-pressed='true'] {
      background: var(--color-ink);
      color: var(--color-bg);
    }

    .segment:hover:not([aria-pressed='true']) {
      background: var(--color-surface);
    }

    .segment:active:not([aria-pressed='true']) {
      background: var(--color-surface-2);
    }

    .segment:focus-visible {
      position: relative;
      z-index: 1;
    }

    .tools {
      display: flex;
      gap: var(--space-2);
    }

    /* En el móvil, un grupo por fila; en horizontal, también (al lado de la caja, alineados). */
    @media (max-width: 47.99rem), (orientation: landscape) and (max-height: 32rem) {
      .bar {
        flex-direction: column;
        gap: var(--space-1);
      }
    }

    /*
     * Y si la caja del instrumento (el contenedor «instrumento» de la portada) no da para una fila:
     * entre 1024 y unos 1100 px, en dos columnas, o con zum (revisión de la fase 8, #1).
     */
    @container instrumento (max-width: 43.99rem) {
      .bar {
        flex-direction: column;
        gap: var(--space-1);
      }
    }

    @media (orientation: landscape) and (max-height: 32rem) {
      .bar {
        align-items: start;
      }
    }

    @media (max-width: 47.99rem) {
      .segment {
        padding-inline: var(--space-2);
        font-size: 0.75rem;
        letter-spacing: 0;
      }
    }
  `,
})
export class StageToolbar {
  readonly camera = input.required<CameraGoal>();
  readonly fullscreen = input(false);
  readonly fullscreenAvailable = input(false);
  readonly shotChange = output<Shot>();
  readonly inspect = output<void>();
  readonly explode = output<void>();
  readonly fullscreenChange = output<void>();

  protected readonly text = INSTRUMENT_STAGE_CONTENT;
  protected readonly shots = SHOTS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly explodeButton = viewChild<ElementRef<HTMLButtonElement>>('explodeButton');

  /** El foco, a «Despiezar» (cuando lo pide la sección de los detalles: revisión de la fase 7, #9). */
  focusExplode(): void {
    this.explodeButton()?.nativeElement.focus({ preventScroll: true });
  }

  /** El foco, al botón del encuadre que está puesto (cuando el control enfocado deja de verse). */
  focusCurrent(): void {
    this.host.nativeElement.querySelector<HTMLElement>('.segmented [aria-pressed="true"]')?.focus();
  }

  protected isShot(shot: Shot): boolean {
    const camera = this.camera();
    return camera.kind === 'shot' && camera.shot === shot;
  }
}
