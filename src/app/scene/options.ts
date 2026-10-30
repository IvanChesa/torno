/**
 * Lo que la interfaz elige del 3D sin cargar `three` (lo exporta `scene/index.ts`, que entra en el
 * bundle inicial): las vistas.
 */

/** `frente` es la del escenario; las otras tres, para inspeccionarlo en las capturas. */
export type View = 'frente' | 'tres-cuartos' | 'cenital' | 'perfil';
export const VIEWS: readonly View[] = ['frente', 'tres-cuartos', 'cenital', 'perfil'];
