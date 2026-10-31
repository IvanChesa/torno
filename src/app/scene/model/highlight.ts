/**
 * El anillo de luz del control enfocado o bajo el puntero (PLAN §4.7: el foco y el *hover* del
 * elemento HTML se ven también en 3D). Es un aro fino en la cubierta, alrededor de la huella de la
 * pieza, en el color del foco de la página (`--color-focus`): crema sobre el barro.
 */
import { Mesh, MeshBasicMaterial, TorusGeometry, type BufferGeometry } from 'three';
import {
  ARM,
  armHead,
  DECK_HEIGHT,
  DISC_OUTER_RADIUS,
  KEY,
  PLACEMENTS,
  polar,
  type ControlId,
  type Point,
} from '../../instrument';
import { PALETTE } from '../materials/palette';
import { MM } from './geometry';

/** Lo que se separa el aro de la huella de la pieza, y su grosor, en mm. */
const GAP = 3.5;
const TUBE = 0.65;

/** El radio del aro de cada control, en mm. */
export function highlightRadius(id: ControlId): number {
  switch (id) {
    case 'disc':
      return DISC_OUTER_RADIUS + GAP;
    case 'arm':
      return ARM.ribWidth / 2 + GAP;
    case 'play':
    case 'record':
    case 'undo':
      return Math.hypot(KEY.width / 2, KEY.depth / 2) + 2;
    default:
      return PLACEMENTS[id].footprint + GAP;
  }
}

/** El centro del aro, en mm sobre la cubierta (el del brazo, donde está su costilla). */
export function highlightCenter(id: ControlId, armValue: number): Point {
  if (id === 'disc') return { x: 0, z: 0 };
  if (id === 'arm') return armHead(armValue);
  const placement = PLACEMENTS[id];
  return polar(placement.radius, placement.angle);
}

export class Highlight {
  readonly mesh: Mesh;
  readonly #segments: number;
  #id: ControlId | null = null;
  #radius = 0;

  constructor(segments: number) {
    this.#segments = segments;
    this.mesh = new Mesh(
      new TorusGeometry(1, TUBE * MM, 6, 8),
      new MeshBasicMaterial({ name: 'resaltado', color: PALETTE.focus, toneMapped: false }),
    );
    this.mesh.name = 'resaltado';
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = (DECK_HEIGHT + 0.6) * MM;
    this.mesh.visible = false;
  }

  get id(): ControlId | null {
    return this.#id;
  }

  /** Pone el aro en un control (o lo quita); dice si ha cambiado algo que se ve. */
  set(id: ControlId | null, armValue: number): boolean {
    if (id === null) {
      const changed = this.mesh.visible;
      this.#id = null;
      this.mesh.visible = false;
      return changed;
    }
    const radius = highlightRadius(id);
    const center = highlightCenter(id, armValue);
    const x = center.x * MM;
    const z = center.z * MM;
    const same =
      this.mesh.visible &&
      this.#id === id &&
      this.mesh.position.x === x &&
      this.mesh.position.z === z;
    if (same) return false;
    if (radius !== this.#radius) {
      const old: BufferGeometry = this.mesh.geometry;
      const segments = Math.max(48, Math.round(this.#segments * (radius / 20)));
      this.mesh.geometry = new TorusGeometry(radius * MM, TUBE * MM, 6, Math.min(256, segments));
      old.dispose();
      this.#radius = radius;
    }
    this.#id = id;
    this.mesh.position.x = x;
    this.mesh.position.z = z;
    this.mesh.visible = true;
    return true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}
