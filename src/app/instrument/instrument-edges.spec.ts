// Los bordes del modelo del instrumento: entradas que no hacen nada, bloqueos de cada acción
// durante una toma, volver desde cada estado del menú y todo lo que puede enseñar la pantalla.
import { describe, expect, it } from 'vitest';
import { layerControl, type ControlId } from './catalog';
import { controlValue } from './control-value';
import { displayModel, type DisplayContext } from './display';
import {
  initialState,
  reduce,
  type InstrumentInput,
  type InstrumentIntent,
  type InstrumentLayerStatus,
  type InstrumentState,
  type InstrumentStatus,
} from './instrument';
import { keyDown, keyUp, shortcutFor, type KeyInput } from './keyboard';
import { control } from './catalog';
import { listAt, MENU } from './menu';
import { soundLabel } from './sounds';
import { gesture, IDLE } from './gestures';

const EMPTY: InstrumentLayerStatus = {
  hasContent: false,
  source: 'empty',
  soundId: '',
  pending: false,
  undo: 0,
  redo: 0,
  lengthBeats: 0,
  positionBeats: 0,
};
const LIBRARY: InstrumentLayerStatus = {
  ...EMPTY,
  hasContent: true,
  source: 'library',
  soundId: 'prueba-bateria',
  lengthBeats: 8,
};
const RECORDING: InstrumentLayerStatus = {
  ...EMPTY,
  hasContent: true,
  source: 'recording',
  lengthBeats: 6.5,
};

const IDLE_AUDIO: InstrumentStatus = {
  transport: 'stopped',
  recording: 'idle',
  recordLayer: -1,
  standby: false,
  layers: [LIBRARY, EMPTY, RECORDING, EMPTY],
};
const TAKING: InstrumentStatus = { ...IDLE_AUDIO, recording: 'count-in', recordLayer: 0 };
const CONTEXT: DisplayContext = {
  recordSeconds: 0,
  countInBeats: 0,
  mic: 'off',
  autoLatencyMs: 42,
  message: '',
};

function play(
  inputs: InstrumentInput[],
  audio = IDLE_AUDIO,
  start: InstrumentState = initialState(),
): { state: InstrumentState; intents: InstrumentIntent[] } {
  let state = start;
  const intents: InstrumentIntent[] = [];
  for (const input of inputs) {
    const next = reduce(state, input, audio);
    state = next.state;
    intents.push(...next.intents);
  }
  return { state, intents };
}

const press = (c: ControlId): InstrumentInput => ({ type: 'press', control: c });
const hold = (c: ControlId): InstrumentInput => ({ type: 'hold', control: c });
const turn = (c: ControlId, steps: number): InstrumentInput => ({
  type: 'turn',
  control: c,
  steps,
});
/** Abre el menú y entra por `path` (índices). */
const into = (...path: number[]): InstrumentInput[] => [
  press('main'),
  ...path.flatMap((index) => [turn('main', index), press('main')]),
];

describe('entradas que no hacen nada', () => {
  it('capas fuera de rango, giros de cero, valores no finitos y gestos que un control no tiene', () => {
    const start = initialState();
    const { state, intents } = play([
      { type: 'select', layer: 7 },
      { type: 'select', layer: 0 },
      turn('layer-0', 0),
      turn('layer-0', Number.NaN),
      { type: 'set', control: 'arm', value: Number.POSITIVE_INFINITY },
      { type: 'set', control: 'play', value: 5 },
      turn('play', 3),
      press('arm'),
      hold('arm'),
      hold('standby'),
      { type: 'drag', turns: 1 },
      { type: 'drop' },
      turn('disc', 2),
      { type: 'set', control: 'arm', value: 0 },
      { type: 'set', control: 'volume', value: 100 },
      { type: 'escape' },
    ]);
    expect(intents).toEqual([]);
    expect(state).toEqual(start);
  });

  it('con el menú abierto, el dial principal no cambia el tempo y Esc cierra antes la chuleta', () => {
    const opened = play([press('main')]).state;
    expect(
      reduce(opened, { type: 'set', control: 'main', value: 120 }, IDLE_AUDIO).intents,
    ).toEqual([]);
    const help = play([{ type: 'toggle-help' }], IDLE_AUDIO, opened).state;
    expect(help.help).toBe(true);
    const escaped = play([{ type: 'escape' }], IDLE_AUDIO, help).state;
    expect(escaped.help).toBe(false);
    expect(escaped.menu.open).toBe(true);
  });
});

