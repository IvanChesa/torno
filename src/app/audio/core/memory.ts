/**
 * Contabilidad de memoria del audio (PLAN §4.4 y §5): bytes de los búferes de PCM que el núcleo
 * tiene vivos (estados del deshacer y del rehacer, cambios en cola y la toma en curso), sin contar
 * dos veces el mismo búfer. El peor caso se calcula aquí y se documenta en docs/AUDIO.md.
 */
import { LAYER_COUNT, MAX_LAYER_SECONDS, MAX_TAKE_SECONDS, UNDO_DEPTH } from './constants';

/** Presupuesto de §5: el núcleo recorta el deshacer más antiguo para no pasar de aquí. */
export const MEMORY_BUDGET_BYTES = 220_000_000;

const FLOAT_BYTES = 4;

/** Cuenta bytes de búferes distintos. Sin reservas al contar (vale dentro de `process()`). */
export class MemoryCounter {
  readonly #seen: (ArrayBufferLike | null)[];
  #count = 0;
  total = 0;

  constructor(capacity: number) {
    this.#seen = new Array<ArrayBufferLike | null>(capacity).fill(null);
  }

  reset(): void {
    for (let i = 0; i < this.#count; i++) this.#seen[i] = null;
    this.#count = 0;
    this.total = 0;
  }

  add(data: Float32Array | null | undefined): void {
    if (!data) return;
    const buffer = data.buffer;
    for (let i = 0; i < this.#count; i++) if (this.#seen[i] === buffer) return;
    if (this.#count < this.#seen.length) this.#seen[this.#count++] = buffer;
    this.total += buffer.byteLength;
  }
}

export interface WorstCase {
  readonly sampleRate: number;
  /** Una capa de 60 s. */
  readonly layerBytes: number;
  /** Las 4 capas con sus 3 estados de deshacer más el actual. */
  readonly historyBytes: number;
  /** La toma en curso (60 s). */
  readonly takeBytes: number;
  readonly totalBytes: number;
  readonly withinBudget: boolean;
}

/**
 * Peor caso: 4 capas de 60 s con 3 estados de deshacer cada una (más el actual) y una toma de 60 s
 * en curso. Los cambios de sonido en cola son bucles de la biblioteca (unos pocos segundos) y no
 * cambian el orden de magnitud; el presupuesto los cubre igualmente.
 */
export function worstCaseMemory(sampleRate: number): WorstCase {
  const layerBytes = MAX_LAYER_SECONDS * sampleRate * FLOAT_BYTES;
  const historyBytes = LAYER_COUNT * (UNDO_DEPTH + 1) * layerBytes;
  const takeBytes = MAX_TAKE_SECONDS * sampleRate * FLOAT_BYTES;
  const totalBytes = historyBytes + takeBytes;
  return {
    sampleRate,
    layerBytes,
    historyBytes,
    takeBytes,
    totalBytes,
    withinBudget: totalBytes <= MEMORY_BUDGET_BYTES,
  };
}
