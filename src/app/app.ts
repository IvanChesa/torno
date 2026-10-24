import { afterNextRender, Component, computed, DOCUMENT, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_CONTENT } from './app.content';
import { applyCaptureMode } from './core/capture-mode';
import { SITE_CONFIG } from './core/site.config';

const MAIN_ID = 'contenido';

/**
 * Destino de «Saltar al contenido» en la página actual. Con `<base href="/">`, un `#contenido`
 * suelto se resuelve contra la base y llevaría a la portada desde cualquier otra página.
 */
export function skipLinkHref(routerUrl: string): string {
  return `${routerUrl.split('#')[0]}#${MAIN_ID}`;
}

@Component({
  selector: 'trn-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip-link" [href]="skipHref()" (click)="skipToContent($event)">{{ text.skipLink }}</a>

    <header class="site-header">
      <a class="wordmark" routerLink="/" [attr.aria-label]="text.homeLabel">{{ site.name }}</a>
      <nav [attr.aria-label]="text.navLabel">
        <ul>
          <li>
            <a
              routerLink="/"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: true }"
              ariaCurrentWhenActive="page"
              >{{ text.nav.instrument }}</a
            >
          </li>
          <li>
            <a
              routerLink="/sobre-el-proyecto"
              routerLinkActive="is-active"
              ariaCurrentWhenActive="page"
              >{{ text.nav.about }}</a
            >
          </li>
        </ul>
      </nav>
    </header>

    <main [id]="mainId" tabindex="-1">
      <router-outlet />
    </main>

    <footer class="site-footer">
      <p class="site-footer__name" aria-hidden="true">{{ site.name }}</p>
      <div class="site-footer__body">
        <p>
          {{ text.authorPrefix }} <a [href]="site.author.url">{{ site.author.name }}</a
          >.
        </p>
        <p>{{ text.privacy }}</p>
        <nav class="site-footer__legal" [attr.aria-label]="text.legalLabel">
          <ul>
            @for (link of site.legal; track link.url) {
              <li>
                <a [href]="link.url">{{ link.label }}</a>
              </li>
            }
          </ul>
        </nav>
      </div>
    </footer>
  `,
  styleUrl: './app.css',
})
export class App {
  protected readonly site = SITE_CONFIG;
  protected readonly text = APP_CONTENT;
  protected readonly mainId = MAIN_ID;
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  /** Ruta de la última navegación (también al prerenderizar: el enlace sirve antes de hidratar). */
  protected readonly skipHref = computed(() => {
    const finalUrl = this.router.lastSuccessfulNavigation()?.finalUrl;
    return skipLinkHref(finalUrl ? this.router.serializeUrl(finalUrl) : this.router.url);
  });

  constructor() {
    afterNextRender(() => applyCaptureMode(this.document));
  }

  /** Con JS, el enlace lleva el foco al contenido sin cambiar la URL ni el historial. */
  protected skipToContent(event: MouseEvent): void {
    const main = this.document.getElementById(MAIN_ID);
    if (!main) return;
    event.preventDefault();
    main.focus();
  }
}
