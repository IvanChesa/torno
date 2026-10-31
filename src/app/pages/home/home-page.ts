import { afterNextRender, Component, signal } from '@angular/core';
import { noteInstrumentTap, preloadAudioEngine } from '../../audio/engine';
import { isDiagnosticsMode } from '../../core/diagnostics-mode';
import { isHtmlOnlyMode } from '../../core/html-only-mode';
import { DesignSample } from '../../features/design-sample/design-sample';
import { DiagnosticsPanel } from '../../features/diagnostics/diagnostics-panel';
import { HtmlInstrument } from '../../features/html-instrument/html-instrument';
import { InstrumentStage } from '../../features/instrument-stage/instrument-stage';
import { StagePlaceholder } from '../../features/instrument-stage/stage-placeholder';
import { HOME_CONTENT } from './home.content';

/**
 * Portada. Hasta la fase 7 es la página base: presentación, instrumento y muestrario.
 *
 * El instrumento es el aparato en 3D (PLAN §4.6 y fase 6), en `@defer`, al acercarse o en reposo:
 * mientras, su póster con el sitio del espejo de la pantalla y de la barra (sin mover nada al
 * llegar). Con `?sin3d=1`, o si el navegador no tiene WebGL, el plato HTML en su lugar. Nunca están
 * los dos.
 *
 * El escenario que lo rodea lleva `data-audio-unlock` (el desbloqueo nativo actúa en el gesto real
 * aunque la página no esté hidratada). La página escucha los `click` (Angular los repite tras la
 * hidratación): si un toque sobre el escenario llegó antes que el JS, el instrumento pide otro
 * («Toca para activar el sonido»). Es una escucha de la página, no un control: los controles están
 * dentro.
 *
 * Con `?diagnostico=1`, debajo del instrumento va el panel de diagnóstico del audio (las pruebas en
 * los móviles, PLAN fase 4). Solo se sabe en el navegador; también va en `@defer`.
 */
@Component({
  selector: 'trn-home-page',
  imports: [DesignSample, DiagnosticsPanel, HtmlInstrument, InstrumentStage, StagePlaceholder],
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
        @if (noWebgl()) {
          <p class="stage__notice" role="status">{{ text.instrument.noWebgl }}</p>
        }
        <!--
          Un @defer de fuera con los disparadores y el mismo marcador para los dos instrumentos: con
          ?sin3d=1, lo que hay dentro de .stage no cambia al hidratar, y un toque anterior (que
          Angular repite después) sigue encontrando su sitio en la página. Dentro, un @defer para
          cada uno: solo se descarga el trozo del que se usa.
        -->
        @defer (on viewport; on idle; on interaction) {
          @if (htmlOnly() || noWebgl()) {
            @defer (on immediate) {
              <trn-html-instrument />
            } @placeholder {
              <trn-stage-placeholder [alt]="text.instrument.poster" />
            }
          } @else {
            @defer (on immediate) {
              <trn-instrument-stage (failed)="noWebgl.set(true)" />
            } @placeholder {
              <trn-stage-placeholder [alt]="text.instrument.poster" />
            }
          }
        } @placeholder {
          <trn-stage-placeholder [alt]="text.instrument.poster" />
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

    .stage__notice {
      max-inline-size: var(--measure);
      margin-block-end: var(--space-4);
    }
  `,
})
export class HomePage {
  protected readonly text = HOME_CONTENT;
  protected readonly diagnostics = signal(false);
  /** `?sin3d=1`: sin el escenario 3D (ni su póster). Solo se sabe en el navegador. */
  protected readonly htmlOnly = signal(false);
  /** El 3D no ha podido arrancar (sin WebGL): el plato HTML en su lugar. */
  protected readonly noWebgl = signal(false);

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
