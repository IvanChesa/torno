import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  Injector,
} from '@angular/core';
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

/** El fragmento de una URL del router (sin `#`), o `null`. */
export function routeFragment(routerUrl: string): string | null {
  const fragment = routerUrl.split('#')[1];
  return fragment ? decodeURIComponent(fragment) : null;
}

/** Lo que dice que alguien ya se mueve por la página por su cuenta (y deja de sujetarse el ancla). */
const USER_MOVES = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
/**
 * El ancla de otra página se sujeta hasta que lo de encima lleva `ANCHOR_SETTLE_MS` sin crecer,
 * y como mucho `ANCHOR_HOLD_MS` (en un móvil lento, las secciones se pintan más tarde).
 */
const ANCHOR_SETTLE_MS = 1000;
const ANCHOR_HOLD_MS = 6000;

/**
 * Llegar a un ancla de otra página (`/#ficha-tecnica` desde `/sobre-el-proyecto`; revisión de la
 * fase 8, #3): el foco va al destino (no al `h1`) y la página se queda en él mientras crece lo de
 * encima. En la navegación de dentro de la web, las secciones de la portada se pintan después de que
 * el router desplace la página, y el destino acababa 3000 px más abajo, fuera de la pantalla. Se
 * sujeta hasta que el contenido lleva `settleMs` sin crecer (como mucho, `ms`) o hasta que la
 * persona se mueve sola. Devuelve cómo soltarlo.
 */
export function holdAnchor(
  document: Document,
  id: string,
  ms = ANCHOR_HOLD_MS,
  settleMs = ANCHOR_SETTLE_MS,
): () => void {
  const win = document.defaultView;
  const target = document.getElementById(id);
  if (!target || !win) return () => undefined;
  const place = () => target.scrollIntoView?.({ block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  place();
  let settle: ReturnType<typeof setTimeout> | undefined;
  const release = () => {
    observer?.disconnect();
    clearTimeout(timer);
    clearTimeout(settle);
    for (const type of USER_MOVES) win.removeEventListener(type, release, true);
  };
  const wait = () => {
    clearTimeout(settle);
    settle = setTimeout(release, settleMs);
  };
  const main = document.getElementById(MAIN_ID);
  const observer =
    main && typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          place();
          wait();
        })
      : null;
  if (main) observer?.observe(main);
  wait();
  const timer = setTimeout(release, ms);
  for (const type of USER_MOVES) {
    win.addEventListener(type, release, { capture: true, passive: true });
  }
  return release;
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
    // ya empieza por arriba) ni en un enlace a un ancla de la misma página. A un ancla de otra
    // página, al destino, que se sujeta mientras crece lo de encima (`holdAnchor`).
    let previous: string | null = null;
    let release: () => void = () => undefined;
    inject(DestroyRef).onDestroy(() => release());
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const path = routePath(event.urlAfterRedirects);
        const fragment = routeFragment(event.urlAfterRedirects);
        const changed = previous !== null && path !== previous;
        previous = path;
        if (!changed) return;
        release();
        afterNextRender(
          () => {
            if (fragment) release = holdAnchor(this.document, fragment);
            else focusPageHeading(this.document);
          },
          { injector: this.injector },
        );
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
