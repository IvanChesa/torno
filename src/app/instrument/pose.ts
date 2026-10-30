/**
 * La pose del aparato (PLAN §4.6, «Animación ligada al audio»): lo que enseña el 3D de cada pieza,
 * sacado del estado del instrumento, del estado del audio y del modelo de pantalla. El escenario 3D
 * la recibe entera y solo la pinta; no sabe nada del menú ni del audio.
 *
 * Los valores van de 0 a 1 en el recorrido de cada pieza: los diales, de su tope izquierdo al
 * derecho (como la aguja del instrumento HTML); el brazo, de fuera (sin filtro) hacia el disco.
 */
import { LAYER_COUNT, MAX_BPM, MIN_BPM } from './constants';
import type { DisplayModel, LayerPilot } from './display';
import type { InstrumentState, InstrumentStatus } from './instrument';

/** Lo que enseña el piloto de una capa (el color: fósforo, aviso o grabación; apagado si vacía). */
export type PilotLight = 'off' | 'content' | 'pending' | 'recording';

export interface LayerPose {
  /** El nivel de la capa: la posición de su dial. */
  readonly level: number;
  readonly muted: boolean;
  readonly pilot: PilotLight;
}

export interface InstrumentPose {
  readonly layers: readonly LayerPose[];
  /** La capa elegida (0–3): lleva un anillo de luz alrededor de su dial. */
  readonly selected: number;
  /** El dial principal: el tempo en su rango (40–240 BPM). */
  readonly main: number;
  /** El brazo: el filtro de la capa elegida, de 0 (sin filtro) a 1. */
  readonly arm: number;
  readonly volume: number;
  /** Teclas que se quedan hundidas mientras dura lo que hacen. */
  readonly pressed: {
    readonly play: boolean;
    readonly record: boolean;
    readonly standby: boolean;
  };
  /** El piloto de grabar: apagado, a media luz en la cuenta previa o encendido. */
  readonly recordLight: 'off' | 'count-in' | 'on';
  /** Lo que se lee en la pantalla. */
  readonly display: DisplayModel;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Dos poses enseñan lo mismo (para no repintar el 3D cuando el estado del audio llega sin cambios
 * visibles: mientras suena, llega diez veces por segundo).
 */
export function samePose(a: InstrumentPose, b: InstrumentPose): boolean {
  if (a === b) return true;
  const sameLayers = a.layers.every((layer, i) => {
    const other = b.layers[i];
    return (
      other !== undefined &&
      layer.level === other.level &&
      layer.muted === other.muted &&
      layer.pilot === other.pilot
    );
  });
  const da = a.display;
  const db = b.display;
  const sameRows =
    da.rows.length === db.rows.length &&
    da.rows.every((row, i) => {
      const other = db.rows[i]!;
      return (
        row.label === other.label &&
        row.value === other.value &&
        row.selected === other.selected &&
        row.editing === other.editing
      );
    });
  return (
    sameLayers &&
    a.layers.length === b.layers.length &&
    a.selected === b.selected &&
    a.main === b.main &&
    a.arm === b.arm &&
    a.volume === b.volume &&
    a.pressed.play === b.pressed.play &&
    a.pressed.record === b.pressed.record &&
    a.pressed.standby === b.pressed.standby &&
    a.recordLight === b.recordLight &&
    da.title === db.title &&
    da.status === db.status &&
    da.lines.length === db.lines.length &&
    da.lines.every((line, i) => line === db.lines[i]) &&
    sameRows
  );
}

/** El color del piloto: grabar manda sobre la cola, y la cola sobre tener sonido. */
export function pilotLight(pilot: LayerPilot | undefined): PilotLight {
  if (!pilot) return 'off';
  if (pilot.recording) return 'recording';
  if (pilot.pending) return 'pending';
  return pilot.hasContent ? 'content' : 'off';
}

export function instrumentPose(
  state: InstrumentState,
  status: InstrumentStatus,
  display: DisplayModel,
): InstrumentPose {
  const { controls } = state;
  const layers = Array.from({ length: LAYER_COUNT }, (_, i) => {
    const layer = controls.layers[i];
    return {
      level: clamp01(layer?.level ?? 0),
      muted: layer?.muted ?? false,
      pilot: pilotLight(display.pilots[i]),
    };
  });
  return {
    layers,
    selected: state.selected,
    main: clamp01((controls.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)),
    arm: clamp01(controls.layers[state.selected]?.filter ?? 0),
    volume: clamp01(controls.volume),
    pressed: {
      play: status.transport === 'playing',
      record: status.recording !== 'idle',
      standby: status.standby,
    },
    recordLight:
      status.recording === 'recording'
        ? 'on'
        : status.recording === 'count-in'
          ? 'count-in'
          : 'off',
    display,
  };
}
