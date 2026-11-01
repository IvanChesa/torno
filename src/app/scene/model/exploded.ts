/**
 * La vista despiezada (PLAN fase 7, «Los detalles»): los niveles del aparato suben, cada uno lo
 * suyo (`EXPLODE_LIFT_MM`), para ver de qué está hecho. El cuerpo se queda en la mesa.
 */
import type { Vector3 } from 'three';
import { silhouette } from '../camera/shots';
import type { InstrumentModel } from './instrument';

/** Despieza el aparato: de 0 (montado) a 1 (despiezado del todo). */
export function applyExplode(model: InstrumentModel, amount: number): void {
  for (const level of model.levels) level.group.position.y = level.lift * amount;
  model.root.updateMatrixWorld(true);
}

/** La silueta del aparato despiezado del todo (para encuadrarlo); lo deja como estaba. */
export function explodedSilhouette(model: InstrumentModel): Vector3[] {
  const before = model.levels.map((level) => level.group.position.y);
  applyExplode(model, 1);
  const points = silhouette(model);
  model.levels.forEach((level, i) => (level.group.position.y = before[i] ?? 0));
  model.root.updateMatrixWorld(true);
  return points;
}
