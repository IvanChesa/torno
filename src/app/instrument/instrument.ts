/**
 * Modelo del instrumento (PLAN §4.5, D11): qué hace cada gesto sobre cada control, el menú y los
 * ajustes. Es una función pura: (estado, entrada, estado del audio) → (estado nuevo, intenciones).
 * Las **intenciones** («reproducir», «nivel de la capa 2 al 70 %», «guardar»…) no conocen el
 * protocolo del audio: `SessionStore` las traduce a llamadas del motor.
 *
 * Los valores que se mueven en directo (niveles, panoramas, filtros, volumen y tempo) viven aquí
 * (`controls`): la interfaz responde al momento y el estado del audio, que llega 30 veces por
 * segundo como mucho, los confirma.
 */
import { controlLayer, type ControlId } from './catalog';
import {
  DEFAULT_BPM,
  DISC_TURNS_PER_STEP,
  LAYER_COUNT,
  MAX_BPM,
  MIN_BPM,
  TAKE_BARS,
  type TakeBars,
} from './constants';
import { listAt, type ActionId, type MenuItem, type SettingId } from './menu';
import { FIRST_PLAY_SOUND } from './sounds';

/** Tempo por pulsaciones: tras este tiempo sin pulsar, se empieza a contar de nuevo. */
export const TAP_RESET_MS = 2000;
/** Se promedian como mucho los últimos 4 intervalos. */
const TAP_INTERVALS = 4;

// --- Estado ------------------------------------------------------------------------------------

export interface LayerControls {
  /** 0–1. */
  readonly level: number;
  readonly muted: boolean;
  /** −1 (izquierda) a 1 (derecha). */
  readonly pan: number;
  readonly reversed: boolean;
  /** Brazo: 0 = sin filtro, 1 = el más cerrado. */
  readonly filter: number;
}

export interface InstrumentControls {
  readonly layers: readonly LayerControls[];
  /** 0–1. */
  readonly volume: number;
  readonly bpm: number;
}

export type LatencyMode = 'auto' | 'calibrated' | 'manual';

export interface InstrumentSettings {
  readonly takeBars: TakeBars;
  readonly countIn: boolean;
  readonly metronome: boolean;
  readonly fitTempo: boolean;
  /** 0–2. */
  readonly inputGain: number;
  readonly latency: { readonly mode: LatencyMode; readonly ms: number };
  /** Exportar la mezcla: vueltas (1–8) y fundido final. */
  readonly repeats: number;
  readonly fadeOut: boolean;
}

/** Lo que pide confirmación (con «Cancelar» seleccionado primero). */
export type ConfirmAction =
  | { readonly type: 'clear-layer'; readonly layer: number }
  | { readonly type: 'new-session' }
  | { readonly type: 'clear-autosave' }
  | { readonly type: 'replace'; readonly layer: number; readonly sound: string | null };

export interface MenuState {
  readonly open: boolean;
  /** Índices desde la raíz hasta la lista actual. */
  readonly path: readonly number[];
  readonly cursor: number;
  /** Ajustando un valor: el que se está probando y el que había (para volver con Esc). */
  readonly edit: { readonly value: number; readonly original: number } | null;
  /** Confirmación en pantalla: `yes` = la acción está seleccionada (empieza en «Cancelar»). */
  readonly confirm: { readonly action: ConfirmAction; readonly yes: boolean } | null;
  /** Leyendo un texto de ayuda. */
  readonly reading: boolean;
}

export interface InstrumentState {
  /** Capa elegida (0–3). */
  readonly selected: number;
  readonly controls: InstrumentControls;
  readonly settings: InstrumentSettings;
  readonly menu: MenuState;
  /** Vueltas del disco desde que se agarró. */
  readonly discTurns: number;
  readonly discHeld: boolean;
  /** Chuleta de atajos abierta. */
  readonly help: boolean;
  /**
   * Aún no se ha pulsado reproducir: la primera vez, con la sesión vacía, la capa 1 arranca con la
   * batería y queda elegida la capa 2 (PLAN §0.1).
   */
  readonly firstPlay: boolean;
  /** Cuándo se pulsó «MARCAR TEMPO» (ms, del reloj de la interfaz), los últimos 5. */
  readonly taps: readonly number[];
}

