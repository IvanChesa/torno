import { Component } from '@angular/core';
import { FAQ_CONTENT } from './faq.content';

/**
 * Las preguntas frecuentes (PLAN fase 7): un acordeón con `details` y `summary` nativos, que se abre
 * con el teclado y que los lectores de pantalla ya saben leer.
 */
@Component({
  selector: 'trn-faq',
  template: `
    <h2 id="preguntas">{{ text.title }}</h2>
    <div class="items">
      @for (item of text.items; track item.question; let first = $first) {
        <details [open]="first">
          <summary>{{ item.question }}</summary>
          <p>{{ item.answer }}</p>
        </details>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
      gap: var(--space-8);
      align-items: start;
    }

    .items {
      display: grid;
      gap: var(--space-2);
    }

    details {
      border-radius: var(--radius-panel);
      background: var(--color-surface);
    }

    summary {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-block-size: var(--target-min);
      padding: var(--space-4) var(--space-5);
      border-radius: var(--radius-panel);
      font-weight: var(--weight-strong);
      cursor: pointer;
      list-style: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    /* La marca: un «+» que gira a «×» al abrir (solo transform). */
    summary::before {
      content: '+';
      flex: none;
      inline-size: 1em;
      color: var(--color-accent-text);
      font-family: var(--font-mono);
      text-align: center;
      transition: transform var(--duration) var(--ease-out);
    }

    details[open] summary::before {
      transform: rotate(45deg);
    }

    summary:focus-visible {
      outline-offset: calc(-1 * var(--focus-offset));
    }

    details p {
      max-inline-size: var(--measure);
      padding: 0 var(--space-5) var(--space-5) calc(var(--space-5) + 1em + var(--space-3));
    }

    @media (max-width: 47.99rem) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-6);
      }
    }
  `,
})
export class Faq {
  protected readonly text = FAQ_CONTENT;
}
