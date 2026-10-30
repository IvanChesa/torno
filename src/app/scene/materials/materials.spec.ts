// Las texturas procedurales (ruido periódico, cerámica y moleteado), lo impreso en la cubierta y las
// filas de la pantalla (PLAN §4.6; DISENO.md §7).
import { describe, expect, it } from 'vitest';
import { controlCenter, PLACEMENTS, type DisplayModel, type PlacedControl } from '../../instrument';
import { deckPrint, needleDirection, PRINT_INNER_RADIUS, PRINT_RADIUS } from './print';
import {
  ceramicMaps,
  COLOR_MEAN,
  CERAMIC_ROUGHNESS,
  knurlNormal,
  periodicNoise,
} from './procedural';
import { screenRows, SCREEN_ROWS, VISIBLE_MENU_ROWS } from './screen';

describe('ruido periódico', () => {
  const size = 64;
  const noise = periodicNoise(size, { period: 4, octaves: 3, seed: 3 });

  it('es determinista y se queda en [−1, 1]', () => {
    expect(periodicNoise(size, { period: 4, octaves: 3, seed: 3 })).toEqual(noise);
    expect(periodicNoise(size, { period: 4, octaves: 3, seed: 4 })).not.toEqual(noise);
    for (const value of noise) expect(Math.abs(value)).toBeLessThanOrEqual(1);
  });

  it('se repite sin junta: el salto del borde es como cualquier otro salto entre vecinos', () => {
    let inside = 0;
    let seam = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size - 1; x++) {
        inside = Math.max(inside, Math.abs(noise[y * size + x + 1]! - noise[y * size + x]!));
      }
      seam = Math.max(seam, Math.abs(noise[y * size]! - noise[y * size + size - 1]!));
    }
    expect(seam).toBeLessThanOrEqual(inside * 1.05);
  });
});

describe('cerámica', () => {
  const maps = ceramicMaps(128);
  const mean = (data: Uint8Array, channel: number) => {
    let sum = 0;
    for (let i = channel; i < data.length; i += 4) sum += data[i]!;
    return sum / (data.length / 4) / 255;
  };

  it('el grano del color varía ±4 % alrededor de su media (y los poros, algo más oscuros)', () => {
    expect(mean(maps.color, 0)).toBeCloseTo(COLOR_MEAN, 1);
    let min = 1;
    let max = 0;
    for (let i = 0; i < maps.color.length; i += 4) {
      min = Math.min(min, maps.color[i]! / 255);
      max = Math.max(max, maps.color[i]! / 255);
    }
    expect(max).toBeLessThanOrEqual(COLOR_MEAN + 0.045);
    expect(min).toBeGreaterThan(COLOR_MEAN - 0.2);
  });

  it('la rugosidad queda en 0,85 ± 0,08', () => {
    const roughness = CERAMIC_ROUGHNESS * mean(maps.roughness, 1);
    expect(roughness).toBeGreaterThan(0.83);
    expect(roughness).toBeLessThan(0.88);
    for (let i = 1; i < maps.roughness.length; i += 4) {
      const value = (CERAMIC_ROUGHNESS * maps.roughness[i]!) / 255;
      expect(value).toBeGreaterThan(0.76);
      expect(value).toBeLessThanOrEqual(CERAMIC_ROUGHNESS);
    }
  });

  it('el mapa normal mira hacia fuera de la superficie (z siempre la mayor)', () => {
    for (let i = 0; i < maps.normal.length; i += 4) {
      expect(maps.normal[i + 2]!).toBeGreaterThan(200);
    }
  });

  it('el moleteado: estrías en V simétricas a lo largo de u', () => {
    const knurl = knurlNormal(32);
    const x = (i: number) => knurl[4 * i]! - 128;
    // Simétricas salvo el redondeo a 8 bits.
    for (let i = 0; i < 16; i++) expect(Math.abs(x(i) + x(31 - i))).toBeLessThanOrEqual(1);
    expect(x(0)).toBeLessThan(0);
  });
});

describe('lo impreso en la cubierta', () => {
  const marks = deckPrint();
  const points = marks.flatMap((mark) => {
    switch (mark.kind) {
      case 'line':
        return [mark.from, mark.to];
      case 'dot':
      case 'text':
        return [mark.at];
      case 'ring':
        return [];
    }
  });

  it('todo cae en la parte plana de la cubierta, fuera del hueco del disco', () => {
    for (const point of points) {
      const r = Math.hypot(point.x, point.z);
      expect(r).toBeGreaterThan(PRINT_INNER_RADIUS);
      expect(r).toBeLessThan(PRINT_RADIUS);
    }
  });

  it('nada se imprime debajo de una pieza (ni de los diales, ni de las teclas, ni de la rueda)', () => {
    for (const point of points) {
      for (const [id, placement] of Object.entries(PLACEMENTS)) {
        const center = controlCenter(id as PlacedControl);
        const distance = Math.hypot(point.x - center.x, point.z - center.z);
        expect(distance, `${id} en (${point.x}, ${point.z})`).toBeGreaterThan(placement.footprint);
      }
    }
  });

  it('cada dial tiene su escala de 11 marcas y su rótulo debajo', () => {
    const texts = marks.filter((mark) => mark.kind === 'text').map((mark) => mark.text);
    expect(texts).toEqual(expect.arrayContaining(['1', '2', '3', '4', 'TEMPO', '+', '−', 'VOL']));
    expect(marks.filter((mark) => mark.kind === 'line')).toHaveLength(5 * 11);
  });

  it('la aguja: a las 12 mira al fondo y a las 3 a la derecha', () => {
    expect(needleDirection(0).z).toBeCloseTo(-1, 10);
    expect(needleDirection(90).x).toBeCloseTo(1, 10);
  });
});

describe('las filas de la pantalla', () => {
  const display = (change: Partial<DisplayModel>): DisplayModel => ({
    mode: 'main',
    title: '',
    lines: ['90 BPM · PAUSA', 'CAPA 1 · BATERÍA · ALFAR'],
    rows: [],
    status: 'TOMA LIBRE',
    pilots: [],
    summary: '',
    ...change,
  });

  it('la principal: sus líneas (el estado va aparte, abajo)', () => {
    expect(screenRows(display({})).map((row) => row.text)).toEqual([
      '90 BPM · PAUSA',
      'CAPA 1 · BATERÍA · ALFAR',
    ]);
  });

  it('el menú: el título a media luz y una ventana alrededor de la fila elegida, invertida', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      label: `FILA ${i}`,
      value: i === 5 ? '4' : '',
      selected: i === 5,
      editing: i === 5,
    }));
    const result = screenRows(display({ mode: 'menu', title: 'BUCLE', lines: [], rows }));
    expect(result[0]).toEqual({ text: 'BUCLE', value: '', inverted: false, dim: true });
    expect(result.slice(1).map((row) => row.text)).toEqual(['FILA 4', 'FILA 5', 'FILA 6']);
    expect(result.slice(1)).toHaveLength(VISIBLE_MENU_ROWS);
    expect(result[2]).toEqual({ text: 'FILA 5', value: '‹ 4 ›', inverted: true, dim: false });
    expect(result.length).toBeLessThan(SCREEN_ROWS);
  });
});
