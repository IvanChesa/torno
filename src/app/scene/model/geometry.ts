/**
 * Geometría torneada: casi todo Torno sale de un perfil que gira alrededor de un eje vertical, como
 * en un torno de verdad (`LatheGeometry`). Los perfiles se escriben en mm, como `instrument/layout`,
 * y aquí pasan a metros, la unidad de la escena.
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** La escena va en metros; las medidas, en mm. */
export const MM = 0.001;

/** Grados a radianes. */
export const rad = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Un vértice de un perfil (r, y) en mm, con el radio del redondeo de esa esquina (0: arista viva).
 *
 * El perfil se recorre dejando el exterior de la pieza **a la derecha** (con r hacia la derecha e y
 * hacia arriba): la base de dentro afuera, la pared hacia arriba y la tapa de fuera adentro. Así las
 * caras de `LatheGeometry` miran hacia fuera.
 */
export type ProfilePoint = readonly [r: number, y: number, round?: number];

/**
 * Convierte un perfil con esquinas redondeadas en puntos (en metros). Cada esquina con radio se
 * cambia por un arco tangente a sus dos lados; si dos redondeos no caben en el lado que comparten,
 * el pequeño se queda como está (hasta la mitad del lado) y el grande, con lo que sobra. Cada arista
 * viva se duplica, para que el sombreado no la suavice. Los extremos se quedan como están. Con
 * `closed`, el perfil vuelve a su primer punto, que tiene que ser una arista viva.
 */
export function profilePoints(
  profile: readonly ProfilePoint[],
  { closed = false, segments = 6 }: { closed?: boolean; segments?: number } = {},
): Vector2[] {
  const n = profile.length;
  const point = (i: number) => {
    const [r, y] = profile[(i + n) % n]!;
    return new Vector2(r, y);
  };
  // El primero de un perfil cerrado también es un extremo: el último punto lo repite.
  const isEnd = (i: number) => i === 0 || (!closed && i === n - 1);
  const corners = profile.map((entry, i) => {
    const corner = point(i);
    const u = point(i - 1)
      .sub(corner)
      .normalize();
    const v = point(i + 1)
      .sub(corner)
      .normalize();
    const half = Math.acos(Math.min(1, Math.max(-1, u.dot(v)))) / 2;
    // Sin esquina de verdad (lados en línea o vuelta atrás), nada que redondear.
    const straight = half < 1e-3 || Math.PI / 2 - half < 1e-3;
    const round = entry[2] ?? 0;
    const wanted = isEnd(i) || straight || round <= 0 ? 0 : round / Math.tan(half);
    return { corner, u, v, half, straight, wanted };
  });
  // Lo que el redondeo de `i` se puede comer del lado que comparte con `j`.
  const allowed = (i: number, j: number) => {
    const mine = corners[(i + n) % n]!.wanted;
    const theirs = corners[(j + n) % n]!.wanted;
    const length = point(i).distanceTo(point(j));
    if (mine + theirs <= length) return mine;
    return mine <= theirs ? Math.min(mine, length / 2) : length - Math.min(theirs, length / 2);
  };
  const out: Vector2[] = [];
  corners.forEach(({ corner, u, v, half, straight, wanted }, i) => {
    if (isEnd(i) || straight) {
      out.push(corner);
      return;
    }
    if (wanted === 0) {
      out.push(corner, corner.clone());
      return;
    }
    const reach = Math.min(allowed(i, i - 1), allowed(i, i + 1));
    const radius = reach * Math.tan(half);
    const start = corner.clone().addScaledVector(u, reach);
    const end = corner.clone().addScaledVector(v, reach);
    const center = corner
      .clone()
      .addScaledVector(u.clone().add(v).normalize(), radius / Math.sin(half));
    const a0 = Math.atan2(start.y - center.y, start.x - center.x);
    let sweep = Math.atan2(end.y - center.y, end.x - center.x) - a0;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const a = a0 + (sweep * s) / segments;
      out.push(new Vector2(center.x + radius * Math.cos(a), center.y + radius * Math.sin(a)));
    }
  });
  if (closed) out.push(out[0]!.clone());
  return out.map((p) => p.multiplyScalar(MM));
}

