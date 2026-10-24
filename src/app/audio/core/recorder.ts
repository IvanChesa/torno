/**
 * Grabación de una toma (PLAN §4.4): `idle` → `count-in` → `recording` → `idle`.
 *
 * La entrada que llega en la muestra `f` se oyó (y se tocó) en la muestra `f − latencia` de la línea
 * de tiempo, así que la muestra `k` de la toma es la entrada que llega `latencia` muestras después
 * de que el transporte pase por `inicio + k`. Cada muestra se escribe donde la cabeza de lectura de
 * la capa la hará sonar: directa si la capa va a su tempo nativo, o con un remuestreador de Hermite
 * en flujo si no (sobregrabar una capa grabada a otro tempo).
 *
 * La toma entra con un fundido de `junta` muestras y, al cerrarse, se sigue grabando otro tanto que
 * se funde hacia fuera: si la toma da la vuelta completa al bucle, ese final se cruza con el
 * principio (junta sin clic); si se cierra antes, el sonido se apaga sin cortarse.
 *
 * Los búferes se reservan al empezar (en el manejador del comando); `process*` no reserva nada.
 */
import type { RecordingState } from './protocol';
import type { MutableLayerContent } from './content';
import { LowpassSvf } from './svf';

export type TakeKind =
  /** Toma libre con la sesión vacía: se cierra al pulsar y fija la duración del bucle. */
  | 'first'
  /** Toma libre con otras capas: sigue la duración del bucle y se cierra sola. */
  | 'follow'
  /** Toma de 1, 2 o 4 compases. */
  | 'fixed';

/** Por debajo de este error acumulado (en muestras) se escribe directamente, sin remuestrear. */
const DIRECT_TOLERANCE = 0.5;
/** El remuestreador va una muestra por detrás y Hermite necesita una más. */
const RESAMPLER_LAG = 2;

export class Recorder {
  state: RecordingState = 'idle';
  layer = -1;
  kind: TakeKind = 'fixed';
  fitTempo = false;
  /** La toma se escribe sobre lo que ya había (sobregrabación). */
  overdub = false;

  // --- Cuenta previa ---
  /** Muestras de cuenta previa que quedan con el transporte parado (0 si no hay). */
  timerFrames = 0;
  /** Muestras por pulso de la cuenta previa con el transporte parado. */
  timerBeatFrames = 0;
  /** Pulso en el que empieza la toma (`NaN` mientras no se sabe). */
  startBeat = Number.NaN;

  // --- Toma ---
  /** Muestra del transporte en la que empieza la toma. */
  startFrame = 0;
  /** Muestras de la toma en la línea de tiempo (−1 si es una primera toma libre sin cerrar). */
  takeFrames = 0;
  /** Muestras de la toma ya cerrada (la duración efectiva). */
  closedFrames = -1;
  /** Máximo de una toma libre. */
  maxFrames = 0;
  /** Contenido que se está grabando (se publica al confirmar). */
  target: MutableLayerContent | null = null;
  private k = 0;
  private readonly junction: Float32Array;
  private junctionFrames: number;

  // Escritura.
  private direct = true;
  private writeStart = 0;
  private direction = 1;
  private speed = 1;
  // Remuestreador: las cuatro últimas entradas y si hay que filtrar antes (al comprimir).
  private u0 = 0;
  private u1 = 0;
  private u2 = 0;
  private u3 = 0;
  private antiAlias = false;
  private readonly alias1: LowpassSvf;
  private readonly alias2: LowpassSvf;

  constructor(
    private readonly sampleRate: number,
    junction: Float32Array,
  ) {
    this.junction = junction;
    this.junctionFrames = junction.length;
    this.alias1 = new LowpassSvf(sampleRate);
    this.alias2 = new LowpassSvf(sampleRate);
  }

  get active(): boolean {
    return this.state !== 'idle';
  }

  /** Prepara una toma: el búfer ya está reservado (y, si es sobregrabación, copiado). */
  arm(
    layer: number,
    kind: TakeKind,
    target: MutableLayerContent,
    overdub: boolean,
    fitTempo: boolean,
    maxFrames: number,
  ): void {
    this.state = 'count-in';
    this.layer = layer;
    this.kind = kind;
    this.target = target;
    this.overdub = overdub;
    this.fitTempo = fitTempo;
    this.maxFrames = maxFrames;
    this.timerFrames = 0;
    this.startBeat = Number.NaN;
    this.closedFrames = -1;
  }

  /**
   * Empieza a grabar en la muestra `startFrame` del transporte. `writeStart` es la posición del
   * PCM que suena en ese momento, `direction` el sentido de la cabeza y `speed` las muestras del PCM
   * por muestra del transporte.
   */
  begin(
    startFrame: number,
    takeFrames: number,
    latency: number,
    writeStart: number,
    direction: number,
    speed: number,
  ): void {
    this.state = 'recording';
    this.startFrame = startFrame;
    this.takeFrames = takeFrames;
    this.k = -latency;
    this.direction = direction;
    this.speed = speed;
    const span = takeFrames < 0 ? this.maxFrames : takeFrames;
    this.direct = Math.abs(speed - 1) * span < DIRECT_TOLERANCE;
    this.writeStart = this.direct ? Math.round(writeStart) : writeStart;
    this.u0 = this.u1 = this.u2 = this.u3 = 0;
    this.antiAlias = !this.direct && speed < 1;
    if (this.antiAlias) {
      const cutoff = 0.45 * speed * this.sampleRate;
      this.alias1.reset();
      this.alias2.reset();
      this.alias1.setCutoff(cutoff);
      this.alias2.setCutoff(cutoff);
      // Los dos Butterworth retrasan los graves √2/ωc cada uno: la toma se escribe ese tanto antes
      // para que siga alineada.
      const delay = (2 * Math.SQRT2 * this.sampleRate) / (2 * Math.PI * cutoff);
      this.writeStart -= direction * speed * delay;
    }
  }

