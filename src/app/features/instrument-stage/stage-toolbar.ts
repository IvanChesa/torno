import { Component, ElementRef, inject, input, output } from '@angular/core';
import { SHOTS, type CameraGoal, type Shot } from '../../scene';
import { InstrumentTools } from '../instrument-common/instrument-tools';
import { INSTRUMENT_STAGE_CONTENT } from './instrument-stage.content';

/**
 * La barra del escenario 3D (PLAN fase 6):
 * - los encuadres de «Tocar» (completo, capas y controles) e «Inspeccionar»;
 * - la pantalla completa (si el navegador la tiene: en el iPhone no);
 * - «Pausar movimiento» y la chuleta de atajos (`InstrumentTools`, como en el plato HTML).
 *
 * Son botones con `aria-pressed`. Llevan `data-sin-atajos`: dentro del instrumento, Espacio e
 * Intro los pulsan a ellos y no reproducen.
 */
@Component({
  selector: 'trn-stage-toolbar',
  imports: [InstrumentTools],
  host: { 'data-sin-atajos': '' },
  template: `
    <div class="bar">
      <div class="group" role="group" [attr.aria-label]="text.play">
        @for (item of shots; track item) {
          <button
            type="button"
            class="toggle"
            [attr.aria-pressed]="isShot(item)"
            (click)="shotChange.emit(item)"
          >
            {{ text.shots[item] }}
          </button>
        }
      </div>
      <button
        type="button"
        class="toggle"
        [attr.aria-pressed]="camera().kind === 'orbit'"
        (click)="inspect.emit()"
      >
        {{ text.inspect }}
      </button>
      @if (fullscreenAvailable()) {
        <button
          type="button"
          class="toggle"
          [attr.aria-pressed]="fullscreen()"
          (click)="fullscreenChange.emit()"
        >
          {{ text.fullscreen }}
        </button>
      }
      <div class="tools"><trn-instrument-tools /></div>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
    }

    .bar,
    .group,
    .tools {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2);
    }

    .group {
      padding-inline-end: var(--space-2);
      border-inline-end: 1px solid var(--color-ink-faint);
    }

    /* En el móvil, más apretada. */
    @media (max-width: 47.99rem) {
      .bar {
        gap: var(--space-1);
      }

      /* Tres filas, con o sin la pantalla completa: los encuadres, «Inspeccionar» y lo común. */
      .group,
      .tools {
        flex-basis: 100%;
        padding-inline-end: 0;
        border-inline-end: 0;
      }

      .tools {
        gap: var(--space-1);
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
  readonly fullscreenChange = output<void>();

  protected readonly text = INSTRUMENT_STAGE_CONTENT;
  protected readonly shots = SHOTS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** El foco, al botón del encuadre que está puesto (cuando el control enfocado deja de verse). */
  focusCurrent(): void {
    this.host.nativeElement.querySelector<HTMLElement>('.group [aria-pressed="true"]')?.focus();
  }

  protected isShot(shot: Shot): boolean {
    const camera = this.camera();
    return camera.kind === 'shot' && camera.shot === shot;
  }
}
