import { afterNextRender, Component, signal } from '@angular/core';
import { noteInstrumentTap, preloadAudioEngine } from '../../audio/engine';
import { isDiagnosticsMode } from '../../core/diagnostics-mode';
import { DesignSample } from '../../features/design-sample/design-sample';
import { DiagnosticsPanel } from '../../features/diagnostics/diagnostics-panel';
import { HtmlInstrument } from '../../features/html-instrument/html-instrument';
import { HOME_CONTENT } from './home.content';

/**
 * Portada. Hasta la fase 7 es la página base: presentación, instrumento (HTML hasta las fases 5 y
 * 6) y muestrario.
 *
 * El instrumento va en `@defer`: su JS no entra en la primera visita. El escenario que lo rodea
 * lleva `data-audio-unlock` (el desbloqueo nativo actúa en el gesto real aunque la página no esté
 * hidratada). La página escucha los `click` (Angular los repite tras la hidratación): si un toque
 * sobre el escenario llegó antes que el JS, el instrumento pide otro («Toca para activar el
 * sonido»). Es una escucha de la página, no un control: los controles están dentro.
 *
 * Con `?diagnostico=1`, debajo del instrumento va el panel de diagnóstico del audio (las pruebas en
 * los móviles, PLAN fase 4). Solo se sabe en el navegador; también va en `@defer`.
 */
@Component({
  selector: 'trn-home-page',
  imports: [DesignSample, DiagnosticsPanel, HtmlInstrument],
  host: { '(click)': 'tap($event)' },
  template: `
    <section class="hero">
      <h1>{{ text.title }}</h1>
      <p class="hero__lead">{{ text.lead }}</p>
      <p class="hero__status">{{ text.status }}</p>
      <p>
        <a class="button" href="#instrumento" data-audio-unlock (click)="preload()">{{
          text.play
        }}</a>
      </p>
    </section>

    <section class="section" id="instrumento" aria-labelledby="instrumento-titulo">
      <h2 id="instrumento-titulo">{{ text.instrument.title }}</h2>
      <p class="section__intro">{{ text.instrument.intro }}</p>
      <div class="stage" data-audio-unlock>
        @defer (on idle; on viewport; on interaction) {
          <trn-html-instrument />
        } @placeholder {
          <div class="stage__placeholder">
            <p class="stage__loading">{{ text.instrument.loading }}</p>
          </div>
        }
      </div>
      @if (diagnostics()) {
        @defer (on immediate) {
          <trn-diagnostics-panel />
        }
      }
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
      scroll-margin-block-start: var(--space-6);
    }

    .section__intro {
      max-inline-size: var(--measure);
    }

    /* El esqueleto ocupa lo mismo que el instrumento: al cargarlo, nada se mueve. */
    .stage__placeholder {
      display: grid;
      place-items: center;
      min-block-size: 30rem;
      border-radius: var(--radius-panel);
      background: var(--instrument-plate);
    }

    .stage__loading {
      color: var(--color-ink);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
    }
  `,
})
export class HomePage {
  protected readonly text = HOME_CONTENT;
  protected readonly diagnostics = signal(false);

  constructor() {
    afterNextRender(() => this.diagnostics.set(isDiagnosticsMode(location.search)));
  }

  protected preload(): void {
    preloadAudioEngine();
  }

  protected tap(event: Event): void {
    if ((event.target as Element | null)?.closest?.('.stage')) noteInstrumentTap();
  }
}