  /** Cierra la toma en la muestra `frame` del transporte (pulsar grabar, pausar o los 60 s). */
  close(frame: number): void {
    if (this.state !== 'recording' || this.closedFrames >= 0) return;
    const elapsed = frame - this.startFrame;
    const limit = this.takeFrames < 0 ? this.maxFrames : this.takeFrames;
    this.closedFrames = Math.max(0, Math.min(elapsed, limit));
    if (this.kind === 'first' && this.target) this.target.frames = Math.max(1, this.closedFrames);
  }

  /** Muestra del transporte en la que la toma se cierra sola (o la primera toma libre, a los 60 s). */
  endFrame(): number {
    const limit = this.takeFrames < 0 ? this.maxFrames : this.takeFrames;
    return this.startFrame + limit;
  }

  /** Ya se ha grabado todo, también el final que se cruza con la junta: se puede confirmar. */
  get complete(): boolean {
    return this.state === 'recording' && this.closedFrames >= 0 && this.framesToComplete <= 0;
  }

  /** Muestras de entrada que faltan para confirmar una toma cerrada. */
  get framesToComplete(): number {
    const end = this.closedFrames + this.junctionFrames + (this.direct ? 0 : RESAMPLER_LAG);
    return end - this.k;
  }

  /** Vuelve a reposo y suelta el búfer (cancelar o después de confirmar). */
  finish(): void {
    this.state = 'idle';
    this.layer = -1;
    this.target = null;
    this.closedFrames = -1;
    this.timerFrames = 0;
    this.startBeat = Number.NaN;
  }

  /**
   * Graba `frames` muestras de `input` (desde `offset`; `null` = silencio) multiplicadas por
   * `gains` (la ganancia de entrada suavizada, desde 0).
   */
  processInput(
    input: Float32Array | null,
    offset: number,
    frames: number,
    gains: Float32Array,
  ): void {
    const target = this.target;
    if (this.state !== 'recording' || !target) return;
    const data = target.data;
    const junction = this.junction;
    const fadeFrames = this.junctionFrames;
    const closed = this.closedFrames;
    for (let i = 0; i < frames; i++) {
      const k = this.k++;
      if (k < 0) continue;
      let envelope = k < fadeFrames ? junction[k]! : 1;
      if (closed >= 0 && k >= closed) {
        const tail = k - closed;
        envelope = tail < fadeFrames ? envelope * (1 - junction[tail]!) : 0;
      }
      const x = input ? input[offset + i]! : 0;
      const u = x * gains[i]! * envelope;
      if (this.direct) {
        if (envelope === 0) continue;
        // La primera toma libre no sabe su duración hasta cerrarse: hasta entonces, sin vuelta.
        const length = closed >= 0 || this.kind !== 'first' ? target.frames : data.length;
        let index = (this.writeStart + this.direction * k) % length;
        if (index < 0) index += length;
        data[index] = data[index]! + u;
      } else {
        this.renderResampled(data, target.frames, k, u);
      }
    }
  }

  /**
   * Remuestreador en flujo: la entrada `k` está en la posición W(k) = inicio + sentido·velocidad·k
   * del PCM. Al llegar `u_k` se escriben las muestras enteras del PCM entre W(k−2) y W(k−1),
   * interpoladas con Hermite sobre u(k−3)…u(k).
   */
  private renderResampled(data: Float32Array, frames: number, k: number, input: number): void {
    let u = input;
    if (this.antiAlias) u = this.alias2.tick(this.alias1.tick(u));
    this.u0 = this.u1;
    this.u1 = this.u2;
    this.u2 = this.u3;
    this.u3 = u;
    if (k < 2) return;
    const step = this.direction * this.speed;
    const from = this.writeStart + step * (k - 2);
    const to = this.writeStart + step * (k - 1);
    const xm1 = this.u0;
    const x0 = this.u1;
    const x1 = this.u2;
    const x2 = this.u3;
    const c1 = 0.5 * (x1 - xm1);
    const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
    const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
    if (step > 0) {
      for (let j = Math.floor(from) + 1; j <= to; j++) {
        const t = (j - from) / step;
        let index = j % frames;
        if (index < 0) index += frames;
        data[index] = data[index]! + (((c3 * t + c2) * t + c1) * t + x0);
      }
    } else {
      for (let j = Math.ceil(from) - 1; j >= to; j--) {
        const t = (from - j) / -step;
        let index = j % frames;
        if (index < 0) index += frames;
        data[index] = data[index]! + (((c3 * t + c2) * t + c1) * t + x0);
      }
    }
  }
}
