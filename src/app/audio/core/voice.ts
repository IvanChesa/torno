/**
 * Voz: una cabeza de lectura sobre el contenido de una capa (PLAN §4.4). Lee con interpolación
 * cúbica de Hermite y da la vuelta al llegar al final. Sigue a la línea de tiempo común
 * (*varispeed*: la velocidad sale del tempo) o, mientras se mantiene el disco, a la cabeza del disco.
 *
 * Cada capa tiene varias voces para que todos los cambios sean fundidos cruzados: la voz anterior
 * se apaga mientras la nueva entra.
 *
 * Por encima del tempo nativo, si las imágenes del *varispeed* pudieran caer en la banda audible, la
 * línea de tiempo lee el PCM pasado antes por un paso bajo que sigue a la velocidad
 * (`antialias.ts`). Encenderlo o apagarlo es un fundido de 10 ms entre las dos lecturas. El disco
 * no se filtra.
 */
import { AntialiasFilter, antialiasThreshold } from './antialias';
import type { LayerContent } from './content';
import { Ramp, wrap } from './dsp';
import type { Clock } from './transport';

/** Muestras del PCM que se filtran antes de la posición de lectura al encender el filtro. */
const ANTIALIAS_PREROLL = 512;
/** Histéresis: se enciende un 2 % por encima del umbral y se apaga en el umbral. */
const ANTIALIAS_HYSTERESIS = 1.02;
/** Saltos de la posición (en muestras) que el filtro sigue sin volver a empezar. */
const MAX_BACKWARD_JUMP = 3;
const MAX_FORWARD_JUMP = 512;

export class Voice {
  content: LayerContent | null = null;
  reversed = false;
  /** Sigue al disco en vez de a la línea de tiempo. */
  disc = false;
  /** Posición hacia delante en el PCM, en [0, frames). En reverso se lee su espejo. */
  position = 0;
  /** Pulso en el que está la cabeza del disco. */
  headBeat = 0;
  /** Pulso al que va la cabeza del disco (lo pone el canal antes de cada tramo). */
  discTarget = 0;
  readonly gain: Ramp;
  #speed = 0;
  #framesPerBeat = 1;
  #frames = 1;

  /** Coeficiente del suavizado con el que la cabeza sigue al disco. */
  readonly #discFollow: number;
  /** Polo del filtro de continua de la voz del disco (un disco quieto no suena). */
  readonly #dcBlock: number;
  #dcIn = 0;
  #dcOut = 0;

  // Contra el aliasing del varispeed.
  readonly #antialias: AntialiasFilter;
  readonly #antialiasOn: number;
  readonly #antialiasOff: number;
  /** Proporción de la lectura filtrada (0–1), con fundido al encender y al apagar. */
  readonly #antialiasMix: Ramp;
  readonly #mixGains: Float32Array;
  #antialiasActive = false;
  /** Las últimas 8 muestras filtradas (anillo) y la casilla de la última. */
  readonly #ring = new Float64Array(8);
  #ringSlot = 0;
  /** Índice de la última muestra filtrada, en la vuelta de `position` (puede salirse de [0, frames)). */
  #fed = 0;

  constructor(
    fade: Float32Array,
    discFollow = 1,
    dcBlock = 0,
    sampleRate = 48_000,
    maxFrames = 128,
  ) {
    this.#discFollow = discFollow;
    this.#dcBlock = dcBlock;
    this.gain = new Ramp(0, fade);
    this.#antialias = new AntialiasFilter(sampleRate);
    this.#antialiasOff = antialiasThreshold(sampleRate);
    this.#antialiasOn = this.#antialiasOff * ANTIALIAS_HYSTERESIS;
    this.#antialiasMix = new Ramp(0, fade);
    this.#mixGains = new Float32Array(maxFrames);
  }

