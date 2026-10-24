import { Component } from '@angular/core';
import { ControlDirective } from './control.directive';
import { HTML_INSTRUMENT_CONTENT } from './html-instrument.content';

/** El lateral del instrumento: el brazo de expresión, la rueda de volumen y el botón de reposo. */
@Component({
  selector: 'trn-instrument-side',
  imports: [ControlDirective],
  template: `
    <div class="control">
      <div trnControl="arm" class="track track--arm" aria-describedby="trn-pista-arm">
        <span class="handle" aria-hidden="true"></span>
      </div>
      <span class="label" aria-hidden="true">{{ text.labels.arm }}</span>
    </div>
    <div class="control">
      <div trnControl="volume" class="track track--volume" aria-describedby="trn-pista-volume">
        <span class="handle" aria-hidden="true"></span>
      </div>
      <span class="label" aria-hidden="true">{{ text.labels.volume }}</span>
    </div>
    <button type="button" trnControl="standby" class="standby" aria-describedby="trn-pista-standby">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 3h2v9h-2zM7.05 6.05l1.41 1.41a6 6 0 1 0 7.08 0l1.41-1.41a8 8 0 1 1-9.9 0z" />
      </svg>
      <span class="label">{{ text.labels.standby }}</span>
    </button>
  `,
  styles: `
    :host {
      display: grid;
      align-content: start;
      justify-items: center;
      gap: var(--space-5);
    }

    .control {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
    }

    .label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* Una ranura con su tirador de latón: el brazo, horizontal; la rueda, vertical. */
    .track {
      position: relative;
      border-radius: var(--radius-pill);
      background: var(--color-screen);
      cursor: ew-resize;
      touch-action: none;
    }

    .track--arm {
      inline-size: 7rem;
      block-size: 0.5rem;
      margin-block: 1rem;
    }

    .track--volume {
      inline-size: 0.5rem;
      block-size: 5.5rem;
      margin-inline: 1rem;
      cursor: ns-resize;
    }

    .handle {
      position: absolute;
      inline-size: 1.75rem;
      aspect-ratio: 1;
      border-radius: 50%;
      background: var(--instrument-brass);
      box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.22);
    }

    .track--arm .handle {
      inset-block-start: calc(50% - 0.875rem);
      inset-inline-start: calc(var(--value, 0) * (100% - 1.75rem));
    }

    .track--volume .handle {
      inset-inline-start: calc(50% - 0.875rem);
      inset-block-end: calc(var(--value, 0) * (100% - 1.75rem));
    }

    .standby {
      display: grid;
      justify-items: center;
      gap: var(--space-1);
      min-inline-size: 5.25rem;
      min-block-size: var(--target-min);
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-radius: var(--radius-s);
      background: var(--instrument-key);
      color: var(--color-bg);
      cursor: pointer;
      touch-action: none;
    }

    .standby svg {
      inline-size: 1.5rem;
      fill: currentColor;
    }

    .standby[aria-pressed='true'] {
      box-shadow: inset 0 3px 0 rgb(0 0 0 / 0.25);
    }

    [trnControl]:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-offset);
    }

    @media (max-width: 47.99rem) {
      :host {
        grid-template-columns: repeat(3, auto);
        align-items: center;
        justify-content: space-between;
      }
    }
  `,
})
export class InstrumentSide {
  protected readonly text = HTML_INSTRUMENT_CONTENT;
}
