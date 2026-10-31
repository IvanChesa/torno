/**
 * Pantalla del instrumento (PLAN §4.5): un modelo de texto que pintan el instrumento HTML y, en la
 * fase 5, la textura de la pantalla 3D. Tiene tres modos (principal, menú y confirmación o texto),
 * los pilotos de las capas y un resumen en frases para la región `aria-live` (la interfaz lo emite
 * con antirrebote).
 */
import { TAKE_BARS } from './constants';
import { INSTRUMENT_CONTENT } from './instrument.content';
import { menuItem, settingValue, type InstrumentState, type InstrumentStatus } from './instrument';
import { listAt, type MenuItem } from './menu';
import { soundLabel } from './sounds';

export interface DisplayRow {
  readonly label: string;
  readonly value: string;
  readonly selected: boolean;
  /** Se está ajustando su valor. */
  readonly editing: boolean;
}

export interface LayerPilot {
  readonly hasContent: boolean;
  readonly muted: boolean;
  readonly selected: boolean;
  readonly recording: boolean;
  readonly pending: boolean;
}

export interface DisplayModel {
  readonly mode: 'main' | 'menu' | 'confirm' | 'text';
  readonly title: string;
  /** Líneas de texto (pantalla principal, pregunta de una confirmación o texto de ayuda). */
  readonly lines: readonly string[];
  /** Filas del menú (o las dos opciones de una confirmación). */
  readonly rows: readonly DisplayRow[];
  /** Línea de estado de abajo: cola, toma, disco o un aviso. */
  readonly status: string;
  readonly pilots: readonly LayerPilot[];
  /** El estado en una frase, para leerlo en voz (sin mayúsculas de pantalla). */
  readonly summary: string;
}

/** Lo que la pantalla necesita además del modelo. */
export interface DisplayContext {
  readonly recordSeconds: number;
  readonly countInBeats: number;
  readonly mic: 'off' | 'requesting' | 'on';
  /** Latencia automática estimada, en ms. */
  readonly autoLatencyMs: number;
  /** Aviso del momento (ya en mayúsculas), o `''`. */
  readonly message: string;
}

const d = INSTRUMENT_CONTENT.display;
const m = INSTRUMENT_CONTENT.menu;

const decimal = (value: number, digits = 0) =>
  value.toFixed(digits).replace('.', ',').replace('-', '−');

export function displayModel(
  state: InstrumentState,
  status: InstrumentStatus,
  context: DisplayContext,
): DisplayModel {
  const pilots = status.layers.map((layer, i) => ({
    hasContent: layer.hasContent,
    muted: state.controls.layers[i]?.muted ?? false,
    selected: i === state.selected,
    recording: status.recording !== 'idle' && status.recordLayer === i,
    pending: layer.pending,
  }));
  const statusLine = statusText(state, status, context);
  const menu = state.menu;
  if (menu.open && menu.confirm) {
    const question = confirmQuestion(menu.confirm.action);
    const rows = [m.cancel, question.action].map((label, i) => ({
      label,
      value: '',
      selected: (i === 1) === menu.confirm!.yes,
      editing: false,
    }));
    return model('confirm', '', [question.question], rows, statusLine, pilots);
  }
  if (menu.open) {
    const list = listAt(menu.path);
    const item = menuItem(menu);
    if (menu.reading && item?.kind === 'text') {
      return model('text', item.label, item.lines, [], statusLine, pilots);
    }
    const rows = list.items.map((entry, i) => ({
      label: entry.label,
      value:
        i === menu.cursor && menu.edit
          ? formatSetting(entry, menu.edit.value)
          : itemValue(entry, state, status, context),
      selected: i === menu.cursor,
      editing: i === menu.cursor && menu.edit !== null,
    }));
    return model('menu', list.label, [], rows, statusLine, pilots);
  }
  return model('main', '', mainLines(state, status), [], statusLine, pilots);
}

function model(
  mode: DisplayModel['mode'],
  title: string,
  lines: readonly string[],
  rows: readonly DisplayRow[],
  status: string,
  pilots: readonly LayerPilot[],
): DisplayModel {
  const parts: string[] = [];
  if (title) parts.push(title);
  parts.push(...lines);
  const selected = rows.find((row) => row.selected);
  if (selected) {
    const value = spoken(selected.value);
    parts.push(value ? `${selected.label}: ${value}` : selected.label);
  }
  if (status) parts.push(status);
  return { mode, title, lines, rows, status, pilots, summary: sentences(parts) };
}

/**
 * Lo que se lee de un valor de la pantalla: sin la flecha de los submenús y con la marca de lo
 * elegido dicha con palabras (un lector de pantalla leería el símbolo).
 */