export const CLOSED_MENU: MenuState = {
  open: false,
  path: [],
  cursor: 0,
  edit: null,
  confirm: null,
  reading: false,
};

export const DEFAULT_LAYER: LayerControls = {
  level: 1,
  muted: false,
  pan: 0,
  reversed: false,
  filter: 0,
};

export const DEFAULT_SETTINGS: InstrumentSettings = {
  takeBars: 0,
  countIn: true,
  metronome: false,
  fitTempo: true,
  inputGain: 1,
  latency: { mode: 'auto', ms: 0 },
  repeats: 4,
  fadeOut: true,
};

export function initialState(): InstrumentState {
  return {
    selected: 0,
    controls: {
      layers: Array.from({ length: LAYER_COUNT }, () => DEFAULT_LAYER),
      volume: 1,
      bpm: DEFAULT_BPM,
    },
    settings: DEFAULT_SETTINGS,
    menu: CLOSED_MENU,
    discTurns: 0,
    discHeld: false,
    help: false,
    firstPlay: true,
    taps: [],
  };
}

// --- Estado del audio (lo que el modelo necesita saber) ----------------------------------------

export interface InstrumentLayerStatus {
  readonly hasContent: boolean;
  readonly source: 'empty' | 'library' | 'recording';
  readonly soundId: string;
  readonly pending: boolean;
  readonly undo: number;
  readonly redo: number;
  readonly lengthBeats: number;
  readonly positionBeats: number;
}

export interface InstrumentStatus {
  readonly transport: 'stopped' | 'playing' | 'pausing';
  readonly recording: 'idle' | 'count-in' | 'recording';
  readonly recordLayer: number;
  readonly standby: boolean;
  readonly layers: readonly InstrumentLayerStatus[];
}

// --- Entradas e intenciones -----------------------------------------------------------------------

export type InstrumentInput =
  /** `at`: cuándo (ms, reloj de la interfaz), para el tempo por pulsaciones. */
  | { readonly type: 'press'; readonly control: ControlId; readonly at?: number }
  | { readonly type: 'hold'; readonly control: ControlId }
  /** Pasos de un dial, del brazo o de la rueda (negativo = hacia atrás). */
  | { readonly type: 'turn'; readonly control: ControlId; readonly steps: number }
  /** Valor absoluto, en las unidades del control (%, o BPM en el dial principal). */
  | { readonly type: 'set'; readonly control: ControlId; readonly value: number }
  | { readonly type: 'grab' }
  /** Vueltas del disco desde que se agarró. */
  | { readonly type: 'drag'; readonly turns: number }
  | { readonly type: 'drop' }
  | { readonly type: 'escape' }
  | { readonly type: 'select'; readonly layer: number }
  | { readonly type: 'toggle-help' };

