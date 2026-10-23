import { Component } from '@angular/core';
import { DESIGN_SAMPLE_CONTENT } from './design-sample.content';

interface Swatch {
  readonly label: string;
  /** Token de docs/DISENO.md (src/styles/tokens.css). */
  readonly token: string;
  /** Token del texto que va encima (solo en los colores de la web). */
  readonly on?: string;
}

const t = DESIGN_SAMPLE_CONTENT;

const WEB: readonly Swatch[] = [
  { label: t.colors.bg, token: '--color-bg', on: '--color-ink' },
  { label: t.colors.surface, token: '--color-surface', on: '--color-ink' },
  { label: t.colors.surface2, token: '--color-surface-2', on: '--color-ink' },
  { label: t.colors.ink, token: '--color-ink', on: '--color-bg' },
  { label: t.colors.inkMuted, token: '--color-ink-muted', on: '--color-bg' },
  { label: t.colors.accent, token: '--color-accent', on: '--color-on-accent' },
  { label: t.colors.accentText, token: '--color-accent-text', on: '--color-bg' },
  { label: t.colors.warning, token: '--color-warning', on: '--color-bg' },
  { label: t.colors.error, token: '--color-error', on: '--color-bg' },
];

const INSTRUMENT: readonly Swatch[] = [
  { label: t.colors.body, token: '--instrument-body' },
  { label: t.colors.brass, token: '--instrument-brass' },
  { label: t.colors.key, token: '--instrument-key' },
  { label: t.colors.glaze, token: '--instrument-glaze' },
  { label: t.colors.screen, token: '--color-screen' },
  { label: t.colors.ledRec, token: '--instrument-led-rec' },
];

/** Muestrario temporal de la fase 0: los tokens de docs/DISENO.md a la vista. */
@Component({
  selector: 'trn-design-sample',
  template: `
    <div class="group">
      <h3>{{ text.webColors }}</h3>
      <ul class="swatches">
        @for (swatch of web; track swatch.token) {
          <li
            class="swatch"
            [style.background]="'var(' + swatch.token + ')'"
            [style.color]="'var(' + swatch.on + ')'"
          >
            <span>{{ swatch.label }}</span>
            <code>{{ swatch.token }}</code>
          </li>
        }
      </ul>
    </div>

    <div class="group">
      <h3>{{ text.instrumentColors }}</h3>
      <ul class="chips">
        @for (swatch of instrument; track swatch.token) {
          <li class="chip">
            <span class="chip__color" [style.background]="'var(' + swatch.token + ')'"></span>
            <span>{{ swatch.label }}</span>
            <code>{{ swatch.token }}</code>
          </li>
        }
      </ul>
    </div>

    <div class="group">
      <h3>{{ text.type }}</h3>
      <div class="type">
        <p class="type__display" aria-hidden="true">{{ text.samples.display }}</p>
        <p class="type__heading">{{ text.samples.heading }}</p>
        <p class="type__lead">{{ text.samples.lead }}</p>
        <p class="type__text">
          {{ text.samples.text }} <a href="#muestrario">{{ text.link }}</a
          >.
        </p>
        <p class="type__small">{{ text.samples.small }}</p>
        <p class="type__screen mono">{{ text.samples.mono }}</p>
      </div>
    </div>

    <div class="group">
      <h3>{{ text.controls }}</h3>
      <div class="controls">
        <button type="button" class="button">{{ text.buttons.primary }}</button>
        <button type="button" class="button button--secondary">{{ text.buttons.secondary }}</button>
        <p>{{ text.shortcut }} <kbd>Espacio</kbd> {{ text.shortcutAction }}.</p>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-8);
    }

    .group {
      display: grid;
      gap: var(--space-4);
    }

    h3 {
      font-size: var(--text-m);
      font-weight: var(--weight-strong);
      font-variation-settings: 'SOFT' var(--soft-text);
    }

    .swatches,
    .chips {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
      gap: var(--space-3);
      padding: 0;
      list-style: none;
    }

    .swatch {
      display: grid;
      align-content: end;
      gap: var(--space-1);
      min-block-size: 7rem;
      padding: var(--space-4);
      border-radius: var(--radius-panel);
      box-shadow: inset 0 0 0 1px var(--color-surface-2);
    }

    .swatch code,
    .chip code {
      font-size: var(--text-xs);
      white-space: nowrap;
    }

    .chips {
      gap: var(--space-6) var(--space-3);
    }

    .chip {
      display: grid;
      justify-items: start;
      align-content: start;
      gap: var(--space-1);
    }

    .chip__color {
      inline-size: 3rem;
      block-size: 3rem;
      margin-block-end: var(--space-2);
      border-radius: var(--radius-pill);
    }

    .chip code {
      color: var(--color-ink-muted);
    }

    .type {
      display: grid;
      gap: var(--space-5);
      max-inline-size: 48rem;
    }

    .type__display {
      font-size: var(--text-display);
      font-weight: var(--weight-heading);
      font-variation-settings: 'SOFT' var(--soft-display);
      line-height: var(--leading-display);
      letter-spacing: var(--tracking-display);
    }

    .type__heading {
      font-size: var(--text-xl);
      font-weight: var(--weight-heading);
      font-variation-settings: 'SOFT' var(--soft-display);
      line-height: var(--leading-heading);
      letter-spacing: var(--tracking-heading);
    }

    .type__lead {
      font-size: var(--text-l);
      line-height: var(--leading-lead);
    }

    .type__text {
      max-inline-size: var(--measure);
    }

    .type__small {
      color: var(--color-ink-muted);
      font-size: var(--text-s);
    }

    .type__screen {
      justify-self: start;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-s);
      background: var(--color-screen);
      color: var(--color-phosphor);
      font-size: var(--text-s);
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
    }
  `,
})
export class DesignSample {
  protected readonly text = t;
  protected readonly web = WEB;
  protected readonly instrument = INSTRUMENT;
}
