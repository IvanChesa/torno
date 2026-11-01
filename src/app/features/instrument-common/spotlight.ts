import { Service, signal } from '@angular/core';
import type { ControlId } from '../../instrument';
import type { Shot } from '../../scene';

/** Lo que pide la guía: señalar un control y, si hace falta, con un encuadre de «Tocar». */
export interface SpotlightRequest {
  readonly id: ControlId;
  /** Un encuadre de «Tocar» en lugar del de cerca del control (las capas, que son cuatro). */
  readonly shot: Shot | null;
  /** Cada petición, con su número: cada instrumento atiende cada una una sola vez. */
  readonly serial: number;
}

/**
 * «Ver en el instrumento» (PLAN fase 7, la guía): la guía pide señalar un control y el instrumento
 * que haya lo atiende cuando está listo (la guía no espera a que se cargue). El 3D viaja hasta él
 * y le pasa el foco, que enciende su anillo de luz; el plato HTML le pasa el foco.
 *
 * **Nunca suena ni cambia nada:** solo mueve la cámara y el foco. Es un signal y nada más: va en el
 * bundle de la portada sin arrastrar el instrumento.
 */
@Service()
export class InstrumentSpotlight {
  readonly #request = signal<SpotlightRequest | null>(null);
  #serial = 0;

  /** La última petición (la atiende el instrumento si aún no lo ha hecho). */
  readonly request = this.#request.asReadonly();

  show(id: ControlId, shot: Shot | null = null): void {
    this.#request.set({ id, shot, serial: ++this.#serial });
  }
}

/**
 * El control de un instrumento, enfocado sin el salto del navegador. La guía ya lleva la página al
 * instrumento; con `scroll`, además, el control al centro de la pantalla (el plato HTML puede ser
 * más alto que ella).
 */
export function focusControl(
  root: HTMLElement,
  id: ControlId,
  scroll: ScrollBehavior | null = null,
): boolean {
  const element = root.querySelector<HTMLElement>(`[data-control="${id}"]`);
  if (!element || element.hidden) return false;
  element.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  if (scroll) element.scrollIntoView({ block: 'center', behavior: scroll });
  return root.ownerDocument.activeElement === element;
}
