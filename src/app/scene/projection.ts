/**
 * Los controles en la pantalla (PLAN §4.7, D10): de cada pieza, unos puntos de su contorno en la
 * escena y la dirección en la que sube su valor al arrastrarla; con la cámara, su caja y su eje en
 * píxeles CSS del lienzo. La capa de controles pone encima de cada caja su elemento HTML.
 *
 * El contorno es la cara que se toca, la de arriba de cada pieza, y sale de las medidas de
 * `instrument/layout.ts`: un círculo en las redondas (diales, disco y reposo) y un rectángulo girado
 * como la pieza en las teclas y la ranura de la rueda. Con toda la pieza (o su caja en la escena,
 * alineada con los ejes), las zonas de las de detrás se montaban en el disco, que es más bajo. Las
 * piezas giran sobre su eje y las teclas bajan 2 mm: su contorno no cambia. El brazo se mueve: su
 * zona es todo el recorrido de la costilla.
 */
import { Box3, Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three';
import {
  ARM,
  armDirection,
  armHead,
  CONTROLS,
  DECK_HEIGHT,
  DISC,
  KEY,
  PLACEMENTS,
  polar,
  WHEEL,
  type ControlId,
} from '../instrument';
import { MM } from './model/geometry';
import type { InstrumentModel } from './model/instrument';
import type { ControlBox } from './options';

export interface ControlShape {
  readonly id: ControlId;
  /** El contorno de la pieza (o de su recorrido), en la escena. */
  readonly points: readonly Vector3[];
  /** Encima de la pieza, en su centro: hacia ahí va el rayo que dice si se ve. */
  readonly top: Vector3;
  /** De dónde a dónde sube su valor al arrastrarla, en la escena; `null`: hacia arriba. */
  readonly axis: readonly [Vector3, Vector3] | null;
  readonly piece: Object3D;
}

/** Valores del brazo en los que se toma la costilla para su zona. */
const ARM_SAMPLES = 5;
/** Puntos del contorno de una pieza redonda (en su base y en su cima). */
const CIRCLE_POINTS = 32;

const deckPoint = (x: number, z: number, height: number) =>
  new Vector3(x * MM, (DECK_HEIGHT + height) * MM, z * MM);

export function corners(box: Box3): Vector3[] {
  const { min, max } = box;
  const points: Vector3[] = [];
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) points.push(new Vector3(x, y, z));
    }
  }
  return points;
}

/** Un círculo (centro y radio en mm) a una altura sobre la cubierta: la cara de una pieza redonda. */
function circle(x: number, z: number, radius: number, height: number): Vector3[] {
  return Array.from({ length: CIRCLE_POINTS }, (_, i) => {
    const angle = (2 * Math.PI * i) / CIRCLE_POINTS;
    return deckPoint(x + radius * Math.sin(angle), z + radius * Math.cos(angle), height);
  });
}

/** Un rectángulo girado `angle` grados (como la pieza), de `width` por `depth` mm, a una altura. */
function turnedRectangle(
  x: number,
  z: number,
  angle: number,
  width: number,
  depth: number,
  height: number,
): Vector3[] {
  const a = (angle * Math.PI) / 180;
  const points: Vector3[] = [];
  for (const u of [-width / 2, width / 2]) {
    for (const v of [-depth / 2, depth / 2]) {
      // En su sistema, u va a lo ancho (tangente) y v hacia fuera (radial).
      const px = x + u * Math.cos(a) + v * Math.sin(a);
      const pz = z - u * Math.sin(a) + v * Math.cos(a);
      points.push(deckPoint(px, pz, height));
    }
  }
  return points;
}

