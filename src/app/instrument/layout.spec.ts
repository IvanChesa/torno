import { describe, expect, it } from 'vitest';
import { CONTROLS, type ControlId } from './catalog';
import {
  ARM,
  armHead,
  BODY,
  controlCenter,
  DISC_OUTER_RADIUS,
  PILOTS,
  PLACEMENTS,
  polar,
  TRAY,
  type PlacedControl,
  type Point,
} from './layout';

const placed = Object.keys(PLACEMENTS) as PlacedControl[];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const radiusOf = (p: Point) => Math.hypot(p.x, p.z);
/** El ángulo de un punto, de −180° a 180° (0° delante, positivo a la derecha). */
const angleOf = (p: Point) => (Math.atan2(p.x, p.z) * 180) / Math.PI;

/** La cubierta plana termina donde empieza el bisel del canto. */
const DECK_RADIUS = BODY.radius - BODY.edgeRadius;
/** Hueco mínimo entre dos piezas, en mm. */
const GAP = 6;

/**
 * Zonas táctiles en el móvil (PLAN §4.7): círculos de 44 px alrededor de cada control. Con el
 * aparato entero en una pantalla de 360 px de ancho, sus 300 mm ocupan unos 330 px (1,1 px/mm).
 * La cámara mira desde arriba con una elevación de 45° o más: lo que va hacia el fondo se acorta
 * por el seno de la elevación. El encuadre de verdad se prueba con la proyección en la fase 6.
 */
const PX_PER_MM = 330 / (2 * BODY.radius);
const TARGET_PX = 44;

function projected(p: Point, elevation: number): Point {
  const k = Math.sin((elevation * Math.PI) / 180);
  return { x: p.x * PX_PER_MM, z: p.z * PX_PER_MM * k };
}

/** Todos los sitios donde hay una zona táctil (el brazo, en sus dos extremos). */
function targets(): { id: string; at: Point }[] {
  return [
    ...placed.map((id) => ({ id, at: controlCenter(id) })),
    { id: 'arm@0', at: controlCenter('arm', 0) },
    { id: 'arm@1', at: controlCenter('arm', 1) },
  ];
}

