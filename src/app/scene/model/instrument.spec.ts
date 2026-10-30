import { readFileSync } from 'node:fs';
import {
  Box3,
  BufferGeometry,
  Mesh,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { describe, expect, it } from 'vitest';
import {
  armHead,
  BODY,
  CONTROLS,
  DECK_HEIGHT,
  initialState,
  instrumentPose,
  LAYER_CONTROLS,
  PLACEMENTS,
  polar,
  TRAY,
  displayModel,
  type InstrumentPose,
  type PlacedControl,
} from '../../instrument';
import { disposeObject } from '../dispose';
import { createMaterials, materialList, materialTextures } from '../materials/materials';
import { PALETTE } from '../materials/palette';
import { QUALITY } from '../quality';
import { latheSector, MM, profilePoints, rad } from './geometry';
import { buildInstrument, CERAMIC_TILE_MM, type InstrumentModel } from './instrument';
import { applyPose, dialAngle, KEY_TRAVEL } from './pose';

const meshes = (root: Object3D) => {
  const list: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh) list.push(object as Mesh);
  });
  return list;
};

const named = (model: InstrumentModel, name: string) =>
  meshes(model.root).find((mesh) => mesh.name === name)!;

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

describe('el aparato', () => {
  const materials = createMaterials({ grainSize: 64 });
  const model = buildInstrument(materials, QUALITY.medium);
  model.root.updateMatrixWorld(true);

  it('mide lo que dice instrument/layout: Ø 300 mm y la bandeja como lo más alto', () => {
    const bounds = new Box3().setFromObject(model.root);
    const bodyBounds = new Box3().setFromObject(named(model, 'cuerpo'));
    expect(bodyBounds.max.x).toBeCloseTo(BODY.radius * MM, 3);
    expect(bodyBounds.min.z).toBeCloseTo(-BODY.radius * MM, 3);
    expect(bodyBounds.max.y).toBeCloseTo(DECK_HEIGHT * MM, 4);
    expect(bounds.min.y).toBeCloseTo(0, 4);
    expect(bounds.max.y).toBeCloseTo((DECK_HEIGHT + TRAY.height) * MM, 3);
    // Lo único que asoma por fuera del cuerpo es la costilla del brazo en reposo.
    expect(bounds.max.x).toBeLessThan((BODY.radius + 12) * MM);
    expect(bounds.min.x).toBeGreaterThan(-BODY.radius * MM - 1e-6);
  });

  it('las caras miran hacia fuera: la cubierta hacia arriba y la pared hacia fuera', () => {
    const deck = named(model, 'cubierta');
    const up = new Vector3(0, 0, 1).applyQuaternion(deck.quaternion);
    expect(up.y).toBeGreaterThan(0.999);
    expect(deck.position.y).toBeCloseTo(DECK_HEIGHT * MM, 6);
    // En la pared del cuerpo, cada normal apunta hacia fuera (con la componente radial).
    const body = named(model, 'cuerpo').geometry;
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

  it('la cerámica va en mosaico sin estirarse: u da vueltas enteras y v sigue al perfil en mm', () => {
    const uv = named(model, 'cuerpo').geometry.getAttribute('uv');
    let maxU = 0;
    let maxV = 0;
    for (let i = 0; i < uv.count; i++) {
      maxU = Math.max(maxU, uv.getX(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    // Vueltas enteras alrededor (sin junta) y, a lo alto, lo que mide el perfil entre el mosaico.
    expect(maxU).toBe(Math.round((2 * Math.PI * BODY.radius) / CERAMIC_TILE_MM));
    expect(maxV * CERAMIC_TILE_MM).toBeGreaterThan(BODY.height);
    expect(maxV * CERAMIC_TILE_MM).toBeLessThan(BODY.height + BODY.radius - BODY.baseRadius + 10);
  });

  it('cada pieza de un material con colores por vértice los tiene (si no, saldría negra)', () => {
    for (const mesh of meshes(model.root)) {
      if ((mesh.material as Material).vertexColors) {
        expect(mesh.geometry.getAttribute('color'), mesh.name).toBeDefined();
      }
    }
  });

  it('el esmalte se oscurece hacia el borde', () => {
    const glaze = named(model, 'esmalte').geometry;
    const position = glaze.getAttribute('position');
    const color = glaze.getAttribute('color');
    let center = 0;
    let edge = 1;
    for (let i = 0; i < position.count; i++) {
      const r = Math.hypot(position.getX(i), position.getZ(i)) / MM;
      if (r < 1) center = Math.max(center, color.getX(i));
      if (r > 74) edge = Math.min(edge, color.getX(i));
    }
    expect(center).toBe(1);
    expect(edge).toBeLessThan(0.85);
  });

  it('cada control del catálogo tiene su pieza, y hay pantalla, cubierta impresa y rótulos', () => {
    for (const spec of CONTROLS) expect(model.controls.has(spec.id), spec.id).toBe(true);
    expect(model.screen.name).toBe('pantalla');
    expect(model.print.name).toBe('cubierta impresa');
    expect([...model.labels.keys()].sort()).toEqual(['play', 'record', 'standby', 'undo']);
    expect(model.pilots).toHaveLength(4);
  });

  it('la paleta es la de tokens.css (la fuente de los colores, DISENO.md)', () => {
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(tokens)?.[1];
    expect(PALETTE.body).toBe(token('instrument-body'));
    expect(PALETTE.glaze).toBe(token('instrument-glaze'));
    expect(PALETTE.brass).toBe(token('instrument-brass'));
    expect(PALETTE.key).toBe(token('instrument-key'));
    expect(PALETTE.ledRecord).toBe(token('instrument-led-rec'));
    expect(PALETTE.screen).toBe(token('color-screen'));
    expect(PALETTE.phosphor).toBe(token('color-phosphor'));
    expect(PALETTE.warning).toBe(token('color-warning'));
    expect(PALETTE.ink).toBe(token('color-bg'));
  });

  it('a más calidad, más segmentos: el alto tiene más triángulos que el bajo, con las mismas piezas', () => {
    const triangles = (level: 'low' | 'high') => {
      const built = buildInstrument(createMaterials({ grainSize: 16 }), QUALITY[level]);
      const names = meshes(built.root).map((mesh) => mesh.name);
      let count = 0;
      for (const mesh of meshes(built.root)) {
        const geometry = mesh.geometry;
        count += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
      }
      disposeObject(built.root);
      return { count, names };
    };
    const low = triangles('low');
    const high = triangles('high');
    expect(high.names).toEqual(low.names);
    expect(high.count).toBeGreaterThan(1.5 * low.count);
  });

  it('dispose libera cada geometría, cada material y cada textura una vez', () => {
    const freshMaterials = createMaterials({ grainSize: 16 });
    const fresh = buildInstrument(freshMaterials, QUALITY.low);
    const geometries = new Set<BufferGeometry>();
    for (const mesh of meshes(fresh.root)) geometries.add(mesh.geometry);
    const textures = materialTextures(freshMaterials);
    let disposed = 0;
    for (const item of [...geometries, ...textures]) {
      item.addEventListener('dispose', () => disposed++);
    }
    disposeObject(fresh.root, materialList(freshMaterials));
    expect(disposed).toBe(geometries.size + textures.length);
    expect(textures.length).toBe(4);
    expect(geometries.size).toBeGreaterThan(30);
  });
});

describe('la pose en el modelo', () => {
  const materials = createMaterials({ grainSize: 16 });
  const model = buildInstrument(materials, QUALITY.low);
  const state = initialState();
  const audio = {
    transport: 'stopped' as const,
    recording: 'idle' as const,
    recordLayer: -1,
    standby: false,
    layers: Array.from({ length: 4 }, () => ({
      hasContent: false,
      source: 'empty' as const,
      soundId: '',
      pending: false,
      undo: 0,
      redo: 0,
      lengthBeats: 0,
      positionBeats: 0,
    })),
  };
  const display = displayModel(state, audio, {
    recordSeconds: 0,
    countInBeats: 0,
    mic: 'off',
    autoLatencyMs: 0,
    message: '',
  });
  const base = instrumentPose(state, audio, display);
  const pose = (change: Partial<InstrumentPose>): InstrumentPose => ({ ...base, ...change });

  /** Hacia dónde mira la raya de un dial, vista desde arriba (x a la derecha, z hacia quien toca). */
  const needle = (angle: number) =>
    new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), angle);

  it('la raya de los diales va de las 7 y media (0) a las 4 y media (1), pasando por las 12', () => {
    const start = needle(dialAngle(0));
    expect(start.x).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(start.z).toBeCloseTo(Math.SQRT1_2, 6);
    const middle = needle(dialAngle(0.5));
    expect(middle.z).toBeCloseTo(-1, 6);
    const end = needle(dialAngle(1));
    expect(end.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(end.z).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('gira cada dial con su capa, hunde las teclas y lleva el anillo a la capa elegida', () => {
    const layers = base.layers.map((layer, i) => ({ ...layer, level: i / 3 }));
    applyPose(
      model,
      materials,
      pose({ layers, selected: 2, pressed: { play: true, record: false, standby: false } }),
    );
    LAYER_CONTROLS.forEach((id, i) => {
      expect(model.controls.get(id)!.rotation.y).toBeCloseTo(dialAngle(i / 3), 9);
    });
    expect(model.controls.get('play')!.position.y).toBeCloseTo((DECK_HEIGHT - KEY_TRAVEL) * MM, 9);
    expect(model.controls.get('record')!.position.y).toBeCloseTo(DECK_HEIGHT * MM, 9);
    const placement = PLACEMENTS[LAYER_CONTROLS[2] as PlacedControl];
    const center = polar(placement.radius, placement.angle);
    expect(model.selection.position.x).toBeCloseTo(center.x * MM, 9);
    expect(model.selection.position.z).toBeCloseTo(center.z * MM, 9);
  });

  it('el brazo lleva la costilla adonde dice instrument/layout', () => {
    for (const value of [0, 0.5, 1]) {
      applyPose(model, materials, pose({ arm: value }));
      const arm = model.controls.get('arm')!;
      arm.updateMatrixWorld(true);
      const rib = arm.children.find((child) => child.name === 'costilla')!;
      const head = new Vector3().setFromMatrixPosition(rib.matrixWorld);
      const expected = armHead(value);
      expect(head.x / MM).toBeCloseTo(expected.x, 6);
      expect(head.z / MM).toBeCloseTo(expected.z, 6);
    }
  });

  it('los pilotos: apagado a media luz de su color, encendido, en cola y grabando', () => {
    const lights = ['off', 'content', 'pending', 'recording'] as const;
    applyPose(
      model,
      materials,
      pose({ layers: lights.map((pilot) => ({ level: 1, muted: false, pilot })) }),
    );
    const [off, content, pending, recording] = materials.pilots as MeshStandardMaterial[];
    expect(off!.emissiveIntensity).toBeLessThan(0.1);
    expect(off!.color.getHexString()).not.toBe('000000');
    expect(content!.emissiveIntensity).toBeGreaterThan(1);
    expect(`#${pending!.emissive.getHexString()}`).toBe(PALETTE.warning);
    expect(`#${recording!.emissive.getHexString()}`).toBe(PALETTE.ledRecord);
    applyPose(model, materials, pose({ recordLight: 'on' }));
    expect(materials.ledRecord.emissiveIntensity).toBeGreaterThan(1);
    applyPose(model, materials, pose({ recordLight: 'off' }));
    expect(materials.ledRecord.emissiveIntensity).toBeLessThan(0.1);
  });

  it('la rueda gira con el volumen alrededor de su eje, en tangente', () => {
    applyPose(model, materials, pose({ volume: 0 }));
    expect(model.wheel.rotation.x).toBe(0);
    applyPose(model, materials, pose({ volume: 1 }));
    expect(model.wheel.rotation.x).toBeCloseTo(rad(300), 9);
  });
});
