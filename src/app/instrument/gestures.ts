/**
 * Gestos (PLAN §4.5): una máquina de estados pura, igual para puntero, táctil y teclado, con el
 * tiempo inyectado (quien la usa le pasa `tick` cuando vence el temporizador de mantener).
 *
 * - **Pulsar:** soltar antes de 500 ms sin moverse.
 * - **Mantener:** 500 ms sin moverse (al soltar, `release`).
 * - **Girar/arrastrar:** moverse más allá del umbral; cancela la pulsación y el mantener. En los
 *   controles que no giran (las teclas), moverse no cancela nada: con el dedo, unos píxeles de
 *   temblor no deben perder la pulsación.
 * - **Agarrar** (el disco): se agarra al tocarlo, sin esperar; moverlo lo arrastra y soltarlo lo
 *   suelta.
 */
import { HOLD_MS, TURN_THRESHOLD_PX } from './constants';

export interface GestureConfig {
  /** El control se agarra al tocarlo (el disco). */
  readonly grab?: boolean;
  /** El control entiende «mantener». */
  readonly hold?: boolean;
  /** El control gira (diales, brazo, rueda); si no, moverse no cancela la pulsación. */
  readonly turn?: boolean;
  readonly holdMs?: number;
  readonly threshold?: number;
}

export type GestureInput =
  | { readonly type: 'down'; readonly time: number; readonly x: number; readonly y: number }
  | { readonly type: 'move'; readonly time: number; readonly x: number; readonly y: number }
  | { readonly type: 'up'; readonly time: number }
  | { readonly type: 'tick'; readonly time: number }
  | { readonly type: 'cancel' };

export type GestureOutput =
  | { readonly type: 'press' }
  | { readonly type: 'hold' }
  | { readonly type: 'release' }
  /** Desplazamiento desde el último `turn` (o desde que se tocó). */
  | { readonly type: 'turn'; readonly dx: number; readonly dy: number }
  | { readonly type: 'grab' }
  | { readonly type: 'drag'; readonly dx: number; readonly dy: number }
  | { readonly type: 'drop' };

export type GestureState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'pending'; readonly start: number; readonly x: number; readonly y: number }
  | { readonly phase: 'held' }
  | { readonly phase: 'turning'; readonly x: number; readonly y: number }
  | { readonly phase: 'grabbed'; readonly x: number; readonly y: number };

export const IDLE: GestureState = { phase: 'idle' };

export interface GestureStep {
  readonly state: GestureState;
  readonly outputs: readonly GestureOutput[];
}

const step = (state: GestureState, ...outputs: GestureOutput[]): GestureStep => ({
  state,
  outputs,
});

/** Un paso de la máquina: el estado siguiente y lo que ha pasado. */
export function gesture(
  state: GestureState,
  input: GestureInput,
  config: GestureConfig = {},
): GestureStep {
  const holdMs = config.holdMs ?? HOLD_MS;
  const threshold = config.threshold ?? TURN_THRESHOLD_PX;
  const canHold = config.hold ?? true;
  const canTurn = config.turn ?? true;

  if (input.type === 'cancel') {
    if (state.phase === 'grabbed') return step(IDLE, { type: 'drop' });
    if (state.phase === 'held') return step(IDLE, { type: 'release' });
    return step(IDLE);
  }

  switch (state.phase) {
    case 'idle':
      if (input.type !== 'down') return step(state);
      if (config.grab) return step({ phase: 'grabbed', x: input.x, y: input.y }, { type: 'grab' });
      return step({ phase: 'pending', start: input.time, x: input.x, y: input.y });

    case 'pending': {
      if (input.type === 'move') {
        const dx = input.x - state.x;
        const dy = input.y - state.y;
        if (!canTurn || Math.hypot(dx, dy) <= threshold) return step(state);
        return step({ phase: 'turning', x: input.x, y: input.y }, { type: 'turn', dx, dy });
      }
      const late = input.type !== 'down' && canHold && input.time - state.start >= holdMs;
      if (input.type === 'tick')
        return late ? step({ phase: 'held' }, { type: 'hold' }) : step(state);
      if (input.type === 'up') {
        // Si el temporizador no llegó a tiempo, el mantener se reconoce al soltar.
        return late
          ? step(IDLE, { type: 'hold' }, { type: 'release' })
          : step(IDLE, { type: 'press' });
      }
      return step(state);
    }

    case 'held':
      return input.type === 'up' ? step(IDLE, { type: 'release' }) : step(state);

    case 'turning':
      if (input.type === 'move') {
        return step(
          { phase: 'turning', x: input.x, y: input.y },
          { type: 'turn', dx: input.x - state.x, dy: input.y - state.y },
        );
      }
      return input.type === 'up' ? step(IDLE) : step(state);

    case 'grabbed':
      if (input.type === 'move') {
        return step(
          { phase: 'grabbed', x: input.x, y: input.y },
          { type: 'drag', dx: input.x - state.x, dy: input.y - state.y },
        );
      }
      return input.type === 'up' ? step(IDLE, { type: 'drop' }) : step(state);
  }
}