export type InstrumentIntent =
  | { readonly type: 'play' }
  | { readonly type: 'pause' }
  | { readonly type: 'stop' }
  | {
      readonly type: 'record';
      readonly layer: number;
      readonly bars: TakeBars;
      readonly countIn: boolean;
      readonly fitTempo: boolean;
    }
  | { readonly type: 'cancel-recording' }
  | { readonly type: 'undo'; readonly layer: number }
  | { readonly type: 'redo'; readonly layer: number }
  | { readonly type: 'set-level'; readonly layer: number; readonly level: number }
  | { readonly type: 'set-mute'; readonly layer: number; readonly muted: boolean }
  | { readonly type: 'set-pan'; readonly layer: number; readonly pan: number }
  | { readonly type: 'set-reverse'; readonly layer: number; readonly reversed: boolean }
  | { readonly type: 'set-filter'; readonly layer: number; readonly amount: number }
  | { readonly type: 'set-tempo'; readonly bpm: number }
  | { readonly type: 'set-volume'; readonly volume: number }
  | { readonly type: 'set-sound'; readonly layer: number; readonly sound: string | null }
  /** Primera reproducción: poner el sonido en la capa y, cuando esté, reproducir. */
  | { readonly type: 'start-with-sound'; readonly layer: number; readonly sound: string }
  | { readonly type: 'disc-hold'; readonly layer: number }
  | { readonly type: 'disc-move'; readonly turns: number }
  | { readonly type: 'disc-release' }
  | { readonly type: 'set-metronome'; readonly enabled: boolean }
  | { readonly type: 'set-input-gain'; readonly gain: number }
  | { readonly type: 'set-latency'; readonly mode: LatencyMode; readonly ms: number }
  | { readonly type: 'calibrate' }
  | { readonly type: 'save' }
  | { readonly type: 'open' }
  | { readonly type: 'export-mix'; readonly repeats: number; readonly fadeOut: boolean }
  | { readonly type: 'export-stems' }
  | { readonly type: 'clear-layer'; readonly layer: number }
  | { readonly type: 'reset' }
  | { readonly type: 'clear-autosave' }
  | { readonly type: 'standby' }
  | { readonly type: 'wake' }
  /** Algo no se puede hacer ahora (durante una toma). */
  | { readonly type: 'locked' };

export interface Reduction {
  readonly state: InstrumentState;
  readonly intents: readonly InstrumentIntent[];
}

// --- Reductor --------------------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Redondeo a centésimas (los porcentajes) sin errores de coma flotante acumulados. */
const hundredths = (value: number) => Math.round(value * 100) / 100;

const done = (state: InstrumentState, ...intents: InstrumentIntent[]): Reduction => ({
  state,
  intents,
});

/** Un paso del instrumento. */
export function reduce(
  state: InstrumentState,
  input: InstrumentInput,
  status: InstrumentStatus,
): Reduction {
  const result = reduceInput(state, input, status);
  // Poner un sonido o grabar también cuenta como empezar: la primera reproducción ya no pone la
  // batería (aunque el estado del audio, que llega con retraso, aún diga que todo está vacío).
  const started = result.intents.some(
    (intent) => intent.type === 'set-sound' || intent.type === 'record',
  );
  return started && result.state.firstPlay
    ? { state: { ...result.state, firstPlay: false }, intents: result.intents }
    : result;
}

function reduceInput(
  state: InstrumentState,
  input: InstrumentInput,
  status: InstrumentStatus,
): Reduction {
  const taking = status.recording !== 'idle';
  switch (input.type) {
    case 'toggle-help':
      return done({ ...state, help: !state.help });
    case 'select':
      return select(state, input.layer, taking);
    case 'escape':
      if (state.help) return done({ ...state, help: false });
      return menuBack(state);
    case 'grab':
      if (taking) return done(state, { type: 'locked' });
      return done(
        { ...state, discHeld: true, discTurns: 0 },
        { type: 'disc-hold', layer: state.selected },
      );
    case 'drag':
      if (!state.discHeld) return done(state);
      return done({ ...state, discTurns: input.turns }, { type: 'disc-move', turns: input.turns });
    case 'drop':
      if (!state.discHeld) return done(state);
      return done({ ...state, discHeld: false, discTurns: 0 }, { type: 'disc-release' });
    case 'press':
      return press(state, input.control, status, input.at);
    case 'hold':
      return hold(state, input.control, status);
    case 'turn':
      return turn(state, input.control, input.steps, status);
    case 'set':
      return set(state, input.control, input.value, status);
  }
}

function select(state: InstrumentState, layer: number, taking: boolean): Reduction {
  if (!Number.isInteger(layer) || layer < 0 || layer >= LAYER_COUNT) return done(state);
  if (layer === state.selected) return done(state);
  if (taking) return done(state, { type: 'locked' });
  return done({ ...state, selected: layer });
}

