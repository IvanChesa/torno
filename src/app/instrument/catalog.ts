/**
 * Catálogo de controles del instrumento (PLAN §4.5): el mismo para el instrumento HTML, el 3D y la
 * guía. Cada control es un elemento enfocable: `button` (teclas, reposo) o `role="slider"` (diales,
 * disco, brazo, rueda), con su nombre, su rango, su paso, su paso grande (×10) y sus gestos.
 */
import { BIG_STEP, DEFAULT_BPM, LAYER_COUNT, MAX_BPM, MIN_BPM } from './constants';
import { INSTRUMENT_CONTENT } from './instrument.content';

export type ControlId =
  | 'play'
  | 'record'
  | 'undo'
  | 'layer-0'
  | 'layer-1'
  | 'layer-2'
  | 'layer-3'
  | 'main'
  | 'disc'
  | 'arm'
  | 'volume'
  | 'standby';

export type ControlKind = 'key' | 'dial' | 'disc' | 'arm' | 'wheel' | 'button';
export type Gesture = 'press' | 'hold' | 'turn' | 'grab';

export interface ControlSpec {
  readonly id: ControlId;
  readonly kind: ControlKind;
  readonly role: 'button' | 'slider';
  /** Nombre accesible. */
  readonly name: string;
  /** Qué hace cada gesto, en una frase (descripción accesible y ayuda). */
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly bigStep: number;
  readonly defaultValue: number;
  readonly gestures: readonly Gesture[];
}

const text = INSTRUMENT_CONTENT.controls;

function key(id: ControlId, content: { name: string; hint: string }, hold = true): ControlSpec {
  return {
    id,
    kind: id === 'standby' ? 'button' : 'key',
    role: 'button',
    name: content.name,
    hint: content.hint,
    min: 0,
    max: 0,
    step: 0,
    bigStep: 0,
    defaultValue: 0,
    gestures: hold ? ['press', 'hold'] : ['press'],
  };
}

function slider(
  id: ControlId,
  kind: ControlKind,
  content: { name: string; hint: string },
  range: { min: number; max: number; defaultValue: number },
  gestures: readonly Gesture[],
): ControlSpec {
  return { id, kind, role: 'slider', ...content, ...range, step: 1, bigStep: BIG_STEP, gestures };
}

const LAYER_IDS = ['layer-0', 'layer-1', 'layer-2', 'layer-3'] as const;

export const CONTROLS: readonly ControlSpec[] = [
  key('play', text.play),
  key('record', text.record),
  key('undo', text.undo),
  ...LAYER_IDS.map((id, layer) =>
    slider(id, 'dial', text.layer(layer + 1), { min: 0, max: 100, defaultValue: 100 }, [
      'turn',
      'press',
      'hold',
    ]),
  ),
  slider('main', 'dial', text.main, { min: MIN_BPM, max: MAX_BPM, defaultValue: DEFAULT_BPM }, [
    'turn',
    'press',
    'hold',
  ]),
  slider('disc', 'disc', text.disc, { min: 0, max: 0, defaultValue: 0 }, ['grab']),
  slider('arm', 'arm', text.arm, { min: 0, max: 100, defaultValue: 0 }, ['turn']),
  slider('volume', 'wheel', text.volume, { min: 0, max: 100, defaultValue: 100 }, ['turn']),
  key('standby', text.standby, false),
];

const BY_ID = new Map(CONTROLS.map((spec) => [spec.id, spec]));

export function control(id: ControlId): ControlSpec {
  return BY_ID.get(id)!;
}

/** El dial de una capa (0–3). */
export function layerControl(layer: number): ControlId {
  return LAYER_IDS[layer] ?? 'layer-0';
}

/** La capa de un dial de capa, o −1 si el control no es uno. */
export function controlLayer(id: ControlId): number {
  return (LAYER_IDS as readonly ControlId[]).indexOf(id);
}

/** Los diales de las capas, en orden. */
export const LAYER_CONTROLS: readonly ControlId[] = LAYER_IDS.slice(0, LAYER_COUNT);
