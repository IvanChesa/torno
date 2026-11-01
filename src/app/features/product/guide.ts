import { afterNextRender, Component, DOCUMENT, inject, signal } from '@angular/core';
import { MotionPreference } from '../../core/motion';
import { InstrumentSpotlight } from '../instrument-common/spotlight';
import { GUIDE_CONTENT, type GuideEntry } from './guide.content';

/** El `id` de la caja del instrumento en la portada: adonde lleva «Ver en el instrumento». */
export const INSTRUMENT_ANCHOR = 'instrumento';

/**
 * «Conoce tu instrumento» (PLAN fase 7): los 9 controles, cada uno con sus gestos, sus teclas y
 * «Ver en el instrumento». Ese botón lleva la página al instrumento y le pide que señale el
 * control (`InstrumentSpotlight`): la cámara viaja hasta él y él recibe el foco.
 *
 * **Nunca inicia el audio ni pide el micrófono:** los botones no llevan `data-audio-unlock`, y
 * señalar un control solo mueve la cámara y el foco (lo comprueba un e2e).
 */
@Component({
  selector: 'trn-guide',
  // `data-lista`: ya hidratada en el navegador (los e2e esperan a ella antes de usar el teclado).
  host: { '[attr.data-lista]': 'ready() ? "" : null' },
  template: `
    <div class="heading">
      <h2 id="guia-titulo">{{ text.title }}</h2>
      <p>{{ text.intro }}</p>
    </div>
    <ul class="entries" role="list">
      @for (entry of text.entries; track entry.title) {
        <li class="entry">
          <h3>{{ entry.title }}</h3>
          <div class="entry__body">
            <p>{{ entry.text }}</p>
            <p class="entry__keys">
              @for (key of entry.keys; track key.text; let last = $last) {
                <span class="key">
                  @for (name of key.keys; track name; let lastName = $last) {
                    <kbd>{{ name }}</kbd>
                    @if (!lastName) {
                      {{ key.combo ? '+' : ' ' }}
                    }
                  }
                  {{ key.text }}</span
                >
              }
            </p>
          </div>
          <button
            type="button"
            class="button button--secondary entry__show"
            [attr.aria-label]="text.showLabel(entry.title)"
            (click)="show(entry)"
          >
            {{ text.show }}
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }

    .heading {
      display: grid;
      gap: var(--space-4);
      max-inline-size: var(--measure);
      margin-block-end: var(--space-7);
    }

    .entries {
      display: grid;
      gap: var(--space-2);
      padding: 0;
      list-style: none;
    }

    /* Filas, no tarjetas: una sí y otra no sobre un escalón de tono (DISENO.md §2). */
    .entry {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 6fr) minmax(0, 3fr);
      gap: var(--space-6);
      align-items: start;
      padding: var(--space-5) var(--space-6);
      border-radius: var(--radius-panel);
    }

    .entry:nth-child(odd) {
      background: var(--color-surface);
    }

    .entry__body {
      display: grid;
      gap: var(--space-3);
    }

    .entry__keys {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-5);
      color: var(--color-ink-muted);
      font-size: var(--text-s);
    }

    .entry__show {
      justify-self: end;
    }

    @media (max-width: 47.99rem) {
      .entry {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-3);
        padding: var(--space-5) var(--space-4);
      }

      .entry__show {
        justify-self: start;
      }
    }
  `,
})
export class Guide {
  protected readonly text = GUIDE_CONTENT;
  private readonly spotlight = inject(InstrumentSpotlight);
  private readonly motion = inject(MotionPreference);
  private readonly document = inject(DOCUMENT);
  protected readonly ready = signal(false);

  constructor() {
    afterNextRender(() => this.ready.set(true));
  }

  protected show(entry: GuideEntry): void {
    this.spotlight.show(entry.control, entry.shot ?? null);
    this.document.getElementById(INSTRUMENT_ANCHOR)?.scrollIntoView({
      behavior: this.motion.still() ? 'auto' : 'smooth',
      block: 'center',
    });
  }
}
