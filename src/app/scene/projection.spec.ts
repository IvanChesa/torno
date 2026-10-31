// Los controles en la pantalla (PLAN §4.7 y fase 6): cada pieza proyectada con los encuadres de
// «Tocar», en el lienzo del escritorio (5:4) y en el del móvil (1:1). Lo que se comprueba aquí, en
// Node, es la geometría: las zonas de 44 px del móvil no se pisan y todo cae dentro del lienzo.
import { PerspectiveCamera, Raycaster } from 'three';
import { describe, expect, it } from 'vitest';
import { CONTROLS, type ControlId } from '../instrument';
import { shadowRing, shotPoints, silhouette } from './camera/shots';
import { FOV, orbitPlacement, place, shotPlacement } from './camera/views';
import { createMaterials } from './materials/materials';
import { buildInstrument } from './model/instrument';
import type { ControlBox, Shot } from './options';
import { controlShapes, projectControls } from './projection';
import { QUALITY } from './quality';
import { Box3, Sphere } from 'three';

const model = buildInstrument(createMaterials({ grainSize: 16 }), QUALITY.low);
const shapes = controlShapes(model);
const outline = [...silhouette(model), ...shadowRing()];
const shots = shotPoints(model, shapes, outline);

function boxes(shot: Shot, width: number, height: number): ControlBox[] {
  const camera = new PerspectiveCamera(FOV, width / height, 0.01, 10);
  shotPlacement(camera, shot, shots);
  return projectControls(shapes, camera, width, height);
}

/** La zona de toque de la capa de controles: la caja de la pieza, y nunca menos de 44 px. */
const TARGET = 44;
function zone(box: ControlBox) {
  const width = Math.max(TARGET, box.width);
  const height = Math.max(TARGET, box.height);
  return { x: box.x, y: box.y, width, height };
}

/** Dos zonas se pisan. El disco es redondo (su elemento también: `border-radius`). */
function overlap(a: ControlBox, b: ControlBox): boolean {
  const za = zone(a);
  const zb = zone(b);
  if (a.id === 'disc' || b.id === 'disc') {
    const [disc, other] = a.id === 'disc' ? [za, zb] : [zb, za];
    // La esquina del rectángulo más cerca del centro del disco, en el círculo unidad del disco.
    const nearX = Math.max(other.x - other.width / 2, Math.min(disc.x, other.x + other.width / 2));
    const nearY = Math.max(
      other.y - other.height / 2,
      Math.min(disc.y, other.y + other.height / 2),
    );
    const dx = (nearX - disc.x) / (disc.width / 2);
    const dy = (nearY - disc.y) / (disc.height / 2);
    return dx * dx + dy * dy < 1;
  }
  return (
    Math.abs(za.x - zb.x) < (za.width + zb.width) / 2 &&
    Math.abs(za.y - zb.y) < (za.height + zb.height) / 2
  );
}

function overlaps(list: readonly ControlBox[]): string[] {
  const found: string[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (overlap(list[i]!, list[j]!)) found.push(`${list[i]!.id}–${list[j]!.id}`);
    }
  }
  return found;
}

describe('los controles en la pantalla', () => {
  it('cada control tiene su pieza (en el orden del catálogo) y su eje de arrastre', () => {
    expect(shapes.map((shape) => shape.id)).toEqual(CONTROLS.map((spec) => spec.id));
    const list = boxes('completo', 900, 720);
    const axis = (id: ControlId) => list.find((box) => box.id === id)!.axis;
    // Los diales, hacia arriba; el brazo, de fuera hacia el disco (en la pantalla: a la izquierda);
    // la rueda, hacia fuera (al fondo y a la izquierda).
    expect(axis('layer-0')).toEqual({ x: 0, y: -1 });
    expect(axis('arm').x).toBeLessThan(-0.5);
    expect(axis('volume').x).toBeLessThan(0);
    expect(axis('volume').y).toBeLessThan(0);
    for (const box of list) expect(Math.hypot(box.axis.x, box.axis.y)).toBeCloseTo(1, 6);
  });

  for (const shot of ['completo', 'capas', 'controles'] as const) {
    it(`«${shot}» en el escritorio: lo que encuadra cae dentro del lienzo`, () => {
      const list = boxes(shot, 900, 720);
      const framed: Record<Shot, readonly ControlId[]> = {
        completo: CONTROLS.map((spec) => spec.id),
        capas: ['layer-0', 'layer-1', 'layer-2', 'layer-3'],
        controles: ['play', 'record', 'undo', 'disc', 'arm'],
      };
      for (const id of framed[shot]) {
        const box = list.find((item) => item.id === id)!;
        expect(box.visible, id).toBe(true);
        expect(box.x - box.width / 2, id).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width / 2, id).toBeLessThanOrEqual(900);
        expect(box.y - box.height / 2, id).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height / 2, id).toBeLessThanOrEqual(720);
      }
    });
  }

  for (const width of [360, 390]) {
    it(`en el móvil (${width}×${width}, el aparato entero): las zonas de 44 px no se pisan`, () => {
      expect(overlaps(boxes('completo', width, width))).toEqual([]);
    });
  }

  it('en el escritorio, ninguna zona se pisa tampoco', () => {
    expect(overlaps(boxes('completo', 900, 720))).toEqual([]);
  });

  it('al girar alrededor («Inspeccionar»), lo que tapa la bandeja no se ve', () => {
    const camera = new PerspectiveCamera(FOV, 1.25, 0.01, 10);
    const sphere = new Box3().setFromPoints(outline).getBoundingSphere(new Sphere());
    const occlusion = { raycaster: new Raycaster(), root: model.root };
    // Desde el fondo y bajo, la bandeja tapa el reposo (detrás del disco); de frente, se ve.
    const look = (azimuth: number, elevation: number) => {
      place(camera, orbitPlacement(camera, { azimuth, elevation }, sphere.center, sphere.radius));
      camera.updateProjectionMatrix();
      return projectControls(shapes, camera, 900, 720, occlusion);
    };
    const standby = (list: ControlBox[]) => list.find((box) => box.id === 'standby')!.visible;
    expect(standby(look(0, 40))).toBe(true);
    expect(standby(look(150, 10))).toBe(false);
  });
});
