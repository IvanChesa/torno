/**
 * Azar con semilla (mulberry32): la misma semilla da siempre la misma serie, en Node y en el
 * navegador. La síntesis no usa `Math.random()` (lo prohíbe el lint): los bucles son deterministas.
 */

/** Devuelve números en [0, 1). */
export type Random = () => number;

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido blanco uniforme en [−1, 1). */
export function noise(random: Random): number {
  return 2 * random() - 1;
}

/** Un valor en [−amount, amount) (pequeñas variaciones «humanas» de tiempo y de fuerza). */
export function jitter(random: Random, amount: number): number {
  return (2 * random() - 1) * amount;
}