function press(
  state: InstrumentState,
  control: ControlId,
  status: InstrumentStatus,
  at = NaN,
): Reduction {
  const layer = controlLayer(control);
  if (layer >= 0) return select(state, layer, status.recording !== 'idle');
  const { settings } = state;
  switch (control) {
    case 'play': {
      if (status.transport === 'playing') return done(state, { type: 'pause' });
      const started = state.firstPlay ? { ...state, firstPlay: false } : state;
      const empty = status.layers.every((layer) => !layer.hasContent);
      if (state.firstPlay && empty && status.recording === 'idle') {
        return done(
          { ...started, selected: 1 },
          { type: 'start-with-sound', layer: 0, sound: FIRST_PLAY_SOUND },
        );
      }
      return done(started, { type: 'play' });
    }
    case 'record':
      return done(state, {
        type: 'record',
        // Con una toma en marcha, grabar la cierra (en su capa).
        layer: status.recording !== 'idle' ? status.recordLayer : state.selected,
        bars: settings.takeBars,
        countIn: settings.countIn,
        fitTempo: settings.fitTempo,
      });
    case 'undo':
      if (status.recording !== 'idle') return done(state, { type: 'locked' });
      return done(state, { type: 'undo', layer: state.selected });
    case 'standby':
      return done(state, { type: status.standby ? 'wake' : 'standby' });
    case 'main':
      return menuPress(state, status, at);
    default:
      return done(state);
  }
}

function hold(state: InstrumentState, control: ControlId, status: InstrumentStatus): Reduction {
  const layer = controlLayer(control);
  if (layer >= 0) {
    const muted = !state.controls.layers[layer]!.muted;
    return done(withLayer(state, layer, { muted }), { type: 'set-mute', layer, muted });
  }
  switch (control) {
    case 'play':
      return done(state, { type: 'stop' });
    case 'record':
      return done(state, { type: 'cancel-recording' });
    case 'undo':
      if (status.recording !== 'idle') return done(state, { type: 'locked' });
      return done(state, { type: 'redo', layer: state.selected });
    case 'main':
      return menuBack(state);
    default:
      return done(state);
  }
}

function turn(
  state: InstrumentState,
  control: ControlId,
  steps: number,
  status: InstrumentStatus,
): Reduction {
  if (!Number.isFinite(steps) || steps === 0) return done(state);
  const layer = controlLayer(control);
  const { controls } = state;
  if (layer >= 0) return set(state, control, controls.layers[layer]!.level * 100 + steps, status);
  switch (control) {
    case 'main':
      if (state.menu.open) return menuTurn(state, steps, status);
      return set(state, 'main', controls.bpm + steps, status);
    case 'arm':
      return set(state, 'arm', controls.layers[state.selected]!.filter * 100 + steps, status);
    case 'volume':
      return set(state, 'volume', controls.volume * 100 + steps, status);
    case 'disc':
      // Con el teclado: cada paso, 1/16 de vuelta (el paso grande, 10/16).
      if (!state.discHeld) return done(state);
      return reduce(
        state,
        { type: 'drag', turns: state.discTurns + steps * DISC_TURNS_PER_STEP },
        status,
      );
    default:
      return done(state);
  }
}

