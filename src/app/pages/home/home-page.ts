import { afterNextRender, Component, inject, signal } from '@angular/core';
import { noteInstrumentTap, preloadAudioEngine } from '../../audio/engine';
import { isDiagnosticsMode } from '../../core/diagnostics-mode';
import { isHtmlOnlyMode } from '../../core/html-only-mode';
import { DiagnosticsPanel } from '../../features/diagnostics/diagnostics-panel';
import { HtmlInstrument } from '../../features/html-instrument/html-instrument';
import { InstrumentStage } from '../../features/instrument-stage/instrument-stage';
import { StagePlaceholder } from '../../features/instrument-stage/stage-placeholder';
import { InstrumentSpotlight } from '../../features/instrument-common/spotlight';
import { Details } from '../../features/product/details';
import { Guide, INSTRUMENT_ANCHOR } from '../../features/product/guide';
import { LoopAnatomy } from '../../features/product/loop-anatomy';
import { LOOP_ANATOMY_CONTENT } from '../../features/product/loop-anatomy.content';
import { ProductIntro } from '../../features/product/intro';
import { HOME_CONTENT } from './home.content';

/**
 * La portada (PLAN fase 7): el titular junto al instrumento y, debajo, la web de producto («Qué es»
 * y la guía de los 9 controles; los detalles, la anatomía de un bucle, la ficha técnica, las
 * preguntas y el cierre llegan en las entregas siguientes).
 *
 * El instrumento es el aparato en 3D (PLAN §4.6 y fase 6), en `@defer`, al acercarse o en reposo:
 * mientras, su póster con el sitio del espejo de la pantalla y de la barra (sin mover nada al
 * llegar). Con `?sin3d=1`, o si el navegador no tiene WebGL, el plato HTML en su lugar. Nunca están
 * los dos.
 *
 * El escenario que lo rodea lleva `data-audio-unlock` (el desbloqueo nativo actúa en el gesto real
 * aunque la página no esté hidratada), y también «Tocar», que lleva al instrumento y le pasa el foco
 * a la tecla de reproducir. La página escucha los `click` (Angular los repite tras la hidratación):
 * si un toque sobre el escenario llegó antes que el JS, el instrumento pide otro («Toca para activar
 * el sonido»). Es una escucha de la página, no un control: los controles están dentro.
 *
 * Con `?diagnostico=1`, debajo del instrumento va el panel de diagnóstico del audio (las pruebas en
 * los móviles, PLAN fase 4). Solo se sabe en el navegador; también va en `@defer`.
 */
@Component({
  selector: 'trn-home-page',
  imports: [
    Details,
    DiagnosticsPanel,
    Guide,
    HtmlInstrument,
    InstrumentStage,
    LoopAnatomy,
    ProductIntro,
    StagePlaceholder,
  ],
  host: { '(click)': 'tap($event)' },
  template: `
    <section class="hero" aria-labelledby="titulo">
      <div class="hero__text">
        <h1 id="titulo">{{ text.title }}</h1>
        <p class="hero__lead">{{ text.lead }}</p>
        <p class="hero__actions">
          <a class="button" [href]="anchor" data-audio-unlock (click)="play()">{{ text.play }}</a>
          <a class="button button--secondary" href="#guia">{{ text.guide }}</a>
        </p>
        <p class="hero__note">
          {{ text.note.before }} <kbd>{{ text.note.play }}</kbd> {{ text.note.middle }}
          <kbd>{{ text.note.help }}</kbd> {{ text.note.after }}
        </p>
      </div>

      <div
        class="hero__instrument"
        [id]="anchorId"
        [attr.aria-label]="text.instrument.label"
        role="region"
      >
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
      </div>
    </section>

    <section class="block" aria-labelledby="que-es">
      <trn-product-intro />
    </section>

    <section class="block" id="guia" aria-labelledby="guia-titulo">
      <trn-guide />
    </section>

    <section class="field" aria-labelledby="detalles">
      <trn-details class="block" [explodable]="!htmlOnly() && !noWebgl()" />
    </section>

    <!--
      La anatomía (su JS y las formas de onda), al acercarse: no entra en el peso de la primera
      visita. Mientras, su título y su entradilla, ya en el HTML prerenderizado.
    -->
    <section class="block" aria-labelledby="anatomia">
      @defer (on viewport; on idle) {
        <trn-loop-anatomy />
      } @placeholder {
        <div class="placeholder">
          <h2 id="anatomia">{{ anatomy.title }}</h2>
          <p>{{ anatomy.intro }}</p>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--section-gap);
      padding-block: var(--space-6) var(--section-gap);
    }

    .hero,
    .block {
      inline-size: min(var(--max-width), 100% - 2 * var(--page-margin));
      margin-inline: auto;
      scroll-margin-block-start: var(--space-6);
    }

    /* El marcador de la anatomía: lo que ocupa (la figura, de 34 rem como mucho), sin saltos. */
    .placeholder {
      display: grid;
      align-content: center;
      gap: var(--space-5);
      min-block-size: min(34rem, 100vw);
      max-inline-size: var(--measure);
      margin-inline-start: auto;
    }

    /* Un campo de color entero: el escalón de tono de la superficie, de borde a borde. */
    .field {
      padding-block: var(--space-9);
      background: var(--color-surface);
    }

    /* El titular a la izquierda y el instrumento a la derecha, en la primera pantalla. */
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
      gap: var(--space-7);
      align-items: center;
    }

    .hero__text {
      display: grid;
      gap: var(--space-5);
    }

    .hero__lead {
      font-size: var(--text-l);
      line-height: var(--leading-lead);
    }

    .hero__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .hero__note {
      color: var(--color-ink-muted);
      font-size: var(--text-s);
    }

    .hero__instrument {
      display: grid;
      gap: var(--space-5);
      scroll-margin-block-start: var(--space-4);
    }

    .stage__notice {
      max-inline-size: var(--measure);
      margin-block-end: var(--space-4);
    }

    @media (max-width: 63.99rem) {
      .hero {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-6);
      }
    }
  `,
})
export class HomePage {
  protected readonly text = HOME_CONTENT;
  protected readonly anatomy = LOOP_ANATOMY_CONTENT;
  protected readonly anchorId = INSTRUMENT_ANCHOR;
  protected readonly anchor = `#${INSTRUMENT_ANCHOR}`;
  private readonly spotlight = inject(InstrumentSpotlight);
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

  /** «Tocar»: lleva al instrumento (el enlace) y deja el foco en la tecla de reproducir. */
  protected play(): void {
    preloadAudioEngine();
    this.spotlight.show('play', 'completo');
  }

  protected tap(event: Event): void {
    if ((event.target as Element | null)?.closest?.('.stage')) noteInstrumentTap();
  }
}
