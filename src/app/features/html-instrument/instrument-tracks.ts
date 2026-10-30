import { Component } from '@angular/core';
import { PLATE } from '../../instrument';
import { ControlDirective } from './control.directive';

/**
 * El brazo de expresión, la rueda de volumen y el botón de reposo, en su sitio del plato redondo
 * (`instrument/plate.ts`). El brazo y la rueda son ranuras rectas a lo largo de su recorrido, giradas
 * en el plato, con su tirador; arrastrar a lo largo de la ranura sube o baja el valor.
 *
 * Va dentro del plato (sin caja propia: `display: contents`), después del disco: así el orden del
 * tabulador sigue siendo el de siempre.
 */
@Component({
  selector: 'trn-instrument-tracks',
  imports: [ControlDirective],
  template: `
    <div
      class="spot track-spot"
      [style.--x]="plate.arm.x"
      [style.--z]="plate.arm.z"
      [style.--length]="plate.arm.length"
      [style.--angle]="plate.arm.angle + 'deg'"
    >
      <div
        trnControl="arm"
        [trnAxis]="plate.arm.axis"
        class="track"
        aria-describedby="trn-pista-arm"
      >
        <span class="handle" aria-hidden="true"></span>
      </div>
    </div>
    <div
      class="spot track-spot"
      [style.--x]="plate.volume.x"
      [style.--z]="plate.volume.z"
      [style.--length]="plate.volume.length"
      [style.--angle]="plate.volume.angle + 'deg'"
    >
      <div
        trnControl="volume"
        [trnAxis]="plate.volume.axis"
        class="track track--wheel"
        aria-describedby="trn-pista-volume"
      >
        <span class="handle" aria-hidden="true"></span>
      </div>
    </div>
    <div class="spot" [style.--x]="plate.controls.standby.x" [style.--z]="plate.controls.standby.z">
      <button
        type="button"
        trnControl="standby"
        class="standby"
        aria-describedby="trn-pista-standby"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 3h2v9h-2zM7.05 6.05l1.41 1.41a6 6 0 1 0 7.08 0l1.41-1.41a8 8 0 1 1-9.9 0z" />
        </svg>
      </button>
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }

    .spot {
      position: absolute;
      inset-inline-start: calc(50% + var(--x, 0) * 50%);
      inset-block-start: calc(50% + var(--z, 0) * 50%);
      translate: -50% -50%;
    }

    /*
     * La ranura que se ve es el ::before; el control entero es la zona de toque (44 px de grosor).
     * El valor 0 queda a un extremo y el 1 al otro.
     */
    .track-spot {
      rotate: var(--angle);
    }

    .track {
      position: relative;
      inline-size: max(var(--target-min), calc(var(--length) * 100cqi));
      block-size: var(--target-min);
      cursor: grab;
      touch-action: none;
    }

    .track::before {
      content: '';
      position: absolute;
      inset-inline: 0;
      inset-block: calc(50% - 0.25rem);
      border-radius: var(--radius-pill);
      background: var(--color-screen);
    }

    .handle {
      position: absolute;
      inset-block-start: calc(50% - 0.875rem);
      inset-inline-start: calc(var(--value, 0) * (100% - 1.75rem));
      inline-size: 1.75rem;
      aspect-ratio: 1;
      border-radius: 50%;
      background: var(--instrument-brass);
      box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.22);
    }

    /* La rueda, estriada: se ve que gira. */
    .track--wheel .handle {
      border-radius: var(--radius-s);
      background: repeating-linear-gradient(
        90deg,
        var(--instrument-brass) 0 3px,
        var(--instrument-plate) 3px 5px
      );
    }

    .standby {
      display: grid;
      place-items: center;
      inline-size: var(--target-min);
      aspect-ratio: 1;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: var(--instrument-key);
      color: var(--color-bg);
      cursor: pointer;
      touch-action: none;
    }

    .standby svg {
      inline-size: 1.25rem;
      fill: currentColor;
    }

    .standby[aria-pressed='true'] {
      box-shadow: inset 0 3px 0 rgb(0 0 0 / 0.25);
    }

    [trnControl]:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-offset);
    }
  `,
})
export class InstrumentTracks {
  protected readonly plate = PLATE;
}
