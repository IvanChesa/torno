// El modelo del instrumento (PLAN §4.5): cada gesto sobre cada control, los bloqueos durante una
// toma, el menú (recorrer nunca cambia el audio, confirmaciones con «Cancelar» primero) y la
// pantalla con su resumen para leer en voz.
import { describe, expect, it } from 'vitest';
import type { ControlId } from './catalog';
import { controlValue } from './control-value';
import { displayModel, sentences, type DisplayContext } from './display';
import {
  initialState,
  reduce,
  type InstrumentInput,
  type InstrumentIntent,
  type InstrumentLayerStatus,
  type InstrumentState,
  type InstrumentStatus,
} from './instrument';

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
  soundId: 'raiz',
  lengthBeats: 8,
};
const RECORDING: InstrumentLayerStatus = { ...LIBRARY, source: 'recording', soundId: '' };

function status(change: Partial<InstrumentStatus> = {}): InstrumentStatus {
  return {
    transport: 'stopped',
    recording: 'idle',
    recordLayer: -1,
    standby: false,
    layers: [LIBRARY, EMPTY, RECORDING, EMPTY],
    ...change,
  };
}

const TAKING = status({ recording: 'recording', recordLayer: 1, transport: 'playing' });

/** Aplica entradas en orden; devuelve el estado final y todas las intenciones. */
function play(
  inputs: InstrumentInput[],
  audio = status(),
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

const press = (control: ControlId): InstrumentInput => ({ type: 'press', control });
const hold = (control: ControlId): InstrumentInput => ({ type: 'hold', control });
const turn = (control: ControlId, steps: number): InstrumentInput => ({
  type: 'turn',
  control,
  steps,
});

describe('teclas de transporte', () => {
  it('reproducir alterna con pausa; mantener para', () => {
    expect(play([press('play')]).intents).toEqual([{ type: 'play' }]);
    expect(play([press('play')], status({ transport: 'playing' })).intents).toEqual([
      { type: 'pause' },
    ]);
    expect(play([hold('play')]).intents).toEqual([{ type: 'stop' }]);
  });

  it('grabar usa la capa elegida y los ajustes; con una toma en marcha la cierra en su capa', () => {
    const { intents } = play([{ type: 'select', layer: 3 }, press('record')]);
    expect(intents).toEqual([{ type: 'record', layer: 3, bars: 0, countIn: true, fitTempo: true }]);
    expect(play([press('record')], TAKING).intents).toEqual([
      { type: 'record', layer: 1, bars: 0, countIn: true, fitTempo: true },
    ]);
    expect(play([hold('record')], TAKING).intents).toEqual([{ type: 'cancel-recording' }]);
  });

  it('deshacer y rehacer (mantener) en la capa elegida; durante una toma, bloqueados', () => {
    expect(play([{ type: 'select', layer: 2 }, press('undo'), hold('undo')]).intents).toEqual([
      { type: 'undo', layer: 2 },
      { type: 'redo', layer: 2 },
    ]);
    expect(play([press('undo'), hold('undo')], TAKING).intents).toEqual([
      { type: 'locked' },
      { type: 'locked' },
    ]);
  });

  it('reposo y salir del reposo', () => {
    expect(play([press('standby')]).intents).toEqual([{ type: 'standby' }]);
    expect(play([press('standby')], status({ standby: true })).intents).toEqual([{ type: 'wake' }]);
  });
});

describe('diales, brazo, rueda y disco', () => {
  it('dial de capa: girar = nivel (1 % por paso, de 0 a 100), pulsar = elegir, mantener = silenciar', () => {
    const { state, intents } = play([
      turn('layer-1', -5),
      turn('layer-1', -200),
      turn('layer-1', 30),
      press('layer-1'),
      hold('layer-1'),
      hold('layer-1'),
    ]);
    expect(intents).toEqual([
      { type: 'set-level', layer: 1, level: 0.95 },
      { type: 'set-level', layer: 1, level: 0 },
      { type: 'set-level', layer: 1, level: 0.3 },
      { type: 'set-mute', layer: 1, muted: true },
      { type: 'set-mute', layer: 1, muted: false },
    ]);
    expect(state.selected).toBe(1);
    expect(state.controls.layers[1]).toMatchObject({ level: 0.3, muted: false });
    // En los extremos, girar más no envía nada.
    expect(play([turn('layer-0', 3)]).intents).toEqual([]);
  });

  it('durante una toma no se cambia de capa, pero niveles y silencio siguen libres', () => {
    expect(play([press('layer-2'), turn('layer-2', -10), hold('layer-2')], TAKING).intents).toEqual(
      [
        { type: 'locked' },
        { type: 'set-level', layer: 2, level: 0.9 },
        { type: 'set-mute', layer: 2, muted: true },
      ],
    );
  });

  it('dial principal con el menú cerrado: tempo de 40 a 240 BPM, entero; bloqueado en una toma', () => {
    expect(
      play([turn('main', 10), turn('main', 1000), { type: 'set', control: 'main', value: 33.4 }])
        .intents,
    ).toEqual([
      { type: 'set-tempo', bpm: 100 },
      { type: 'set-tempo', bpm: 240 },
      { type: 'set-tempo', bpm: 40 },
    ]);
    expect(play([turn('main', 1)], TAKING).intents).toEqual([{ type: 'locked' }]);
  });

  it('el brazo filtra la capa elegida y la rueda es el volumen', () => {
    const { intents } = play([
      { type: 'select', layer: 2 },
      turn('arm', 25),
      { type: 'set', control: 'volume', value: 42 },
    ]);
    expect(intents).toEqual([
      { type: 'set-filter', layer: 2, amount: 0.25 },
      { type: 'set-volume', volume: 0.42 },
    ]);
  });

  it('el disco: agarrar la capa elegida, arrastrar por vueltas, soltar; flechas de 1/16', () => {
    const { intents } = play([
      { type: 'select', layer: 3 },
      { type: 'grab' },
      { type: 'drag', turns: 0.5 },
      turn('disc', 2),
      { type: 'drop' },
      { type: 'drop' },
    ]);
    expect(intents).toEqual([
      { type: 'disc-hold', layer: 3 },
      { type: 'disc-move', turns: 0.5 },
      { type: 'disc-move', turns: 0.625 },
      { type: 'disc-release' },
    ]);
    expect(play([{ type: 'grab' }], TAKING).intents).toEqual([{ type: 'locked' }]);
  });
});

describe('menú', () => {
  const open = press('main');

  it('se abre al pulsar; girar solo recorre (nunca cambia el audio); mantener vuelve y cierra', () => {
    const { state, intents } = play([open, turn('main', 2), turn('main', 50), turn('main', -1)]);
    expect(intents).toEqual([]);
    expect(state.menu).toMatchObject({ open: true, path: [], cursor: 3 });
    const entered = play([press('main'), turn('main', 1), press('main')], status(), state).state;
    expect(entered.menu.path).toEqual([3]);
    const back = play([hold('main')], status(), entered).state;
    expect(back.menu).toMatchObject({ path: [], cursor: 3 });
    expect(play([{ type: 'escape' }], status(), back).state.menu.open).toBe(false);
  });

  it('un ajuste se prueba al girar, se deja al pulsar y se deshace con Esc', () => {
    // BUCLE (1) → METRÓNOMO (2): pulsar, girar a SÍ, pulsar.
    const loop = [open, turn('main', 1), press('main'), turn('main', 2), press('main')];
    const kept = play([...loop, turn('main', 1), press('main')]);
    expect(kept.intents).toEqual([{ type: 'set-metronome', enabled: true }]);
    expect(kept.state.settings.metronome).toBe(true);
    expect(kept.state.menu.edit).toBeNull();
    const reverted = play([...loop, turn('main', 1), { type: 'escape' }]);
    expect(reverted.intents).toEqual([
      { type: 'set-metronome', enabled: true },
      { type: 'set-metronome', enabled: false },
    ]);
    expect(reverted.state.settings.metronome).toBe(false);
  });

  it('duración de la toma, panorama y reverso de la capa elegida', () => {
    const loop = [{ type: 'select', layer: 1 } as const, open, turn('main', 1), press('main')];
    const result = play([
      ...loop,
      press('main'),
      turn('main', 3),
      press('main'),
      turn('main', 3),
      press('main'),
      turn('main', 1),
      press('main'),
      turn('main', 1),
      press('main'),
      turn('main', -4),
      press('main'),
    ]);
    expect(result.state.settings.takeBars).toBe(4);
    expect(result.intents).toEqual([
      { type: 'set-reverse', layer: 1, reversed: true },
      { type: 'set-pan', layer: 1, pan: -0.2 },
    ]);
  });

  it('elegir un sonido: en una capa de la biblioteca o vacía, directo; sobre una grabación, pide confirmación con «Cancelar» primero', () => {
    // SONIDO (0) → BAJO (1) → RAÍZ (0).
    const choose = [open, press('main'), turn('main', 1), press('main'), press('main')];
    expect(play(choose).intents).toEqual([{ type: 'set-sound', layer: 0, sound: 'raiz' }]);
    const onRecording = [{ type: 'select', layer: 2 } as const, ...choose];
    const asked = play(onRecording);
    expect(asked.intents).toEqual([]);
    expect(asked.state.menu.confirm).toMatchObject({ yes: false });
    // Pulsar sin girar = «Cancelar».
    expect(play([...onRecording, press('main')]).intents).toEqual([]);
    expect(play([...onRecording, turn('main', 1), press('main')]).intents).toEqual([
      { type: 'set-sound', layer: 2, sound: 'raiz' },
    ]);
    // APAGADO (el último de la lista).
    expect(
      play([open, press('main'), press('main'), turn('main', 5), press('main')]).intents,
    ).toEqual([{ type: 'set-sound', layer: 0, sound: null }]);
  });

  it('sesión: guardar, cargar y exportar al momento; borrar capa y sesión nueva confirman', () => {
    const session = [open, turn('main', 3), press('main')];
    expect(play([...session, press('main')]).intents).toEqual([{ type: 'save' }]);
    expect(play([...session, turn('main', 1), press('main')]).intents).toEqual([{ type: 'open' }]);
    expect(play([...session, turn('main', 3), press('main')]).intents).toEqual([
      { type: 'export-stems' },
    ]);
    // EXPORTAR MEZCLA → VUELTAS a 2 → EXPORTAR.
    expect(
      play([
        ...session,
        turn('main', 2),
        press('main'),
        press('main'),
        turn('main', -2),
        press('main'),
        turn('main', 2),
        press('main'),
      ]).intents,
    ).toEqual([{ type: 'export-mix', repeats: 2, fadeOut: true }]);
    const clear = [...session, turn('main', 4), press('main')];
    expect(play(clear).intents).toEqual([]);
    expect(play([...clear, turn('main', 1), press('main')]).intents).toEqual([
      { type: 'clear-layer', layer: 0 },
    ]);
    const reset = play([
      ...session,
      turn('main', 5),
      press('main'),
      turn('main', 1),
      press('main'),
    ]);
    expect(reset.intents).toEqual([{ type: 'reset' }]);
    expect(reset.state.selected).toBe(0);
  });

  it('durante una toma, los archivos están bloqueados', () => {
    const session = [open, turn('main', 3), press('main')];
    expect(play([...session, press('main')], TAKING).intents).toEqual([{ type: 'locked' }]);
  });

  it('entrada: ganancia de 0 a 200 % y latencia automática, calibrada o manual', () => {
    const input = [open, turn('main', 2), press('main')];
    expect(play([...input, press('main'), turn('main', 4), press('main')]).intents).toEqual([
      { type: 'set-input-gain', gain: 1.2 },
    ]);
    const latency = [...input, turn('main', 1), press('main')];
    expect(play([...latency, press('main')]).intents).toEqual([
      { type: 'set-latency', mode: 'auto', ms: 0 },
    ]);
    expect(play([...latency, turn('main', 1), press('main')]).intents).toEqual([
      { type: 'calibrate' },
    ]);
    const manual = play([
      ...latency,
      turn('main', 2),
      press('main'),
      turn('main', 35),
      press('main'),
    ]);
    expect(manual.intents).toEqual([{ type: 'set-latency', mode: 'manual', ms: 35 }]);
    expect(manual.state.settings.latency).toEqual({ mode: 'manual', ms: 35 });
  });

  it('ayuda: se abre un texto y se vuelve', () => {
    const { state } = play([open, turn('main', 4), press('main'), press('main')]);
    expect(state.menu.reading).toBe(true);
    expect(play([press('main')], status(), state).state.menu.reading).toBe(false);
  });
});

const CONTEXT: DisplayContext = {
  recordSeconds: 0,
  countInBeats: 0,
  mic: 'off',
  autoLatencyMs: 42,
  message: '',
};

describe('pantalla', () => {
  it('principal: tempo, transporte, capa elegida y su contenido', () => {
    const view = displayModel(initialState(), status({ transport: 'playing' }), CONTEXT);
    expect(view.mode).toBe('main');
    expect(view.lines).toEqual(['90 BPM · EN MARCHA', 'CAPA 1 · BAJO · RAÍZ']);
    expect(view.status).toBe('TOMA LIBRE');
    expect(view.pilots.map((p) => p.hasContent)).toEqual([true, false, true, false]);
    expect(view.summary).toBe('90 bpm, en marcha. Capa 1, bajo, raíz. Toma libre.');
  });

  it('la línea de estado: aviso, micrófono, cuenta previa, grabación, disco y cola', () => {
    const base = initialState();
    const layers = [LIBRARY, { ...EMPTY, pending: true }, RECORDING, EMPTY];
    expect(displayModel(base, status({ layers }), CONTEXT).status).toBe('EN COLA · CAPA 2');
    expect(displayModel({ ...base, discHeld: true }, status(), CONTEXT).status).toBe('DISCO');
    expect(displayModel(base, TAKING, { ...CONTEXT, recordSeconds: 1.25 }).status).toBe(
      'GRABANDO 1,3 S',
    );
    expect(
      displayModel(base, status({ recording: 'count-in' }), { ...CONTEXT, countInBeats: 2.2 })
        .status,
    ).toBe('CUENTA 3');
    expect(displayModel(base, status(), { ...CONTEXT, mic: 'requesting' }).status).toBe(
      'PIDIENDO EL MICRÓFONO',
    );
    expect(displayModel(base, status(), { ...CONTEXT, message: 'GUARDADO' }).status).toBe(
      'GUARDADO',
    );
  });

  it('menú: filas con su valor, la elegida y la que se ajusta', () => {
    const { state } = play([press('main'), turn('main', 1), press('main'), press('main')]);
    const view = displayModel(state, status(), CONTEXT);
    expect(view.mode).toBe('menu');
    expect(view.title).toBe('BUCLE');
    expect(view.rows[0]).toEqual({
      label: 'DURACIÓN',
      value: 'LIBRE',
      selected: true,
      editing: true,
    });
    expect(view.rows.map((row) => row.value)).toEqual([
      'LIBRE',
      'SÍ',
      'NO',
      'NO',
      'C',
      '90 BPM',
      'SÍ',
    ]);
    expect(view.summary).toContain('Duración: libre.');
  });

  it('confirmación: la pregunta y las dos opciones, con «Cancelar» elegida', () => {
    const { state } = play([
      press('main'),
      turn('main', 3),
      press('main'),
      turn('main', 5),
      press('main'),
    ]);
    const view = displayModel(state, status(), CONTEXT);
    expect(view.mode).toBe('confirm');
    expect(view.lines).toEqual(['¿EMPEZAR DE CERO?']);
    expect(view.rows.map((row) => [row.label, row.selected])).toEqual([
      ['CANCELAR', true],
      ['EMPEZAR', false],
    ]);
  });

  it('el resumen en voz convierte las líneas de pantalla en frases', () => {
    expect(sentences(['CAPA 2 · VACÍA', 'EN COLA · CAPA 3'])).toBe(
      'Capa 2, vacía. En cola, capa 3.',
    );
  });
});

describe('valor de los controles para los lectores de pantalla', () => {
  it('diales de capa, tempo, brazo, rueda y disco', () => {
    const { state } = play([turn('layer-1', -30), hold('layer-1'), turn('arm', 40)]);
    expect(controlValue('layer-1', state, status())).toEqual({
      now: 70,
      min: 0,
      max: 100,
      text: '70 %, en silencio',
    });
    expect(controlValue('main', state, status())).toEqual({
      now: 90,
      min: 40,
      max: 240,
      text: '90 pulsos por minuto',
    });
    expect(controlValue('arm', state, status())?.text).toBe('Filtro al 40 %');
    expect(controlValue('arm', initialState(), status())?.text).toBe('Sin filtro');
    expect(controlValue('volume', state, status())?.text).toBe('100 %');
    const playing = status({
      layers: [{ ...LIBRARY, positionBeats: 2.46 }, EMPTY, RECORDING, EMPTY],
    });
    // Suelto, el disco no sigue al transporte (un lector de pantalla lo leería sin parar).
    expect(controlValue('disc', initialState(), playing)).toEqual({
      now: 0,
      min: 0,
      max: 8,
      text: 'Capa 1, 8 pulsos',
    });
    expect(controlValue('disc', initialState(), status())).toEqual(
      controlValue('disc', initialState(), playing),
    );
    expect(controlValue('disc', { ...initialState(), discHeld: true }, playing)).toEqual({
      now: 2.5,
      min: 0,
      max: 8,
      text: 'Congelado en el pulso 3,5 de 8',
    });
    expect(controlValue('disc', { ...initialState(), selected: 1 }, playing)?.text).toBe(
      'Sin capa',
    );
    expect(controlValue('play', state, status())).toBeNull();
  });

  it('con el menú abierto, el dial principal dice el elemento y su valor', () => {
    const { state } = play([press('main'), turn('main', 1), press('main')]);
    expect(controlValue('main', state, status())?.text).toBe('Menú: duración: libre');
  });
});
