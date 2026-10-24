/**
 * Límites del instrumento que ve el usuario. Coinciden con los del núcleo de audio (audio/core), que
 * esta capa no puede importar (PLAN §4.2): `scripts/instrument-sync.spec.ts` comprueba que no se
 * separan.
 */

export const LAYER_COUNT = 4;
export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 90;
/** Duración de la toma: 0 = libre; si no, compases. */
export const TAKE_BARS = [0, 1, 2, 4] as const;
export type TakeBars = (typeof TAKE_BARS)[number];
export const MAX_INPUT_GAIN = 2;
export const MAX_REPEATS = 8;
export const MAX_MANUAL_LATENCY_MS = 500;
/** Una vuelta del disco = un compás. */
export const BEATS_PER_TURN = 4;
/** Con el teclado, cada flecha mueve el disco 1/16 de vuelta (una semicorchea). */
export const DISC_TURNS_PER_STEP = 1 / 16;

/** Pulsar: soltar antes de este tiempo sin moverse. Mantener: llegar a él sin moverse. */
export const HOLD_MS = 500;
/** Moverse más de esto (px) es girar o arrastrar, y cancela la pulsación. */
export const TURN_THRESHOLD_PX = 6;
/** Píxeles de arrastre por paso de un dial. */
export const PX_PER_STEP = 4;
/** El paso grande (Mayús, Re Pág / Av Pág) son diez pasos. */
export const BIG_STEP = 10;
