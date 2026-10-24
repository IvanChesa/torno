import { Component, computed, inject } from '@angular/core';
import { SESSION_CONTENT, SessionStore } from '../../state';
import { HTML_INSTRUMENT_CONTENT } from './html-instrument.content';

/**
 * Avisos alrededor del instrumento: el estado del audio («Toca para activar el sonido», reposo…),
 * los errores (en una región `role="alert"` que siempre está), recuperar el autoguardado, la chuleta
 * de atajos y el aviso de que la sesión se autoguarda en este navegador.
 */
@Component({
  selector: 'trn-instrument-notices',
  template: `
    @if (fatalError(); as error) {
      <p class="notice notice--error">
        {{ error.text }}
        @if (store.engineError() !== 'no-web-audio') {
          <button
            type="button"
            class="button button--secondary"
            data-audio-unlock
            (click)="store.retry()"
          >
            {{ engineText.retry }}
          </button>
        }
      </p>
    }
    <p class="notice" role="status">
      @if (engineNotice(); as notice) {
        {{ notice }}
      }
    </p>
    <p class="notice notice--error" role="alert">
      @if (store.message(); as message) {
        @if (message.tone === 'error') {
          {{ message.text }}
        }
      }
    </p>
    @if (recoveryDate(); as date) {
      <div class="panel">
        <p>{{ recoveryText.question(date) }}</p>
        <div class="actions">
          <button type="button" class="button" data-audio-unlock (click)="store.recover()">
            {{ recoveryText.recover }}
          </button>
          <button type="button" class="button button--secondary" (click)="store.discardAutosave()">
            {{ recoveryText.discard }}
          </button>
        </div>
      </div>
    }
    @if (store.state().help) {
      <section class="panel" aria-labelledby="trn-atajos">
        <h3 id="trn-atajos">{{ text.help.title }}</h3>
        <p>{{ text.help.intro }}</p>
        <dl>
          @for (item of shortcuts; track item[0]) {
            <div>
              <dt>
                <kbd>{{ item[0] }}</kbd>
              </dt>
              <dd>{{ item[1] }}</dd>
            </div>
          }
        </dl>
        <button type="button" class="button button--secondary" (click)="closeHelp()">
          {{ text.help.close }}
        </button>
      </section>
    }
    <p class="autosave">
      {{ text.autosave.note }}
      <button type="button" class="link-button" (click)="store.clearAutosave()">
        {{ text.autosave.clear }}
      </button>
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }

    .notice {
      margin: 0;
      color: var(--color-ink-muted);
    }

    /*
     * Vacías, las regiones vivas siguen en el árbol de accesibilidad (con display: none, un lector
     * podría no anunciar su primer cambio): ocultas a la vista y fuera de la rejilla.
     */
    .notice:empty {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    .notice--error {
      color: var(--color-error);
    }

    .panel {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-5);
      border-radius: var(--radius-panel);
      background: var(--color-surface);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    dl {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }

    dl div {
      display: flex;
      gap: var(--space-3);
    }

    dd {
      margin: 0;
    }

    .autosave {
      margin: 0;
      color: var(--color-ink-muted);
      font-size: var(--text-s);
    }

    .link-button {
      min-block-size: var(--target-min);
      padding: 0;
      border: 0;
      background: none;
      color: var(--color-ink);
      text-decoration: underline var(--color-accent) 0.08em;
      text-underline-offset: 0.2em;
      cursor: pointer;
    }
  `,
})
export class InstrumentNotices {
  protected readonly store = inject(SessionStore);
  protected readonly text = HTML_INSTRUMENT_CONTENT;
  protected readonly engineText = SESSION_CONTENT.engine;
  protected readonly recoveryText = SESSION_CONTENT.recovery;
  protected readonly shortcuts = [...this.text.help.shortcuts, ...this.text.help.controls];

  /** Aviso del estado del audio (o `null` si suena con normalidad). */
  protected readonly engineNotice = computed(() => {
    const state = this.store.engineState();
    if (this.store.needsGesture()) return this.engineText.needsGesture;
    if (state === 'loading') return this.engineText.loading;
    if (state === 'interrupted') return this.engineText.interrupted;
    if (state === 'standby') return this.engineText.standby;
    return null;
  });

  protected readonly fatalError = computed(() => {
    const error = this.store.engineError();
    return this.store.engineState() === 'error' && error ? SESSION_CONTENT.problems[error] : null;
  });

  protected readonly recoveryDate = computed(() => {
    const savedAt = this.store.recovery();
    return savedAt === null
      ? null
      : new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(savedAt);
  });

  protected closeHelp(): void {
    this.store.input({ type: 'toggle-help' });
  }
}
