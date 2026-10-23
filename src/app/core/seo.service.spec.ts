import { canonicalUrl, formatPageTitle } from './seo.service';

describe('SeoService', () => {
  it('compone el título de la página con el del sitio', () => {
    expect(formatPageTitle('Sobre el proyecto')).toBe('Sobre el proyecto · Torno');
    expect(formatPageTitle(undefined)).toBe('Torno');
  });

  it('da la URL canónica sin consulta ni fragmento', () => {
    expect(canonicalUrl('/')).toBe('https://torno.ivanchesa.es/');
    expect(canonicalUrl('/sobre-el-proyecto?captura=1#arriba')).toBe(
      'https://torno.ivanchesa.es/sobre-el-proyecto',
    );
  });
});