/** Una pieza torneada entera (o un sector, entre dos ángulos en grados, 0° delante). */
export function lathe(points: Vector2[], segments: number, from = 0, to = 360): LatheGeometry {
  return new LatheGeometry(points, segments, rad(from), rad(to - from));
}

/**
 * Cómo se reparte una textura en mosaico sobre un torneado: `uRepeat` veces alrededor (entero en una
 * pieza entera, para que no se note la junta) y, a lo largo del perfil, una vez cada `tile` metros.
 */
export interface LatheTiling {
  readonly uRepeat: number;
  readonly tile: number;
}

/**
 * Las coordenadas de textura de un torneado, proporcionales a lo que mide el perfil (las de
 * `LatheGeometry` reparten la v por puntos, no por longitud, y el mosaico se estiraría).
 */
export function tileLathe(
  geometry: BufferGeometry,
  points: readonly Vector2[],
  segments: number,
  { uRepeat, tile }: LatheTiling,
): void {
  const lengths = [0];
  for (let j = 1; j < points.length; j++) {
    lengths.push(lengths[j - 1]! + points[j]!.distanceTo(points[j - 1]!));
  }
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j < points.length; j++) {
      uv.setXY(i * points.length + j, (i / segments) * uRepeat, lengths[j]! / tile);
    }
  }
  uv.needsUpdate = true;
}

/** Un color por vértice (gris: multiplica el del material), según su posición en metros. */
export function shade(
  geometry: BufferGeometry,
  factor: (x: number, y: number, z: number) => number,
): BufferGeometry {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(3 * position.count);
  for (let i = 0; i < position.count; i++) {
    const value = factor(position.getX(i), position.getY(i), position.getZ(i));
    colors[3 * i] = value;
    colors[3 * i + 1] = value;
    colors[3 * i + 2] = value;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Un sector torneado cerrado: el torneado entre dos ángulos y sus dos tapas (la sección del perfil,
 * que tiene que ser cerrado). La tapa del principio mira hacia los ángulos menores; la del final,
 * hacia los mayores.
 */
export function latheSector(
  points: Vector2[],
  segments: number,
  from: number,
  to: number,
  tiling?: LatheTiling,
): BufferGeometry {
  const body = lathe(points, segments, from, to);
  const caps = [cap(points, rad(from), false), cap(points, rad(to), true)];
  if (tiling) {
    tileLathe(body, points, segments, tiling);
    // Las tapas llevan de coordenadas su sección (r, y) en metros: al mismo mosaico.
    for (const geometry of caps) {
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, uv.getX(i) / tiling.tile, uv.getY(i) / tiling.tile);
    }
  }
  const merged = mergeGeometries([body, ...caps]);
  body.dispose();
  for (const geometry of caps) geometry.dispose();
  if (!merged) throw new Error('No se pudo unir el sector torneado');
  return merged;
}

/** La tapa plana de un sector: la sección (r, y) llevada al plano vertical de ese ángulo. */
function cap(points: Vector2[], phi: number, flip: boolean): BufferGeometry {
  const outline = points.slice(0, -1);
  const shape = new ShapeGeometry(new Shape(outline));
  const position = shape.getAttribute('position');
  const normal = shape.getAttribute('normal');
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  // La tangente hacia los ángulos mayores es (cos, 0, −sen). La forma, que mira hacia +z en su
  // plano, queda mirando hacia los ángulos menores (−tangente).
  const facing = flip ? 1 : -1;
  for (let i = 0; i < position.count; i++) {
    const r = position.getX(i);
    const y = position.getY(i);
    position.setXYZ(i, r * sin, y, r * cos);
    normal.setXYZ(i, facing * cos, 0, -facing * sin);
  }
  if (flip) {
    const index = shape.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, a);
    }
  }
  return shape;
}
