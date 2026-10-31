import { Component, inject, input, output } from '@angular/core';
import { MotionPreference } from '../../core/motion';
import { SHOTS, type CameraGoal, type Shot } from '../../scene';
import { SessionStore } from '../../state';
import { INSTRUMENT_STAGE_CONTENT } from './instrument-stage.content';

/**
 * La barra del escenario 3D (PLAN fase 6):
 * - los encuadres de «Tocar» (completo, capas y controles) e «Inspeccionar»;
 * - la pantalla completa (si el navegador la tiene: en el iPhone no);
 * - «Pausar movimiento»;
 * - la chuleta de atajos.
 *
 * Son botones con `aria-pressed`. Llevan `data-sin-atajos`: dentro del instrumento, Espacio e
 * Intro los pulsan a ellos y no reproducen.
 */
@Component({
  selector: 'trn-stage-toolbar',
  host: { 'data-sin-atajos': '' },
  template: `
    <div class="bar">
      <div class="group" role="group" [attr.aria-label]="text.play">
        @for (item of shots; track item) {
          <button
            type="button"
            class="tool"
            [attr.aria-pressed]="isShot(item)"
            (click)="shotChange.emit(item)"
          >
            {{ text.shots[item] }}
          </button>
        }
      </div>
      <button
        type="button"
        class="tool"
        [attr.aria-pressed]="camera().kind === 'orbit'"
        (click)="inspect.emit()"
      >
        {{ text.inspect }}
      </button>
      @if (fullscreenAvailable()) {
        <button
          type="button"
          class="tool"
          [attr.aria-pressed]="fullscreen()"
          (click)="fullscreenChange.emit()"
        >
          {{ text.fullscreen }}
        </button>
      }
      <button
        type="button"
        class="tool"
        [attr.aria-pressed]="motion.paused()"
        [attr.aria-describedby]="motion.reduced() ? 'trn-movimiento-sistema' : null"
        (click)="motion.toggle()"
      >
        {{ text.pauseMotion }}
      </button>
      <button
        type="button"
        class="tool"
        [attr.aria-pressed]="store.state().help"
        (click)="toggleHelp()"
      >
        {{ text.shortcuts }}
      </button>
    </div>
    @if (motion.reduced()) {
      <p id="trn-movimiento-sistema" class="note">{{ text.reducedBySystem }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
    }

    .bar,
    .group {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2);
    }

    .group {
      padding-inline-end: var(--space-2);
      border-inline-end: 1px solid var(--color-ink-faint);
    }

    .tool {
      min-block-size: var(--target-min);
      padding-inline: var(--space-3);
      border: 1px solid var(--color-ink-faint);
      border-radius: var(--radius-s);
      background: transparent;
      color: var(--color-ink);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .tool[aria-pressed='true'] {
      border-color: var(--color-ink);
      background: var(--color-ink);
      color: var(--color-bg);
    }

    .note {
      margin: 0;
      color: var(--color-ink-muted);
      font-size: var(--text-xs);
    }

    /* En el móvil, más apretada: los encuadres en una fila y lo demás debajo. */
    @media (max-width: 47.99rem) {
      .bar {
        gap: var(--space-1);
      }

      .group {
        flex-basis: 100%;
        padding-inline-end: 0;
        border-inline-end: 0;
      }

      .tool {
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
  readonly fullscreenChange = output<void>();

  protected readonly text = INSTRUMENT_STAGE_CONTENT;
  protected readonly shots = SHOTS;
  protected readonly motion = inject(MotionPreference);
  protected readonly store = inject(SessionStore);

  protected isShot(shot: Shot): boolean {
    const camera = this.camera();
    return camera.kind === 'shot' && camera.shot === shot;
  }

  protected toggleHelp(): void {
    this.store.input({ type: 'toggle-help' });
  }
}
