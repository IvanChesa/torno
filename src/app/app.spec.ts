import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App, routePath, skipLinkHref } from './app';
import { APP_CONTENT } from './app.content';
import { routes } from './app.routes';
import { SITE_CONFIG } from './core/site.config';

describe('App', () => {
  async function render(url = '/') {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] });
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('«Saltar al contenido» es lo primero y apunta al contenido de la página actual', async () => {
    const root = await render('/sobre-el-proyecto');
    const skipLink = root.querySelector('a');
    expect(skipLink?.textContent?.trim()).toBe(APP_CONTENT.skipLink);
    // Con <base href="/">, un «#contenido» suelto llevaría a la portada.
    expect(skipLink?.getAttribute('href')).toBe('/sobre-el-proyecto#contenido');
    expect(root.querySelector('main#contenido')).not.toBeNull();
  });

  it('al pulsarlo, el foco pasa al contenido sin navegar', async () => {
    const root = await render('/sobre-el-proyecto');
    const skipLink = root.querySelector<HTMLAnchorElement>('a.skip-link');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    skipLink?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('main#contenido'));
  });

  it('el destino conserva la ruta y la consulta y cambia el fragmento', () => {
    expect(skipLinkHref('/')).toBe('/#contenido');
    expect(skipLinkHref('/?captura=1')).toBe('/?captura=1#contenido');
    expect(skipLinkHref('/sobre-el-proyecto#arriba')).toBe('/sobre-el-proyecto#contenido');
  });

  it('tiene la marca y la navegación principal etiquetada', async () => {
    const root = await render();
    expect(root.querySelector('.wordmark')?.textContent?.trim()).toBe(SITE_CONFIG.name);
    const nav = root.querySelector('header nav');
    expect(nav?.getAttribute('aria-label')).toBe(APP_CONTENT.navLabel);
    expect(nav?.querySelectorAll('a')).toHaveLength(2);
  });

  it('el pie enlaza con el autor y las páginas legales, y dice que el audio no sale del navegador', async () => {
    const root = await render();
    const footer = root.querySelector('footer');
    const links = [...(footer?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'));
    expect(links).toEqual([SITE_CONFIG.author.url, ...SITE_CONFIG.legal.map((link) => link.url)]);
    expect(footer?.textContent).toContain('Tu audio no sale de tu navegador.');
  });

  it('al cambiar de página, el foco va al h1 de la nueva; no en la primera ni con un ancla', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] });
    const fixture = TestBed.createComponent(App);
    document.body.append(fixture.nativeElement);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(document.activeElement?.tagName).not.toBe('H1');
    await router.navigateByUrl('/sobre-el-proyecto');
    await fixture.whenStable();
    const heading = document.querySelector('main h1');
    expect(heading?.textContent?.trim()).toBe('Sobre el proyecto');
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    // Un ancla de la misma página no mueve el foco.
    (document.activeElement as HTMLElement | null)?.blur();
    await router.navigateByUrl('/sobre-el-proyecto#creditos');
    await fixture.whenStable();
    expect(document.activeElement).toBe(document.body);
    fixture.nativeElement.remove();
  });

  it('la ruta de una URL, sin consulta ni fragmento', () => {
    expect(routePath('/sobre-el-proyecto#creditos')).toBe('/sobre-el-proyecto');
    expect(routePath('/?sin3d=1#guia')).toBe('/');
  });
});