function set(
  state: InstrumentState,
  control: ControlId,
  value: number,
  status: InstrumentStatus,
): Reduction {
  if (!Number.isFinite(value)) return done(state);
  const layer = controlLayer(control);
  if (layer >= 0) {
    const level = hundredths(clamp(value, 0, 100) / 100);
    if (level === state.controls.layers[layer]!.level) return done(state);
    return done(withLayer(state, layer, { level }), { type: 'set-level', layer, level });
  }
  switch (control) {
    case 'main': {
      if (state.menu.open) return done(state);
      if (status.recording !== 'idle') return done(state, { type: 'locked' });
      const bpm = clamp(Math.round(value), MIN_BPM, MAX_BPM);
      if (bpm === state.controls.bpm) return done(state);
      return done({ ...state, controls: { ...state.controls, bpm } }, { type: 'set-tempo', bpm });
    }
    case 'arm': {
      const amount = hundredths(clamp(value, 0, 100) / 100);
      const target = state.selected;
      if (amount === state.controls.layers[target]!.filter) return done(state);
      return done(withLayer(state, target, { filter: amount }), {
        type: 'set-filter',
        layer: target,
        amount,
      });
    }
    case 'volume': {
      const volume = hundredths(clamp(value, 0, 100) / 100);
      if (volume === state.controls.volume) return done(state);
      return done(
        { ...state, controls: { ...state.controls, volume } },
        { type: 'set-volume', volume },
      );
    }
    default:
      return done(state);
  }
}

function withLayer(
  state: InstrumentState,
  layer: number,
  change: Partial<LayerControls>,
): InstrumentState {
  const layers = state.controls.layers.map((controls, i) =>
    i === layer ? { ...controls, ...change } : controls,
  );
  return { ...state, controls: { ...state.controls, layers } };
}

// --- Menú ----------------------------------------------------------------------------------------

/** El elemento bajo el cursor. */
export function menuItem(menu: MenuState): MenuItem | undefined {
  return listAt(menu.path).items[menu.cursor];
}

function menuPress(state: InstrumentState, status: InstrumentStatus, at: number): Reduction {
  const menu = state.menu;
  if (!menu.open) return done({ ...state, menu: { ...CLOSED_MENU, open: true } });
  if (menu.confirm) {
    const closed = { ...state, menu: { ...menu, confirm: null } };
    return menu.confirm.yes ? confirmed(closed, menu.confirm.action, status) : done(closed);
  }
  if (menu.reading) return done({ ...state, menu: { ...menu, reading: false } });
  if (menu.edit) {
    // Pulsar deja el valor que se estaba probando (ya aplicado al girar).
    return done({ ...state, menu: { ...menu, edit: null } });
  }
  const item = menuItem(menu);
  if (!item) return done(state);
  switch (item.kind) {
    case 'list':
      return done({ ...state, menu: { ...menu, path: [...menu.path, menu.cursor], cursor: 0 } });
    case 'text':
      return done({ ...state, menu: { ...menu, reading: true } });
    case 'choice':
    case 'number': {
      const value = settingValue(state, item.setting);
      return done({ ...state, menu: { ...menu, edit: { value, original: value } } });
    }
    case 'sound':
      return chooseSound(state, item.sound, status);
    case 'action':
      return item.action === 'tapTempo'
        ? tapTempo(state, status, at)
        : menuAction(state, item.action, status);
  }
}

/**
 * Tempo por pulsaciones (PLAN fase 3, tarea 6): cada pulsación del dial sobre «MARCAR TEMPO» marca
 * un pulso; con dos o más, el tempo es la media de los últimos intervalos (hasta 4). Tras 2 s sin
 * pulsar, se empieza de nuevo.
 */
function tapTempo(state: InstrumentState, status: InstrumentStatus, at: number): Reduction {
  if (!Number.isFinite(at)) return done(state);
  if (status.recording !== 'idle') return done(state, { type: 'locked' });
  const last = state.taps[state.taps.length - 1];
  const fresh = last === undefined || at - last > TAP_RESET_MS || at <= last;
  const taps = fresh ? [at] : [...state.taps, at].slice(-(TAP_INTERVALS + 1));
  const tapped = { ...state, taps };
  if (taps.length < 2) return done(tapped);
  const interval = (taps[taps.length - 1]! - taps[0]!) / (taps.length - 1);
  const bpm = clamp(Math.round(60_000 / interval), MIN_BPM, MAX_BPM);
  if (bpm === state.controls.bpm) return done(tapped);
  return done({ ...tapped, controls: { ...tapped.controls, bpm } }, { type: 'set-tempo', bpm });
}

