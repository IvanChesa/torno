/**
 * Utilidades de los tests del núcleo (solo las usan los `*.spec.ts`): un arnés que envía comandos y
 * renderiza por bloques como el worklet, y señales sintéticas con propiedades conocidas.
 */
import { DEFAULT_BPM } from './constants';
import { LoopCore, type LoopCoreOptions } from './loop-core';
import type { SessionState } from './session';
import {
  PROTOCOL_VERSION,
  type CoreCommand,
  type CoreStatus,
  type LibrarySound,
  type Notice,
} from './protocol';

type Body<C> = C extends unknown ? Omit<C, 'v'> : never;
/** Un comando sin la versión (el arnés la pone). */
export type CommandBody = Body<CoreCommand>;

/** Bloque del AudioWorklet. */
export const BLOCK = 128;

export interface Rendered {
  readonly left: Float32Array;
  readonly right: Float32Array;
}

/** Entrada del micrófono: un PCM (desde la muestra 0 del arnés) o una función de la muestra. */
export type InputSource = Float32Array | ((frame: number) => number);

export class Harness {
  readonly core: LoopCore;
  readonly sampleRate: number;
  /** Avisos recogidos de cada estado. */
  readonly notices: Notice[] = [];
  /** Muestras renderizadas desde el principio (reloj del núcleo). */
  frame = 0;
  private readonly inputBuffer = new Float32Array(BLOCK);

  constructor(options: Partial<LoopCoreOptions> = {}) {
    this.sampleRate = options.sampleRate ?? 48_000;
    this.core = new LoopCore({ ...options, sampleRate: this.sampleRate });
  }

  send(command: CommandBody): this {
    this.core.handle({ v: PROTOCOL_VERSION, ...command } as CoreCommand);
    return this;
  }

  /** Renderiza `frames` muestras en bloques de `block` (como el worklet) y recoge los avisos. */
  render(frames: number, input?: InputSource, block = BLOCK): Rendered {
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    for (let done = 0; done < frames; done += block) {
      const n = Math.min(block, frames - done);
      let mic: Float32Array | null = null;
      if (input) {
        mic = n === BLOCK ? this.inputBuffer : new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const f = this.frame + i;
          mic[i] = typeof input === 'function' ? input(f) : (input[f] ?? 0);
        }
      }
      const outL = left.subarray(done, done + n);
      const outR = right.subarray(done, done + n);
      this.core.process(mic, outL, outR, n);
      this.frame += n;
      this.collect();
    }
    return { left, right };
  }

  /** Renderiza hasta que el reloj del núcleo llegue a `frame`. */
  renderUntil(frame: number, input?: InputSource): Rendered {
    return this.render(Math.max(0, frame - this.frame), input);
  }

  /** Avisos con un código dado (desde el principio, también los que aún no han salido). */
  noticesOf(code: Notice['code']): Notice[] {
    this.flush();
    return this.notices.filter((notice) => notice.code === code);
  }

  /** Estado actual (sin perder los avisos que trae). */
  status(): CoreStatus {
    this.flush();
    return this.core.status;
  }

  /** Recoge los avisos del último estado. */
  collect(): void {
    const status = this.core.statusReady ? this.core.status : undefined;
    if (!status) return;
    this.core.statusReady = false;
    for (let i = 0; i < status.noticeCount; i++) this.notices.push({ ...status.notices[i]! });
  }

  /** Fuerza un estado y recoge sus avisos. */
  flush(): void {
    const status = this.core.flushStatus();
    for (let i = 0; i < status.noticeCount; i++) this.notices.push({ ...status.notices[i]! });
  }
}

/** Muestras de un bucle de `beats` pulsos a `bpm` (redondeado). */
/**
 * Copia de golpe de la sesión que suena (lo que hacía el manejador del worklet antes de copiar por
 * tramos con `SessionCopy`): la referencia de los tests.
 */
export function exportState(core: LoopCore): SessionState {
  const { sampleRate, bpm, layers } = core.snapshot();
  return {
    sampleRate,
    bpm,
    layers: layers.map(({ content, level, muted, pan, reversed, filter }) => ({
      pcm: content ? content.data.slice(0, content.frames) : null,
      lengthBeats: content?.lengthBeats ?? 0,
      offsetBeats: content?.offsetBeats ?? 0,
      source: content?.source ?? null,
      level,
      muted,
      pan,
      reversed,
      filter,
    })),
  };
}

export function loopFrames(beats: number, sampleRate: number, bpm = DEFAULT_BPM): number {
  return Math.round((beats * 60 * sampleRate) / bpm);
}

/** Un sonido de la biblioteca a partir de una función de la muestra. */
export function sound(
  id: string,
  frames: number,
  lengthBeats: number,
  sample: (i: number) => number,
): LibrarySound {
  const pcm = new Float32Array(frames);
  for (let i = 0; i < frames; i++) pcm[i] = sample(i);
  return { id, pcm, lengthBeats };
}

/** Un seno con un número entero de ciclos en el bucle (sin junta). */
export function sineSound(
  sampleRate: number,
  cycles: number,
  amplitude: number,
  beats = 8,
  bpm = DEFAULT_BPM,
): LibrarySound {
  const frames = loopFrames(beats, sampleRate, bpm);
  return sound(
    'seno',
    frames,
    beats,
    (i) => amplitude * Math.sin((2 * Math.PI * cycles * i) / frames),
  );
}

/** Una constante (corriente continua): cualquier salto en un cambio se ve entero. */
export function constantSound(
  sampleRate: number,
  value: number,
  beats = 8,
  bpm = DEFAULT_BPM,
): LibrarySound {
  return sound(`constante-${value}`, loopFrames(beats, sampleRate, bpm), beats, () => value);
}

/** Diente de sierra 0 → 1: el valor de la salida dice qué posición se está leyendo. */
export function rampSound(sampleRate: number, beats = 8, bpm = DEFAULT_BPM): LibrarySound {
  const frames = loopFrames(beats, sampleRate, bpm);
  return sound('rampa', frames, beats, (i) => i / frames);
}

/** Mayor salto entre muestras consecutivas de `signal[from..to)`. */
export function maxJump(signal: Float32Array, from = 0, to = signal.length): number {
  let max = 0;
  for (let i = Math.max(1, from); i < to; i++) {
    const jump = Math.abs(signal[i]! - signal[i - 1]!);
    if (jump > max) max = jump;
  }
  return max;
}

/** Pico absoluto de `signal[from..to)`. */
export function peak(signal: Float32Array, from = 0, to = signal.length): number {
  let max = 0;
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(signal[i]!));
  return max;
}

/** RMS de `signal[from..to)`. */
export function rms(signal: Float32Array, from = 0, to = signal.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += signal[i]! * signal[i]!;
  return Math.sqrt(sum / Math.max(1, to - from));
}

/** Generador pseudoaleatorio determinista (mulberry32) para el ruido de los tests. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
