import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NOT_FOUND_CONTENT } from './not-found.content';

/** Página de error (`noindex`). Se prerenderiza en /404 para el ErrorDocument de Apache. */
@Component({
  selector: 'trn-not-found-page',
  imports: [RouterLink],
  template: `
    <h1>{{ text.title }}</h1>
    <p>
      {{ text.text }} <a routerLink="/">{{ text.link }}</a
      >.
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
      inline-size: min(var(--max-width), 100% - 2 * var(--page-margin));
      margin-inline: auto;
      padding-block-start: var(--space-8);
    }
  `,
})
export class NotFoundPage {
  protected readonly text = NOT_FOUND_CONTENT;
}
