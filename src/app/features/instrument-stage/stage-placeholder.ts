import { Component, input } from '@angular/core';
import { STAGE_POSTER } from './stage-poster';

/**
 * El marcador del instrumento 3D: ocupa lo mismo que él (el espejo de la pantalla, la caja con el
 * póster y la barra), para que al llegar no se mueva nada. Lo usa la portada mientras se cargan el
 * instrumento y sus trozos (sin cargar nada del escenario: va en el trozo de la portada).
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
}
