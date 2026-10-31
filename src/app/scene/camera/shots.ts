/**
 * Lo que encuadra cada encuadre (PLAN fase 6): la silueta del aparato con su sombra, y los puntos de
 * los de cerca de «Tocar». Se toman una vez, al construir el aparato.
 */
import { Box3, Vector3, type Mesh } from 'three';
import { BODY, LAYER_CONTROLS, type ControlId } from '../../instrument';
import { MM } from '../model/geometry';
import type { InstrumentModel } from '../model/instrument';
import type { Shot } from '../options';
import { corners, type ControlShape } from '../projection';

/**
 * Radio de la sombra de contacto, en mm: se desvanece del todo 8 mm más allá del canto del cuerpo, y
 * el encuadre la incluye entera (antes, el lienzo la cortaba en recto: revisión de la fase 5, #2).
 */
export const SHADOW_RADIUS = BODY.radius + 8;
/** Puntos del borde de la sombra que entran en la silueta del encuadre. */
const SHADOW_RING_POINTS = 48;
/** Cada cuántos vértices se toma uno para la silueta del encuadre. */
const SILHOUETTE_STEP = 5;
/** Lo que se separan los encuadres de cerca de las piezas que encuadran, en mm. */
const SHOT_MARGIN_MM = 12;

/** El borde de la sombra de contacto, en la mesa: el encuadre la deja entera dentro del lienzo. */
export function shadowRing(): Vector3[] {
  return Array.from({ length: SHADOW_RING_POINTS }, (_, i) => {
    const angle = (2 * Math.PI * i) / SHADOW_RING_POINTS;
    return new Vector3(
      SHADOW_RADIUS * MM * Math.sin(angle),
      0,
      SHADOW_RADIUS * MM * Math.cos(angle),
    );
  });
}

/** Unos cuantos vértices de todo el aparato, en coordenadas de la escena: su silueta. */
export function silhouette(model: InstrumentModel): Vector3[] {
  const points: Vector3[] = [];
  model.root.updateMatrixWorld(true);
  model.root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += SILHOUETTE_STEP) {
      points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    }
  });
  return points;
}

/**
 * Lo que encuadra cada encuadre de «Tocar»: el aparato entero (`outline`); los diales de las capas
 * con sus pilotos; o las teclas, el disco y todo el recorrido del brazo. Con un margen alrededor de
 * cada pieza, para que los rótulos de la cubierta entren.
 */
export function shotPoints(
  model: InstrumentModel,
  shapes: readonly ControlShape[],
  outline: readonly Vector3[],
): Record<Shot | 'aparato', Vector3[]> {
  const margin = new Vector3(SHOT_MARGIN_MM * MM, 0, SHOT_MARGIN_MM * MM);
  const around = (ids: readonly ControlId[]) =>
    ids.flatMap((id) =>
      corners(new Box3().setFromObject(model.controls.get(id)!).expandByVector(margin)),
    );
  const arm = shapes.find((shape) => shape.id === 'arm')?.points ?? [];
  return {
    completo: [...outline],
    // El aparato sin su sombra: el encuadre completo del móvil, que lo apura hasta los bordes.
    aparato: silhouette(model),
    capas: [...around(LAYER_CONTROLS), ...model.pilots.map((pilot) => pilot.position.clone())],
    controles: [...around(['play', 'record', 'undo', 'disc']), ...arm],
  };
}