function menuBack(state: InstrumentState): Reduction {
  const menu = state.menu;
  if (!menu.open) return done(state);
  if (menu.confirm) return done({ ...state, menu: { ...menu, confirm: null } });
  if (menu.reading) return done({ ...state, menu: { ...menu, reading: false } });
  if (menu.edit) {
    // Volver deshace lo que se estaba probando.
    const item = menuItem(menu);
    const reverted = { ...state, menu: { ...menu, edit: null } };
    return item && (item.kind === 'choice' || item.kind === 'number')
      ? applySetting(reverted, item.setting, menu.edit.original)
      : done(reverted);
  }
  if (menu.path.length === 0) return done({ ...state, menu: CLOSED_MENU });
  return done({
    ...state,
    menu: { ...menu, path: menu.path.slice(0, -1), cursor: menu.path[menu.path.length - 1]! },
  });
}

function menuTurn(state: InstrumentState, steps: number, status: InstrumentStatus): Reduction {
  const menu = state.menu;
  if (menu.confirm) {
    // Dos opciones: girar a la derecha elige la acción; a la izquierda, «Cancelar».
    return done({ ...state, menu: { ...menu, confirm: { ...menu.confirm, yes: steps > 0 } } });
  }
  if (menu.reading) return done(state);
  if (menu.edit) {
    const item = menuItem(menu);
    if (!item || (item.kind !== 'choice' && item.kind !== 'number')) return done(state);
    const value =
      item.kind === 'choice'
        ? clamp(menu.edit.value + steps, 0, item.options.length - 1)
        : clamp(menu.edit.value + steps * item.step, item.min, item.max);
    if (value === menu.edit.value) return done(state);
    if (item.setting === 'reverse' && status.recording !== 'idle')
      return done(state, { type: 'locked' });
    const editing = { ...state, menu: { ...menu, edit: { ...menu.edit, value } } };
    return applySetting(editing, item.setting, value);
  }
  // Recorrer: solo mueve el cursor (nunca cambia el audio).
  const count = listAt(menu.path).items.length;
  const cursor = clamp(
    menu.cursor + Math.sign(steps) * Math.min(Math.abs(steps), count),
    0,
    count - 1,
  );
  return done({ ...state, menu: { ...menu, cursor } });
}

/** Valor de un ajuste en las unidades del menú (índice de la opción o el número que se ve). */
export function settingValue(state: InstrumentState, setting: SettingId): number {
  const { settings, controls, selected } = state;
  switch (setting) {
    case 'takeBars':
      return TAKE_BARS.indexOf(settings.takeBars);
    case 'countIn':
      return Number(settings.countIn);
    case 'metronome':
      return Number(settings.metronome);
    case 'fitTempo':
      return Number(settings.fitTempo);
    case 'fadeOut':
      return Number(settings.fadeOut);
    case 'reverse':
      return Number(controls.layers[selected]!.reversed);
    case 'pan':
      return Math.round(controls.layers[selected]!.pan * 100);
    case 'inputGain':
      return Math.round(settings.inputGain * 100);
    case 'latencyManual':
      return Math.round(settings.latency.ms);
    case 'repeats':
      return settings.repeats;
  }
}

