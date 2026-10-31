import { describe, expect, it } from 'vitest';
import { CONTROLS, control, controlLayer, layerControl } from './catalog';
import {
  accelerated,
  CIRCULAR_SWEEP,
  circularSteps,
  DIAL_SWEEP,
  gesture,
  IDLE,
  MENU_STEP_ANGLE,
  wrapAngle,
  type GestureInput,
  type GestureOutput,
  type GestureState,
} from './gestures';
import { keyDown, keyUp, shortcutFor, type KeyInput } from './keyboard';

/** Pasa una secuencia de entradas y devuelve todo lo que ha pasado. */
function run(inputs: GestureInput[], config = {}): GestureOutput[] {
  let state: GestureState = IDLE;
  const outputs: GestureOutput[] = [];
  for (const input of inputs) {
    const next = gesture(state, input, config);
    state = next.state;
    outputs.push(...next.outputs);
  }
  return outputs;
}

const down = (time: number, x = 0, y = 0): GestureInput => ({ type: 'down', time, x, y });
const move = (time: number, x: number, y = 0): GestureInput => ({ type: 'move', time, x, y });
const up = (time: number): GestureInput => ({ type: 'up', time });
const tick = (time: number): GestureInput => ({ type: 'tick', time });

describe('gestos', () => {
  it('pulsar: soltar antes de 500 ms sin moverse', () => {
    expect(run([down(0), tick(200), up(499)])).toEqual([{ type: 'press' }]);
  });

  it('mantener: 500 ms sin moverse; al soltar, release', () => {
    expect(run([down(0), tick(499), tick(500), up(900)])).toEqual([
      { type: 'hold' },
      { type: 'release' },
    ]);
    // Si el temporizador no llegó, el mantener se reconoce al soltar.
    expect(run([down(0), up(800)])).toEqual([{ type: 'hold' }, { type: 'release' }]);
    // Un control sin «mantener» se pulsa aunque se tarde.
    expect(run([down(0), tick(600), up(800)], { hold: false })).toEqual([{ type: 'press' }]);
  });

  it('girar: moverse más allá del umbral cancela la pulsación y da los desplazamientos', () => {
    expect(run([down(0, 10, 10), move(10, 14, 10), up(100)])).toEqual([{ type: 'press' }]);
    expect(run([down(0, 10, 10), move(10, 10, 30), move(20, 10, 25), tick(600), up(700)])).toEqual([
      { type: 'turn', dx: 0, dy: 20 },
      { type: 'turn', dx: 0, dy: -5 },
    ]);
  });

  it('en las teclas (sin girar), moverse no cancela la pulsación ni el mantener', () => {
    expect(run([down(0, 10, 10), move(10, 30, 25), up(100)], { turn: false })).toEqual([
      { type: 'press' },
    ]);
    expect(run([down(0), move(100, 40, 40), tick(500), up(900)], { turn: false })).toEqual([
      { type: 'hold' },
      { type: 'release' },
    ]);
  });

  it('el disco se agarra al tocarlo, se arrastra y se suelta', () => {
    expect(run([down(0, 5, 5), move(10, 8, 9), up(20)], { grab: true })).toEqual([
      { type: 'grab' },
      { type: 'drag', dx: 3, dy: 4 },
      { type: 'drop' },
    ]);
  });

  it('cancelar suelta lo que estuviera agarrado o mantenido', () => {
    expect(run([down(0), { type: 'cancel' }])).toEqual([]);
    expect(run([down(0), tick(500), { type: 'cancel' }])).toEqual([
      { type: 'hold' },
      { type: 'release' },
    ]);
    expect(run([down(0), { type: 'cancel' }], { grab: true })).toEqual([
      { type: 'grab' },
      { type: 'drop' },
    ]);
  });
});

describe('catálogo', () => {
  it('12 controles con id único, nombre, gestos y rango en los sliders', () => {
    expect(CONTROLS).toHaveLength(12);
    expect(new Set(CONTROLS.map((spec) => spec.id)).size).toBe(12);
    for (const spec of CONTROLS) {
      expect(spec.name.length).toBeGreaterThan(2);
      expect(spec.hint.length).toBeGreaterThan(10);
      expect(spec.gestures.length).toBeGreaterThan(0);
      if (spec.role === 'slider' && spec.kind !== 'disc') {
        expect(spec.max).toBeGreaterThan(spec.min);
        expect(spec.bigStep).toBe(10 * spec.step);
      }
    }
    expect(control('main')).toMatchObject({ min: 40, max: 240, defaultValue: 90 });
    expect(layerControl(2)).toBe('layer-2');
    expect(controlLayer('layer-3')).toBe(3);
    expect(controlLayer('play')).toBe(-1);
  });
});

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  ...extra,
});