  /** La lectura de la línea de tiempo pasa ahora por el filtro contra el aliasing. */
  get antialiased(): boolean {
    return this.#antialiasActive;
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
    this.#frames = content.frames;
    this.#framesPerBeat = content.frames / content.lengthBeats;
    this.reversed = reversed;
    this.disc = disc;
    this.headBeat = beat;
    this.discTarget = beat;
    this.#dcIn = 0;
    this.#dcOut = 0;
    let position = wrap(beat - content.offsetBeats, content.lengthBeats) * this.#framesPerBeat;
    if (position >= this.#frames) position -= this.#frames;
    this.position = position;
    this.#speed = beatsPerFrame * this.#framesPerBeat;
    this.gain.set(0);
    this.gain.start(1, fade);
    // La voz entra con su propio fundido: el filtro, si hace falta, ya está puesto desde el principio.
    this.#antialiasActive = false;
    this.#antialiasMix.set(0);
    if (!disc) this.#updateAntialias(false);
  }

  /** Recalcula la posición exacta para el pulso del reloj (sin errores acumulados) y la velocidad. */
  sync(clock: Clock): void {
    const content = this.content;
    if (!content) return;
    let position =
      wrap(clock.beat - content.offsetBeats, content.lengthBeats) * this.#framesPerBeat;
    if (position >= this.#frames) position -= this.#frames;
    if (this.#antialiasActive) {
      // El filtro sigue a la lectura: el índice de lo ya filtrado pasa a la vuelta de la posición
      // nueva, y un salto grande (o hacia atrás) lo hace empezar de nuevo.
      const n = this.#frames;
      let delta = position - this.position;
      if (delta > n / 2) delta -= n;
      else if (delta < -n / 2) delta += n;
      this.#fed -= this.position + delta - position;
      if (delta < -MAX_BACKWARD_JUMP || delta > MAX_FORWARD_JUMP) {
        this.position = position;
        this.#restartAntialias();
      }
    }
    this.position = position;
    this.#speed = clock.beatsPerFrame * this.#framesPerBeat;
    this.#updateAntialias(true);
  }

  /**
   * Enciende, ajusta o apaga el filtro según la velocidad (con histéresis). `fade`: con fundido
   * entre las dos lecturas (si no, al momento).
   */
  #updateAntialias(fade: boolean): void {
    const speed = this.#speed;
    const on = this.#antialiasActive && this.#antialiasMix.target === 1;
    const wanted = on ? speed > this.#antialiasOff : speed > this.#antialiasOn;
    const mix = this.#antialiasMix;
    if (wanted) {
      if (Math.abs(speed - this.#antialias.speed) > 1e-4 * speed) this.#antialias.design(speed);
      if (!this.#antialiasActive) {
        this.#antialiasActive = true;
        this.#restartAntialias();
      }
      if (mix.target !== 1) {
        if (fade) mix.start(1);
        else mix.set(1);
      }
    } else if (this.#antialiasActive && mix.target !== 0) {
      if (fade) {
        mix.start(0);
      } else {
        mix.set(0);
        this.#antialiasActive = false;
      }
    }
  }

  /** Vacía el filtro y lo pone a filtrar desde `ANTIALIAS_PREROLL` muestras antes de la lectura. */
  #restartAntialias(): void {
    this.#antialias.reset();
    this.#fed = Math.floor(this.position) + 2 - ANTIALIAS_PREROLL;
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
    return this.gain.current;
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
    if (this.#antialiasActive) {
      this.#renderAntialiasedAdd(out, frames, gains, transport);
      return;
    }
    const content = this.content;
    if (!content) return;
    const ramping = this.gain.ramping || transport !== null;
    const constant = this.gain.current;
    if (ramping) {
      this.gain.renderInto(gains, frames);
      if (transport) for (let i = 0; i < frames; i++) gains[i] = gains[i]! * transport[i]!;
    }
    const data = content.data;
    const n = this.#frames;
    const speed = this.#speed;
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
   * Como `renderTimelineAdd`, leyendo el PCM filtrado contra el aliasing (y, mientras se enciende o
   * se apaga, el fundido entre esa lectura y la directa).
   */
  #renderAntialiasedAdd(
    out: Float32Array,
    frames: number,
    gains: Float32Array,
    transport: Float32Array | null,
  ): void {
    const content = this.content;
    if (!content) return;
    const ramping = this.gain.ramping || transport !== null;
    const constant = this.gain.current;
    if (ramping) {
      this.gain.renderInto(gains, frames);
      if (transport) for (let i = 0; i < frames; i++) gains[i] = gains[i]! * transport[i]!;
    }
    const mixRamp = this.#antialiasMix;
    const blend = mixRamp.ramping || mixRamp.current !== 1;
    const mix = this.#mixGains;
    if (blend) mixRamp.renderInto(mix, frames);
    const filter = this.#antialias;
    const ring = this.#ring;
    const data = content.data;
    const n = this.#frames;
    const speed = this.#speed;
    const reversed = this.reversed;
    // Se lee lo filtrado adelantado en su retardo de grupo (ver `AntialiasFilter.delay`).
    const delay = filter.delay;
    let slot = this.#ringSlot;
    let fed = this.#fed;
    let p = this.position;
    for (let i = 0; i < frames; i++) {
      const pf = p + delay;
      const i1 = pf | 0;
      // Filtra el PCM (en el sentido de lectura) hasta la muestra que pide la interpolación.
      while (fed < i1 + 2) {
        fed++;
        let k = fed;
        while (k < 0) k += n;
        while (k >= n) k -= n;
        slot = (slot + 1) & 7;
        ring[slot] = filter.process(reversed ? data[n - 1 - k]! : data[k]!);
      }
      const t = pf - i1;
      // Casilla de la muestra `i1`: la última filtrada es `fed`.
      const base = slot - (fed - i1);
      const ym1 = ring[(base - 1) & 7]!;
      const y0 = ring[base & 7]!;
      const y1 = ring[(base + 1) & 7]!;
      const y2 = ring[(base + 2) & 7]!;
      const d1 = 0.5 * (y1 - ym1);
      const d2 = ym1 - 2.5 * y0 + 2 * y1 - 0.5 * y2;
      const d3 = 0.5 * (y2 - ym1) + 1.5 * (y0 - y1);
      let sample = ((d3 * t + d2) * t + d1) * t + y0;
      if (blend) {
        let q = reversed ? n - 1 - p : p;
        if (q < 0) q += n;
        const j1 = q | 0;
        const u = q - j1;
        const j0 = j1 === 0 ? n - 1 : j1 - 1;
        const j2 = j1 + 1 >= n ? j1 + 1 - n : j1 + 1;
        const j3 = j2 + 1 >= n ? j2 + 1 - n : j2 + 1;
        const xm1 = data[j0]!;
        const x0 = data[j1]!;
        const x1 = data[j2]!;
        const x2 = data[j3]!;
        const c1 = 0.5 * (x1 - xm1);
        const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
        const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
        const direct = ((c3 * u + c2) * u + c1) * u + x0;
        sample = direct + (sample - direct) * mix[i]!;
      }
      out[i] = out[i]! + sample * (ramping ? gains[i]! : constant);
      p += speed;
      if (p >= n) {
        p -= n;
        fed -= n;
      }
    }
    this.position = p;
    this.#fed = fed;
    this.#ringSlot = slot;
    if (!mixRamp.ramping && mixRamp.target === 0) this.#antialiasActive = false;
    if (!this.gain.ramping && this.gain.target === 0) this.release();
  }

  /**
   * Suma a `out` las `frames` muestras siguientes de la cabeza del disco, que sigue a `discTarget`
   * con un suavizado de un polo (sin escalones aunque el ángulo llegue a saltos).
   */
  renderDiscAdd(out: Float32Array, frames: number, gains: Float32Array): void {
    const content = this.content;
    if (!content) return;
    const ramping = this.gain.ramping;
    const constant = this.gain.current;
    const targetBeat = this.discTarget;
    const follow = this.#discFollow;
    const dcBlock = this.#dcBlock;
    let dcIn = this.#dcIn;
    let dcOut = this.#dcOut;
    if (ramping) this.gain.renderInto(gains, frames);
    const data = content.data;
    const n = this.#frames;
    const offset = content.offsetBeats;
    const length = content.lengthBeats;
    const framesPerBeat = this.#framesPerBeat;
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
      const raw = ((c3 * t + c2) * t + c1) * t + x0;
      // Filtro de continua: con la cabeza quieta, la salida se apaga sola en unos 16 ms.
      const sample = raw - dcIn + dcBlock * dcOut;
      dcIn = raw;
      dcOut = sample;
      out[i] = out[i]! + sample * (ramping ? gains[i]! : constant);
    }
    this.#dcIn = dcIn;
    this.#dcOut = dcOut;
    this.headBeat = head;
    this.position = wrap(head - offset, length) * framesPerBeat;
    if (this.position >= n) this.position -= n;
    if (!this.gain.ramping && this.gain.target === 0) this.release();
  }
}
