import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { noteInstrumentTap, preloadAudioEngine } from '../../audio/engine';
import { isCaptureMode } from '../../core/capture-mode';
import { isDiagnosticsMode } from '../../core/diagnostics-mode';
import { isHtmlOnlyMode } from '../../core/html-only-mode';
import { MotionPreference } from '../../core/motion';
import { onPresenceOrQuiet } from '../../core/page-presence';
import type { ControlId } from '../../instrument';
import { DiagnosticsPanel } from '../../features/diagnostics/diagnostics-panel';
import { HtmlInstrument } from '../../features/html-instrument/html-instrument';
import {
  InstrumentStage,
  type StageFailure,
} from '../../features/instrument-stage/instrument-stage';
import { StagePlaceholder } from '../../features/instrument-stage/stage-placeholder';
import { InstrumentSpotlight } from '../../features/instrument-common/spotlight';
import { Closing } from '../../features/product/closing';
import { Details } from '../../features/product/details';
import { Faq } from '../../features/product/faq';
import { Guide } from '../../features/product/guide';
import { guideTargetFor, INSTRUMENT_ANCHOR } from '../../features/product/guide-target';
import { LoopAnatomy } from '../../features/product/loop-anatomy';
import { LOOP_ANATOMY_CONTENT } from '../../features/product/loop-anatomy.content';
import { ProductIntro } from '../../features/product/intro';
import { SpecSheet } from '../../features/product/spec-sheet';
import { HOME_CONTENT } from './home.content';

