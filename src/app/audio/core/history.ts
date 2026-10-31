/**
 * Deshacer y rehacer de una capa (PLAN §4.4): hasta `UNDO_DEPTH` estados anteriores más el actual.
 * Cada estado es un contenido inmutable (o `null`, capa vacía), así que moverse por el historial
 * no copia nada y no reserva memoria. Una edición nueva invalida el rehacer.
 */
import { UNDO_DEPTH } from './constants';
import type { LayerContent } from './content';

export class LayerHistory {
  readonly #states: (LayerContent | null)[];
  /** Estados guardados (del más antiguo al más nuevo). */
  #count = 1;
  /** Índice del estado actual. */
  #cursor = 0;
  #version = 0;

  constructor(readonly capacity = UNDO_DEPTH + 1) {
    this.#states = new Array<LayerContent | null>(capacity).fill(null);
  }

  get current(): LayerContent | null {
    return this.#states[this.#cursor] ?? null;
  }

  get undoCount(): number {
    return this.#cursor;
  }

  get redoCount(): number {
    return this.#count - 1 - this.#cursor;
  }

  /**
   * Sube cada vez que cambia el estado actual (editar, deshacer, rehacer o empezar de cero): la
   * pantalla rehace la forma de onda de la capa solo entonces. Los contadores de deshacer no valen
   * para eso: se quedan en 3 con la cuarta sobregrabación.
   */
  get version(): number {
    return this.#version;
  }

  /** Una edición: `content` pasa a ser el actual, se pierde el rehacer y, si no cabe, lo más antiguo. */
  push(content: LayerContent | null): void {
    // Lo que había por delante del cursor (el rehacer) se descarta.
    for (let i = this.#cursor + 1; i < this.#count; i++) this.#states[i] = null;
    this.#count = this.#cursor + 1;
    if (this.#count === this.capacity) {
      for (let i = 1; i < this.capacity; i++) this.#states[i - 1] = this.#states[i] ?? null;
      this.#count--;
    }
    this.#states[this.#count] = content;
    this.#cursor = this.#count;
    this.#count++;
    this.#version++;
  }

  undo(): boolean {
    if (this.#cursor === 0) return false;
    this.#cursor--;
    this.#version++;
    return true;
  }

  redo(): boolean {
    if (this.#cursor >= this.#count - 1) return false;
    this.#cursor++;
    this.#version++;
    return true;
  }

  /** Empieza de cero con un solo estado (cargar una sesión o sesión nueva). */
  reset(content: LayerContent | null): void {
    this.#states.fill(null);
    this.#states[0] = content;
    this.#count = 1;
    this.#cursor = 0;
    this.#version++;
  }

  /** Olvida el estado más antiguo que no sea el actual (para liberar memoria). */
  dropOldest(): boolean {
    if (this.#cursor === 0) {
      // Sin deshacer: se puede soltar el rehacer más lejano.
      if (this.#count <= 1) return false;
      this.#count--;
      this.#states[this.#count] = null;
      return true;
    }
    for (let i = 1; i < this.#count; i++) this.#states[i - 1] = this.#states[i] ?? null;
    this.#count--;
    this.#states[this.#count] = null;
    this.#cursor--;
    return true;
  }

  /** Estados guardados: el actual, el deshacer y el rehacer. */
  get size(): number {
    return this.#count;
  }

  /** Estado guardado número `index` (del más antiguo al más nuevo). Sin cierres: vale en `process()`. */
  at(index: number): LayerContent | null {
    return index < this.#count ? (this.#states[index] ?? null) : null;
  }
}