describe('bloqueos durante una toma (también en la cuenta previa)', () => {
  it.each([
    ['calibrar', [2, 1, 1]],
    ['guardar', [3, 0]],
    ['cargar', [3, 1]],
    ['exportar la mezcla', [3, 2, 2]],
    ['exportar las pistas', [3, 3]],
    ['borrar la capa', [3, 4]],
    ['sesión nueva', [3, 5]],
    ['elegir un sonido', [0, 0, 0]],
  ])('%s', (_name, path) => {
    expect(play(into(...path), TAKING).intents).toEqual([{ type: 'locked' }]);
  });

  it('el reverso de la capa, el tempo y el disco', () => {
    // BUCLE → REVERSO: entrar a ajustarlo se puede; girarlo, no.
    expect(play([...into(1, 3), turn('main', 1)], TAKING).intents).toEqual([{ type: 'locked' }]);
    expect(play([{ type: 'set', control: 'main', value: 100 }], TAKING).intents).toEqual([
      { type: 'locked' },
    ]);
  });

  it('borrar el autoguardado sí se puede; una confirmación que llega durante la toma, no', () => {
    const asked = play(into(3, 6)).state;
    expect(play([turn('main', 1), press('main')], TAKING, asked).intents).toEqual([
      { type: 'clear-autosave' },
    ]);
    const clear = play(into(3, 4)).state;
    expect(play([turn('main', 1), press('main')], TAKING, clear).intents).toEqual([
      { type: 'locked' },
    ]);
  });
});

describe('volver en el menú', () => {
  it('desde una confirmación (girar a la izquierda es «Cancelar»), un texto y un ajuste numérico', () => {
    const asked = play(into(3, 4)).state;
    const left = play([turn('main', 1), turn('main', -1)], IDLE_AUDIO, asked).state;
    expect(left.menu.confirm?.yes).toBe(false);
    expect(play([hold('main')], IDLE_AUDIO, asked).state.menu.confirm).toBeNull();
    const reading = play(into(4, 1)).state;
    expect(reading.menu.reading).toBe(true);
    expect(play([turn('main', 1)], IDLE_AUDIO, reading).state).toEqual(reading);
    expect(play([{ type: 'escape' }], IDLE_AUDIO, reading).state.menu.reading).toBe(false);
    // PANORAMA: se prueba a la derecha y Esc lo devuelve al centro.
    const pan = play([...into(1, 4), turn('main', 3), { type: 'escape' }]);
    expect(pan.intents).toEqual([
      { type: 'set-pan', layer: 0, pan: 0.15 },
      { type: 'set-pan', layer: 0, pan: 0 },
    ]);
  });

  it('un ajuste en el tope no cambia nada', () => {
    // GANANCIA ya en 100 %: Inicio no existe en el menú, pero girar mucho se queda en 200 %.
    const { intents } = play([...into(2, 0), turn('main', 100), turn('main', 1)]);
    expect(intents).toEqual([{ type: 'set-input-gain', gain: 2 }]);
  });

  it('un camino que no lleva a una lista devuelve la última lista válida', () => {
    expect(listAt([0, 0, 0])).toBe(listAt([0, 0]));
    expect(listAt([99])).toBe(MENU);
  });
});

describe('pantalla', () => {
  it('la capa elegida: grabación, silencio y reposo', () => {
    const { state } = play([{ type: 'select', layer: 2 }, hold('layer-2')]);
    const view = displayModel(state, { ...IDLE_AUDIO, standby: true }, CONTEXT);
    expect(view.lines).toEqual(['90 BPM · REPOSO', 'CAPA 3 · GRABACIÓN · SILENCIO']);
    expect(view.pilots[2]).toMatchObject({ selected: true, muted: true, hasContent: true });
  });

  it('la latencia: automática con su estimación, calibrada o manual', () => {
    const latency = play(into(2, 1)).state;
    expect(displayModel(latency, IDLE_AUDIO, CONTEXT).rows.map((r) => r.value)).toEqual([
      '42 MS •',
      '',
      '0 MS',
    ]);
    const calibrated: InstrumentState = {
      ...latency,
      settings: { ...latency.settings, latency: { mode: 'calibrated', ms: 12.46 } },
    };
    expect(displayModel(calibrated, IDLE_AUDIO, CONTEXT).rows.map((r) => r.value)).toEqual([
      '',
      '12,5 MS •',
      '12 MS',
    ]);
  });

  it('los sonidos marcan el que suena en la capa (o APAGADO si está vacía)', () => {
    const drums = play(into(0, 0)).state;
    expect(displayModel(drums, IDLE_AUDIO, CONTEXT).rows).toEqual([
      { label: 'PRUEBA', value: '•', selected: true, editing: false },
      { label: 'APAGADO', value: '', selected: false, editing: false },
    ]);
    const empty = { ...drums, selected: 1 };
    expect(displayModel(empty, IDLE_AUDIO, CONTEXT).rows.map((r) => r.value)).toEqual(['', '•']);
    const recorded = { ...drums, selected: 2 };
    expect(displayModel(recorded, IDLE_AUDIO, CONTEXT).rows.map((r) => r.value)).toEqual(['', '']);
  });

  it('el panorama, la ganancia y las listas', () => {
    const loop = play([...into(1, 4), turn('main', -4)]).state;
    expect(displayModel(loop, IDLE_AUDIO, CONTEXT).rows[4]).toEqual({
      label: 'PANORAMA',
      value: 'I 20',
      selected: true,
      editing: true,
    });
    const right = play([turn('main', 8), press('main')], IDLE_AUDIO, loop).state;
    expect(displayModel(right, IDLE_AUDIO, CONTEXT).rows[4]?.value).toBe('D 20');
    const input = play(into(2)).state;
    expect(displayModel(input, IDLE_AUDIO, CONTEXT).rows.map((r) => r.value)).toEqual([
      '100 %',
      '›',
    ]);
  });

  it('las confirmaciones: borrar la capa, el autoguardado y sustituir una grabación', () => {
    expect(displayModel(play(into(3, 4)).state, IDLE_AUDIO, CONTEXT).lines).toEqual([
      '¿BORRAR LA CAPA 1?',
    ]);
    expect(displayModel(play(into(3, 6)).state, IDLE_AUDIO, CONTEXT).lines).toEqual([
      '¿BORRAR EL AUTOGUARDADO?',
    ]);
    const replace = play([{ type: 'select', layer: 2 }, ...into(0, 1, 0)]).state;
    expect(displayModel(replace, IDLE_AUDIO, CONTEXT).lines).toEqual([
      '¿SUSTITUIR LA GRABACIÓN DE LA CAPA 3?',
    ]);
  });
});

