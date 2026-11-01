import { Component, output, signal } from '@angular/core';
import { SITE_CONFIG } from '../../core/site.config';
import { CLOSING_CONTENT } from './closing.content';
import { INSTRUMENT_ANCHOR } from './guide';

/**
 * El cierre de la portada (PLAN fase 7): volver a tocar, el caso de estudio, el contacto, el código
 * y compartir (D18). Compartir usa el menú del sistema si lo hay y, si no, copia el enlace; nada
 * sale a otro sitio que no elija quien comparte.
 */
@Component({
  selector: 'trn-closing',
  template: `
    <h2 id="cierre">{{ text.title }}</h2>
    <div class="actions">
      <p>
        <a class="button" [href]="anchor" data-audio-unlock (click)="playRequest.emit()">{{
          text.play
        }}</a>
      </p>
      <ul role="list">
        <li>
          <a href="/sobre-el-proyecto">{{ text.about }}</a>
        </li>
        <li>
          <a [href]="site.author.contactUrl">{{ text.contact }}</a>
        </li>
        <li>
          <a [href]="site.repoUrl">{{ text.code }}</a>
        </li>
        <li>
          <button type="button" class="link" (click)="share()">{{ text.share }}</button>
        </li>
      </ul>
      <p class="status" aria-live="polite">{{ status() }}</p>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
      gap: var(--space-8);
      align-items: end;
    }

    h2 {
      font-size: var(--text-display);
      line-height: var(--leading-display);
      letter-spacing: var(--tracking-display);
    }

    .actions {
      display: grid;
      gap: var(--space-5);
    }

    ul {
      display: grid;
      gap: var(--space-1);
      padding: 0;
      list-style: none;
    }

    ul a,
    .link {
      display: inline-flex;
      align-items: center;
      min-block-size: var(--target-min);
      font-size: var(--text-l);
    }

    /* Un botón que parece un enlace (compartir no lleva a ningún sitio). */
    .link {
      padding: 0;
      border: 0;
      background: none;
      cursor: pointer;
      text-decoration-line: underline;
      text-decoration-color: var(--color-accent);
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.2em;
    }

    .link:hover {
      text-decoration-color: currentColor;
    }

    .status {
      min-block-size: 1.5em;
      color: var(--color-ink-muted);
      font-size: var(--text-s);
      overflow-wrap: anywhere;
    }

    @media (max-width: 47.99rem) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-6);
      }
    }
  `,
})
export class Closing {
  /** «Tocar»: la portada lleva al instrumento y deja el foco en la tecla de reproducir. */
  readonly playRequest = output<void>();

  protected readonly text = CLOSING_CONTENT;
  protected readonly site = SITE_CONFIG;
  protected readonly anchor = `#${INSTRUMENT_ANCHOR}`;
  protected readonly status = signal('');

  protected async share(): Promise<void> {
    const url = location.origin + '/';
    const data = { title: SITE_CONFIG.name, text: this.text.shareText, url };
    try {
      if (navigator.share && navigator.canShare?.(data) !== false) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      this.status.set(this.text.copied);
    } catch (error) {
      // Cerrar el menú del sistema no es un error.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.status.set(this.text.manual(url));
    }
  }
}
