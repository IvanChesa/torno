import { afterNextRender, Component, computed, DOCUMENT, inject, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
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

/** La ruta de una URL del router, sin la consulta ni el fragmento. */
export function routePath(routerUrl: string): string {
  return routerUrl.split('#')[0]!.split('?')[0]!;
}

/**
 * Tras cambiar de página dentro de la web, el foco va al `h1` de la nueva (o, si no lo tiene, al
 * contenido): como en una carga completa, el lector de pantalla dice dónde se está y el tabulador
 * sigue desde ahí, no desde el enlace de la página anterior. Sin desplazar: eso lo hace el router.
 */
export function focusPageHeading(document: Document): void {
  const main = document.getElementById(MAIN_ID);
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

@Component({
  selector: 'trn-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip-link" [href]="skipHref()" (click)="skipToContent($event)">{{ text.skipLink }}</a>

    <header class="site-header">
      <a class="wordmark" routerLink="/" translate="no" [attr.aria-label]="text.homeLabel">{{
        site.name
      }}</a>
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
      <p class="site-footer__name" aria-hidden="true" translate="no">{{ site.name }}</p>
      <div class="site-footer__body">
        <p>
          {{ text.authorPrefix }} <a [href]="site.author.url">{{ site.author.name }}</a
          >, {{ site.author.role }}.
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
  private readonly injector = inject(Injector);

  /** Ruta de la última navegación (también al prerenderizar: el enlace sirve antes de hidratar). */
  protected readonly skipHref = computed(() => {
    const finalUrl = this.router.lastSuccessfulNavigation()?.finalUrl;
    return skipLinkHref(finalUrl ? this.router.serializeUrl(finalUrl) : this.router.url);
  });

  constructor() {
    afterNextRender(() => applyCaptureMode(this.document));
    // El foco al cambiar de página (PLAN fase 8, tarea 3), nunca en la primera carga (el navegador
    // ya empieza por arriba) ni en un enlace a un ancla de la misma página.
    let previous: string | null = null;
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const path = routePath(event.urlAfterRedirects);
        const changed = previous !== null && path !== previous;
        previous = path;
        if (!changed) return;
        afterNextRender(() => focusPageHeading(this.document), { injector: this.injector });
      });
  }

  /** Con JS, el enlace lleva el foco al contenido sin cambiar la URL ni el historial. */
  protected skipToContent(event: MouseEvent): void {
    const main = this.document.getElementById(MAIN_ID);
    if (!main) return;
    event.preventDefault();
    main.focus();
  }
}
