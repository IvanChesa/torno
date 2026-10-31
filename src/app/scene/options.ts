/**
 * Lo que la interfaz elige del 3D sin cargar `three` (lo exporta `scene/index.ts`, que entra en el
 * bundle inicial): las vistas, los encuadres, la órbita y lo que el motor devuelve de cada control.
 */
import type { ControlId } from '../instrument';

/** `frente` es la del escenario; las otras tres, para inspeccionarlo en las capturas. */
export type View = 'frente' | 'tres-cuartos' | 'cenital' | 'perfil';
export const VIEWS: readonly View[] = ['frente', 'tres-cuartos', 'cenital', 'perfil'];

/**
 * Los encuadres de «Tocar» (PLAN fase 6): el aparato entero, el arco de las capas o los controles
 * de delante (las teclas, el disco y el brazo).
 */
export type Shot = 'completo' | 'capas' | 'controles';
export const SHOTS: readonly Shot[] = ['completo', 'capas', 'controles'];

/** «Inspeccionar»: desde dónde se mira, en grados (acimut 0 delante, positivo a la derecha). */
export interface Orbit {
  readonly azimuth: number;
  readonly elevation: number;
}

/** Los límites de la órbita: casi la vuelta entera, y nunca por debajo de la mesa ni en vertical. */
export const ORBIT_LIMITS = {
  azimuth: { min: -150, max: 150 },
  elevation: { min: 10, max: 85 },
} as const;

/** Lo que encuadra la cámara: un encuadre de «Tocar», una órbita o una vista de las capturas. */
export type CameraGoal =
  | { readonly kind: 'shot'; readonly shot: Shot }
  | { readonly kind: 'orbit'; readonly orbit: Orbit }
  | { readonly kind: 'view'; readonly view: View };

/**
 * Un control en la pantalla (PLAN §4.7): su caja en píxeles CSS del lienzo, hacia dónde sube su
 * valor al arrastrar y si se ve (en «Inspeccionar», los que tapa otra pieza no).
 */
export interface ControlBox {
  readonly id: ControlId;
  /** El centro y el tamaño de la pieza proyectada. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Dirección de arrastre en la pantalla (x a la derecha, y hacia abajo), de largo 1. */
  readonly axis: { readonly x: number; readonly y: number };
  readonly visible: boolean;
}

/**
 * Lo que se mueve con el audio, a cada fotograma (PLAN fase 6, «Sincronía»): el giro del disco en
 * vueltas, el nivel de cada capa de 0 a 1 (para sus pilotos y sus medidores), por dónde va cada
 * capa (de 0 a 1 en su bucle, para el cabezal de su forma de onda) y el destello del piloto de
 * grabar en la cuenta previa (de 0 a 1).
 */
export interface SceneMotion {
  readonly disc: number;
  readonly levels: readonly number[];
  readonly heads: readonly number[];
  readonly recordFlash: number;
}

/** La forma de onda de una capa: picos de 0 a 1 por tramo, o `null` si está vacía. */
export type Waveform = Float32Array | null;
