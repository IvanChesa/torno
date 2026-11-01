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
    /** A qué se dedica, en minúsculas (el pie y el caso de estudio). */
    readonly role: string;
    readonly url: string;
    readonly contactUrl: string;
  };
  /** Páginas legales de ivanchesa.com, que también cubren este subdominio. */
  readonly legal: readonly { readonly label: string; readonly url: string }[];
  /** El código fuente, en GitHub (público desde el 24-10). */
  readonly repoUrl: string;
  /**
   * La imagen Open Graph (D18): la que se ve al compartir un enlace. Renderizada con el propio
   * motor (`scripts/render-poster.mjs`), en la raíz del sitio y sin CORP (`_headers`).
   */
  readonly shareImage: {
    readonly path: string;
    readonly width: number;
    readonly height: number;
    readonly alt: string;
  };
  /** Mientras sea `false`, todas las páginas llevan `noindex` (hasta el lanzamiento, fase 9). */
  readonly indexable: boolean;
}

export const SITE_CONFIG: SiteConfig = {
  name: 'Torno',
  description: SITE_CONTENT.description,
  // Decisión de Iván del 31-10 (PLAN §0): su web pasa a ivanchesa.com. Si cambia, solo se edita aquí.
  baseUrl: 'https://torno.ivanchesa.com',
  lang: 'es',
  locale: 'es-ES',
  themeColor: '#252712',
  author: {
    name: 'Iván Chesa Lapena',
    role: SITE_CONTENT.authorRole,
    url: 'https://ivanchesa.com',
    contactUrl: 'https://ivanchesa.com/contacto/',
  },
  legal: [
    { label: SITE_CONTENT.legal.notice, url: 'https://ivanchesa.com/aviso-legal/' },
    { label: SITE_CONTENT.legal.privacy, url: 'https://ivanchesa.com/privacidad/' },
    { label: SITE_CONTENT.legal.cookies, url: 'https://ivanchesa.com/cookies/' },
  ],
  repoUrl: 'https://github.com/IvanChesa/torno',
  shareImage: { path: '/img/og.jpg', width: 1200, height: 630, alt: SITE_CONTENT.shareImageAlt },
  indexable: false,
};
