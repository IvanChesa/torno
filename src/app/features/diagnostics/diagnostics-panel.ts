import { afterNextRender, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import type { EngineDiagnostics } from '../../audio/engine';
import { isCaptureMode } from '../../core/capture-mode';
import { SessionStore } from '../../state';
import { DIAGNOSTICS_CONTENT } from './diagnostics.content';
import { diagnosticsRows, reportText } from './diagnostics-report';

/** El panel se refresca una vez por segundo (lo que dice el navegador cambia poco). */
const REFRESH_MS = 1000;

/**
 * Panel de diagnóstico del audio (`?diagnostico=1`, PLAN fase 4, tarea 7): latencias, estado del
 * audio, estadísticas de reproducción del navegador y, sobre todo, cuánto tarda en sonar cada
 * «reproducir» (la primera vez, en frío). Para las pruebas en los móviles: todo es local, y el
 * informe se copia al portapapeles para pegarlo en `docs/PRUEBAS-MOVIL.md`.
 */
@Component({
  selector: 'trn-diagnostics-panel',
  template: `
    <section class="panel" aria-labelledby="trn-diagnostico">
      <h3 id="trn-diagnostico">{{ text.title }}</h3>
      <p class="intro">{{ text.intro }}</p>
      <dl>
        @for (row of rows(); track row.label) {
          <div>
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        }
      </dl>
      <p class="note">{{ text.note }}</p>
      <div class="actions">
        <button type="button" class="button button--secondary" (click)="copy()">
          {{ text.copy }}
        </button>
        <p class="status" role="status">{{ copyStatus() }}</p>
      </div>
    </section>
  `,
  styles: `
    .panel {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-5);
      border-radius: var(--radius-panel);
      background: var(--color-surface);
    }

    h3 {
      margin: 0;
    }

    .intro,
    .note {
      margin: 0;
      max-inline-size: var(--measure);
      color: var(--color-ink-muted);
      font-size: var(--text-s);
    }

    dl {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    dl div {
      display: grid;
      grid-template-columns: minmax(12rem, 1fr) 2fr;
      gap: var(--space-3);
    }

    dt {
      color: var(--color-ink-muted);
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    @media (max-width: 40rem) {
      dl div {
        grid-template-columns: 1fr;
        gap: 0;
      }
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .status {
      margin: 0;
      color: var(--color-ink-muted);
    }
  `,
})
export class DiagnosticsPanel {
  protected readonly text = DIAGNOSTICS_CONTENT;
  readonly #store = inject(SessionStore);
  readonly #snapshot = signal<EngineDiagnostics | null>(null);
  readonly #userAgent = signal('');
  protected readonly copyStatus = signal('');

  protected readonly rows = computed(() =>
    diagnosticsRows(this.#snapshot(), this.#store.firstSounds(), this.#userAgent()),
  );

  constructor() {
    // Desde ya, cada «reproducir» mide cuánto tarda en sonar.
    this.#store.enableDiagnostics();
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // En las capturas (`?captura=1`), un texto fijo: el agente de usuario cambia con cada versión.
      this.#userAgent.set(
        isCaptureMode(location.search) ? this.text.values.browserInCapture : navigator.userAgent,
      );
      const refresh = () => this.#snapshot.set(this.#store.diagnostics());
      refresh();
      const timer = setInterval(refresh, REFRESH_MS);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  /** Copia el informe al portapapeles (en local: nada sale del navegador). */
  protected async copy(): Promise<void> {
    this.#snapshot.set(this.#store.diagnostics());
    try {
      await navigator.clipboard.writeText(reportText(this.rows()));
      this.copyStatus.set(this.text.copied);
    } catch {
      this.copyStatus.set(this.text.copyFailed);
    }
  }
}
