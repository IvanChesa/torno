import { Component, input } from '@angular/core';
import { INSTRUMENT_COMMON_CONTENT } from '../instrument-common/instrument-common.content';
import { STAGE_POSTER } from './stage-poster';

/**
 * El marcador del instrumento 3D: ocupa lo mismo que él (el espejo de la pantalla, la caja con el
 * póster, la barra y la línea del autoguardado), para que al llegar no se mueva nada. Lo usa la
 * portada mientras se cargan el instrumento y sus trozos (sin cargar nada del escenario: va en el
 * trozo de la portada). Desde la fase 8 el 3D llega tarde (con un gesto o con la página quieta), y
 * lo que no reservaba (esa línea: 60 px en el escritorio y 83 en el móvil) movía la página.
 */
@Component({
  selector: 'trn-stage-placeholder',
  template: `
    <div class="mirror"></div>
    <div class="box">
      <!--
        Un <img> sin NgOptimizedImage: la directiva entra en el trozo común del bundle inicial
        (esbuild reparte por módulos) y lo pasaba de 300 kB. Los pósteres no la necesitan.
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
          [alt]="alt()"
          fetchpriority="high"
          decoding="async"
        />
      </picture>
    </div>
    <div class="bar"></div>
    <!--
      El sitio de la línea del autoguardado (InstrumentNotices), con su mismo texto y sus mismos
      estilos para que ocupe lo mismo a cualquier ancho; invisible y fuera del árbol de accesibilidad
      (aún no hay nada que borrar).
    -->
    <p class="autosave" aria-hidden="true">
      {{ autosave.note }} <span class="link-button">{{ autosave.clear }}</span>
    </p>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
    }

    .mirror {
      inline-size: min(100%, 38rem);
      block-size: var(--instrument-mirror-height);
      border-radius: var(--radius-s);
      background: var(--color-screen);
    }

    .box {
      inline-size: min(100%, (100svh - 13rem) * 1.25);
      aspect-ratio: 5 / 4;
    }

    /* En el escritorio, el espejo va dentro de la caja, como en el escenario (no ocupa fila). */
    @media (min-width: 48rem) {
      :host {
        position: relative;
      }

      .mirror {
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: calc((100% - min(100%, (100svh - 13rem) * 1.25)) / 2);
        inline-size: var(--instrument-reading-width);
      }
    }

    /* La barra: lo que reserva StageToolbar (dos filas en el escritorio y cuatro en el móvil). */
    .bar {
      block-size: var(--stage-toolbar-height);
    }

    @media (max-width: 47.99rem) {
      .box {
        inline-size: calc(100% + 2 * var(--page-margin));
        margin-inline: calc(-1 * var(--page-margin));
        aspect-ratio: 1;
      }
    }

    /* Como en InstrumentNotices: el mismo texto, el mismo tamaño y el botón de 44 px de alto. */
    .autosave {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      column-gap: 0.5ch;
      justify-self: stretch;
      margin: 0;
      font-size: var(--text-s);
      visibility: hidden;
    }

    .link-button {
      display: inline-block;
      min-block-size: var(--target-min);
    }

    /* El móvil en horizontal: como el escenario (InstrumentStage), la caja a la izquierda. */
    @media (orientation: landscape) and (max-height: 32rem) {
      :host {
        /* En vw: el 100 % de la columna dependería de sí mismo. */
        --stage-width: min(
          100vw - 2 * var(--page-margin) - var(--stage-side-width) - var(--space-5),
          (100svh - 2 * var(--space-4)) * 1.25
        );
        grid-template-columns: var(--stage-width) minmax(0, 1fr);
        grid-template-rows: auto 1fr auto;
        justify-items: start;
        align-items: start;
        column-gap: var(--space-5);
      }

      .box {
        grid-column: 1;
        grid-row: 1 / span 2;
        inline-size: 100%;
        margin-inline: 0;
        aspect-ratio: 5 / 4;
      }

      .mirror {
        position: static;
        grid-column: 2;
        inline-size: 100%;
      }

      .bar {
        grid-column: 2;
      }

      .autosave {
        grid-column: 1 / -1;
      }
    }

    img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
    }
  `,
})
export class StagePlaceholder {
  /** El texto alternativo del póster. */
  readonly alt = input.required<string>();
  protected readonly poster = STAGE_POSTER;
  protected readonly autosave = INSTRUMENT_COMMON_CONTENT.autosave;
}
