/**
 * Teclado (PLAN §0.1 y §4.7): flechas, Mayús ×10, Re Pág/Av Pág, Inicio/Fin, Intro = pulsar,
 * Mayús+Intro = mantener, Esc = volver y Espacio en el disco = mantenerlo. Y los atajos con el foco
 * dentro del instrumento (WCAG 2.1.4): Espacio, R, Z, 1–4 y `?`. Si el control enfocado usa la
 * tecla, manda el control.
 */
import { BIG_STEP } from './constants';
import type { ControlSpec } from './catalog';

export interface KeyInput {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  /** La tecla se repite por estar mantenida. */
  readonly repeat: boolean;
}

export type KeyAction =
  /** La tecla es del control, pero ahora no hace nada (Espacio repetido con el disco agarrado). */
  | { readonly type: 'none' }
  | { readonly type: 'press' }
  | { readonly type: 'hold' }
  | { readonly type: 'step'; readonly steps: number }
  | { readonly type: 'min' }
  | { readonly type: 'max' }
  | { readonly type: 'escape' }
  | { readonly type: 'grab' }
  | { readonly type: 'drop' };

/**
 * Lo que hace `keydown` sobre un control, o `null` si no la usa (puede ser un atajo). Los botones
 * se pulsan con su Intro y su Espacio nativos (`click`); aquí solo se añade Mayús+Intro = mantener.
 */
export function keyDown(spec: ControlSpec, input: KeyInput): KeyAction | null {
  if (input.ctrlKey || input.altKey || input.metaKey) return null;
  const { key, shiftKey } = input;
  if (spec.role === 'button') {
    return key === 'Enter' && shiftKey && spec.gestures.includes('hold') && !input.repeat
      ? { type: 'hold' }
      : null;
  }
  if (spec.kind === 'disc') {
    if (key === ' ' || key === 'Enter') return input.repeat ? { type: 'none' } : { type: 'grab' };
    const steps = arrowSteps(key, shiftKey);
    return steps === null ? null : { type: 'step', steps };
  }
  if (key === 'Enter') {
    if (input.repeat) return null;
    if (shiftKey) return spec.gestures.includes('hold') ? { type: 'hold' } : null;
    return spec.gestures.includes('press') ? { type: 'press' } : null;
  }
  if (key === 'Escape') return { type: 'escape' };
  if (key === 'Home') return { type: 'min' };
  if (key === 'End') return { type: 'max' };
  if (key === 'PageUp') return { type: 'step', steps: BIG_STEP };
  if (key === 'PageDown') return { type: 'step', steps: -BIG_STEP };
  const steps = arrowSteps(key, shiftKey);
  return steps === null ? null : { type: 'step', steps };
}

/** Lo que hace `keyup`: solo soltar el disco. */
export function keyUp(spec: ControlSpec, input: KeyInput): KeyAction | null {
  return spec.kind === 'disc' && (input.key === ' ' || input.key === 'Enter')
    ? { type: 'drop' }
    : null;
}

function arrowSteps(key: string, shift: boolean): number | null {
  const size = shift ? BIG_STEP : 1;
  if (key === 'ArrowUp' || key === 'ArrowRight') return size;
  if (key === 'ArrowDown' || key === 'ArrowLeft') return -size;
  return null;
}

export type Shortcut =
  | { readonly type: 'play' }
  | { readonly type: 'record' }
  | { readonly type: 'undo' }
  | { readonly type: 'select'; readonly layer: number }
  | { readonly type: 'help' };

/**
 * Atajo de una tecla con el foco dentro del instrumento, o `null`. `focused` es el control que
 * tiene el foco (o `null`): si usa la tecla, el atajo no se dispara.
 */
export function shortcutFor(input: KeyInput, focused: ControlSpec | null): Shortcut | null {
  if (input.ctrlKey || input.altKey || input.metaKey || input.repeat) return null;
  const { key } = input;
  if (key === ' ') {
    // Espacio pulsa una tecla (botón nativo) y mantiene el disco: ahí manda el control.
    if (focused && (focused.role === 'button' || focused.kind === 'disc')) return null;
    return { type: 'play' };
  }
  if (key === '?') return { type: 'help' };
  const lower = key.toLowerCase();
  if (lower === 'r') return { type: 'record' };
  if (lower === 'z') return { type: 'undo' };
  if (key >= '1' && key <= '4') return { type: 'select', layer: Number(key) - 1 };
  return null;
}
