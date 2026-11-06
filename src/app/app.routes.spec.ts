import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { SeoService } from './core/seo.service';
import { SITE_CONFIG } from './core/site.config';

// Las rutas de PLAN §2 con el SEO de cada una (SeoService hace de TitleStrategy).
describe('rutas y SEO', () => {
  let harness: RouterTestingHarness;
  const meta = (name: string) => TestBed.inject(Meta).getTag(`name="${name}"`)?.content;
  const canonical = () =>
    TestBed.inject(DOCUMENT).head.querySelector('link[rel="canonical"]')?.getAttribute('href');

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: TitleStrategy, useClass: SeoService }],
    });
    harness = await RouterTestingHarness.create();
  });

  it('portada: título, descripción del sitio, canonical e indexable', async () => {
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Title).getTitle()).toBe('Torno');
    expect(meta('description')).toBe(SITE_CONFIG.description);
    expect(meta('robots')).toBe('index, follow');
    expect(canonical()).toBe('https://torno.ivanchesa.com/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Torno');
    // Para compartir (D18): Open Graph con la imagen absoluta y la tarjeta grande.
    const og = (property: string) => TestBed.inject(Meta).getTag(`property="${property}"`)?.content;
    expect(og('og:title')).toBe('Torno');
    expect(og('og:url')).toBe('https://torno.ivanchesa.com/');
    expect(og('og:image')).toBe('https://torno.ivanchesa.com/img/og.jpg');
    expect(og('og:locale')).toBe('es_ES');
    expect(meta('twitter:card')).toBe('summary_large_image');
  });

  it('/sobre-el-proyecto: su título y su descripción', async () => {
    await harness.navigateByUrl('/sobre-el-proyecto');
    expect(TestBed.inject(Title).getTitle()).toBe('Sobre el proyecto · Torno');
    expect(meta('description')).toContain('Cómo está hecho Torno');
    expect(meta('robots')).toBe('index, follow');
    expect(canonical()).toBe('https://torno.ivanchesa.com/sobre-el-proyecto');
  });

  it.each(['/404', '/una-ruta-que-no-existe'])(
    '%s: página de error con noindex y sin canonical',
    async (url) => {
      await harness.navigateByUrl('/sobre-el-proyecto');
      await harness.navigateByUrl(url);
      expect(TestBed.inject(Title).getTitle()).toBe('Página no encontrada · Torno');
      expect(meta('robots')).toBe('noindex');
      expect(canonical()).toBeUndefined();
    },
  );
});
