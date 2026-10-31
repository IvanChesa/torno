/**
 * Los pósteres del escenario 3D: capturas del propio motor en `?captura=1`, de la misma proporción
 * que el lienzo, para que el fundido no mueva nada. En el escritorio, 5:4; en el móvil, 1:1 (su
 * encuadre, desde más arriba). Los genera `npm run capturas -- --poster`.
 *
 * Va aparte del componente: la portada lo usa en el marcador del `@defer` sin cargar el escenario.
 */
export const STAGE_POSTER = {
  src: '/img/escenario.webp',
  width: 1200,
  height: 960,
  /** El del móvil: hasta 47,99 rem de ancho, como la caja cuadrada. */
  mobile: { src: '/img/escenario-movil.webp', width: 800, height: 800 },
  mobileMedia: '(max-width: 47.99rem)',
} as const;
