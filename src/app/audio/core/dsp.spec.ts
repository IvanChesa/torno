import { describe, expect, it } from 'vitest';
import {
  fadeTable,
  framesOf,
  hermite,
  INSTANT_FADE,
  onePoleCoefficient,
  Ramp,
  readLooped,
  wrap,
} from './dsp';

describe('hermite', () => {
  it('pasa por las muestras: t = 0 da x0 exacto y t = 1 da x1', () => {
    expect(hermite(0.3, -0.7, 0.2, 0.9, 0)).toBe(-0.7);
    expect(hermite(0.3, -0.7, 0.2, 0.9, 1)).toBeCloseTo(0.2, 12);
  });

  it('reproduce exactamente un polinomio de grado 2', () => {
    const f = (x: number) => 0.5 * x * x - 0.25 * x + 0.1;
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(hermite(f(-1), f(0), f(1), f(2), t)).toBeCloseTo(f(t), 12);
    }
  });

  it('interpola un seno muy por debajo de Nyquist con error < 1e-4', () => {
    const w = (2 * Math.PI) / 64;
    let worst = 0;
    for (let n = 1; n < 60; n++) {
      for (const t of [0.2, 0.5, 0.8]) {
        const value = hermite(
          Math.sin(w * (n - 1)),
          Math.sin(w * n),
          Math.sin(w * (n + 1)),
          Math.sin(w * (n + 2)),
          t,
        );
        worst = Math.max(worst, Math.abs(value - Math.sin(w * (n + t))));
      }
    }
    expect(worst).toBeLessThan(1e-4);
  });
});

describe('readLooped', () => {
  it('da la vuelta al final del bucle (usa x[N−1] y x[0] como vecinos)', () => {
    const data = Float32Array.from([0, 1, 2, 3]);
    expect(readLooped(data, 4, 1)).toBe(1);
    // Entre la última y la primera: usa x[2], x[3], x[0], x[1].
    expect(readLooped(data, 4, 3.5)).toBeCloseTo(hermite(2, 3, 0, 1, 0.5), 12);
    expect(readLooped(data, 4, 0.5)).toBeCloseTo(hermite(3, 0, 1, 2, 0.5), 12);
  });

  it('respeta `frames` aunque el búfer tenga más capacidad', () => {
    const data = Float32Array.from([5, 6, 7, 99, 99]);
    expect(readLooped(data, 3, 2.5)).toBeCloseTo(hermite(6, 7, 5, 6, 0.5), 12);
  });
});

describe('utilidades', () => {
  it('wrap deja cualquier número en [0, m)', () => {
    expect(wrap(9, 8)).toBe(1);
    expect(wrap(-1, 8)).toBe(7);
    expect(wrap(-8, 8)).toBe(0);
    expect(wrap(2.5, 8)).toBe(2.5);
  });

  it('framesOf redondea y nunca da 0', () => {
    expect(framesOf(0.01, 48_000)).toBe(480);
    expect(framesOf(0.005, 44_100)).toBe(221);
    expect(framesOf(0, 48_000)).toBe(1);
  });

  it('el suavizado de un polo llega al 63 % en una constante de tiempo', () => {
    const a = onePoleCoefficient(0.01, 48_000);
    let y = 0;
    for (let i = 0; i < 480; i++) y += (1 - y) * a;
    expect(y).toBeCloseTo(1 - Math.exp(-1), 6);
  });
});

describe('fadeTable', () => {
  it('es un coseno alzado de 0 a 1 muestreado en el centro: simétrica y complementaria', () => {
    const table = fadeTable(480);
    expect(table).toHaveLength(480);
    expect(table[0]).toBeGreaterThan(0);
    expect(table[0]).toBeLessThan(1e-4);
    expect(table[479]).toBeLessThan(1);
    expect(table[479]).toBeGreaterThan(1 - 1e-4);
    for (let i = 0; i < 480; i++) expect(table[i]! + table[479 - i]!).toBeCloseTo(1, 6);
  });

  it('su mayor salto es π/2 · 1/N (el criterio de clics de §5 se calcula con esto)', () => {
    const n = 441;
    const table = fadeTable(n);
    let worst = Math.max(table[0]!, 1 - table[n - 1]!);
    for (let i = 1; i < n; i++) worst = Math.max(worst, table[i]! - table[i - 1]!);
    expect(worst).toBeLessThanOrEqual(Math.PI / 2 / n + 1e-9);
    expect(worst).toBeGreaterThan(Math.PI / 2 / n - 1e-4);
  });
});

describe('Ramp', () => {
  it('sigue la tabla desde el valor actual y se queda en el objetivo', () => {
    const table = fadeTable(4);
    const ramp = new Ramp(0, table);
    ramp.start(1);
    expect(ramp.ramping).toBe(true);
    expect(ramp.remaining).toBe(4);
    const out = new Float32Array(6);
    ramp.renderInto(out, 6);
    expect([...out]).toEqual([...table, 1, 1]);
    expect(ramp.ramping).toBe(false);
    expect(ramp.value).toBe(1);
  });

  it('un fundido a medias empieza donde estaba, sin saltos', () => {
    const ramp = new Ramp(0, fadeTable(10));
    ramp.start(1);
    ramp.skip(5);
    const middle = ramp.value;
    ramp.start(0);
    // La primera muestra del fundido nuevo ya se mueve, pero menos que el paso máximo π/2 · Δ/N.
    expect(Math.abs(ramp.value - middle)).toBeLessThanOrEqual((Math.PI / 2) * (middle / 10));
    ramp.skip(100);
    expect(ramp.value).toBe(0);
  });

  it('set salta sin fundido y start al mismo valor no hace nada', () => {
    const ramp = new Ramp(0.5, fadeTable(10));
    ramp.start(0.5);
    expect(ramp.ramping).toBe(false);
    ramp.set(0.25);
    expect(ramp.value).toBe(0.25);
    expect(ramp.target).toBe(0.25);
  });

  it('INSTANT_FADE es un cambio inmediato', () => {
    const ramp = new Ramp(0, fadeTable(10));
    ramp.start(1, INSTANT_FADE);
    expect(ramp.ramping).toBe(false);
    expect(ramp.value).toBe(1);
  });
});
