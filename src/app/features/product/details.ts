import { Component, input } from '@angular/core';
import { DETAILS_CONTENT } from './details.content';

/**
 * «Los detalles» (PLAN fase 7): los materiales del aparato, con el render despiezado del propio
 * motor y «Despiezar el instrumento», que lleva la página al 3D y le pide la vista despiezada. Sin
 * el 3D no hay piezas que separar: lo dice en lugar del botón.
 *
 * El clic de «Despiezar el instrumento» lo atiende la portada (como «Ver en el instrumento» de la
 * guía): la sección se hidrata al verse, y un clic en plena hidratación se perdía (fase 8).
 */
@Component({
  selector: 'trn-details',
  template: `
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
    <div class="text">
      <h2 id="detalles">{{ text.title }}</h2>
      <p>{{ text.intro }}</p>
      <ul class="materials" role="list">
        @for (material of text.materials; track material.name) {
          <li>
            <span class="swatch" [style.background]="'var(' + material.color + ')'"></span>
            <p>
              <strong>{{ material.name }}</strong>
              <span>{{ material.text }}</span>
            </p>
          </li>
        }
      </ul>
      @if (explodable()) {
        <p>
          <!-- data-despiezar: lo atiende la portada (isExplodeRequest, en guide-target.ts). -->
          <button type="button" class="button button--secondary" data-despiezar>
            {{ text.explode }}
          </button>
        </p>
      } @else {
        <p class="note">{{ text.noExplode }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
      gap: var(--space-8);
      align-items: center;
    }

    /* El render lleva el fondo de la página: sobre el campo de la sección, un marco. */
    img,
    .image-slot {
      inline-size: 100%;
      block-size: auto;
      border-radius: var(--radius-panel);
    }

    .text {
      display: grid;
      gap: var(--space-5);
    }

    .materials {
      display: grid;
      gap: var(--space-4);
      padding: 0;
      list-style: none;
    }

    .materials li {
      display: grid;
      grid-template-columns: 2.25rem minmax(0, 1fr);
      gap: var(--space-4);
      align-items: start;
    }

    /* La muestra es decorativa: el nombre del material dice lo mismo (WCAG 1.4.1). */
    .swatch {
      inline-size: 2.25rem;
      aspect-ratio: 1;
      border-radius: 50%;
    }

    strong {
      display: block;
    }

    .materials span:not(.swatch),
    .note {
      color: var(--color-ink-muted);
    }

    @media (max-width: 47.99rem) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-6);
      }
    }
  `,
})
export class Details {
  /** Hay un 3D que despiezar (sin `?sin3d=1` y con WebGL). */
  readonly explodable = input(true);

  protected readonly text = DETAILS_CONTENT;
}
