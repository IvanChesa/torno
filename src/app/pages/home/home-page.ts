import { Component } from '@angular/core';
import { DesignSample } from '../../features/design-sample/design-sample';
import { HOME_CONTENT } from './home.content';

/** Portada. Hasta la fase 7 es la página base: presentación, instrumento y muestrario. */
@Component({
  selector: 'trn-home-page',
  imports: [DesignSample],
  template: `
    <section class="hero">
      <h1>{{ text.title }}</h1>
      <p class="hero__lead">{{ text.lead }}</p>
      <p class="hero__status">{{ text.status }}</p>
    </section>

    <section class="section" aria-labelledby="muestrario">
      <h2 id="muestrario">{{ text.sample.title }}</h2>
      <p class="section__intro">{{ text.sample.intro }}</p>
      <trn-design-sample />
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--section-gap);
      inline-size: min(var(--max-width), 100% - 2 * var(--page-margin));
      margin-inline: auto;
      padding-block-start: var(--space-8);
    }

    .hero {
      display: grid;
      gap: var(--space-6);
      max-inline-size: 52rem;
    }

    .hero__lead {
      font-size: var(--text-l);
      line-height: var(--leading-lead);
    }

    .hero__status {
      max-inline-size: var(--measure);
      color: var(--color-ink-muted);
    }

    .section {
      display: grid;
      gap: var(--space-5);
    }

    .section__intro {
      max-inline-size: var(--measure);
    }
  `,
})
export class HomePage {
  protected readonly text = HOME_CONTENT;
}
