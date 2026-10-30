/**
 * El póster del escenario 3D: una captura del propio motor en `?captura=1`, del mismo tamaño que el
 * lienzo (5:4), para que el fundido no mueva nada. Lo genera `npm run capturas -- --poster`.
 *
 * Va aparte del componente: la portada lo usa en el marcador del `@defer` sin cargar el escenario.
 */
export const STAGE_POSTER = { src: '/img/escenario.webp', width: 1200, height: 960 } as const;
