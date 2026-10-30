import { readFileSync } from 'node:fs';
import { Box3, BufferGeometry, Mesh, Vector3, type Material } from 'three';
import { describe, expect, it } from 'vitest';
import { BODY, CONTROLS, DECK_HEIGHT, TRAY } from '../../instrument';
import { disposeObject } from '../dispose';
import { applyVariant, createMaterials } from '../materials/materials';
import { VARIANT_SPECS, VARIANTS } from '../materials/variants';
import { latheSector, MM, profilePoints, rad } from './geometry';
import { buildInstrument } from './instrument';

const meshes = (root: import('three').Object3D) => {
  const list: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh) list.push(object as Mesh);
  });
  return list;
};

/** La normal (media) de los vértices de una geometría que cumplen una condición. */
function normalWhere(geometry: BufferGeometry, test: (p: Vector3) => boolean): Vector3 {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const sum = new Vector3();
  const p = new Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    if (test(p)) sum.add(new Vector3().fromBufferAttribute(normal, i));
  }
  return sum.normalize();
}

describe('perfiles torneados', () => {
  it('redondea las esquinas (si no caben dos, el pequeño se respeta) y duplica las aristas vivas', () => {
    const points = profilePoints(
      [
        [0, 0],
        [10, 0, 2],
        [10, 10, 50],
        [0, 10],
      ],
      { segments: 4 },
    );
    // Extremos, 5 puntos por cada arco.
    expect(points).toHaveLength(2 + 5 + 5);
    // El primer arco empieza a 2 mm de la esquina (radio 2 en un ángulo recto).
    expect(points[1]!.x / MM).toBeCloseTo(8, 6);
    // El segundo, con un radio enorme, se queda con lo que le deja el primero en el lado común.
    expect(points[6]!.y / MM).toBeCloseTo(2, 6);
    expect(points[10]!.x / MM).toBeCloseTo(2, 6);
    const sharp = profilePoints([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(sharp).toHaveLength(4);
    expect(sharp[1]!.equals(sharp[2]!)).toBe(true);
  });

  it('un perfil cerrado vuelve a su primer punto', () => {
    const points = profilePoints(
      [
        [10, 0],
        [12, 0],
        [12, 4],
        [10, 4],
      ],
      { closed: true },
    );
    expect(points.at(-1)!.equals(points[0]!)).toBe(true);
  });

  it('un sector cerrado tiene sus dos tapas mirando hacia fuera', () => {
    const points = profilePoints(
      [
        [12, 0],
        [12, 4],
        [10, 4],
        [10, 0],
      ],
      { closed: true },
    );
    const geometry = latheSector(points, 16, 150, 210);
    // Cerca de cada extremo, la media de las normales apunta fuera del sector.
    const atAngle = (degrees: number) => (p: Vector3) =>
      Math.abs(Math.atan2(p.x, p.z) - Math.atan2(Math.sin(rad(degrees)), Math.cos(rad(degrees)))) <
      1e-6;
    const start = normalWhere(geometry, atAngle(150));
    const end = normalWhere(geometry, atAngle(210));
    const tangent = (degrees: number) =>
      new Vector3(Math.cos(rad(degrees)), 0, -Math.sin(rad(degrees)));
    expect(start.dot(tangent(150))).toBeLessThan(-0.3);
    expect(end.dot(tangent(210))).toBeGreaterThan(0.3);
    geometry.dispose();
  });
});

describe('el aparato en bloques', () => {
  const materials = createMaterials('terracota');
  const model = buildInstrument(materials);
  model.root.updateMatrixWorld(true);

  it('mide lo que dice instrument/layout: Ø 300 mm y la bandeja como lo más alto', () => {
    const bounds = new Box3().setFromObject(model.root);
    const body = meshes(model.root).find((mesh) => mesh.name === 'cuerpo')!;
    const bodyBounds = new Box3().setFromObject(body);
    expect(bodyBounds.max.x).toBeCloseTo(BODY.radius * MM, 3);
    expect(bodyBounds.min.z).toBeCloseTo(-BODY.radius * MM, 3);
    expect(bodyBounds.max.y).toBeCloseTo(DECK_HEIGHT * MM, 4);
    expect(bounds.min.y).toBeCloseTo(0, 4);
    expect(bounds.max.y).toBeCloseTo((DECK_HEIGHT + TRAY.height) * MM, 3);
    // Lo único que asoma por fuera del cuerpo es la costilla del brazo en reposo.
    expect(bounds.max.x).toBeLessThan((BODY.radius + 12) * MM);
    expect(bounds.min.x).toBeGreaterThan(-BODY.radius * MM - 1e-6);
  });

  it('las caras del cuerpo miran hacia fuera: la cubierta hacia arriba y la pared hacia fuera', () => {
    const body = meshes(model.root).find((mesh) => mesh.name === 'cuerpo')!.geometry;
    const deck = normalWhere(
      body,
      (p) => Math.abs(p.y - DECK_HEIGHT * MM) < 1e-6 && Math.hypot(p.x, p.z) < 0.1,
    );
    expect(deck.y).toBeGreaterThan(0.99);
    // En la pared, cada normal apunta hacia fuera (con la componente radial).
    const position = body.getAttribute('position');
    const normal = body.getAttribute('normal');
    let checked = 0;
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i);
      const r = Math.hypot(p.x, p.z);
      if (r < 0.145 || p.y < 0.015 || p.y > (DECK_HEIGHT - BODY.edgeRadius) * MM) continue;
      const n = new Vector3().fromBufferAttribute(normal, i);
      expect((n.x * p.x + n.z * p.z) / r).toBeGreaterThan(0.85);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('cada control del catálogo tiene su pieza, y hay pantalla y rótulos', () => {
    for (const spec of CONTROLS) expect(model.controls.has(spec.id), spec.id).toBe(true);
    expect(model.screen.name).toBe('pantalla');
    expect([...model.labels.keys()].sort()).toEqual(['play', 'record', 'standby', 'undo']);
  });

  it('cambiar de variante solo cambia colores y rugosidad', () => {
    for (const variant of VARIANTS) {
      applyVariant(materials, variant);
      expect(`#${materials.body.color.getHexString()}`).toBe(VARIANT_SPECS[variant].body);
      expect(`#${materials.glaze.color.getHexString()}`).toBe(VARIANT_SPECS[variant].glaze);
      expect(materials.brass.roughness).toBe(VARIANT_SPECS[variant].brassRoughness);
    }
  });

  it('la variante Terracota es la de tokens.css (la fuente de los colores, DISENO.md)', () => {
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    const token = (name: string) =>
      new RegExp(`--instrument-${name}:\\s*(#[0-9a-f]{6})`).exec(tokens)?.[1];
    const terracota = VARIANT_SPECS.terracota;
    expect(terracota.body).toBe(token('body'));
    expect(terracota.glaze).toBe(token('glaze'));
    expect(terracota.brass).toBe(token('brass'));
    expect(terracota.key).toBe(token('key'));
  });

  it('dispose libera cada geometría y cada material una vez', () => {
    const fresh = buildInstrument(createMaterials('barro-oscuro'));
    const geometries = new Set<BufferGeometry>();
    const used = new Set<Material>();
    for (const mesh of meshes(fresh.root)) {
      geometries.add(mesh.geometry);
      used.add(mesh.material as Material);
    }
    let disposed = 0;
    for (const item of [...geometries, ...used]) item.addEventListener('dispose', () => disposed++);
    disposeObject(fresh.root);
    expect(disposed).toBe(geometries.size + used.size);
    expect(geometries.size).toBeGreaterThan(30);
  });
});