describe('medidas del aparato', () => {
  it('cada control del catálogo tiene su sitio: una pieza fija, el disco o el brazo', () => {
    const ids = CONTROLS.map((spec) => spec.id).sort();
    expect([...placed, 'disc', 'arm'].sort()).toEqual(ids);
    expect(controlCenter('disc')).toEqual({ x: 0, z: 0 });
  });

  it('las posiciones polares: 0° delante, 90° a la derecha', () => {
    const front = polar(100, 0);
    const right = polar(100, 90);
    expect(front.x).toBeCloseTo(0);
    expect(front.z).toBeCloseTo(100);
    expect(right.x).toBeCloseTo(100);
    expect(right.z).toBeCloseTo(0);
  });

  it('las piezas caben en la cubierta plana y no tocan el disco', () => {
    for (const id of placed) {
      const { radius, footprint } = PLACEMENTS[id];
      expect(radius + footprint, id).toBeLessThanOrEqual(DECK_RADIUS);
      expect(radius - footprint, id).toBeGreaterThanOrEqual(DISC_OUTER_RADIUS + GAP);
    }
  });

  it('ninguna pieza se solapa con otra', () => {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const [a, b] = [placed[i]!, placed[j]!];
        const gap = PLACEMENTS[a].footprint + PLACEMENTS[b].footprint + GAP;
        expect(distance(controlCenter(a), controlCenter(b)), `${a} y ${b}`).toBeGreaterThan(gap);
      }
    }
  });

  it('los pilotos caben entre su dial y el disco', () => {
    for (const id of ['layer-0', 'layer-1', 'layer-2', 'layer-3'] as const) {
      const dial = PLACEMENTS[id];
      const pilot = polar(PILOTS.radius, dial.angle);
      expect(distance(pilot, controlCenter(id))).toBeGreaterThan(dial.footprint + PILOTS.size);
      expect(PILOTS.radius - PILOTS.size / 2).toBeGreaterThan(DISC_OUTER_RADIUS + GAP / 2);
    }
    const key = PLACEMENTS.record;
    expect(PILOTS.recordRadius + PILOTS.size / 2).toBeLessThan(key.radius - key.footprint + 6);
  });

  it('nada choca con la bandeja: lo que queda delante de ella deja un hueco', () => {
    for (const id of placed) {
      const center = controlCenter(id);
      const { footprint } = PLACEMENTS[id];
      // La bandeja, como una serie de puntos de su cara de dentro y de sus extremos.
      for (let angle = 180 - TRAY.halfAngle; angle <= 180 + TRAY.halfAngle; angle += 1) {
        for (const r of [TRAY.innerRadius, TRAY.innerRadius + TRAY.thickness]) {
          expect(distance(center, polar(r, angle)), id).toBeGreaterThan(footprint + 2);
        }
      }
    }
  });

  it('el brazo: en reposo mira hacia delante por fuera, y girado se acerca al disco sin tocarlo', () => {
    const rest = armHead(0);
    const turned = armHead(1);
    expect(radiusOf(rest)).toBeGreaterThan(radiusOf(turned) + 30);
    expect(radiusOf(rest) + ARM.ribWidth / 2).toBeLessThanOrEqual(BODY.radius + 12);
    expect(radiusOf(turned) - ARM.ribWidth / 2).toBeGreaterThan(DISC_OUTER_RADIUS + 4);
    // Hacia delante: la costilla en reposo queda por delante del eje; los valores fuera de 0–1, en
    // sus extremos.
    expect(angleOf(rest)).toBeLessThan(ARM.pivotAngle);
    expect(armHead(-1)).toEqual(rest);
    expect(armHead(2)).toEqual(turned);
    // En todo su recorrido, la barra y la costilla no pasan por encima de otra pieza.
    for (let value = 0; value <= 1; value += 0.05) {
      const pivot = polar(ARM.pivotRadius, ARM.pivotAngle);
      const head = armHead(value);
      for (let t = 0; t <= 1; t += 0.1) {
        const point = { x: pivot.x + (head.x - pivot.x) * t, z: pivot.z + (head.z - pivot.z) * t };
        for (const id of placed) {
          const clearance = PLACEMENTS[id].footprint + (t === 1 ? ARM.ribWidth / 2 : 4);
          expect(distance(point, controlCenter(id)), `${id} a ${value}`).toBeGreaterThan(clearance);
        }
      }
    }
  });

  it.each([90, 60, 45])(
    'zonas táctiles de 44 px sin solaparse en el móvil (elevación %i°)',
    (elevation) => {
      const all = targets();
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const [a, b] = [all[i]!, all[j]!];
          if (a.id.startsWith('arm') && b.id.startsWith('arm')) continue;
          const apart = distance(projected(a.at, elevation), projected(b.at, elevation));
          expect(apart, `${a.id} y ${b.id}`).toBeGreaterThanOrEqual(TARGET_PX);
        }
      }
      // Y fuera de la zona del disco (su círculo, con el anillo), con medio círculo de margen.
      const disc = DISC_OUTER_RADIUS * PX_PER_MM;
      const k = Math.sin((elevation * Math.PI) / 180);
      for (const { id, at } of all) {
        const p = projected(at, elevation);
        // Distancia al borde de la elipse del disco, medida en la dirección del centro.
        const scale = Math.hypot(p.x / disc, p.z / (disc * k));
        const toEdge = Math.hypot(p.x, p.z) * (1 - 1 / scale);
        expect(toEdge, id).toBeGreaterThanOrEqual(TARGET_PX / 2);
      }
    },
  );

  it('el centro de cada control, también el del brazo en cualquier valor', () => {
    const ids: ControlId[] = ['play', 'arm', 'disc', 'volume'];
    for (const id of ids) {
      const center = controlCenter(id, 0.5);
      expect(Number.isFinite(center.x) && Number.isFinite(center.z)).toBe(true);
    }
    expect(controlCenter('arm', 0.5)).toEqual(armHead(0.5));
  });
});
