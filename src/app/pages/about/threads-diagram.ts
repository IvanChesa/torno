import { Component } from '@angular/core';
import { ABOUT_CONTENT } from './about.content';

/**
 * El diagrama de hilos del caso de estudio (PLAN fase 7): el hilo principal, el de audio y los dos
 * de los workers, con lo que va de uno a otro. En HTML y CSS (no un SVG que se encoge): la letra es
 * la de la página a cualquier ancho, y en el móvil las cajas van una debajo de otra (revisión de la
 * fase 7, #10). La descripción entera, para los lectores de pantalla, es el pie de la figura; el
 * dibujo va oculto para ellos (diría lo mismo a trozos).
 */
@Component({
  selector: 'trn-threads-diagram',
  template: `
    <figure>
      <div class="diagram" aria-hidden="true">
        <div class="box">
          <p class="title">{{ labels.main }}</p>
          <ul>
            @for (item of labels.mainItems; track item) {
              <li>{{ item }}</li>
            }
          </ul>
        </div>
        <div class="links">
          <p><span class="arrow">→</span> {{ labels.commands }}</p>
          <p><span class="arrow">←</span> {{ labels.status }}</p>
        </div>
        <div class="box box--audio">
          <p class="io">↓ {{ labels.mic }}</p>
          <p class="title">{{ labels.audio }}</p>
          <ul>
            @for (item of labels.audioItems; track item) {
              <li>{{ item }}</li>
            }
          </ul>
          <p class="io">↓ {{ labels.out }}</p>
        </div>
        <div class="workers">
          <p class="box box--worker">{{ labels.synth }} <span class="arrow">↑</span></p>
          <p class="box box--worker">{{ labels.export }} <span class="arrow">↓</span></p>
        </div>
      </div>
      <figcaption class="visually-hidden">{{ text.diagram }}</figcaption>
    </figure>
  `,
  styles: `
    :host {
      display: block;
    }

    figure {
      margin: 0;
    }

    .diagram {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      gap: var(--space-4);
      align-items: center;
    }

    .box {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-5);
      border-radius: var(--radius-panel);
      background: var(--color-surface);
    }

    .box--audio {
      background: var(--color-screen);
    }

    .title {
      font-size: var(--text-l);
      font-weight: var(--weight-heading);
      font-variation-settings: 'SOFT' var(--soft-display);
    }

    .box--audio .title {
      color: var(--color-phosphor);
    }

    ul {
      display: grid;
      gap: var(--space-1);
      padding: 0;
      list-style: none;
    }

    .links,
    .io {
      color: var(--color-ink-muted);
      font-size: var(--text-s);
    }

    .links {
      display: grid;
      gap: var(--space-3);
    }

    .arrow {
      color: var(--color-ink);
    }

    /* Los dos workers, debajo: el de síntesis da al hilo principal; el de exportación sale de él. */
    .workers {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
      max-inline-size: 36rem;
    }

    .box--worker {
      display: block;
      padding: var(--space-4) var(--space-5);
      background: var(--color-surface-2);
    }

    @media (max-width: 47.99rem) {
      .diagram {
        grid-template-columns: minmax(0, 1fr);
      }

      .links {
        justify-items: center;
      }

      .links .arrow {
        display: inline-block;
        transform: rotate(90deg);
      }
    }
  `,
})
export class ThreadsDiagram {
  protected readonly text = ABOUT_CONTENT.architecture;
  protected readonly labels = ABOUT_CONTENT.architecture.labels;
}
