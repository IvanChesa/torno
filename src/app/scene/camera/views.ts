/**
 * Las vistas del aparato (PLAN fase 5: el encuadre del escenario y las capturas de 4 ángulos) y el
 * encuadre: la cámara se aleja o se acerca hasta que el aparato entero cabe con un margen, en
 * cualquier proporción de la pantalla, y se centra en lo que se ve (la bandeja de detrás lo
 * descentra un poco).
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { rad } from '../model/geometry';
import type { View } from '../options';

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

/** Campo de visión vertical: estrecho, como una foto de producto (poca deformación). */
export const FOV = 30;

/** Dirección del centro a la cámara. */
export function viewDirection({ azimuth, elevation }: ViewAngles): Vector3 {
  const a = rad(azimuth);
  const e = rad(elevation);
  return new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

const projected = new Vector3();

/**
 * Coloca la cámara mirando desde `angles` hacia los puntos (la silueta del aparato), lo bastante
 * lejos para que todos queden dentro con `margin` (en fracción de media pantalla) y centrados.
 * Devuelve el punto al que mira.
 */
export function frame(
  camera: PerspectiveCamera,
  angles: ViewAngles,
  points: readonly Vector3[],
  margin = 0.08,
): Vector3 {
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
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return target;
}

function horizontalFov(camera: PerspectiveCamera): number {
  return (2 * Math.atan(Math.tan(rad(camera.fov / 2)) * camera.aspect) * 180) / Math.PI;
}
