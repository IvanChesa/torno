// El plato redondo del instrumento HTML (PLAN fase 5.b): las mismas posiciones que el aparato en 3D,
// todo dentro del plato, ranuras que siguen el recorrido del brazo y de la rueda, y zonas de toque
// de 44 px que no se pisan con el plato a 330 px (un móvil de 360 px).
import { describe, expect, it } from 'vitest';
import {
  armHead,
  BODY,
  controlCenter,
  DISC_OUTER_RADIUS,
  PLACEMENTS,
  type PlacedControl,
} from './layout';
import { PLATE } from './plate';

/** Píxeles por radio del plato con el plato a 330 px. */
const PX = 330 / 2;
const TARGET = 44;

describe('el plato', () => {
  it('cada control está donde está en el aparato (instrument/layout)', () => {
    for (const id of Object.keys(PLACEMENTS) as PlacedControl[]) {
      const center = controlCenter(id);
      expect(PLATE.controls[id].x * BODY.radius).toBeCloseTo(center.x, 9);
      expect(PLATE.controls[id].z * BODY.radius).toBeCloseTo(center.z, 9);
    }
    expect(PLATE.disc).toBeCloseTo(DISC_OUTER_RADIUS / BODY.radius, 12);
  });

  it('todo queda dentro del plato (la ranura del brazo, como su costilla, asoma un poco)', () => {
    for (const spot of [...Object.values(PLATE.controls), ...PLATE.pilots]) {
      expect(Math.hypot(spot.x, spot.z)).toBeLessThan(1);
    }
    const arm = PLATE.arm;
    const end = {
      x: arm.x - arm.axis.x * arm.length,
      z: arm.z - arm.axis.y * arm.length,
    };
    expect(Math.hypot(end.x, end.z)).toBeLessThan(1.06);
  });

  it('el brazo sube hacia el disco y la rueda hacia fuera, a lo largo de su ranura', () => {
    const rest = armHead(0);
    const full = armHead(1);
    const toDisc = Math.hypot(full.x, full.z) - Math.hypot(rest.x, rest.z);
    expect(toDisc).toBeLessThan(0);
    // El eje del brazo apunta de la costilla en reposo a la costilla girada.
    const length = Math.hypot(full.x - rest.x, full.z - rest.z);
    expect(PLATE.arm.axis.x).toBeCloseTo((full.x - rest.x) / length, 9);
    expect(PLATE.arm.axis.y).toBeCloseTo((full.z - rest.z) / length, 9);
    // La rueda: su eje, hacia fuera del centro.
    const { x, z } = PLATE.volume;
    expect(PLATE.volume.axis.x * x + PLATE.volume.axis.y * z).toBeGreaterThan(0);
  });

  it('a 330 px, las zonas de toque de 44 px no se pisan ni pisan el disco', () => {
    const points = (Object.keys(PLACEMENTS) as PlacedControl[])
      .filter((id) => id !== 'volume')
      .map((id) => ({ id, x: PLATE.controls[id].x * PX, z: PLATE.controls[id].z * PX }));
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]!;
        const b = points[j]!;
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} y ${b.id}`).toBeGreaterThanOrEqual(
          TARGET,
        );
      }
      const r = Math.hypot(points[i]!.x, points[i]!.z);
      expect(r - TARGET / 2, `${points[i]!.id} y el disco`).toBeGreaterThan(PLATE.disc * PX);
    }
    // Las ranuras (44 px de grueso y de largo, como poco): las esquinas de sus dos extremos, fuera
    // del disco. En radios del plato, medio largo es `length`.
    for (const track of [PLATE.arm, PLATE.volume]) {
      const half = Math.max(TARGET / 2, track.length * PX);
      const normal = { x: -track.axis.y, z: track.axis.x };
      for (const along of [-1, 1]) {
        for (const across of [-1, 1]) {
          const corner = {
            x: track.x * PX + along * track.axis.x * half + across * normal.x * (TARGET / 2),
            z: track.z * PX + along * track.axis.y * half + across * normal.z * (TARGET / 2),
          };
          expect(Math.hypot(corner.x, corner.z)).toBeGreaterThan(PLATE.disc * PX);
        }
      }
    }
  });

  it('los rótulos salen hacia fuera del plato', () => {
    for (const [id, label] of Object.entries(PLATE.labels)) {
      expect(Math.hypot(label.x, label.z), id).toBeGreaterThan(1);
      if (label.side === 'left') expect(label.x).toBeLessThan(0);
      if (label.side === 'right') expect(label.x).toBeGreaterThan(0);
      if (label.side === 'top') expect(label.z).toBeLessThan(0);
      if (label.side === 'bottom') expect(label.z).toBeGreaterThan(0);
    }
  });
});