function spoken(value: string): string {
  const inUse = value.endsWith('•');
  const clean = value.replace('›', '').replace('•', '').trim();
  if (!inUse) return clean;
  return clean ? `${clean} · ${d.inUse}` : d.inUse;
}

function mainLines(state: InstrumentState, status: InstrumentStatus): string[] {
  const transport = status.standby
    ? d.standby
    : status.transport === 'playing'
      ? d.playing
      : d.paused;
  const layer = status.layers[state.selected];
  const controls = state.controls.layers[state.selected];
  let content: string = d.empty;
  if (layer?.source === 'recording') content = d.recording;
  else if (layer?.source === 'library') content = soundLabel(layer.soundId);
  const muted = controls?.muted ? ` · ${d.muted}` : '';
  return [
    `${d.bpm(decimal(state.controls.bpm))} · ${transport}`,
    `${d.layer(state.selected + 1)} · ${content}${muted}`,
  ];
}

function statusText(
  state: InstrumentState,
  status: InstrumentStatus,
  context: DisplayContext,
): string {
  if (context.message) return context.message;
  if (context.mic === 'requesting') return d.micRequest;
  if (status.recording === 'count-in')
    return d.countIn(Math.max(1, Math.ceil(context.countInBeats)));
  if (status.recording === 'recording') return d.recordingNow(decimal(context.recordSeconds, 1));
  if (state.discHeld) return d.disc;
  const queued = status.layers.findIndex((layer) => layer.pending);
  if (queued >= 0) return d.queued(queued + 1);
  return d.takeLengths[TAKE_BARS.indexOf(state.settings.takeBars)] ?? '';
}

function itemValue(
  item: MenuItem,
  state: InstrumentState,
  status: InstrumentStatus,
  context: DisplayContext,
): string {
  const latency = state.settings.latency;
  switch (item.kind) {
    case 'list':
      return '›';
    case 'choice':
    case 'number':
      return formatSetting(item, settingValue(state, item.setting));
    case 'sound': {
      const layer = status.layers[state.selected];
      const current = layer?.source === 'library' ? layer.soundId : layer?.hasContent ? '' : null;
      return item.sound === current ? '•' : '';
    }
    case 'action':
      if (item.action === 'latencyAuto') {
        return latency.mode === 'auto' ? `${decimal(context.autoLatencyMs)} MS •` : '';
      }
      if (item.action === 'calibrate') {
        return latency.mode === 'calibrated' ? `${decimal(latency.ms, 1)} MS •` : '';
      }
      if (item.action === 'tapTempo') return d.bpm(decimal(state.controls.bpm));
      return '';
    case 'text':
      return '';
  }
}

function formatSetting(item: MenuItem, value: number): string {
  if (item.kind === 'choice') return item.options[value] ?? '';
  if (item.kind !== 'number') return '';
  switch (item.setting) {
    case 'pan':
      return value === 0 ? 'C' : value < 0 ? `I ${-value}` : `D ${value}`;
    case 'inputGain':
      return `${value} %`;
    case 'latencyManual':
      return `${value} MS`;
    default:
      return String(value);
  }
}

function confirmQuestion(action: NonNullable<InstrumentState['menu']['confirm']>['action']): {
  question: string;
  action: string;
} {
  switch (action.type) {
    case 'clear-layer':
      return m.confirm.clearLayer(action.layer + 1);
    case 'new-session':
      return m.confirm.newSession;
    case 'clear-autosave':
      return m.confirm.clearAutosave;
    case 'replace':
      return m.confirm.replaceRecording(action.layer + 1);
  }
}

/**
 * Las filas del menú que caben a la vez (`size`) alrededor de la elegida: la elegida, con la de
 * antes si caben más de dos, y las siguientes; al final de la lista, las últimas. La misma ventana
 * en la pantalla del 3D, en su espejo y en el plato HTML.
 */
export function menuWindow<T extends { readonly selected: boolean }>(
  rows: readonly T[],
  size: number,
): readonly T[] {
  if (rows.length <= size) return rows;
  const selected = Math.max(
    0,
    rows.findIndex((row) => row.selected),
  );
  const start = Math.min(Math.max(0, selected - Math.floor((size - 1) / 2)), rows.length - size);
  return rows.slice(start, start + size);
}

/** «CAPA 2 · VACÍA» → «Capa 2, vacía.»: las líneas de pantalla, en frases para leer en voz. */
export function sentences(parts: readonly string[]): string {
  return parts
    .map((part) => {
      const lower = part.toLocaleLowerCase('es-ES').replaceAll(' · ', ', ');
      return `${lower.charAt(0).toLocaleUpperCase('es-ES')}${lower.slice(1)}.`;
    })
    .join(' ');
}