function applySetting(state: InstrumentState, setting: SettingId, value: number): Reduction {
  const settings = state.settings;
  const withSettings = (change: Partial<InstrumentSettings>) => ({
    ...state,
    settings: { ...settings, ...change },
  });
  const layer = state.selected;
  switch (setting) {
    case 'takeBars':
      return done(withSettings({ takeBars: TAKE_BARS[value] ?? 0 }));
    case 'countIn':
      return done(withSettings({ countIn: value === 1 }));
    case 'fitTempo':
      return done(withSettings({ fitTempo: value === 1 }));
    case 'fadeOut':
      return done(withSettings({ fadeOut: value === 1 }));
    case 'repeats':
      return done(withSettings({ repeats: value }));
    case 'metronome':
      return done(withSettings({ metronome: value === 1 }), {
        type: 'set-metronome',
        enabled: value === 1,
      });
    case 'inputGain':
      return done(withSettings({ inputGain: value / 100 }), {
        type: 'set-input-gain',
        gain: value / 100,
      });
    case 'latencyManual':
      return done(withSettings({ latency: { mode: 'manual', ms: value } }), {
        type: 'set-latency',
        mode: 'manual',
        ms: value,
      });
    case 'reverse':
      return done(withLayer(state, layer, { reversed: value === 1 }), {
        type: 'set-reverse',
        layer,
        reversed: value === 1,
      });
    case 'pan':
      return done(withLayer(state, layer, { pan: value / 100 }), {
        type: 'set-pan',
        layer,
        pan: value / 100,
      });
  }
}

function chooseSound(
  state: InstrumentState,
  sound: string | null,
  status: InstrumentStatus,
): Reduction {
  if (status.recording !== 'idle') return done(state, { type: 'locked' });
  const layer = state.selected;
  if (status.layers[layer]?.source === 'recording') {
    // Sustituir una grabación pide confirmación, con «Cancelar» seleccionado.
    return done({
      ...state,
      menu: { ...state.menu, confirm: { action: { type: 'replace', layer, sound }, yes: false } },
    });
  }
  return done(state, { type: 'set-sound', layer, sound });
}

function menuAction(state: InstrumentState, action: ActionId, status: InstrumentStatus): Reduction {
  const taking = status.recording !== 'idle';
  const ask = (confirm: ConfirmAction) =>
    done({ ...state, menu: { ...state.menu, confirm: { action: confirm, yes: false } } });
  switch (action) {
    case 'tapTempo':
      // Lo lleva `tapTempo` (necesita el momento de la pulsación).
      return done(state);
    case 'latencyAuto':
      return done(
        { ...state, settings: { ...state.settings, latency: { mode: 'auto', ms: 0 } } },
        { type: 'set-latency', mode: 'auto', ms: 0 },
      );
    case 'calibrate':
      return taking ? done(state, { type: 'locked' }) : done(state, { type: 'calibrate' });
    case 'save':
      return taking ? done(state, { type: 'locked' }) : done(state, { type: 'save' });
    case 'open':
      return taking ? done(state, { type: 'locked' }) : done(state, { type: 'open' });
    case 'exportMix':
      return taking
        ? done(state, { type: 'locked' })
        : done(state, {
            type: 'export-mix',
            repeats: state.settings.repeats,
            fadeOut: state.settings.fadeOut,
          });
    case 'exportStems':
      return taking ? done(state, { type: 'locked' }) : done(state, { type: 'export-stems' });
    case 'clearLayer':
      return taking
        ? done(state, { type: 'locked' })
        : ask({ type: 'clear-layer', layer: state.selected });
    case 'newSession':
      return taking ? done(state, { type: 'locked' }) : ask({ type: 'new-session' });
    case 'clearAutosave':
      return ask({ type: 'clear-autosave' });
  }
}

function confirmed(
  state: InstrumentState,
  action: ConfirmAction,
  status: InstrumentStatus,
): Reduction {
  if (status.recording !== 'idle' && action.type !== 'clear-autosave') {
    return done(state, { type: 'locked' });
  }
  switch (action.type) {
    case 'clear-layer':
      return done(state, { type: 'clear-layer', layer: action.layer });
    case 'new-session':
      return done(
        {
          ...state,
          selected: 0,
          controls: { ...initialState().controls, volume: state.controls.volume },
        },
        { type: 'reset' },
      );
    case 'clear-autosave':
      return done(state, { type: 'clear-autosave' });
    case 'replace':
      return done(state, { type: 'set-sound', layer: action.layer, sound: action.sound });
  }
}
