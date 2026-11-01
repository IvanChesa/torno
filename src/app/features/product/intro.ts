import { Component } from '@angular/core';
import { INTRO_CONTENT } from './intro.content';

/** «Qué es» (PLAN fase 7): lo que hace, en una frase y tres hechos, con un render del motor. */
@Component({
  selector: 'trn-product-intro',
  template: `
    <div class="text">
      <h2 id="que-es">{{ text.title }}</h2>
      <p class="statement">{{ text.statement }}</p>
      <dl class="facts">
        @for (fact of text.facts; track fact.term) {
          <div>
            <dt>{{ fact.term }}</dt>
            <dd>{{ fact.text }}</dd>
          </div>
        }
      </dl>
    </div>
    <!--
      La imagen, al verse (no en la primera visita: Chromium carga las «lazy» que quedan a menos de
      unos 1250 px, y esta está justo debajo). Mientras, su hueco, del mismo tamaño.
    -->
    @defer (on viewport) {
      <img
        [src]="text.image.src"
        [width]="text.image.width"
        [height]="text.image.height"
        [alt]="text.image.alt"
        loading="lazy"
        decoding="async"
      />
    } @placeholder {
      <div
        class="image-slot"
        [style.aspect-ratio]="text.image.width + ' / ' + text.image.height"
      ></div>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 6fr) minmax(0, 6fr);
      gap: var(--space-8);
      align-items: center;
    }

    .text {
      display: grid;
      gap: var(--space-6);
    }

    /* Una frase de exposición, al tamaño de la entradilla: nunca un titular (DISENO.md §3.1). */
    .statement {
      font-size: var(--text-l);
      line-height: var(--leading-lead);
      max-inline-size: 34ch;
    }

    .facts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-5);
    }

    dt {
      font-weight: var(--weight-strong);
    }

    dd {
      margin-block-start: var(--space-1);
      color: var(--color-ink-muted);
    }

    img,
    .image-slot {
      inline-size: 100%;
      block-size: auto;
      border-radius: var(--radius-panel);
      background: var(--color-surface);
    }

    @media (max-width: 47.99rem) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-6);
      }

      .facts {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class ProductIntro {
  protected readonly text = INTRO_CONTENT;
}
