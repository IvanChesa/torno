/**
 * Medidas y distribución del aparato, en mm (PLAN fase 5.a; DISENO.md §7). Es la fuente del 3D
 * (`scene/`), del instrumento HTML y de la guía.
 *
 * Torno es un torno de alfarero visto desde arriba: un cuerpo redondo con el disco en el centro,
 * como la cabeza del torno, y los controles alrededor, por zonas: las capas a la izquierda, las
 * teclas delante, el brazo a la derecha y, detrás, la bandeja con la pantalla, el dial principal,
 * el volumen y el reposo.
 *
 * Posiciones polares sobre la cubierta: `angle` en grados, 0° delante (hacia quien toca) y positivo
 * hacia la derecha; `radius` en mm desde el eje del disco. En el 3D, x = radius · sen(angle),
 * z = radius · cos(angle) e y hacia arriba, con la cubierta a `DECK_HEIGHT` de la mesa.
 */
import type { ControlId } from './catalog';

/**
 * El cuerpo: una pieza torneada que se abre desde la base y sube recta hasta el canto, como un
 * plato grueso.
 */
export const BODY = {
  /** Radio del cuerpo (el de la pared recta de arriba): Ø 300 mm. */
  radius: 150,
  /** Radio de la base. */
  baseRadius: 141,
  /** Alto del cuerpo, sin las patas. */
  height: 40,
  /** Alto de la parte de abajo, la que se abre desde la base hasta `radius`. */
  flare: 18,
  /** Radio del bisel del canto de arriba: la cubierta plana llega hasta `radius − edgeRadius`. */
  edgeRadius: 10,
  /** Radio del bisel de la base. */
  footRadius: 4,
} as const;

/** Tres patas de goma, a 120° entre sí. */
export const FEET = { radius: 12, height: 6, distance: 118, angles: [0, 120, -120] } as const;

/** Altura de la cubierta sobre la mesa. */
export const DECK_HEIGHT = FEET.height + BODY.height;

/** El disco: cerámica vidriada con un anillo de latón, un poco levantado sobre la cubierta. */
export const DISC = {
  radius: 75,
  /** Ancho del anillo de latón que lo rodea. */
  ringWidth: 6,
  thickness: 12,
  /** Hueco entre la cubierta y el disco. */
  gap: 2,
  /** El cubo de latón del centro. */
  hubRadius: 11,
  /** La marca crema que da una vuelta por compás. */
  markRadius: 62,
} as const;

/** Radio exterior del disco con su anillo. */
export const DISC_OUTER_RADIUS = DISC.radius + DISC.ringWidth;

/**
 * La bandeja: un borde levantado detrás, como la bandeja de un torno, que lleva la pantalla en su
 * cara de dentro, inclinada hacia quien toca.
 */
export const TRAY = {
  innerRadius: 134,
  thickness: 8,
  /** Alto sobre la cubierta. */
  height: 36,
  /** Inclinación hacia atrás, en grados. */
  lean: 10,
  /** Mitad del arco que ocupa, centrado detrás (180°). */
  halfAngle: 32,
} as const;

/** La pantalla, en la cara de dentro de la bandeja. */
export const SCREEN = {
  halfAngle: 26,
  /** Borde de abajo y de arriba, en mm sobre la cubierta. */
  bottom: 13,
  top: 32,
} as const;

export type PieceShape = 'dial' | 'key' | 'button' | 'wheel';

/** Dónde va un control sobre la cubierta y qué ocupa. */
export interface Placement {
  readonly angle: number;
  readonly radius: number;
  readonly shape: PieceShape;
  /** Radio de la huella de la pieza sobre la cubierta (o la mitad de su lado mayor). */
  readonly footprint: number;
  /** Alto de la pieza sobre la cubierta. */
  readonly height: number;
}

/** Los controles que son una pieza fija (todos menos el disco y el brazo). */
export type PlacedControl = Exclude<ControlId, 'disc' | 'arm'>;

const dial = (angle: number, radius: number, size: number, height: number): Placement => ({
  angle,
  radius,
  shape: 'dial',
  footprint: size / 2,
  height,
});

/** Las capas, de la 1 (detrás) a la 4 (delante), en arco a la izquierda. */
const LAYER_ANGLES = [-134, -106, -78, -50] as const;
const LAYER_RADIUS = 121;
/** Diámetro de los diales de capa y del principal. */
export const LAYER_DIAL_SIZE = 30;
export const MAIN_DIAL_SIZE = 40;