describe('teclado', () => {
  it('en los diales: flechas, Mayús ×10, Re Pág/Av Pág, Inicio/Fin, Intro y Mayús+Intro', () => {
    const dial = control('layer-0');
    expect(keyDown(dial, key('ArrowUp'))).toEqual({ type: 'step', steps: 1 });
    expect(keyDown(dial, key('ArrowLeft'))).toEqual({ type: 'step', steps: -1 });
    expect(keyDown(dial, key('ArrowRight', { shiftKey: true }))).toEqual({
      type: 'step',
      steps: 10,
    });
    expect(keyDown(dial, key('PageDown'))).toEqual({ type: 'step', steps: -10 });
    expect(keyDown(dial, key('Home'))).toEqual({ type: 'min' });
    expect(keyDown(dial, key('End'))).toEqual({ type: 'max' });
    expect(keyDown(dial, key('Enter'))).toEqual({ type: 'press' });
    expect(keyDown(dial, key('Enter', { shiftKey: true }))).toEqual({ type: 'hold' });
    expect(keyDown(dial, key('Escape'))).toEqual({ type: 'escape' });
    expect(keyDown(dial, key('a'))).toBeNull();
    expect(keyDown(dial, key('ArrowUp', { ctrlKey: true }))).toBeNull();
    // El brazo no se pulsa ni se mantiene.
    expect(keyDown(control('arm'), key('Enter'))).toBeNull();
    // Recorriendo una lista del menú, la flecha abajo va al elemento siguiente.
    expect(keyDown(control('main'), key('ArrowDown'), true)).toEqual({ type: 'step', steps: 1 });
    expect(keyDown(control('main'), key('ArrowUp'), true)).toEqual({ type: 'step', steps: -1 });
    expect(keyDown(control('main'), key('ArrowRight'), true)).toEqual({ type: 'step', steps: 1 });
  });

  it('en las teclas, Intro y Espacio son nativos; Mayús+Intro mantiene', () => {
    expect(keyDown(control('play'), key('Enter'))).toBeNull();
    expect(keyDown(control('play'), key(' '))).toBeNull();
    expect(keyDown(control('play'), key('Enter', { shiftKey: true }))).toEqual({ type: 'hold' });
    expect(keyDown(control('standby'), key('Enter', { shiftKey: true }))).toBeNull();
  });

  it('en el disco, Espacio lo mantiene mientras está pulsado y las flechas lo mueven', () => {
    const disc = control('disc');
    expect(keyDown(disc, key(' '))).toEqual({ type: 'grab' });
    expect(keyDown(disc, key(' ', { repeat: true }))).toEqual({ type: 'none' });
    expect(keyDown(disc, key('ArrowRight'))).toEqual({ type: 'step', steps: 1 });
    expect(keyUp(disc, key(' '))).toEqual({ type: 'drop' });
    expect(keyUp(control('main'), key(' '))).toBeNull();
  });

  it('atajos: Espacio, R, Z, 1–4 y ?; si el control usa la tecla, manda el control', () => {
    expect(shortcutFor(key(' '), control('layer-1'))).toEqual({ type: 'play' });
    expect(shortcutFor(key(' '), null)).toEqual({ type: 'play' });
    expect(shortcutFor(key(' '), control('record'))).toBeNull();
    expect(shortcutFor(key(' '), control('disc'))).toBeNull();
    expect(shortcutFor(key('r'), null)).toEqual({ type: 'record' });
    expect(shortcutFor(key('R'), null)).toEqual({ type: 'record' });
    expect(shortcutFor(key('z'), null)).toEqual({ type: 'undo' });
    expect(shortcutFor(key('3'), null)).toEqual({ type: 'select', layer: 2 });
    expect(shortcutFor(key('5'), null)).toBeNull();
    expect(shortcutFor(key('?'), null)).toEqual({ type: 'help' });
    expect(shortcutFor(key('r', { ctrlKey: true }), null)).toBeNull();
    expect(shortcutFor(key('r', { repeat: true }), null)).toBeNull();
  });
});

describe('arrastres', () => {
  it('despacio, un píxel es un píxel; deprisa, cuenta más, hasta ×4', () => {
    expect(accelerated(10, 100)).toBe(10);
    expect(accelerated(-10, 100)).toBe(-10);
    expect(accelerated(10, 10)).toBeGreaterThan(10);
    expect(accelerated(200, 10)).toBe(800);
    expect(accelerated(-200, 10)).toBe(-800);
    // Sin tiempo (dos movimientos en el mismo instante), sin aceleración.
    expect(accelerated(10, 0)).toBe(10);
  });

  it('en círculo, 270° son todo el recorrido; en el menú, una fila cada 20°', () => {
    expect(circularSteps(DIAL_SWEEP, 100, false)).toBeCloseTo(100, 10);
    expect(circularSteps(-DIAL_SWEEP / 2, 200, false)).toBeCloseTo(-100, 10);
    expect(circularSteps(MENU_STEP_ANGLE * 3, 200, true)).toBeCloseTo(3, 10);
    expect(CIRCULAR_SWEEP).toBeLessThan(DIAL_SWEEP);
  });

  it('los ángulos se dejan entre −π y π (el paso por detrás no da una vuelta entera)', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(wrapAngle(Math.PI / 2 - 2 * Math.PI)).toBeCloseTo(Math.PI / 2, 10);
    expect(wrapAngle(0.1)).toBeCloseTo(0.1, 10);
  });
});