describe('valores para los lectores de pantalla', () => {
  it('tempo con decimales, un ajuste numérico en el menú y el disco agarrado', () => {
    const fitted: InstrumentState = {
      ...initialState(),
      controls: { ...initialState().controls, bpm: 115.2 },
    };
    expect(controlValue('main', fitted, IDLE_AUDIO)?.text).toBe('115,2 pulsos por minuto');
    const gain = play([...into(2, 0), turn('main', 2)]).state;
    expect(controlValue('main', gain, IDLE_AUDIO)?.text).toBe('Menú: ganancia: 110');
    const list = play(into(3)).state;
    expect(controlValue('main', list, IDLE_AUDIO)?.text).toBe('Menú: guardar');
    const held = { ...play([{ type: 'select', layer: 2 }]).state, discHeld: true };
    const audio = {
      ...IDLE_AUDIO,
      layers: [LIBRARY, EMPTY, { ...RECORDING, positionBeats: 3 }, EMPTY],
    };
    expect(controlValue('disc', held, audio)).toEqual({
      now: 3,
      min: 0,
      max: 6.5,
      text: 'Congelado en el pulso 4,0 de 6,5',
    });
  });

  it('catálogo, teclado y sonidos: los casos por defecto', () => {
    expect(layerControl(9)).toBe('layer-0');
    expect(soundLabel('no-existe')).toBe('no-existe');
    const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
      key: k,
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      repeat: false,
      ...extra,
    });
    expect(keyDown(control('layer-0'), key('Enter', { repeat: true }))).toBeNull();
    expect(keyDown(control('volume'), key('Enter', { shiftKey: true }))).toBeNull();
    expect(keyDown(control('disc'), key('a'))).toBeNull();
    expect(keyDown(control('disc'), key('Enter'))).toEqual({ type: 'grab' });
    expect(keyDown(control('play'), key('Enter', { shiftKey: true, repeat: true }))).toBeNull();
    expect(keyUp(control('disc'), key('Enter'))).toEqual({ type: 'drop' });
    expect(shortcutFor(key('x'), null)).toBeNull();
    // Los gestos ignoran lo que no toca en cada fase.
    expect(gesture(IDLE, { type: 'move', time: 0, x: 1, y: 1 }).outputs).toEqual([]);
    const pending = gesture(IDLE, { type: 'down', time: 0, x: 0, y: 0 }).state;
    expect(gesture(pending, { type: 'down', time: 1, x: 0, y: 0 }).state).toBe(pending);
    const held = gesture(pending, { type: 'tick', time: 600 }).state;
    expect(gesture(held, { type: 'move', time: 700, x: 50, y: 50 }).outputs).toEqual([]);
    const turning = gesture(pending, { type: 'move', time: 10, x: 30, y: 0 }).state;
    expect(gesture(turning, { type: 'tick', time: 900 }).outputs).toEqual([]);
    const grabbed = gesture(IDLE, { type: 'down', time: 0, x: 0, y: 0 }, { grab: true }).state;
    expect(gesture(grabbed, { type: 'tick', time: 900 }).outputs).toEqual([]);
  });
});