/** Las teclas de transporte (de cerámica crema), rectangulares, vueltas hacia el disco. */
export const KEY = { width: 32, depth: 26, height: 8 } as const;
/** El botón de reposo. */
export const STANDBY_SIZE = 14;
/** La rueda de volumen: su eje va en tangente y su canto asoma hacia arriba. */
export const WHEEL = { diameter: 30, width: 10, exposed: 10 } as const;

export const PLACEMENTS: Readonly<Record<PlacedControl, Placement>> = {
  play: { angle: -24, radius: 122, shape: 'key', footprint: KEY.width / 2, height: KEY.height },
  record: { angle: 0, radius: 122, shape: 'key', footprint: KEY.width / 2, height: KEY.height },
  undo: { angle: 24, radius: 122, shape: 'key', footprint: KEY.width / 2, height: KEY.height },
  'layer-0': dial(LAYER_ANGLES[0], LAYER_RADIUS, LAYER_DIAL_SIZE, 14),
  'layer-1': dial(LAYER_ANGLES[1], LAYER_RADIUS, LAYER_DIAL_SIZE, 14),
  'layer-2': dial(LAYER_ANGLES[2], LAYER_RADIUS, LAYER_DIAL_SIZE, 14),
  'layer-3': dial(LAYER_ANGLES[3], LAYER_RADIUS, LAYER_DIAL_SIZE, 14),
  main: dial(136, 114, MAIN_DIAL_SIZE, 18),
  volume: {
    angle: -156,
    radius: 114,
    shape: 'wheel',
    footprint: WHEEL.diameter / 2,
    height: WHEEL.exposed,
  },
  standby: { angle: 180, radius: 110, shape: 'button', footprint: STANDBY_SIZE / 2, height: 5 },
};

/** Los pilotos de las capas, entre cada dial y el disco; y el de grabar, detrás de su tecla. */
export const PILOTS = {
  radius: 99,
  size: 6,
  recordRadius: 104,
} as const;

/**
 * El brazo: una costilla de alfarero de latón al final de una barra que gira sobre un eje a la
 * derecha. En reposo (sin filtro) mira hacia delante, por fuera; al girar hacia el disco, la
 * costilla se acerca a él y el sonido se oscurece («hacia dentro, más oscura»).
 */
export const ARM = {
  pivotAngle: 84,
  pivotRadius: 132,
  /** Del eje al centro de la costilla. */
  length: 58,
  /** Lo que gira de un extremo a otro, en grados. */
  sweep: 41,
  /** La costilla: una hoja de latón con forma de riñón. */
  ribWidth: 30,
  ribHeight: 18,
  ribThickness: 3,
  /** Radio del eje y alto de la barra sobre la cubierta. */
  pivotSize: 9,
  barHeight: 12,
} as const;

export interface Point {
  readonly x: number;
  readonly z: number;
}

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

/** Un punto polar de la cubierta en mm (x a la derecha, z hacia quien toca). */
export function polar(radius: number, angle: number): Point {
  return { x: radius * Math.sin(rad(angle)), z: radius * Math.cos(rad(angle)) };
}

/**
 * Dirección de la barra del brazo para un valor de 0 (reposo: hacia delante, en tangente) a 1
 * (girado `sweep` grados hacia el disco).
 */
export function armDirection(value: number): Point {
  const a = rad(ARM.pivotAngle);
  const forward = { x: -Math.cos(a), z: Math.sin(a) };
  const inward = { x: -Math.sin(a), z: -Math.cos(a) };
  const turn = rad(ARM.sweep * Math.min(1, Math.max(0, value)));
  return {
    x: forward.x * Math.cos(turn) + inward.x * Math.sin(turn),
    z: forward.z * Math.cos(turn) + inward.z * Math.sin(turn),
  };
}

/** El centro de la costilla del brazo para un valor de 0 a 1. */
export function armHead(value: number): Point {
  const pivot = polar(ARM.pivotRadius, ARM.pivotAngle);
  const direction = armDirection(value);
  return { x: pivot.x + direction.x * ARM.length, z: pivot.z + direction.z * ARM.length };
}

/** El centro de un control sobre la cubierta (el del brazo, en ese valor). */
export function controlCenter(id: ControlId, armValue = 0): Point {
  if (id === 'disc') return { x: 0, z: 0 };
  if (id === 'arm') return armHead(armValue);
  const placement = PLACEMENTS[id];
  return polar(placement.radius, placement.angle);
}
