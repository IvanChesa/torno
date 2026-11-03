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
 * «Ver en el instrumento» (PLAN fase 7, la guía) y «Despiezar» (los detalles): la web pide al
 * instrumento señalar un control o despiezarse. La guía pide señalar un control y el instrumento
 * que haya lo atiende cuando está listo (la guía no espera a que se cargue). El 3D viaja hasta él
 * y le pasa el foco, que enciende su anillo de luz; el plato HTML le pasa el foco.
 *
 * **Nunca suena ni cambia nada:** solo mueve la cámara y el foco. Es un signal y nada más: va en el
 * bundle de la portada sin arrastrar el instrumento.
 */
@Service()
export class InstrumentSpotlight {
  readonly #request = signal<SpotlightRequest | null>(null);
  readonly #explode = signal(0);
  #serial = 0;
  /** La última petición que ha atendido un instrumento. */
  #attended = 0;

  /** La última petición (la atiende el instrumento si aún no lo ha hecho). */
  readonly request = this.#request.asReadonly();
  /**
   * Cuántas veces se ha pedido la vista despiezada (la sección de los detalles). La atiende el 3D;
   * el plato HTML no tiene piezas que separar.
   */
  readonly explodeRequests = this.#explode.asReadonly();

  show(id: ControlId, shot: Shot | null = null): void {
    this.#request.set({ id, shot, serial: ++this.#serial });
  }

  explode(): void {
    this.#explode.update((count) => count + 1);
  }

  /** Un instrumento ha atendido la petición `serial` (ha movido la cámara y el foco). */
  attend(serial: number): void {
    this.#attended = Math.max(this.#attended, serial);
  }

  /**
   * Olvida la última petición si un instrumento ya la atendió: el que llegue después no la repetirá.
   * Cuando el 3D deja paso al plato HTML (fase 8), una petición vieja de la guía no tiene que mover
   * el foco; una que aún esperaba (un «Tocar» antes de que fallara el 3D), sí (revisión, #6).
   */
  clearAttended(): void {
    if ((this.#request()?.serial ?? 0) <= this.#attended) this.#request.set(null);
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
