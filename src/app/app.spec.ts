import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { APP_CONTENT } from './app.content';
import { SITE_CONFIG } from './core/site.config';

describe('App', () => {
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
  });

  it('lo primero es el enlace para saltar al contenido principal', () => {
    const skipLink = root.querySelector('a');
    expect(skipLink?.getAttribute('href')).toBe('#contenido');
    expect(root.querySelector('main#contenido')).not.toBeNull();
  });

  it('tiene la marca y la navegación principal etiquetada', () => {
    expect(root.querySelector('.wordmark')?.textContent?.trim()).toBe(SITE_CONFIG.name);
    const nav = root.querySelector('header nav');
    expect(nav?.getAttribute('aria-label')).toBe(APP_CONTENT.navLabel);
    expect(nav?.querySelectorAll('a')).toHaveLength(2);
  });

  it('el pie enlaza con el autor y las páginas legales, y dice que el audio no sale del navegador', () => {
    const footer = root.querySelector('footer');
    const links = [...(footer?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'));
    expect(links).toEqual([SITE_CONFIG.author.url, ...SITE_CONFIG.legal.map((link) => link.url)]);
    expect(footer?.textContent).toContain('Tu audio no sale de tu navegador.');
  });
});
