import { Component, computed, input } from '@angular/core';
import type { DisplayModel } from '../../instrument';

/** Filas del menú que caben en la pantalla a la vez (las de alrededor del cursor). */
const VISIBLE_ROWS = 4;

/**
 * La pantalla del aparato (fósforo sobre negro): pinta el modelo de pantalla del instrumento. No es
 * una región viva: el resumen para los lectores de pantalla va aparte, con antirrebote.
 */
/** Espacio sin ruptura delante de cada separador «·». */
const keepSeparator = (text: string) => text.replaceAll(' · ', '\u00a0· ');

@Component({
  selector: 'trn-instrument-screen',
  template: `
    <div class="screen" [attr.data-mode]="display().mode">
      @if (display().title) {
        <p class="screen__title">{{ display().title }}</p>
      }
      @for (line of lines(); track $index) {
        <p class="screen__line">{{ line }}</p>
      }
      @if (rows().length > 0) {
        <ul class="screen__rows">
          @for (row of rows(); track row.label) {
            <li
              class="screen__row"
              [class.is-selected]="row.selected"
              [class.is-editing]="row.editing"
              [attr.aria-current]="row.selected ? 'true' : null"
            >
              <span>{{ row.label }}</span>
              @if (row.value) {
                <span class="screen__value">{{
                  row.editing ? '‹ ' + row.value + ' ›' : row.value
                }}</span>
              }
            </li>
          }
        </ul>
      }
      <p class="screen__status">{{ status() }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .screen {
      display: grid;
      align-content: start;
      gap: var(--space-1);
      min-block-size: 9.5rem;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-s);
      background: var(--color-screen);
      color: var(--color-phosphor);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-variant-numeric: tabular-nums;
      line-height: 1.5;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    p {
      margin: 0;
    }

    .screen__title {
      opacity: 0.8;
    }

    .screen__rows {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .screen__row {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      padding-inline: var(--space-1);
    }

    .screen__row.is-selected {
      background: var(--color-phosphor);
      color: var(--color-screen);
    }

    .screen__status {
      margin-block-start: auto;
      padding-block-start: var(--space-1);
    }
  `,
})
export class InstrumentScreen {
  readonly display = input.required<DisplayModel>();
  /** Las líneas parten detrás del «·», nunca delante («CAPA 1 · BATERÍA ·» / «ALFAR»). */
  protected readonly lines = computed(() => this.display().lines.map(keepSeparator));
  protected readonly status = computed(() => keepSeparator(this.display().status));

  /** Las filas visibles: una ventana alrededor de la elegida. */
  protected readonly rows = computed(() => {
    const rows = this.display().rows;
    if (rows.length <= VISIBLE_ROWS) return rows;
    const selected = Math.max(
      0,
      rows.findIndex((row) => row.selected),
    );
    const start = Math.min(Math.max(0, selected - 1), rows.length - VISIBLE_ROWS);
    return rows.slice(start, start + VISIBLE_ROWS);
  });
}
