/**
 * Copia de la sesión por tramos (para guardar, autoguardar y exportar). Copiar de golpe cuatro capas
 * de 60 s en el hilo de audio son varios milisegundos sin renderizar (más que un bloque); aquí se
 * reserva todo al pedirla (en el manejador del mensaje, a partir de `LoopCore.snapshot()`) y el
 * worklet copia un tramo en cada `process()`. El núcleo no la necesita: así no pesa en el worker
 * de exportación.
 *
 * Es coherente aunque la sesión cambie mientras tanto: el contenido confirmado de una capa no
 * cambia nunca (copia en escritura), así que se copia el que había al pedirla, con la mezcla de ese
 * momento.
 */
import { RECORDING_SOURCE, type LayerContent } from './content';
import { PROTOCOL_VERSION, type SessionCopyEvent } from './protocol';
import type { LayerState, SessionState } from './session';

/** Muestras que se copian por cada muestra que se procesa (con bloques de 128: 32.768). */
export const COPY_SAMPLES_PER_FRAME = 256;
/**
 * Los tramos crecen de 1024 en 1024 muestras hasta el tamaño completo (32 bloques): la primera vez,
 * el bucle aún no está optimizado (en V8, un tramo entero tardaba 1–2 ms en los primeros bloques),
 * y con tramos pequeños da tiempo a que el JIT lo compile.
 */
export const COPY_FIRST_SAMPLES = 1024;

export interface CopySnapshot {
  readonly sampleRate: number;
  readonly bpm: number;
  readonly layers: readonly CopyLayer[];
}

export interface CopyLayer {
  readonly content: LayerContent | null;
  readonly level: number;
  readonly muted: boolean;
  readonly pan: number;
  readonly reversed: boolean;
  readonly filter: number;
}

export class SessionCopy {
  /**
   * Calienta el bucle de copia antes de que suene nada (unos pocos ms, una vez, al crear el
   * worklet): así la primera copia de verdad ya corre optimizada y no da un bloque lento.
   */
  static warmUp(): void {
    const frames = 8192;
    const content: LayerContent = {
      data: new Float32Array(frames),
      frames,
      lengthBeats: 1,
      offsetBeats: 0,
      source: RECORDING_SOURCE,
    };
    const layer = { content, level: 1, muted: false, pan: 0, reversed: false, filter: 0 };
    for (let round = 0; round < 16; round++) {
      const copy = new SessionCopy(-1, { sampleRate: 48_000, bpm: 90, layers: [layer] });
      while (!copy.done) copy.pump(frames);
    }
  }

  /** El evento que se envía al terminar, con el PCM ya en `transfer`. */
  readonly event: SessionCopyEvent;
  readonly transfer: ArrayBuffer[];
  readonly #sources: (Float32Array | null)[];
  readonly #targets: (Float32Array<ArrayBuffer> | null)[];
  #layer = 0;
  #at = 0;
  #ramp = COPY_FIRST_SAMPLES;

  constructor(id: number, { sampleRate, bpm, layers }: CopySnapshot) {
    this.#sources = layers.map((layer) => layer.content?.data ?? null);
    this.#targets = layers.map((layer) =>
      layer.content ? new Float32Array(layer.content.frames) : null,
    );
    const states: LayerState[] = layers.map((layer, i) => ({
      pcm: this.#targets[i] ?? null,
      lengthBeats: layer.content?.lengthBeats ?? 0,
      offsetBeats: layer.content?.offsetBeats ?? 0,
      source: layer.content?.source ?? null,
      level: layer.level,
      muted: layer.muted,
      pan: layer.pan,
      reversed: layer.reversed,
      filter: layer.filter,
    }));
    const session: SessionState = { sampleRate, bpm, layers: states };
    this.event = { v: PROTOCOL_VERSION, type: 'session', id, session };
    this.transfer = [];
    for (const target of this.#targets) if (target) this.transfer.push(target.buffer);
    this.#skipEmpty();
  }

  get done(): boolean {
    return this.#layer >= this.#targets.length;
  }

  /** Copia como mucho `budget` muestras más (menos en los primeros tramos; sin reservar nada). */
  pump(budget: number): void {
    let left = budget < this.#ramp ? budget : this.#ramp;
    this.#ramp += COPY_FIRST_SAMPLES;
    while (left > 0 && this.#layer < this.#targets.length) {
      const target = this.#targets[this.#layer]!;
      const source = this.#sources[this.#layer]!;
      const end = Math.min(target.length, this.#at + left);
      for (let i = this.#at; i < end; i++) target[i] = source[i]!;
      left -= end - this.#at;
      this.#at = end;
      if (end === target.length) {
        this.#layer++;
        this.#at = 0;
        this.#skipEmpty();
      }
    }
  }

  /** Salta las capas sin contenido: una sesión vacía ya está copiada al pedirla. */
  #skipEmpty(): void {
    while (this.#layer < this.#targets.length && !this.#targets[this.#layer]) this.#layer++;
  }
}
