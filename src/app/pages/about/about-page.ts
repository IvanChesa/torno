import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_CONFIG } from '../../core/site.config';
import { ABOUT_CONTENT } from './about.content';
import { ThreadsDiagram } from './threads-diagram';

/**
 * El caso de estudio (PLAN fase 7): la arquitectura con el diagrama de hilos, las decisiones, cómo
 * se ha medido, la accesibilidad, el autor y los créditos. Texto y un SVG: va entero en el HTML
 * prerenderizado.
 */
@Component({
  selector: 'trn-about-page',
  imports: [RouterLink, ThreadsDiagram],
  template: `
    <header class="intro">
      <h1>{{ text.title }}</h1>
      <p class="lead">{{ text.lead }}</p>
      @for (paragraph of text.intro; track $index) {
        <p>{{ paragraph }}</p>
      }
    </header>

    <section class="architecture" aria-labelledby="arquitectura">
      <div class="prose">
        <h2 id="arquitectura">{{ text.architecture.title }}</h2>
        @for (paragraph of text.architecture.text; track $index) {
          <p>{{ paragraph }}</p>
        }
      </div>
      <trn-threads-diagram />
    </section>

    <section aria-labelledby="decisiones">
      <h2 id="decisiones">{{ text.decisions.title }}</h2>
      <dl class="decisions">
        @for (decision of text.decisions.items; track decision.title) {
          <div>
            <dt>{{ decision.title }}</dt>
            <dd>{{ decision.text }}</dd>
          </div>
        }
      </dl>
    </section>

    <section class="split" aria-labelledby="mediciones">
      <h2 id="mediciones">{{ text.measurements.title }}</h2>
      <div class="prose">
        @for (paragraph of text.measurements.text; track $index) {
          <p>{{ paragraph }}</p>
        }
        <p>
          <a routerLink="/" fragment="ficha-tecnica">{{ text.measurements.link }}</a>
        </p>
      </div>
    </section>

    <section class="split" aria-labelledby="accesibilidad">
      <h2 id="accesibilidad">{{ text.accessibility.title }}</h2>
      <ul class="prose">
        @for (item of text.accessibility.items; track $index) {
          <li>{{ item }}</li>
        }
      </ul>
    </section>

    <section class="split" aria-labelledby="autor">
      <h2 id="autor">{{ text.author.title }}</h2>
      <div class="prose">
        <p>{{ text.author.text(site.author.name, site.author.role) }}</p>
        <ul class="links" role="list">
          <li>
            <a [href]="site.author.url">{{ text.author.web }}</a>
          </li>
          <li>
            <a [href]="site.author.contactUrl">{{ text.author.contact }}</a>
          </li>
          <li>
            <a [href]="site.repoUrl">{{ text.author.code }}</a>
          </li>
        </ul>
      </div>
    </section>

    <section class="credits" aria-labelledby="creditos">
      <h2 id="creditos">{{ text.credits.title }}</h2>
      <dl>
        <div>
          <dt>{{ text.credits.sounds.title }}</dt>
          <dd>{{ text.credits.sounds.text }}</dd>
        </div>
        <div>
          <dt>{{ text.credits.fonts.title }}</dt>
          <dd>
            @for (font of text.credits.fonts.items; track font.name; let last = $last) {
              {{ font.name }}, de {{ font.author }} (<a [href]="font.license">{{
                text.credits.fonts.license
              }}</a
              >){{ last ? '.' : '; ' }}
            }
          </dd>
        </div>
        <div>
          <dt>{{ text.credits.libraries.title }}</dt>
          <dd>
            {{ text.credits.libraries.text }}
            <a [href]="text.credits.libraries.url">{{ text.credits.libraries.link }}</a
            >.
          </dd>
        </div>
        <div>
          <dt>{{ text.credits.inspiration.title }}</dt>
          <dd>
            {{ text.credits.inspiration.before }}
            <a [href]="text.credits.inspiration.url">{{ text.credits.inspiration.name }}</a
            >{{ text.credits.inspiration.after }}
          </dd>
        </div>
      </dl>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--section-gap);
      inline-size: min(var(--max-width), 100% - 2 * var(--page-margin));
      margin-inline: auto;
      padding-block: var(--space-8) var(--section-gap);
    }

    .intro,
    .prose {
      display: grid;
      gap: var(--space-5);
      max-inline-size: var(--measure);
    }

    .lead {
      font-size: var(--text-l);
      line-height: var(--leading-lead);
    }

    .architecture {
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
      gap: var(--space-8);
      align-items: center;
    }

    /* Un título a la izquierda y su texto a la derecha: la misma retícula en cada sección. */
    .split {
      display: grid;
      grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
      gap: var(--space-8);
      align-items: start;
    }

    ul.prose {
      padding-inline-start: 1.2em;
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-6);
      padding: 0;
      list-style: none;
    }

    .links a {
      display: inline-flex;
      align-items: center;
      min-block-size: var(--target-min);
    }

    h2 {
      margin-block-end: var(--space-6);
    }

    .split h2,
    .prose h2 {
      margin-block-end: 0;
    }

    .decisions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
      gap: var(--space-7) var(--space-8);
    }

    dt {
      font-size: var(--text-l);
      font-weight: var(--weight-heading);
      font-variation-settings: 'SOFT' var(--soft-display);
      line-height: var(--leading-heading);
    }

    dd {
      margin-block-start: var(--space-3);
    }

    .credits dl {
      display: grid;
      gap: var(--space-5);
      padding: var(--space-6);
      border-radius: var(--radius-panel);
      background: var(--color-surface);
    }

    .credits dt {
      font-size: var(--text-m);
      font-weight: var(--weight-strong);
      font-variation-settings: normal;
    }

    .credits dd {
      margin-block-start: var(--space-1);
      color: var(--color-ink-muted);
    }

    @media (max-width: 47.99rem) {
      .architecture,
      .split {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-6);
      }
    }
  `,
})
export class AboutPage {
  protected readonly text = ABOUT_CONTENT;
  protected readonly site = SITE_CONFIG;
}
