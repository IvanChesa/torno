import { SITE_CONTENT } from './site.content';

/**
 * Configuración del sitio. Es la ÚNICA fuente del nombre, la URL base, el idioma, el autor y los
 * enlaces externos: el resto del código (títulos, SEO, pie) la lee de aquí.
 */
export interface SiteConfig {
  readonly name: string;
  /** Una línea: qué es Torno. Es la descripción por defecto de las páginas. */
  readonly description: string;
  /** URL canónica del sitio, en HTTPS y sin barra final. */
  readonly baseUrl: string;
  readonly lang: string;
  readonly locale: string;
  /** Color de la barra del navegador en el móvil (el fondo de la página, docs/DISENO.md). */
  readonly themeColor: string;
  readonly author: {
    readonly name: string;
    readonly url: string;
    readonly contactUrl: string;
  };
  /** Páginas legales de ivanchesa.es, que también cubren este subdominio. */
  readonly legal: readonly { readonly label: string; readonly url: string }[];
  /** Mientras sea `false`, todas las páginas llevan `noindex` (hasta el lanzamiento, fase 9). */
  readonly indexable: boolean;
}

export const SITE_CONFIG: SiteConfig = {
  name: 'Torno',
  description: SITE_CONTENT.description,
  // Provisional (docs/PENDIENTES.md: «Subdominio definitivo»). Si cambia, solo se edita aquí.
  baseUrl: 'https://torno.ivanchesa.es',
  lang: 'es',
  locale: 'es-ES',
  themeColor: '#252712',
  author: {
    name: 'Iván Chesa Lapena',
    url: 'https://ivanchesa.es',
    contactUrl: 'https://ivanchesa.es/contacto/',
  },
  legal: [
    { label: SITE_CONTENT.legal.notice, url: 'https://ivanchesa.es/aviso-legal/' },
    { label: SITE_CONTENT.legal.privacy, url: 'https://ivanchesa.es/privacidad/' },
    { label: SITE_CONTENT.legal.cookies, url: 'https://ivanchesa.es/cookies/' },
  ],
  indexable: false,
};
