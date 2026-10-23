import indexHtml from '../../index.html' with { loader: 'text' };
import tokensCss from '../../styles/tokens.css' with { loader: 'text' };
import { SITE_CONFIG } from './site.config';

describe('SITE_CONFIG', () => {
  it('tiene una URL base absoluta en HTTPS y sin barra final', () => {
    const url = new URL(SITE_CONFIG.baseUrl);
    expect(url.protocol).toBe('https:');
    expect(SITE_CONFIG.baseUrl.endsWith('/')).toBe(false);
  });

  it('no es indexable hasta el lanzamiento', () => {
    expect(SITE_CONFIG.indexable).toBe(false);
  });

  it('está en español y enlaza con la web del autor y sus páginas legales en HTTPS', () => {
    expect(SITE_CONFIG.lang).toBe('es');
    expect(SITE_CONFIG.author.url).toBe('https://ivanchesa.es');
    expect(SITE_CONFIG.legal.map((link) => link.label)).toEqual([
      'Aviso legal',
      'Privacidad',
      'Cookies',
    ]);
    for (const link of SITE_CONFIG.legal) {
      expect(new URL(link.url).origin).toBe('https://ivanchesa.es');
    }
  });

  // El idioma y el color de la barra están también en el <head> estático y en los tokens: estos
  // tests los mantienen sincronizados con la configuración.
  it('index.html declara el mismo idioma y color de barra que la configuración', () => {
    const page = new DOMParser().parseFromString(indexHtml, 'text/html');
    expect(page.documentElement.lang).toBe(SITE_CONFIG.lang);
    expect(page.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      SITE_CONFIG.themeColor,
    );
  });

  it('el color de la barra es el fondo de la página (tokens.css)', () => {
    expect(tokensCss).toContain(`--color-bg: ${SITE_CONFIG.themeColor};`);
  });
});
