/**
 * El plato redondo del instrumento HTML (PLAN fase 5.b; aprobado por Iván en la 5.a): las mismas
 * posiciones que el aparato en 3D (`layout.ts`), en fracciones del radio del cuerpo (de −1 a 1),
 * para colocar cada control con CSS. En la pantalla, x va a la derecha y z hacia abajo (hacia quien
 * toca, como en el aparato visto desde arriba).
 *
 * Quien toca sin WebGL encuentra cada control donde está en el aparato, y la guía (fase 7) puede
 * señalar el mismo sitio en los dos.
 */
import { LAYER_CONTROLS } from './catalog';
import {
  armHead,
  BODY,
  controlCenter,
  DISC_OUTER_RADIUS,
  PLACEMENTS,
  polar,
  WHEEL,
  type PlacedControl,
  type Point,
} from './layout';

/** Un punto del plato, en fracciones del radio del cuerpo. */
export interface PlateSpot {
  readonly x: number;
  readonly z: number;
}

/**
 * Una ranura recta (el brazo y la rueda): su centro, su largo (en fracciones del diámetro del
 * plato), su giro en la pantalla (grados) y hacia dónde sube el valor al arrastrar.
 */
export interface PlateTrack extends PlateSpot {
  readonly length: number;
  readonly angle: number;
  readonly axis: { readonly x: number; readonly y: number };
}

/** Hacia dónde sale el rótulo de su punto: fuera del plato. */
export type LabelSide = 'left' | 'right' | 'top' | 'bottom';

export interface PlateLabel extends PlateSpot {
  readonly side: LabelSide;
}

/** Los rótulos de fuera del plato (en el móvil no caben: van en una leyenda). */
export type PlateLabelId =
  | 'layer-0'
  | 'layer-1'
  | 'layer-2'
  | 'layer-3'
  | 'main'
  | 'volume'
  | 'standby'
  | 'play'
  | 'record'
  | 'undo'
  | 'arm';

/**
 * Los pilotos del plato van más cerca del disco que en el aparato (99 mm): en el móvil, los diales de
 * 44 px llegan más adentro que sus 30 mm, y el anillo de la capa elegida los pisaría. A 89 mm quedan
 * entre el disco (81) y ese anillo, con aire a los dos lados (lo mide un e2e).
 */
export const PLATE_PILOT_RADIUS = 89;
/** A cuánto del canto van los rótulos de fuera, en mm. */
const LABEL_GAP = 14;
/**
 * La ranura del brazo, algo más larga que el recorrido de su costilla, y solo hacia fuera (hacia
 * dentro chocaría con el disco): se agarra mejor.
 */
const ARM_TRACK_EXTRA = 0.3;

const R = BODY.radius;
const spot = ({ x, z }: Point): PlateSpot => ({ x: x / R, z: z / R });

function label(angle: number): PlateLabel {
  const point = spot(polar(R + LABEL_GAP, angle));
  // Arriba o abajo si queda casi en vertical; si no, a un lado.
  const side: LabelSide =
    Math.abs(point.x) < 0.45 ? (point.z < 0 ? 'top' : 'bottom') : point.x < 0 ? 'left' : 'right';
  return { ...point, side };
}

/** Una ranura de `from` (el valor 0) a `to` (el 1), en mm. */
function track(from: Point, to: Point): PlateTrack {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  return {
    x: (from.x + to.x) / 2 / R,
    z: (from.z + to.z) / 2 / R,
    length: length / (2 * R),
    angle: (Math.atan2(dz, dx) * 180) / Math.PI,
    axis: { x: dx / length, y: dz / length },
  };
}

const rest = armHead(0);
const full = armHead(1);
const armStart = {
  x: rest.x + (rest.x - full.x) * ARM_TRACK_EXTRA,
  z: rest.z + (rest.z - full.z) * ARM_TRACK_EXTRA,
};
const volume = PLACEMENTS.volume;
const volumeReach = WHEEL.diameter / 2;

export const PLATE = {
  /** Diámetro del disco (con su anillo), en fracciones del diámetro del plato. */
  disc: DISC_OUTER_RADIUS / R,
  controls: Object.fromEntries(
    (Object.keys(PLACEMENTS) as PlacedControl[]).map((id) => [id, spot(controlCenter(id))]),
  ) as Readonly<Record<PlacedControl, PlateSpot>>,
  pilots: LAYER_CONTROLS.map((id) =>
    spot(polar(PLATE_PILOT_RADIUS, PLACEMENTS[id as PlacedControl].angle)),
  ),
  /** El brazo: del reposo (sin filtro, por fuera) hacia el disco. */
  arm: track(armStart, full),
  /** La rueda: su canto se mueve en radial; más volumen hacia fuera. */
  volume: track(
    polar(volume.radius - volumeReach, volume.angle),
    polar(volume.radius + volumeReach, volume.angle),
  ),
  labels: {
    ...(Object.fromEntries(
      LAYER_CONTROLS.map((id) => [id, label(PLACEMENTS[id as PlacedControl].angle)]),
    ) as Record<'layer-0' | 'layer-1' | 'layer-2' | 'layer-3', PlateLabel>),
    main: label(PLACEMENTS.main.angle),
    volume: label(volume.angle),
    standby: label(PLACEMENTS.standby.angle),
    play: label(PLACEMENTS.play.angle),
    record: label(PLACEMENTS.record.angle),
    undo: label(PLACEMENTS.undo.angle),
    arm: label(72),
  } as Readonly<Record<PlateLabelId, PlateLabel>>,
} as const;
