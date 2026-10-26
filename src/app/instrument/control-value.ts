/**
 * El valor de cada control para su `role="slider"` (PLAN §4.7): `aria-valuenow`, su rango y
 * `aria-valuetext` en español. Lo usan el instrumento HTML y, en la fase 6, la capa de controles
 * del 3D.
 */
import { controlLayer, control, type ControlId } from './catalog';
import { MAX_BPM, MIN_BPM } from './constants';
import { INSTRUMENT_CONTENT } from './instrument.content';
import { menuItem, settingValue, type InstrumentState, type InstrumentStatus } from './instrument';

export interface ControlValue {
  readonly now: number;
  readonly min: number;
  readonly max: number;
  readonly text: string;
}

const v = INSTRUMENT_CONTENT.values;
const decimal = (value: number, digits = 0) => value.toFixed(digits).replace('.', ',');
const percent = (value: number) => Math.round(value * 100);

/** Valor, rango y texto en voz de un control deslizante (o `null` si es un botón). */
export function controlValue(
  id: ControlId,
  state: InstrumentState,
  status: InstrumentStatus,
): ControlValue | null {
  const spec = control(id);
  if (spec.role !== 'slider') return null;
  const layer = controlLayer(id);
  const { controls } = state;
  if (layer >= 0) {
    const { level, muted } = controls.layers[layer]!;
    return { now: percent(level), min: 0, max: 100, text: v.level(percent(level), muted) };
  }
  switch (id) {
    case 'main': {
      const bpm = Math.round(controls.bpm);
      const item = state.menu.open ? menuItem(state.menu) : undefined;
      const text = item
        ? v.menu(menuItemText(item.label, state))
        : v.tempo(decimal(controls.bpm, controls.bpm % 1 === 0 ? 0 : 1));
      return { now: bpm, min: MIN_BPM, max: MAX_BPM, text };
    }
    case 'arm': {
      const amount = percent(controls.layers[state.selected]!.filter);
      return { now: amount, min: 0, max: 100, text: amount === 0 ? v.filterOff : v.filter(amount) };
    }
    case 'volume': {
      const volume = percent(controls.volume);
      return { now: volume, min: 0, max: 100, text: v.percent(volume) };
    }
    case 'disc': {
      const layerStatus = status.layers[state.selected];
      const length = layerStatus?.lengthBeats ?? 0;
      if (!layerStatus?.hasContent || length <= 0) {
        return { now: 0, min: 0, max: 0, text: v.discEmpty };
      }
      const beats = decimal(length, length % 1 === 0 ? 0 : 1);
      const max = Math.round(length * 10) / 10;
      // Suelto, un valor estable (si siguiera al transporte, un lector de pantalla leería la
      // posición sin parar). La posición, solo mientras se agarra: entonces la mueve quien toca.
      if (!state.discHeld) return { now: 0, min: 0, max, text: v.disc(state.selected + 1, beats) };
      const position = Math.round(layerStatus.positionBeats * 10) / 10;
      return { now: position, min: 0, max, text: v.discHeld(decimal(position + 1, 1), beats) };
    }
    default:
      return { now: spec.defaultValue, min: spec.min, max: spec.max, text: '' };
  }
}

/** «Bucle» → el elemento del menú con su valor, en minúsculas («duración: libre»). */
function menuItemText(label: string, state: InstrumentState): string {
  const item = menuItem(state.menu);
  let value = '';
  if (item?.kind === 'choice') {
    value = item.options[state.menu.edit?.value ?? settingValue(state, item.setting)] ?? '';
  } else if (item?.kind === 'number') {
    value = String(state.menu.edit?.value ?? settingValue(state, item.setting));
  }
  const lower = (text: string) => text.toLocaleLowerCase('es-ES');
  return value ? `${lower(label)}: ${lower(value)}` : lower(label);
}
