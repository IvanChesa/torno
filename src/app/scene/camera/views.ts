/**
 * Las vistas y los encuadres del aparato (PLAN fases 5 y 6) y cómo se coloca la cámara: se aleja o
 * se acerca hasta que lo que se encuadra cabe con un margen, en cualquier proporción del lienzo, y
 * se centra en lo que se ve. Entre dos encuadres, la cámara viaja (`blend`).
 */
import { PerspectiveCamera, Sphere, Vector3 } from 'three';
import { rad } from '../model/geometry';
import type { Orbit, Shot, View } from '../options';

/** Desde dónde mira la cámara: acimut (0° delante, positivo a la derecha) y elevación, en grados. */
export interface ViewAngles {
  readonly azimuth: number;
  readonly elevation: number;
}

export const VIEW_ANGLES: Readonly<Record<View, ViewAngles>> = {
  frente: { azimuth: 0, elevation: 40 },
  'tres-cuartos': { azimuth: 38, elevation: 30 },
  // Casi 90°: a 90° justos, la cámara no sabría hacia dónde es «arriba».
  cenital: { azimuth: 0, elevation: 89 },
  perfil: { azimuth: 90, elevation: 10 },
};

/**
 * Los encuadres de «Tocar», en el lienzo ancho (escritorio, 5:4) y en el cuadrado (móvil, 1:1). En
 * el cuadrado, la cámara sube: la cubierta se aplasta menos y las zonas de 44 px de los diales de
 * las capas, que van unos encima de otros, no se pisan (PLAN §4.7).
 */
export const SHOT_ANGLES: Readonly<Record<Shot, { wide: ViewAngles; square: ViewAngles }>> = {
  completo: { wide: VIEW_ANGLES.frente, square: { azimuth: 0, elevation: 64 } },
  capas: { wide: { azimuth: -28, elevation: 52 }, square: { azimuth: -20, elevation: 64 } },
  controles: { wide: { azimuth: 14, elevation: 46 }, square: { azimuth: 10, elevation: 62 } },
};

/** Un lienzo más estrecho que esto (alto contra ancho) es el del móvil: 1:1. */
export const SQUARE_ASPECT = 1.1;

/**
 * El margen alrededor de lo encuadrado (fracción de media pantalla). En el completo del móvil, el
 * aparato llega casi al borde (sin su sombra, que se desvanece justo ahí): con el margen de siempre,
 * en 360 px las zonas de 44 px de la capa 1 y del volumen se pisaban.
 */
export const SHOT_MARGIN = { wide: 0.08, square: 0.02 } as const;

export function shotAngles(shot: Shot, aspect: number): ViewAngles {
  const angles = SHOT_ANGLES[shot];
  return aspect < SQUARE_ASPECT ? angles.square : angles.wide;
}

/** Campo de visión vertical: estrecho, como una foto de producto (poca deformación). */
export const FOV = 30;

/** Dónde está la cámara: el punto al que mira, a qué distancia y desde qué ángulos. */
export interface CameraPlacement {
  readonly target: Vector3;
  readonly distance: number;
  readonly angles: ViewAngles;
}

