// La cámara (PLAN fase 6): los encuadres del escritorio y del móvil, la órbita de «Inspeccionar» y
// el viaje de un encuadre a otro.
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { SHOTS } from '../options';
import { blend, ease, fit, FOV, orbitPlacement, place, SHOT_ANGLES, shotAngles } from './views';

const camera = (aspect: number) => new PerspectiveCamera(FOV, aspect, 0.01, 10);

describe('la cámara', () => {
  it('encuadra: todos los puntos dentro del lienzo, con su margen, y centrados', () => {
    const points = [
      new Vector3(-0.15, 0, -0.15),
      new Vector3(0.15, 0, 0.15),
      new Vector3(0.15, 0.05, -0.15),
      new Vector3(-0.15, 0.05, 0.15),
    ];
    const view = camera(1.25);
    fit(view, { azimuth: 0, elevation: 40 }, points, 0.08);
    const projected = points.map((point) => point.clone().project(view));
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    expect(Math.max(...xs.map(Math.abs), ...ys.map(Math.abs))).toBeCloseTo(0.92, 2);
    expect(Math.max(...xs) + Math.min(...xs)).toBeCloseTo(0, 2);
    expect(Math.max(...ys) + Math.min(...ys)).toBeCloseTo(0, 2);
  });

  it('en el lienzo cuadrado del móvil, cada encuadre mira desde más arriba', () => {
    for (const shot of SHOTS) {
      expect(shotAngles(shot, 1).elevation).toBeGreaterThan(shotAngles(shot, 1.25).elevation);
      expect(shotAngles(shot, 1.25)).toBe(SHOT_ANGLES[shot].wide);
    }
  });

  it('la órbita no cambia de distancia al girar: el aparato no crece ni encoge', () => {
    const view = camera(1.25);
    const center = new Vector3(0, 0.03, 0);
    const a = orbitPlacement(view, { azimuth: 0, elevation: 40 }, center, 0.16);
    const b = orbitPlacement(view, { azimuth: 120, elevation: 15 }, center, 0.16);
    expect(a.distance).toBe(b.distance);
    // Una esfera de ese radio cabe entera desde cualquier lado.
    place(view, b);
    view.updateProjectionMatrix();
    const edge = center
      .clone()
      .add(new Vector3(0, 0.16, 0))
      .project(view);
    expect(Math.abs(edge.y)).toBeLessThan(1);
  });

  it('el viaje: empieza y acaba donde debe, y gira por el camino corto', () => {
    const from = { target: new Vector3(), distance: 1, angles: { azimuth: 170, elevation: 20 } };
    const to = {
      target: new Vector3(1, 0, 0),
      distance: 4,
      angles: { azimuth: -170, elevation: 60 },
    };
    expect(blend(from, to, 0).angles).toEqual(from.angles);
    const end = blend(from, to, 1);
    expect(end.distance).toBeCloseTo(4, 10);
    expect(end.target.x).toBeCloseTo(1, 10);
    // De 170° a −170° hay 20° por detrás, no 340° por delante.
    expect(blend(from, to, 0.5).angles.azimuth).toBeCloseTo(180, 10);
    // La distancia, en proporción: a mitad de camino, la media geométrica.
    expect(blend(from, to, 0.5).distance).toBeCloseTo(2, 10);
  });

  it('acelera y frena: de 0 a 1, siempre hacia delante y simétrico', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 10);
    let last = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      expect(ease(t)).toBeGreaterThanOrEqual(last);
      last = ease(t);
    }
    expect(ease(0.2) + ease(0.8)).toBeCloseTo(1, 10);
  });
});
