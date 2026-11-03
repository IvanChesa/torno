import type { ControlId } from '../../instrument';
import type { Shot } from '../../scene';

/** El `id` de la caja del instrumento en la portada: adonde lleva «Ver en el instrumento». */
export const INSTRUMENT_ANCHOR = 'instrumento';

/** Lo que pide un «Ver en el instrumento»: su control y, si lo lleva, un encuadre de «Tocar». */
export interface GuideTarget {
  readonly control: ControlId;
  readonly shot: Shot | null;
}

/**
 * El control (y el encuadre) de un clic o un Intro en un «Ver en el instrumento» de la guía, o
 * `null`. Lo usa la portada, que escucha los clics por la guía (fase 8: así funciona también en
 * plena hidratación de la guía). Va aparte de la guía y lee sus atributos (`data-ver` y
 * `data-encuadre`, que pone la propia guía con los valores de su contenido), para no meter la guía
 * ni sus textos en el JS inicial.
 */
export function guideTargetFor(target: EventTarget | null): GuideTarget | null {
  const button = (target as Element | null)?.closest?.('[data-ver]');
  const control = button?.getAttribute('data-ver');
  if (!control) return null;
  return {
    control: control as ControlId,
    shot: (button?.getAttribute('data-encuadre') as Shot | null) ?? null,
  };
}
