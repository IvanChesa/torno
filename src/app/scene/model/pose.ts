/**
 * La pose en el modelo (PLAN §4.6): gira los diales, el brazo y la rueda, hunde las teclas, enciende
 * los pilotos y pone el anillo de la capa elegida. Solo mueve lo que ya existe: no crea nada.
 */
import { Color } from 'three';
import {
  armDirection,
  DECK_HEIGHT,
  LAYER_CONTROLS,
  PLACEMENTS,
  polar,
  type InstrumentPose,
  type PilotLight,
  type PlacedControl,
} from '../../instrument';
import {
  PILOT_OFF_INTENSITY,
  PILOT_OFF_TONE,
  type InstrumentMaterials,
} from '../materials/materials';
import { PALETTE } from '../materials/palette';
import { MM, rad } from './geometry';
import type { InstrumentModel } from './instrument';

/** Lo que baja una tecla hundida y el botón de reposo, en mm. */
export const KEY_TRAVEL = 2;
export const STANDBY_TRAVEL = 1;
/** Lo que gira la rueda de punta a punta del volumen. */
export const WHEEL_TURN = rad(300);

/**
 * El giro de un dial para un valor de 0 a 1: la raya va de −135° a 135° desde las 12 (el fondo), en
 * el sentido de las agujas del reloj visto desde arriba, como la aguja del instrumento HTML. En
 * reposo (giro 0), la raya mira hacia quien toca.
 */
export function dialAngle(value: number): number {
  return Math.PI + rad(135) - rad(270) * value;
}

const PHOSPHOR = new Color(PALETTE.phosphor);
const WARNING = new Color(PALETTE.warning);
const RECORD = new Color(PALETTE.ledRecord);

interface Light {
  readonly color: Color;
  readonly intensity: number;
}

function light(pilot: PilotLight, muted: boolean): Light {
  switch (pilot) {
    case 'off':
      return { color: PHOSPHOR, intensity: 0 };
    case 'content':
      // En silencio, la capa sigue teniendo sonido: el piloto, a media luz.
      return { color: PHOSPHOR, intensity: muted ? 0.35 : 1.2 };
    case 'pending':
      return { color: WARNING, intensity: 1 };
    case 'recording':
      return { color: RECORD, intensity: 1.4 };
  }
}

function setLight(material: InstrumentMaterials['ledRecord'], { color, intensity }: Light): void {
  material.emissive.copy(color);
  if (intensity === 0) {
    // Apagado: un tono apagado de su color, con un brillo mínimo (DISENO.md §7).
    material.color.copy(color).multiplyScalar(PILOT_OFF_TONE);
    material.emissiveIntensity = PILOT_OFF_INTENSITY;
  } else {
    material.color.copy(color);
    material.emissiveIntensity = intensity;
  }
}

export function applyPose(
  model: InstrumentModel,
  materials: InstrumentMaterials,
  pose: InstrumentPose,
): void {
  LAYER_CONTROLS.forEach((id, layer) => {
    const state = pose.layers[layer];
    const dial = model.controls.get(id);
    if (state && dial) dial.rotation.y = dialAngle(state.level);
    const material = materials.pilots[layer];
    if (state && material) setLight(material, light(state.pilot, state.muted));
  });
  const main = model.controls.get('main');
  if (main) main.rotation.y = dialAngle(pose.main);

  const direction = armDirection(pose.arm);
  const arm = model.controls.get('arm');
  if (arm) arm.rotation.y = Math.atan2(direction.x, direction.z);
  model.wheel.rotation.x = pose.volume * WHEEL_TURN;

  const travel = (id: 'play' | 'record' | 'standby', pressed: boolean, distance: number) => {
    const key = model.controls.get(id);
    if (key) key.position.y = (DECK_HEIGHT - (pressed ? distance : 0)) * MM;
  };
  travel('play', pose.pressed.play, KEY_TRAVEL);
  travel('record', pose.pressed.record, KEY_TRAVEL);
  travel('standby', pose.pressed.standby, STANDBY_TRAVEL);

  setLight(materials.ledRecord, {
    color: RECORD,
    intensity: pose.recordLight === 'on' ? 1.4 : pose.recordLight === 'count-in' ? 0.6 : 0,
  });

  const selected = LAYER_CONTROLS[pose.selected] as PlacedControl | undefined;
  if (selected) {
    const placement = PLACEMENTS[selected];
    const point = polar(placement.radius, placement.angle);
    model.selection.position.x = point.x * MM;
    model.selection.position.z = point.z * MM;
  }
}
