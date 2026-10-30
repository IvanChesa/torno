import { afterNextRender, Component, signal } from '@angular/core';
import { noteInstrumentTap, preloadAudioEngine } from '../../audio/engine';
import { isDiagnosticsMode } from '../../core/diagnostics-mode';
import { isHtmlOnlyMode } from '../../core/html-only-mode';
import { DesignSample } from '../../features/design-sample/design-sample';
import { DiagnosticsPanel } from '../../features/diagnostics/diagnostics-panel';
import { HtmlInstrument } from '../../features/html-instrument/html-instrument';
import { InstrumentStage } from '../../features/instrument-stage/instrument-stage';
import { STAGE_POSTER } from '../../features/instrument-stage/stage-poster';
import { HOME_CONTENT } from './home.content';

/**
 * Portada. Hasta la fase 7 es la página base: presentación, instrumento y muestrario.
 *
 * El aparato en 3D (PLAN §4.9) va en `@defer`, al acercarse o en reposo: mientras, su póster, en
 * la misma caja (sin mover nada al llegar). Hasta la fase 6 solo enseña lo que se toca; se toca con
 * el instrumento HTML de debajo.
 *
 * El instrumento también va en `@defer`: su JS no entra en la primera visita. El escenario que lo
 * rodea lleva `data-audio-unlock` (el desbloqueo nativo actúa en el gesto real aunque la página no
 * esté hidratada). La página escucha los `click` (Angular los repite tras la hidratación): si un
 * toque sobre el escenario llegó antes que el JS, el instrumento pide otro («Toca para activar el
 * sonido»). Es una escucha de la página, no un control: los controles están dentro.
 *
 * Con `?diagnostico=1`, debajo del instrumento va el panel de diagnóstico del audio (las pruebas en
 * los móviles, PLAN fase 4). Solo se sabe en el navegador; también va en `@defer`.
 */
@Component({
  selector: 'trn-home-page',
  imports: [DesignSample, DiagnosticsPanel, HtmlInstrument, InstrumentStage],
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
      @if (!htmlOnly()) {
        @defer (on viewport; on idle) {
          <trn-instrument-stage />
        } @placeholder {
          <div class="stage3d-placeholder">
            <!--
              Un <img> sin NgOptimizedImage: la directiva entra en el trozo común del bundle
              inicial (esbuild reparte por módulos) y lo pasaba de 300 kB. Un solo póster, sin
              srcset, no la necesita.
            -->
            <img
              [src]="poster.src"
              [width]="poster.width"
              [height]="poster.height"
              [alt]="text.instrument.poster"
              loading="lazy"
              decoding="async"
            />
          </div>
        }
      }
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

    /* El póster ocupa lo mismo que el escenario 3D (5:4): al llegar el lienzo, nada se mueve. */
    .stage3d-placeholder {
      aspect-ratio: 5 / 4;
    }

    .stage3d-placeholder img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
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
  protected readonly poster = STAGE_POSTER;
  protected readonly diagnostics = signal(false);
  /** `?sin3d=1`: sin el escenario 3D (ni su póster). Solo se sabe en el navegador. */
  protected readonly htmlOnly = signal(false);

  constructor() {
    afterNextRender(() => {
      this.diagnostics.set(isDiagnosticsMode(location.search));
      this.htmlOnly.set(isHtmlOnlyMode(location.search));
    });
  }

  protected preload(): void {
    preloadAudioEngine();
  }

  protected tap(event: Event): void {
    if ((event.target as Element | null)?.closest?.('.stage')) noteInstrumentTap();
  }
}
