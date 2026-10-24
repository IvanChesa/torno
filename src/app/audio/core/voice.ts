/**
 * Voz: una cabeza de lectura sobre el contenido de una capa (PLAN §4.4). Lee con interpolación
 * cúbica de Hermite y da la vuelta al llegar al final. Sigue a la línea de tiempo común
 * (*varispeed*: la velocidad sale del tempo) o, mientras se mantiene el disco, a la cabeza del disco.
 *
 * Cada capa tiene varias voces para que todos los cambios sean fundidos cruzados: la voz anterior
 * se apaga mientras la nueva entra.
 */
import type { LayerContent } from './content';
import { Ramp, wrap } from './dsp';

export class Voice {
  content: LayerContent | null = null;
  reversed = false;
  /** Sigue al disco en vez de a la línea de tiempo. */
  disc = false;
  /** Posición hacia delante en el PCM, en [0, frames). En reverso se lee su espejo. */
  position = 0;
  /** Pulso en el que está la cabeza del disco. */
  headBeat = 0;
  readonly gain: Ramp;
  private speed = 0;
  private framesPerBeat = 1;
  private frames = 1;

  constructor(fade: Float32Array) {
    this.gain = new Ramp(0, fade);
  }

  get active(): boolean {
    return this.content !== null;
  }

  /** Empieza a sonar `content` en el pulso `beat`, entrando con el fundido `fade`. */
  begin(
    content: LayerContent,
    reversed: boolean,
    disc: boolean,
    beat: number,
    beatsPerFrame: number,
    fade: Float32Array,
  ): void {
    this.content = content;
    this.frames = content.frames;
    this.framesPerBeat = content.frames / content.lengthBeats;
    this.reversed = reversed;
    this.disc = disc;
    this.headBeat = beat;
    this.sync(beat, beatsPerFrame);
    this.gain.set(0);
    this.gain.start(1, fade);
  }

  /** Recalcula la posición exacta para el pulso `beat` (sin errores acumulados) y la velocidad. */
  sync(beat: number, beatsPerFrame: number): void {
    const content = this.content;
    if (!content) return;
    let position = wrap(beat - content.offsetBeats, content.lengthBeats) * this.framesPerBeat;
    if (position >= this.frames) position -= this.frames;
    this.position = position;
    this.speed = beatsPerFrame * this.framesPerBeat;
  }

  fadeOut(fade: Float32Array): void {
    this.gain.start(0, fade);
  }

  release(): void {
    this.content = null;
    this.gain.set(0);
  }

  /** Ganancia actual (fundido incluido). */
  get level(): number {
    return this.gain.value;
  }

  /** Avanza el fundido sin leer (con el transporte parado, una voz de la línea de tiempo calla). */
  skip(frames: number): void {
    this.gain.skip(frames);
    if (!this.gain.ramping && this.gain.target === 0) this.release();
  }

  /**
   * Suma a `out` las `frames` muestras siguientes de la línea de tiempo × el fundido de la voz
   * × `transport` (la ganancia del transporte, o `null` si vale 1). `gains` es espacio de trabajo.
   */
  renderTimelineAdd(
    out: Float32Array,
    frames: number,
    gains: Float32Array,
    transport: Float32Array | null,
  ): void {
    const content = this.content;
    if (!content) return;
    const ramping = this.gain.ramping || transport !== null;
    const constant = this.gain.value;
    if (ramping) {
      this.gain.renderInto(gains, frames);
      if (transport) for (let i = 0; i < frames; i++) gains[i] = gains[i]! * transport[i]!;
    }
    const data = content.data;
    const n = this.frames;
    const speed = this.speed;
    const reversed = this.reversed;
    let p = this.position;
    for (let i = 0; i < frames; i++) {
      let q = reversed ? n - 1 - p : p;
      if (q < 0) q += n;
      const i1 = q | 0;
      const t = q - i1;
      const i0 = i1 === 0 ? n - 1 : i1 - 1;
      const i2 = i1 + 1 >= n ? i1 + 1 - n : i1 + 1;
      const i3 = i2 + 1 >= n ? i2 + 1 - n : i2 + 1;
      const xm1 = data[i0]!;
      const x0 = data[i1]!;
      const x1 = data[i2]!;
      const x2 = data[i3]!;
      const c1 = 0.5 * (x1 - xm1);
      const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
      const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
      const sample = ((c3 * t + c2) * t + c1) * t + x0;
      out[i] = out[i]! + sample * (ramping ? gains[i]! : constant);
      p += speed;
      if (p >= n) p -= n;
    }
    this.position = p;
    if (!this.gain.ramping && this.gain.target === 0) this.release();
  }

  /**
   * Suma a `out` las `frames` muestras siguientes de la cabeza del disco, que sigue a `targetBeat`
   * con un suavizado de un polo de coeficiente `follow` (sin escalones aunque el ángulo llegue a
   * saltos).
   */
  renderDiscAdd(
    out: Float32Array,
    frames: number,
    gains: Float32Array,
    targetBeat: number,
    follow: number,
  ): void {
    const content = this.content;
    if (!content) return;
    const ramping = this.gain.ramping;
    const constant = this.gain.value;
    if (ramping) this.gain.renderInto(gains, frames);
    const data = content.data;
    const n = this.frames;
    const offset = content.offsetBeats;
    const length = content.lengthBeats;
    const framesPerBeat = this.framesPerBeat;
    const reversed = this.reversed;
    let head = this.headBeat;
    for (let i = 0; i < frames; i++) {
      head += (targetBeat - head) * follow;
      let p = wrap(head - offset, length) * framesPerBeat;
      if (p >= n) p -= n;
      let q = reversed ? n - 1 - p : p;
      if (q < 0) q += n;
      const i1 = q | 0;
      const t = q - i1;
      const i0 = i1 === 0 ? n - 1 : i1 - 1;
      const i2 = i1 + 1 >= n ? i1 + 1 - n : i1 + 1;
      const i3 = i2 + 1 >= n ? i2 + 1 - n : i2 + 1;
      const xm1 = data[i0]!;
      const x0 = data[i1]!;
      const x1 = data[i2]!;
      const x2 = data[i3]!;
      const c1 = 0.5 * (x1 - xm1);
      const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
      const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
      const sample = ((c3 * t + c2) * t + c1) * t + x0;
      out[i] = out[i]! + sample * (ramping ? gains[i]! : constant);
    }
    this.headBeat = head;
    this.position = wrap(head - offset, length) * framesPerBeat;
    if (this.position >= n) this.position -= n;
    if (!this.gain.ramping && this.gain.target === 0) this.release();
  }
}