/** Dirección del centro a la cámara. */
export function viewDirection({ azimuth, elevation }: ViewAngles): Vector3 {
  const a = rad(azimuth);
  const e = rad(elevation);
  return new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

export function place(
  camera: PerspectiveCamera,
  { target, distance, angles }: CameraPlacement,
): void {
  camera.position.copy(target).addScaledVector(viewDirection(angles), distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

const projected = new Vector3();

/**
 * Coloca la cámara mirando desde `angles` hacia los puntos, lo bastante lejos para que todos queden
 * dentro con `margin` (en fracción de media pantalla) y centrados. Devuelve dónde la ha dejado.
 */
export function fit(
  camera: PerspectiveCamera,
  angles: ViewAngles,
  points: readonly Vector3[],
  margin = 0.08,
): CameraPlacement {
  const direction = viewDirection(angles);
  const target = new Vector3();
  for (const point of points) target.add(point);
  target.divideScalar(Math.max(1, points.length));
  let radius = 0;
  for (const point of points) radius = Math.max(radius, point.distanceTo(target));
  let distance = radius / Math.sin(rad(Math.min(camera.fov, horizontalFov(camera)) / 2));
  const right = new Vector3();
  const up = new Vector3();
  // La proyección no es lineal con la distancia: unas pocas vueltas bastan para ajustarla.
  for (let i = 0; i < 8; i++) {
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      projected.copy(point).project(camera);
      minX = Math.min(minX, projected.x);
      maxX = Math.max(maxX, projected.x);
      minY = Math.min(minY, projected.y);
      maxY = Math.max(maxY, projected.y);
    }
    // Centrar: mover el punto de mira lo que se ha desviado el centro de lo que se ve.
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const tanV = Math.tan(rad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    target
      .addScaledVector(right, ((minX + maxX) / 2) * tanH * distance)
      .addScaledVector(up, ((minY + maxY) / 2) * tanV * distance);
    const extent = Math.max((maxX - minX) / 2, (maxY - minY) / 2);
    distance *= extent / (1 - margin);
  }
  const placement = { target, distance, angles };
  place(camera, placement);
  return placement;
}

/**
 * Un encuadre de «Tocar» con la proporción de `camera`: en el lienzo cuadrado del móvil, desde más
 * arriba y, el completo, apurando el aparato sin su sombra.
 */
export function shotPlacement(
  camera: PerspectiveCamera,
  shot: Shot,
  points: Readonly<Record<Shot | 'aparato', readonly Vector3[]>>,
): CameraPlacement {
  const square = camera.aspect < SQUARE_ASPECT;
  const framed = square && shot === 'completo' ? points.aparato : points[shot];
  return fit(
    camera,
    shotAngles(shot, camera.aspect),
    framed,
    square ? SHOT_MARGIN.square : SHOT_MARGIN.wide,
  );
}

/**
 * La esfera de la órbita: la más justa alrededor de los puntos (la de su caja tomaría la diagonal,
 * 227 mm para el aparato con su sombra, y se vería pequeño).
 */
export function orbitSphere(points: readonly Vector3[]): Sphere {
  return new Sphere().setFromPoints([...points]);
}

/**
 * La órbita de «Inspeccionar»: siempre a la misma distancia del centro de la esfera que envuelve el
 * aparato, para que quepa entero desde cualquier lado sin que el tamaño cambie al girar.
 */
export function orbitPlacement(
  camera: PerspectiveCamera,
  orbit: Orbit,
  center: Vector3,
  radius: number,
  margin = 0.04,
): CameraPlacement {
  const half = rad(Math.min(camera.fov, horizontalFov(camera)) / 2);
  return {
    target: center.clone(),
    distance: radius / Math.sin(half) / (1 - margin),
    angles: orbit,
  };
}

/**
 * Un punto del viaje de `from` a `to` (`t` de 0 a 1): el punto de mira en línea recta, la distancia
 * en proporción (sin acelerones al acercarse) y los ángulos por el camino corto.
 */
export function blend(from: CameraPlacement, to: CameraPlacement, t: number): CameraPlacement {
  let azimuth = to.angles.azimuth - from.angles.azimuth;
  if (azimuth > 180) azimuth -= 360;
  if (azimuth < -180) azimuth += 360;
  return {
    target: from.target.clone().lerp(to.target, t),
    distance: from.distance * Math.pow(to.distance / from.distance, t),
    angles: {
      azimuth: from.angles.azimuth + azimuth * t,
      elevation: from.angles.elevation + (to.angles.elevation - from.angles.elevation) * t,
    },
  };
}

/** Acelera y frena (cúbica). */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function horizontalFov(camera: PerspectiveCamera): number {
  return (2 * Math.atan(Math.tan(rad(camera.fov / 2)) * camera.aspect) * 180) / Math.PI;
}
