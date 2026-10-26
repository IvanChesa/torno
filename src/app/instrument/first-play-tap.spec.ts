// Primera reproducción y tempo por pulsaciones (PLAN fase 3, tareas 5 y 6).
import { describe, expect, it } from 'vitest';
import { displayModel, type DisplayContext } from './display';
import {
  initialState,
  reduce,
  TAP_RESET_MS,
  type InstrumentInput,
  type InstrumentIntent,
  type InstrumentLayerStatus,
  type InstrumentState,
  type InstrumentStatus,
} from './instrument';
import { MENU } from './menu';

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

const status = (change: Partial<InstrumentStatus> = {}): InstrumentStatus => ({
  transport: 'stopped',
  recording: 'idle',
  recordLayer: -1,
  standby: false,
  layers: [EMPTY, EMPTY, EMPTY, EMPTY],
  ...change,
});

function run(
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

const CONTEXT: DisplayContext = {
  recordSeconds: 0,
  countInBeats: 0,
  mic: 'off',
  autoLatencyMs: 0,
  message: '',
};

/** Índices del menú: BUCLE y su «MARCAR TEMPO». */
const LOOP = MENU.items.findIndex((item) => item.label === 'BUCLE');
const loopList = MENU.items[LOOP];
const TAP =
  loopList?.kind === 'list'
    ? loopList.items.findIndex((item) => item.label === 'MARCAR TEMPO')
    : -1;

/** Abre el menú y deja el cursor en BUCLE → MARCAR TEMPO. */
const toTap: InstrumentInput[] = [
  { type: 'press', control: 'main' },
  { type: 'turn', control: 'main', steps: LOOP },
  { type: 'press', control: 'main' },
  { type: 'turn', control: 'main', steps: TAP },
];
const tapAt = (at: number): InstrumentInput => ({ type: 'press', control: 'main', at });

describe('primera reproducción', () => {
  it('con la sesión vacía: la batería ALFAR en la capa 1, reproducir y la capa 2 elegida', () => {
    const { state, intents } = run([{ type: 'press', control: 'play' }]);
    expect(intents).toEqual([{ type: 'start-with-sound', layer: 0, sound: 'alfar' }]);
    expect(state.selected).toBe(1);
    expect(state.firstPlay).toBe(false);
    // La segunda vez (pausada), reproducir sin más.
    expect(run([{ type: 'press', control: 'play' }], status(), state).intents).toEqual([
      { type: 'play' },
    ]);
  });

  it('solo la primera vez y solo con la sesión vacía', () => {
    const withLayer = status({ layers: [EMPTY, { ...EMPTY, hasContent: true }, EMPTY, EMPTY] });
    const first = run([{ type: 'press', control: 'play' }], withLayer);
    expect(first.intents).toEqual([{ type: 'play' }]);
    expect(first.state.selected).toBe(0);
    // Ya se ha reproducido una vez: aunque se vacíe la sesión, no vuelve a poner la batería.
    expect(run([{ type: 'press', control: 'play' }], status(), first.state).intents).toEqual([
      { type: 'play' },
    ]);
    // Elegir un sonido (o grabar) antes de que llegue el estado del audio también la consume.
    const chosen = run([
      { type: 'press', control: 'main' },
      { type: 'press', control: 'main' },
      { type: 'press', control: 'main' },
      { type: 'press', control: 'main' },
    ]);
    expect(chosen.intents).toEqual([{ type: 'set-sound', layer: 0, sound: 'alfar' }]);
    expect(chosen.state.firstPlay).toBe(false);
    expect(run([{ type: 'press', control: 'record' }]).state.firstPlay).toBe(false);
    // Durante una toma (grabar con el transporte parado), tampoco.
    const taking = status({ recording: 'count-in', recordLayer: 0 });
    expect(run([{ type: 'press', control: 'play' }], taking).intents).toEqual([{ type: 'play' }]);
  });
});

describe('tempo por pulsaciones', () => {
  it('está en BUCLE y enseña el tempo', () => {
    expect(TAP).toBeGreaterThan(0);
    const { state } = run(toTap);
    const row = displayModel(state, status(), CONTEXT).rows[TAP];
    expect(row).toEqual({ label: 'MARCAR TEMPO', value: '90 BPM', selected: true, editing: false });
  });

  it('dos pulsaciones dan el tempo; con más, la media de los últimos 4 intervalos', () => {
    const { state, intents } = run([...toTap, tapAt(1000), tapAt(1500)]);
    expect(intents).toEqual([{ type: 'set-tempo', bpm: 120 }]);
    expect(state.controls.bpm).toBe(120);
    // 600, 600, 700 y 600 ms: media 625 ms = 96 BPM. El primer intervalo (500) ya no cuenta.
    const more = run([tapAt(2100), tapAt(2700), tapAt(3400), tapAt(4000)], status(), state);
    expect(more.state.controls.bpm).toBe(96);
    expect(more.state.taps).toHaveLength(5);
    expect(displayModel(more.state, status(), CONTEXT).rows[TAP]?.value).toBe('96 BPM');
  });

  it('tras 2 s sin pulsar empieza de nuevo; dentro de 40–240; sin repetir el mismo tempo', () => {
    const { state } = run([...toTap, tapAt(0), tapAt(500)]);
    const later = run([tapAt(500 + TAP_RESET_MS + 1)], status(), state);
    expect(later.intents).toEqual([]);
    expect(later.state.taps).toHaveLength(1);
    // Muy deprisa (100 ms): 240 BPM como mucho. Muy despacio no llega: a los 2 s ya se reinicia.
    expect(run([...toTap, tapAt(0), tapAt(100)]).intents).toEqual([
      { type: 'set-tempo', bpm: 240 },
    ]);
    const slow = run([...toTap, tapAt(0), tapAt(1990)]);
    expect(slow.intents).toEqual([{ type: 'set-tempo', bpm: 40 }]);
    // Un intervalo que da el tempo que ya hay no pide nada.
    expect(run([...toTap, tapAt(0), tapAt(667)]).intents).toEqual([]);
  });

  it('sin el momento de la pulsación no hace nada, y durante una toma está bloqueado', () => {
    const { state } = run([...toTap, { type: 'press', control: 'main' }]);
    expect(state.taps).toEqual([]);
    const taking = status({ recording: 'recording', recordLayer: 0, transport: 'playing' });
    expect(run([...toTap, tapAt(0)], taking).intents).toEqual([{ type: 'locked' }]);
  });
});
