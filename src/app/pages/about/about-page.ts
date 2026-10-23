import { Component } from '@angular/core';
import { ABOUT_CONTENT } from './about.content';

/** Caso de estudio (se completa en la fase 7). */
@Component({
  selector: 'trn-about-page',
  template: `
    <article>
      <h1>{{ text.title }}</h1>
      <p class="lead">{{ text.lead }}</p>
      @for (paragraph of text.paragraphs; track $index) {
        <p>{{ paragraph }}</p>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      inline-size: min(var(--max-width), 100% - 2 * var(--page-margin));
      margin-inline: auto;
      padding-block-start: var(--space-8);
    }

    article {
      display: grid;
      gap: var(--space-5);
      max-inline-size: var(--measure);
    }

    h1 {
      margin-block-end: var(--space-3);
    }

    .lead {
      font-size: var(--text-l);
      line-height: var(--leading-lead);
    }
  `,
})
export class AboutPage {
  protected readonly text = ABOUT_CONTENT;
}
