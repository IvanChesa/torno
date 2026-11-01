// La vista despiezada (PLAN fase 7): cinco niveles que suben, del cuerpo (quieto) al latón de
// arriba, y una silueta para encuadrarlos que deja el aparato como estaba.
import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createMaterials } from '../materials/materials';
import { QUALITY } from '../quality';
import { applyExplode, explodedSilhouette } from './exploded';
import { MM } from './geometry';
import { buildInstrument, EXPLODE_LIFT_MM } from './instrument';

describe('la vista despiezada', () => {
  const model = buildInstrument(createMaterials({ grainSize: 16 }), QUALITY.low);
  const top = (object = model.root) => new Box3().setFromObject(object).max.y;

  it('reparte todas las piezas en cinco niveles; el cuerpo no sube', () => {
    expect(model.levels).toHaveLength(EXPLODE_LIFT_MM.length);
    expect(model.root.children).toEqual(model.levels.map((level) => level.group));
    expect(model.levels[0]!.lift).toBe(0);
    for (const id of model.controls.keys()) {
      expect(
        model.levels.some((level) => level.group.getObjectById(model.controls.get(id)!.id)),
      ).toBe(true);
    }
  });

  it('despiezado, cada nivel sube lo suyo; montado, vuelve a su sitio', () => {
    const height = top();
    applyExplode(model, 1);
    model.levels.forEach((level, i) =>
      expect(level.group.position.y).toBeCloseTo((EXPLODE_LIFT_MM[i] ?? 0) * MM, 9),
    );
    expect(top()).toBeGreaterThan(height + 0.1);
    applyExplode(model, 0);
    expect(top()).toBeCloseTo(height, 9);
  });

  it('la silueta despiezada llega más arriba y no mueve nada', () => {
    const points = explodedSilhouette(model);
    expect(Math.max(...points.map((point) => point.y))).toBeGreaterThan(top() + 0.1);
    for (const level of model.levels) expect(level.group.position.y).toBe(0);
  });
});
