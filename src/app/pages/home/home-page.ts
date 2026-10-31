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
      <div class="stage" data-audio-unlock>
        @if (noWebgl()) {
          <p class="stage__notice" role="status">{{ text.instrument.noWebgl }}</p>
        }
        <!--
          Un solo @defer para los dos instrumentos, con el mismo marcador: con ?sin3d=1, lo que hay
          dentro de .stage no cambia al hidratar, y un toque anterior (que Angular repite después)
          sigue encontrando su sitio en la página.
        -->
        @defer (on viewport; on idle; on interaction) {
          @if (htmlOnly() || noWebgl()) {
            <trn-html-instrument />
          } @else {
            <trn-instrument-stage (failed)="noWebgl.set(true)" />
          }
        } @placeholder {
          <div class="stage3d-placeholder">
            <div class="stage3d-placeholder__mirror"></div>
            <div class="stage3d-placeholder__box">
              <!--
                Un <img> sin NgOptimizedImage: la directiva entra en el trozo común del bundle
                inicial (esbuild reparte por módulos) y lo pasaba de 300 kB. Un solo póster, sin
                srcset, no la necesita.
              -->
              <picture>
                <source
                  [attr.media]="poster.mobileMedia"
                  [attr.srcset]="poster.mobile.src"
                  [attr.width]="poster.mobile.width"
                  [attr.height]="poster.mobile.height"
                />
                <img
                  [src]="poster.src"
                  [width]="poster.width"
                  [height]="poster.height"
                  [alt]="text.instrument.poster"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div class="stage3d-placeholder__bar"></div>
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

    /*
     * El marcador ocupa lo mismo que el instrumento 3D: el espejo de la pantalla (dos líneas de
     * texto), la caja del póster (5:4 en el escritorio, 1:1 y de borde a borde en el móvil) y la
     * barra. Al llegar el instrumento, nada se mueve.
     */
    .stage3d-placeholder {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
    }

    .stage3d-placeholder__mirror {
      inline-size: min(100%, 38rem);
      block-size: var(--instrument-mirror-height);
      border-radius: var(--radius-s);
      background: var(--color-screen);
    }

    .stage3d-placeholder__box {
      inline-size: min(100%, (100svh - 13rem) * 1.25);
      aspect-ratio: 5 / 4;
    }

    /* La barra: una fila de botones; en el móvil, dos. */
    .stage3d-placeholder__bar {
      block-size: var(--target-min);
    }

    @media (max-width: 47.99rem) {
      .stage3d-placeholder__bar {
        block-size: calc(2 * var(--target-min) + var(--space-2));
      }

      .stage3d-placeholder__box {
        inline-size: calc(100% + 2 * var(--page-margin));
        margin-inline: calc(-1 * var(--page-margin));
        aspect-ratio: 1;
      }
    }

    .stage3d-placeholder img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
    }

    .stage__notice {
      max-inline-size: var(--measure);
      margin-block-end: var(--space-4);
    }
  `,
})
export class HomePage {
  protected readonly text = HOME_CONTENT;
  protected readonly poster = STAGE_POSTER;
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
