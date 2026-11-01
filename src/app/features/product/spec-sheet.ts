import { Component } from '@angular/core';
import { SITE_CONFIG } from '../../core/site.config';
import { SPEC_SHEET_CONTENT } from './spec-sheet.content';

/**
 * La ficha técnica (PLAN fase 7): una tabla de verdad (`th` de fila y de columna), con las cifras
 * en Geist Mono (son datos, DISENO.md §3) y, en cada una, cómo se midió y su informe. En el móvil,
 * cada fila es un bloque.
 */
@Component({
  selector: 'trn-spec-sheet',
  template: `
    <div class="heading">
      <h2 id="ficha">{{ text.title }}</h2>
      <p>{{ text.intro }}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th scope="col">{{ text.headers.name }}</th>
          <th scope="col">{{ text.headers.value }}</th>
          <th scope="col">{{ text.headers.how }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of text.rows; track row.name) {
          <tr>
            <th scope="row">{{ row.name }}</th>
            <td class="value">{{ row.value }}</td>
            <td class="how">
              {{ row.how }}
              <a [href]="reportUrl(row.phase)">{{ text.report(row.phase) }}</a>
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
    }

    .heading {
      display: grid;
      gap: var(--space-4);
      max-inline-size: var(--measure);
      margin-block-end: var(--space-7);
    }

    table {
      inline-size: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: var(--space-4) var(--space-5);
      text-align: start;
      vertical-align: top;
    }

    thead th {
      color: var(--color-ink-muted);
      font-size: var(--text-s);
      font-weight: var(--weight-text);
    }

    /* Filas separadas por un escalón de tono, sin líneas (DISENO.md §5). */
    tbody tr:nth-child(odd) {
      background: var(--color-surface);
    }

    tbody tr > :first-child {
      border-start-start-radius: var(--radius-s);
      border-end-start-radius: var(--radius-s);
    }

    tbody tr > :last-child {
      border-start-end-radius: var(--radius-s);
      border-end-end-radius: var(--radius-s);
    }

    tbody th {
      inline-size: 22%;
      font-weight: var(--weight-strong);
    }

    .value {
      inline-size: 18%;
      color: var(--color-accent-text);
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .how {
      color: var(--color-ink-muted);
    }

    .how a {
      color: var(--color-ink);
      white-space: nowrap;
    }

    @media (max-width: 47.99rem) {
      thead {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }

      tbody tr {
        display: grid;
        gap: var(--space-1);
        padding: var(--space-4);
        border-radius: var(--radius-s);
      }

      th,
      td,
      tbody th,
      .value {
        inline-size: auto;
        padding: 0;
      }
    }
  `,
})
export class SpecSheet {
  protected readonly text = SPEC_SHEET_CONTENT;

  /** El informe de una fase, en el repositorio (público). */
  protected reportUrl(phase: number): string {
    return `${SITE_CONFIG.repoUrl}/blob/main/docs/informes/fase-${phase}.md`;
  }
}