/** El contorno y el eje de cada control, en el orden del catálogo. */
export function controlShapes(model: InstrumentModel): ControlShape[] {
  return CONTROLS.map(({ id }) => {
    const piece = model.controls.get(id)!;
    if (id === 'arm') return armShape(piece);
    if (id === 'disc') {
      const top = DISC.gap + DISC.thickness;
      return {
        id,
        // La cara esmaltada, sin el anillo de latón: así su zona no llega a la del reposo, que está
        // justo detrás y más baja.
        points: circle(0, 0, DISC.radius, top),
        top: deckPoint(0, DISC.markRadius / 2, top),
        axis: null,
        piece,
      };
    }
    const { radius, angle, shape, footprint, height } = PLACEMENTS[id];
    const center = polar(radius, angle);
    const top = deckPoint(center.x, center.z, height);
    if (id === 'volume') {
      // El canto de la rueda se mueve en radial: más volumen hacia fuera (como en el plato HTML).
      const reach = WHEEL.diameter / 2;
      const inner = polar(radius - reach, angle);
      const outer = polar(radius + reach, angle);
      return {
        id,
        points: turnedRectangle(
          center.x,
          center.z,
          angle,
          WHEEL.width + 4,
          WHEEL.diameter + 4,
          height,
        ),
        top,
        axis: [deckPoint(inner.x, inner.z, height), deckPoint(outer.x, outer.z, height)],
        piece,
      };
    }
    const points =
      shape === 'key'
        ? turnedRectangle(center.x, center.z, angle, KEY.width, KEY.depth, KEY.height)
        : circle(center.x, center.z, footprint, height);
    return { id, points, top, axis: null, piece };
  });
}

/** El brazo: la costilla en todo su recorrido, del reposo (sin filtro) hacia el disco. */
function armShape(piece: Object3D): ControlShape {
  const points: Vector3[] = [];
  const half = ARM.ribWidth / 2;
  const low = ARM.barHeight - ARM.ribHeight / 2;
  const high = ARM.barHeight + ARM.ribHeight / 2;
  for (let i = 0; i < ARM_SAMPLES; i++) {
    const value = i / (ARM_SAMPLES - 1);
    const head = armHead(value);
    const direction = armDirection(value);
    for (const along of [-half, half]) {
      const x = head.x + direction.x * along;
      const z = head.z + direction.z * along;
      points.push(deckPoint(x, z, low), deckPoint(x, z, high));
    }
  }
  const start = armHead(0);
  const end = armHead(1);
  const middle = armHead(0.5);
  return {
    id: 'arm',
    points,
    top: deckPoint(middle.x, middle.z, high),
    axis: [deckPoint(start.x, start.z, ARM.barHeight), deckPoint(end.x, end.z, ARM.barHeight)],
    piece,
  };
}

const ndc = new Vector3();
const ray = new Vector2();

/** Un punto de la escena en píxeles CSS del lienzo (y hacia abajo). */
function toScreen(point: Vector3, camera: Camera, width: number, height: number) {
  ndc.copy(point).project(camera);
  return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height, z: ndc.z };
}

/** Lo que dice si un control se ve: un rayo desde la cámara hasta encima de la pieza. */
export interface Occlusion {
  readonly raycaster: Raycaster;
  readonly root: Object3D;
}

/**
 * Las cajas de los controles con esta cámara. Con `occlusion`, un control que tapa otra pieza (el
 * primer choque del rayo no es suyo) o que queda fuera del lienzo no se ve.
 */
export function projectControls(
  shapes: readonly ControlShape[],
  camera: Camera,
  width: number,
  height: number,
  occlusion: Occlusion | null = null,
): ControlBox[] {
  camera.updateMatrixWorld();
  return shapes.map((shape) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of shape.points) {
      const p = toScreen(point, camera, width, height);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    let axis = { x: 0, y: -1 };
    if (shape.axis) {
      const from = toScreen(shape.axis[0], camera, width, height);
      const to = toScreen(shape.axis[1], camera, width, height);
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (length > 1e-6) axis = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    }
    const x = (minX + maxX) / 2;
    const y = (minY + maxY) / 2;
    const inside = x >= 0 && x <= width && y >= 0 && y <= height;
    return {
      id: shape.id,
      x,
      y,
      width: maxX - minX,
      height: maxY - minY,
      axis,
      visible: inside && (!occlusion || unobstructed(shape, camera, occlusion)),
    };
  });
}

function unobstructed(
  shape: ControlShape,
  camera: Camera,
  { raycaster, root }: Occlusion,
): boolean {
  ndc.copy(shape.top).project(camera);
  ray.set(ndc.x, ndc.y);
  raycaster.setFromCamera(ray, camera);
  const [first] = raycaster.intersectObject(root, true);
  if (!first) return true;
  // La pieza misma (o algo suyo), o un choque a menos de 1 mm de su cima: se ve.
  let object: Object3D | null = first.object;
  while (object) {
    if (object === shape.piece) return true;
    object = object.parent;
  }
  return first.distance >= raycaster.ray.origin.distanceTo(shape.top) - MM;
}
