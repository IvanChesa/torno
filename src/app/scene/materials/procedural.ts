/**
 * Texturas procedurales de la cerámica y del moleteado (PLAN §4.6; DISENO.md §7), en datos (RGBA de
 * 8 bits), sin DOM ni `three`: se generan al arrancar y se prueban en Node.
 *
 * El ruido es **periódico**: cada octava cabe un número entero de veces en la textura, así que el
 * mosaico se repite sin juntas sobre el cuerpo, la cubierta y la bandeja.
 */

/** Hash entero de una celda de la rejilla, de 0 a 1. Determinista: las capturas no cambian. */
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Ruido de valor periódico con varias octavas, en [−1, 1] (aprox.), de `size`×`size`. `period` es
 * cuántas celdas tiene la primera octava a lo ancho; cada octava dobla las celdas y pesa la mitad.
 */
export function periodicNoise(
  size: number,
  { period, octaves, seed }: { period: number; octaves: number; seed: number },
): Float32Array {
  const out = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const cells = Math.min(size, period << octave);
    const lattice = new Float32Array(cells * cells);
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) lattice[y * cells + x] = 2 * hash(x, y, seed + octave) - 1;
    }
    const scale = cells / size;
    for (let py = 0; py < size; py++) {
      const gy = py * scale;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      const row0 = (y0 % cells) * cells;
      const row1 = ((y0 + 1) % cells) * cells;
      for (let px = 0; px < size; px++) {
        const gx = px * scale;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const x1 = (x0 + 1) % cells;
        const a = lattice[row0 + (x0 % cells)]!;
        const b = lattice[row0 + x1]!;
        const c = lattice[row1 + (x0 % cells)]!;
        const d = lattice[row1 + x1]!;
        const top = a + (b - a) * sx;
        const bottom = c + (d - c) * sx;
        out[py * size + px]! += amplitude * (top + (bottom - top) * sy);
      }
    }
    total += amplitude;
    amplitude /= 2;
  }
  for (let i = 0; i < out.length; i++) out[i]! /= total;
  return out;
}

/** Los tres mapas de la cerámica sin esmaltar, en el mismo mosaico. */
export interface CeramicMaps {
  readonly size: number;
  /** Multiplicador del color (lineal, gris): grano de ±4 % alrededor de `COLOR_MEAN`. */
  readonly color: Uint8Array;
  /** Multiplicador de la rugosidad en el canal G: ±0,08 sobre la rugosidad del material. */
  readonly roughness: Uint8Array;
  /** Mapa normal en el espacio tangente: los poros, hundidos. */
  readonly normal: Uint8Array;
}

/** La media del multiplicador del color: el material se aclara lo mismo para compensarla. */
export const COLOR_MEAN = 0.96;
/** La rugosidad del material, sobre la que el mapa resta como mucho una décima (0,85 ± 0,08). */
export const CERAMIC_ROUGHNESS = 0.93;
/** Lo que resta el mapa de rugosidad en su punto medio: 0,93 · 0,915 ≈ 0,85. */
const ROUGHNESS_MEAN = 0.915;
const ROUGHNESS_SPAN = 0.086;
/** Fracción del mosaico que son poros (umbral del ruido fino). */
const PORE_THRESHOLD = -0.5;

const byte = (value: number) => Math.round(255 * Math.min(1, Math.max(0, value)));

/**
 * Grano en el color y en la rugosidad y poros en el relieve (DISENO.md §7: «grano fino en el color
 * (±4 % de luminancia) y en la rugosidad (±0,08), mapa normal suave de poros»).
 */
export function ceramicMaps(size: number, seed = 7): CeramicMaps {
  // El grano: manchas de 1–3 mm en un mosaico de unos 80 mm.
  const grain = periodicNoise(size, { period: 24, octaves: 4, seed });
  // Los poros: un ruido más fino; solo sus valles más hondos.
  const fine = periodicNoise(size, { period: 96, octaves: 2, seed: seed + 101 });
  const count = size * size;
  const height = new Float32Array(count);
  const color = new Uint8Array(4 * count);
  const roughness = new Uint8Array(4 * count);
  for (let i = 0; i < count; i++) {
    const g = grain[i]!;
    const pore = Math.max(0, (PORE_THRESHOLD - fine[i]!) / (1 + PORE_THRESHOLD));
    height[i] = 0.15 * g - pore;
    const c = byte(COLOR_MEAN + 0.04 * Math.max(-1, Math.min(1, 1.6 * g)) - 0.12 * pore);
    color[4 * i] = c;
    color[4 * i + 1] = c;
    color[4 * i + 2] = c;
    color[4 * i + 3] = 255;
    const r = ROUGHNESS_MEAN + ROUGHNESS_SPAN * Math.max(-1, Math.min(1, 1.6 * g)) + 0.1 * pore;
    roughness[4 * i] = 255;
    roughness[4 * i + 1] = byte(r);
    roughness[4 * i + 2] = 255;
    roughness[4 * i + 3] = 255;
  }
  // El relieve se mide por píxel: con la fuerza proporcional al tamaño, los poros salen igual de
  // suaves en todos los niveles de calidad.
  return { size, color, roughness, normal: normalMap(height, size, (2 * size) / 512) };
}

/**
 * Mapa normal de un relieve periódico (diferencias centrales con la vuelta del mosaico): x hacia
 * donde crece u, y hacia donde crece v (la fila), como espera `three`.
 */
export function normalMap(height: Float32Array, size: number, strength: number): Uint8Array {
  const out = new Uint8Array(4 * size * size);
  for (let y = 0; y < size; y++) {
    const up = ((y + 1) % size) * size;
    const down = ((y - 1 + size) % size) * size;
    for (let x = 0; x < size; x++) {
      const right = (x + 1) % size;
      const left = (x - 1 + size) % size;
      const dx = (height[y * size + right]! - height[y * size + left]!) * strength;
      const dy = (height[up + x]! - height[down + x]!) * strength;
      const length = Math.hypot(dx, dy, 1);
      const i = 4 * (y * size + x);
      out[i] = byte(0.5 - dx / length / 2);
      out[i + 1] = byte(0.5 - dy / length / 2);
      out[i + 2] = byte(0.5 + 1 / length / 2);
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * El moleteado: estrías en V a lo largo de u (una por ancho de textura; la geometría repite la u
 * tantas veces como estrías). Es un mapa normal de `width`×2.
 */
export function knurlNormal(width = 32, depth = 0.55): Uint8Array {
  const out = new Uint8Array(4 * width * 2);
  for (let x = 0; x < width; x++) {
    // Pendiente de un diente de sierra simétrico: sube media estría y baja la otra media.
    const t = (x + 0.5) / width;
    const slope = t < 0.5 ? depth : -depth;
    const length = Math.hypot(slope, 1);
    for (let y = 0; y < 2; y++) {
      const i = 4 * (y * width + x);
      out[i] = byte(0.5 - slope / length / 2);
      out[i + 1] = 128;
      out[i + 2] = byte(0.5 + 1 / length / 2);
      out[i + 3] = 255;
    }
  }
  return out;
}
