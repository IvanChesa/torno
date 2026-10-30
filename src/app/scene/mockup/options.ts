/**
 * Lo que se elige en la maqueta (PLAN fase 5.a): variante de color, *tone mapping* y vista. Sin
 * `three`: la interfaz lo usa sin cargar el 3D.
 */
export type { Variant } from '../materials/variants';
export { VARIANTS } from '../materials/variants';

export type ToneMapping = 'neutral' | 'agx';
export const TONE_MAPPINGS: readonly ToneMapping[] = ['neutral', 'agx'];

export type View = 'frente' | 'tres-cuartos' | 'cenital' | 'perfil';
export const VIEWS: readonly View[] = ['frente', 'tres-cuartos', 'cenital', 'perfil'];