/**
 * La portada (PLAN fase 7): el titular junto al instrumento y, debajo, la web de producto: «Qué
 * es», la guía de los 9 controles, los materiales con la vista despiezada, la anatomía de un bucle,
 * la ficha técnica, las preguntas frecuentes y el cierre.
 *
 * El instrumento es el aparato en 3D (PLAN §4.6 y fase 6), en `@defer`: llega con el primer gesto en
 * la página (mover el ratón, tocar, desplazar o una tecla) o cuando la página lleva unos segundos
 * quieta, nunca en plena carga (PLAN fase 8: su llegada bloquea el hilo principal y la carga tiene
 * que responder). Mientras, su póster, un render del propio aparato, con el sitio del espejo de la
 * pantalla y de la barra (sin mover nada al llegar). Con `?sin3d=1`, el plato HTML en su lugar, en
 * reposo; si el navegador no tiene WebGL o el contexto se pierde y no vuelve, el plato también,
 * cuando el 3D falla (con su aviso). Nunca están los dos.
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
    Closing,
    Details,
    DiagnosticsPanel,
    Faq,
    Guide,
    HtmlInstrument,
    InstrumentStage,
    LoopAnatomy,
    ProductIntro,
    SpecSheet,
    StagePlaceholder,
  ],
  host: { '(click)': 'onClick($event)' },
  template: `
    <section class="hero" aria-labelledby="titulo">
      <div class="hero__text">
        <!-- La marca no se traduce (un traductor automático la cambiaría por «Lathe»). -->
        <h1 id="titulo" translate="no">{{ text.title }}</h1>
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
          @if (fallback(); as reason) {
            <p class="stage__notice" role="status">{{ text.instrument.fallback[reason] }}</p>
          }
          <!--
            Un @defer de fuera con los disparadores y el mismo marcador para los dos instrumentos: con
            ?sin3d=1, lo que hay dentro de .stage no cambia al hidratar, y un toque anterior (que
            Angular repite después) sigue encontrando su sitio en la página. Dentro, un @defer para
            cada uno: solo se descarga el trozo del que se usa.

            Al cumplirse el de fuera, su marcador se va y el de dentro llega un tic después: en ese
            fotograma no había nada y la página saltaba (CLS de 0,6 al llegar el 3D, fase 8). La
            reserva, un marcador más, solo se ve entonces (.stage__reserve, con :has()).
          -->
          <trn-stage-placeholder class="stage__reserve" aria-hidden="true" alt="" />
          @defer (on interaction; when stageWanted()) {
            @if (htmlOnly() || noWebgl()) {
              @defer (on immediate) {
                <trn-html-instrument />
              } @placeholder {
                <trn-stage-placeholder [alt]="text.instrument.poster" />
              }
            } @else {
              @defer (on immediate) {
                <trn-instrument-stage (failed)="fail($event)" />
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
      @defer (hydrate on viewport) {
        <trn-product-intro />
      }
    </section>

    <section class="block" id="guia" aria-labelledby="guia-titulo">
      @defer (hydrate on viewport) {
        <trn-guide />
      }
    </section>

    <section class="field" aria-labelledby="detalles">
      @defer (hydrate on viewport) {
        <trn-details class="block" [explodable]="!htmlOnly() && !noWebgl()" />
      }
    </section>

    <!--
      La anatomía (su JS y las formas de onda), al acercarse: no entra en el peso de la primera
      visita. Mientras, su título y su entradilla, ya en el HTML prerenderizado.
    -->
    <section class="block" aria-labelledby="anatomia">
      @defer (on viewport) {
        <trn-loop-anatomy />
      } @placeholder {
        <div class="placeholder">
          <h2 id="anatomia">{{ anatomy.title }}</h2>
          <p>{{ anatomy.intro }}</p>
        </div>
      }
    </section>

    <section class="block" id="ficha-tecnica" aria-labelledby="ficha">
      @defer (hydrate on viewport) {
        <trn-spec-sheet />
      }
    </section>

    <section class="block" aria-labelledby="preguntas">
      @defer (hydrate on viewport) {
        <trn-faq />
      }
    </section>

    <section class="block" aria-labelledby="cierre">
      @defer (hydrate on viewport) {
        <trn-closing (playRequest)="play()" />
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

    /*
     * La caja del instrumento es un contenedor: si su columna no da para la barra del 3D en una fila
     * (657 px; entre 1024 y unos 1100 px de ancho, o con zum), la barra va en tres filas, como en el
     * móvil, y el marcador reserva lo mismo (revisión de la fase 8, #1).
     */
    .stage {
      container: instrumento / inline-size;
    }

    @container instrumento (max-width: 43.99rem) {
      trn-stage-placeholder,
      trn-instrument-stage {
        --stage-toolbar-height: calc(3 * var(--target-min) + 2 * var(--space-1));
      }
    }

    /*
     * La reserva del sitio del instrumento: solo cuando en .stage no hay ni marcador ni instrumento
     * (el tic entre el marcador del @defer de fuera y el de dentro).
     */
    .stage__reserve {
      display: none;
    }

    .stage:not(
        :has(trn-instrument-stage, trn-html-instrument, trn-stage-placeholder:not(.stage__reserve))
      )
      > .stage__reserve {
      display: grid;
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
  private readonly motion = inject(MotionPreference);
  private readonly document = inject(DOCUMENT);
  protected readonly diagnostics = signal(false);
  /** `?sin3d=1`: sin el escenario 3D (ni su póster). Solo se sabe en el navegador. */
  protected readonly htmlOnly = signal(false);
  /** El 3D no puede seguir (sin WebGL o con el contexto perdido): el plato HTML en su lugar. */
  protected readonly noWebgl = computed(() => this.fallback() !== null);
  /** Por qué no está el 3D (sin WebGL, o el contexto perdido sin volver), o `null`. */
  protected readonly fallback = signal<StageFailure | null>(null);
  /** Ya se puede pedir el instrumento: alguien se ha acercado o la página está quieta. */
  protected readonly stageWanted = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.diagnostics.set(isDiagnosticsMode(location.search));
      this.htmlOnly.set(isHtmlOnlyMode(location.search));
      // Las capturas no esperan a nadie.
      if (isCaptureMode(location.search)) {
        this.stageWanted.set(true);
        return;
      }
      // El plato HTML es ligero: en reposo, como antes de la fase 8. No antes: un toque anterior al
      // JS, que Angular repite tras la hidratación, tiene que llegar antes que el instrumento (este
      // mira al nacer si hubo uno que no pudo activar el sonido).
      if (this.htmlOnly()) {
        const wanted = () => this.stageWanted.set(true);
        if (typeof requestIdleCallback === 'function') requestIdleCallback(wanted);
        else setTimeout(wanted);
        return;
      }
      destroyRef.onDestroy(onPresenceOrQuiet(window, () => this.stageWanted.set(true)));
    });
  }

  /** «Tocar»: lleva al instrumento (el enlace) y deja el foco en la tecla de reproducir. */
  protected play(): void {
    preloadAudioEngine();
    this.spotlight.show('play', 'completo');
  }

  /**
   * «Ver en el instrumento» (la guía): lleva la página al instrumento y le pide que señale el
   * control. Nunca suena ni cambia nada.
   */
  private showFromGuide(event: Event): void {
    const target = guideTargetFor(event.target);
    if (!target) return;
    this.spotlight.show(target.control, target.shot);
    this.document.getElementById(INSTRUMENT_ANCHOR)?.scrollIntoView({
      behavior: this.motion.still() ? 'auto' : 'smooth',
      block: 'center',
    });
  }

  /**
   * El 3D no puede seguir: el plato HTML en su lugar, con el aviso. Si el foco estaba en un control
   * del 3D, pasa al mismo control del plato (cuando llegue), para no perderse en la página.
   */
  protected fail(reason: StageFailure): void {
    const focused = this.document.activeElement;
    const inStage = focused?.closest?.('.stage');
    // El mismo control y, si el foco estaba en otra cosa del 3D (su barra), el principal.
    const control = inStage
      ? ((focused?.closest?.('[data-control]')?.getAttribute('data-control') as ControlId | null) ??
        'main')
      : null;
    this.fallback.set(reason);
    if (control) this.spotlight.show(control, null);
    else this.spotlight.clearAttended();
  }

  /**
   * Los clics de la página: un toque en el escenario (por si llegó antes que el JS) y «Ver en el
   * instrumento» de la guía (`guideTargetFor`: lo atiende la portada, ya hidratada desde el arranque).
   */
  protected onClick(event: Event): void {
    if ((event.target as Element | null)?.closest?.('.stage')) noteInstrumentTap();
    this.showFromGuide(event);
  }
}
