import { describe, expect, it } from 'vitest';
import { Metronome, clickTable } from './metronome';

describe('metrónomo', () => {
  it('cada clic empieza y acaba en 0 exacto (sin clics digitales) y dura 60 ms', () => {
    const table = clickTable(48_000, 1320, 0.22);
    expect(table).toHaveLength(2880);
    expect(Math.abs(table[0]!)).toBe(0);
    expect(Math.abs(table[table.length - 1]!)).toBe(0);
    const peak = Math.max(...table.map(Math.abs));
    expect(peak).toBeGreaterThan(0.15);
    expect(peak).toBeLessThanOrEqual(0.22);
  });

  it('suena desde la muestra exacta que se pide y se suma a lo que haya', () => {
    const metronome = new Metronome(48_000);
    metronome.trigger(false, 50);
    const out = new Float32Array(128).fill(0.5);
    metronome.renderInto(out, 128);
    expect(out.subarray(0, 51).every((x) => x === 0.5)).toBe(true);
    expect(out[51]).not.toBe(0.5);
    expect(metronome.active).toBe(true);
  });

  it('un retraso más largo que el tramo sigue en el tramo siguiente', () => {
    const metronome = new Metronome(48_000);
    metronome.trigger(true, 200);
    const out = new Float32Array(128);
    metronome.renderInto(out, 128);
    expect(out.every((x) => x === 0)).toBe(true);
    metronome.renderInto(out, 128);
    expect(out.subarray(0, 73).every((x) => x === 0)).toBe(true);
    expect(out[73]).not.toBe(0);
  });

  it('el acento es más agudo y suena hasta el final; stop lo calla', () => {
    const accent = clickTable(48_000, 1760, 0.3);
    const normal = clickTable(48_000, 1320, 0.22);
    const crossings = (t: Float32Array) =>
      t.reduce((count, x, i) => (i > 0 && t[i - 1]! <= 0 && x > 0 ? count + 1 : count), 0);
    expect(crossings(accent)).toBeGreaterThan(crossings(normal));
    const metronome = new Metronome(48_000);
    metronome.trigger(true, 0);
    metronome.renderInto(new Float32Array(4000), 4000);
    expect(metronome.active).toBe(false);
    metronome.trigger(false, 0);
    metronome.stop();
    expect(metronome.active).toBe(false);
  });
});
