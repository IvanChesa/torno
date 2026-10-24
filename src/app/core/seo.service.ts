import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SITE_CONFIG } from './site.config';

/** Datos de SEO de una ruta (en `data`). El título va en `title`, como siempre en el router. */
export interface SeoRouteData {
  /** Descripción de la página; sin ella, la del sitio. */
  readonly description?: string;
  /** Página que nunca se indexa (la 404). */
  readonly noindex?: boolean;
}

/** «Página · Torno»; sin título de ruta, solo el nombre del sitio. */
export function formatPageTitle(pageTitle: string | undefined): string {
  return pageTitle ? `${pageTitle} · ${SITE_CONFIG.name}` : SITE_CONFIG.name;
}

/** URL canónica de una ruta: la base del sitio y la ruta, sin consulta ni fragmento. */
export function canonicalUrl(routerUrl: string): string {
  const path = routerUrl.split(/[?#]/)[0] ?? '/';
  return `${SITE_CONFIG.baseUrl}${path === '' ? '/' : path}`;
}

/**
 * SEO sencillo (PLAN D18): título, descripción, robots y canonical en cada navegación, también al
 * prerenderizar. Hace de `TitleStrategy` del router porque es lo que se ejecuta con cada ruta.
 */
@Injectable()
export class SeoService extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const data = route.data as SeoRouteData;

    this.title.setTitle(formatPageTitle(this.buildTitle(snapshot)));
    this.meta.updateTag({
      name: 'description',
      content: data.description ?? SITE_CONFIG.description,
    });
    const indexable = SITE_CONFIG.indexable && !data.noindex;
    this.meta.updateTag({ name: 'robots', content: indexable ? 'index, follow' : 'noindex' });
    this.setCanonical(data.noindex ? undefined : canonicalUrl(snapshot.url));
  }

  private setCanonical(url: string | undefined): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }
}
