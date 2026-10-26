/**
 * El menú del dial principal (PLAN §4.5): SONIDO, BUCLE, ENTRADA, SESIÓN y AYUDA. Aquí está el
 * árbol (datos); cómo se recorre está en `instrument.ts`: girar = recorrer o ajustar, pulsar =
 * entrar o confirmar, mantener o Esc = volver. Recorrer nunca cambia el audio.
 */
import { MAX_INPUT_GAIN, MAX_MANUAL_LATENCY_MS, MAX_REPEATS } from './constants';
import { INSTRUMENT_CONTENT } from './instrument.content';
import { SOUND_CATEGORIES, soundsIn } from './sounds';

/** Ajustes que se cambian desde el menú. */
export type SettingId =
  | 'takeBars'
  | 'countIn'
  | 'metronome'
  | 'reverse'
  | 'pan'
  | 'fitTempo'
  | 'inputGain'
  | 'latencyManual'
  | 'repeats'
  | 'fadeOut';

/** Acciones del menú. */
export type ActionId =
  | 'latencyAuto'
  | 'calibrate'
  | 'save'
  | 'open'
  | 'exportMix'
  | 'exportStems'
  | 'clearLayer'
  | 'newSession'
  | 'clearAutosave';

export interface MenuList {
  readonly kind: 'list';
  readonly label: string;
  readonly items: readonly MenuItem[];
}

export type MenuItem =
  | MenuList
  /** Un sonido de la biblioteca (o APAGADO, con `null`) para la capa elegida. */
  | { readonly kind: 'sound'; readonly label: string; readonly sound: string | null }
  /** Un ajuste con opciones con nombre (el valor es el índice). */
  | {
      readonly kind: 'choice';
      readonly label: string;
      readonly setting: SettingId;
      readonly options: readonly string[];
    }
  /** Un ajuste numérico. */
  | {
      readonly kind: 'number';
      readonly label: string;
      readonly setting: SettingId;
      readonly min: number;
      readonly max: number;
      readonly step: number;
    }
  | { readonly kind: 'action'; readonly label: string; readonly action: ActionId }
  /** Un texto de ayuda: se abre y se vuelve. */
  | { readonly kind: 'text'; readonly label: string; readonly lines: readonly string[] };

const m = INSTRUMENT_CONTENT.menu;
const yesNo = [m.no, m.yes] as const;

export const MENU: MenuList = {
  kind: 'list',
  label: 'MENÚ',
  items: [
    {
      kind: 'list',
      label: m.sound,
      items: SOUND_CATEGORIES.map((category) => ({
        kind: 'list' as const,
        label: m.categories[category],
        items: [
          ...soundsIn(category).map((sound) => ({
            kind: 'sound' as const,
            label: sound.name,
            sound: sound.id,
          })),
          { kind: 'sound' as const, label: m.off, sound: null },
        ],
      })),
    },
    {
      kind: 'list',
      label: m.loop,
      items: [
        { kind: 'choice', label: m.takeLength, setting: 'takeBars', options: m.takeLengths },
        { kind: 'choice', label: m.countIn, setting: 'countIn', options: yesNo },
        { kind: 'choice', label: m.metronome, setting: 'metronome', options: yesNo },
        { kind: 'choice', label: m.reverse, setting: 'reverse', options: yesNo },
        { kind: 'number', label: m.pan, setting: 'pan', min: -100, max: 100, step: 5 },
        { kind: 'choice', label: m.fitTempo, setting: 'fitTempo', options: yesNo },
      ],
    },
    {
      kind: 'list',
      label: m.input,
      items: [
        {
          kind: 'number',
          label: m.gain,
          setting: 'inputGain',
          min: 0,
          max: MAX_INPUT_GAIN * 100,
          step: 5,
        },
        {
          kind: 'list',
          label: m.latency,
          items: [
            { kind: 'action', label: m.latencyAuto, action: 'latencyAuto' },
            { kind: 'action', label: m.latencyCalibrate, action: 'calibrate' },
            {
              kind: 'number',
              label: m.latencyManual,
              setting: 'latencyManual',
              min: 0,
              max: MAX_MANUAL_LATENCY_MS,
              step: 1,
            },
          ],
        },
      ],
    },
    {
      kind: 'list',
      label: m.session,
      items: [
        { kind: 'action', label: m.save, action: 'save' },
        { kind: 'action', label: m.open, action: 'open' },
        {
          kind: 'list',
          label: m.exportMix,
          items: [
            {
              kind: 'number',
              label: m.repeats,
              setting: 'repeats',
              min: 1,
              max: MAX_REPEATS,
              step: 1,
            },
            { kind: 'choice', label: m.fadeOut, setting: 'fadeOut', options: yesNo },
            { kind: 'action', label: m.exportNow, action: 'exportMix' },
          ],
        },
        { kind: 'action', label: m.exportStems, action: 'exportStems' },
        { kind: 'action', label: m.clearLayer, action: 'clearLayer' },
        { kind: 'action', label: m.newSession, action: 'newSession' },
        { kind: 'action', label: m.clearAutosave, action: 'clearAutosave' },
      ],
    },
    {
      kind: 'list',
      label: m.help,
      items: [m.helpItems.press, m.helpItems.turn, m.helpItems.hold].map((item) => ({
        kind: 'text' as const,
        label: item.title,
        lines: item.lines,
      })),
    },
  ],
};

/** La lista a la que lleva un camino de índices desde la raíz (la raíz si el camino no vale). */
export function listAt(path: readonly number[]): MenuList {
  let list = MENU;
  for (const index of path) {
    const item = list.items[index];
    if (item?.kind !== 'list') return list;
    list = item;
  }
  return list;
}
