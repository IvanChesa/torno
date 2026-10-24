/**
 * Canal de una capa (PLAN §4.4): sus voces, el historial, el cambio de sonido en cola, el disco, el
 * filtro y la mezcla (nivel, silencio y panorama de igual potencia). Todo lo que suena pasa por
 * aquí; `process`/`render` no reservan memoria.
 */
import {
  CHANGE_FADE_SECONDS,
  DISC_BEATS_PER_TURN,
  DISC_DC_BLOCK_HZ,
  DISC_FOLLOW_SECONDS,
  DISC_RELEASE_FADE_SECONDS,
  SMOOTHING_SECONDS,
} from './constants';
import type { LayerContent } from './content';
import { fadeTable, framesOf, onePoleCoefficient, Ramp } from './dsp';
import { LayerHistory } from './history';
import type { LayerStatus } from './protocol';
import { cutoffForAmount, LowpassSvf } from './svf';
import type { Clock } from './transport';
import { Voice } from './voice';

/**
 * Voces por capa: la que suena más las que se están apagando. Con un cambio en cada bloque de 128
 * muestras y fundidos de 10–15 ms, no suenan más de 7 a la vez: no hace falta robar ninguna.
 */
export const VOICES_PER_LAYER = 8;
/** El corte del filtro se recalcula cada 32 muestras (con el valor suavizado). */
export const FILTER_BLOCK = 32;
/** Por debajo de este brazo (y con el objetivo en 0), el filtro se retira y pasa a *bypass*. */
const FILTER_RELEASE_AMOUNT = 1e-3;
/** Por debajo de esta distancia, un parámetro suavizado llega a su objetivo exacto. */
const SNAP = 1e-6;

type FilterState = 'bypass' | 'on';

export class LayerChannel {
  readonly history = new LayerHistory();
  readonly voices: Voice[] = [];
  /** Voz que suena ahora (la última que ha empezado), o −1. */
  #current = -1;
  reversed = false;

  // Cambio de sonido en cola (al siguiente límite de compás).
  pendingActive = false;
  pendingContent: LayerContent | null = null;
  pendingBeat = 0;
  /** Muestra del transporte en la que entra (se recalcula si cambia el tempo). */
  pendingFrame = 0;

  // Disco.
  discHeld = false;
  #discHoldBeat = 0;
  #discTarget = 0;
  readonly #discFollow: number;

  // Mezcla.
  level = 1;
  muted = false;
  pan = 0;
  #targetL = Math.SQRT1_2;
  #targetR = Math.SQRT1_2;
  #gainL = Math.SQRT1_2;
  #gainR = Math.SQRT1_2;
  readonly #smoothing: number;

  // Filtro.
  amountTarget = 0;
  #amount = 0;
  #filterState: FilterState = 'bypass';
  #settlePending = false;
  #coefficientCountdown = 0;
  readonly #amountStep: number;
  readonly #svf: LowpassSvf;
  readonly #wet: Ramp;

  // Medidor: suma de cuadrados antes del nivel.
  #meterSum = 0;
  #meterFrames = 0;

  // Espacio de trabajo.
  readonly #buffer: Float32Array;
  readonly #gains: Float32Array;
  readonly #dry: Float32Array;
  readonly #wetGains: Float32Array;

  readonly changeFade: Float32Array;
  readonly releaseFade: Float32Array;

  readonly #sampleRate: number;

  constructor(sampleRate: number, maxFrames: number) {
    this.#sampleRate = sampleRate;
    this.changeFade = fadeTable(framesOf(CHANGE_FADE_SECONDS, sampleRate));
    this.releaseFade = fadeTable(framesOf(DISC_RELEASE_FADE_SECONDS, sampleRate));
    this.#discFollow = onePoleCoefficient(DISC_FOLLOW_SECONDS, sampleRate);
    const dcBlock = Math.exp((-2 * Math.PI * DISC_DC_BLOCK_HZ) / sampleRate);
    for (let i = 0; i < VOICES_PER_LAYER; i++) {
      this.voices.push(new Voice(this.changeFade, this.#discFollow, dcBlock));
    }
    this.#smoothing = onePoleCoefficient(SMOOTHING_SECONDS, sampleRate);
    this.#amountStep = 1 - Math.exp(-FILTER_BLOCK / (SMOOTHING_SECONDS * sampleRate));
    this.#svf = new LowpassSvf(sampleRate);
    this.#wet = new Ramp(0, this.changeFade);
    this.#buffer = new Float32Array(maxFrames);
    this.#gains = new Float32Array(maxFrames);
    this.#dry = new Float32Array(maxFrames);
    this.#wetGains = new Float32Array(maxFrames);
  }

  /** Contenido actual (el del historial). */
  get content(): LayerContent | null {
    return this.history.current;
  }

  /** Escribe el estado de la capa (sin reservar: lo llama `process()` ≤ 30 veces por segundo). */
  writeStatus(layer: LayerStatus, clock: Clock): void {
    const content = this.content;
    layer.hasContent = content !== null;
    layer.sourceKind = content ? content.source.kind : 'empty';
    layer.sourceId = content && content.source.kind === 'library' ? content.source.id : '';
    layer.lengthBeats = content ? content.lengthBeats : 0;
    layer.positionBeats = 0;
    if (content) {
      // La cabeza que suena: la del disco si se mantiene, si no la de la línea de tiempo.
      const voice = this.#current >= 0 ? this.voices[this.#current] : undefined;
      const beat = voice?.disc ? voice.headBeat : clock.beat;
      const rel = (beat - content.offsetBeats) % content.lengthBeats;
      layer.positionBeats = rel < 0 ? rel + content.lengthBeats : rel;
    }
    layer.level = this.level;
    layer.muted = this.muted;
    layer.pan = this.pan;
    layer.reversed = this.reversed;
    layer.filter = this.amountTarget;
    // RMS desde el último estado, después del nivel y el silencio.
    const frames = this.#meterFrames;
    layer.rms =
      frames === 0
        ? 0
        : Math.sqrt(this.#meterSum / frames) *
          Math.sqrt(this.#gainL * this.#gainL + this.#gainR * this.#gainR);
    this.#meterSum = 0;
    this.#meterFrames = 0;
    layer.pending = this.pendingActive;
    layer.undo = this.history.undoCount;
    layer.redo = this.history.redoCount;
    layer.discHeld = this.discHeld;
  }

  // --- Lo que suena -----------------------------------------------------------------------------

  /** Pasa a sonar `content` (o silencio) con un fundido cruzado `fade`. */
  show(
    content: LayerContent | null,
    beat: number,
    beatsPerFrame: number,
    fade = this.changeFade,
  ): void {
    // Con el disco mantenido, la voz nueva empieza donde está la cabeza del disco.
    const start = this.discHeld ? this.#discHead() : beat;
    for (let i = 0; i < VOICES_PER_LAYER; i++) {
      const voice = this.voices[i]!;
      if (voice.active) voice.fadeOut(fade);
    }
    this.#current = -1;
    if (!content) return;
    const index = this.#acquire();
    this.voices[index]!.begin(content, this.reversed, this.discHeld, start, beatsPerFrame, fade);
    this.#current = index;
  }

  /** Pulso de la cabeza del disco: el de la voz que lo sigue o, si aún no hay, el del agarre. */
  #discHead(): number {
    const voice = this.#current >= 0 ? this.voices[this.#current]! : undefined;
    return voice?.disc ? voice.headBeat : this.#discTarget;
  }

  /** Recalcula la posición exacta de las voces de la línea de tiempo. */
  syncTimeline(clock: Clock): void {
    for (let i = 0; i < VOICES_PER_LAYER; i++) {
      const voice = this.voices[i]!;
      if (voice.active && !voice.disc) voice.sync(clock);
    }
  }

  setReversed(reversed: boolean, beat: number, beatsPerFrame: number): void {
    if (reversed === this.reversed) return;
    this.reversed = reversed;
    this.show(this.content, beat, beatsPerFrame);
  }

  /** Mantener el disco: la capa se separa de la línea de tiempo y se congela donde estaba. */
  holdDisc(beat: number, beatsPerFrame: number): void {
    if (this.discHeld) return;
    this.discHeld = true;
    this.#discHoldBeat = beat;
    this.#discTarget = beat;
    this.show(this.content, beat, beatsPerFrame);
  }

  /** Arrastrar: `turns` vueltas desde que se mantuvo (1 vuelta = 1 compás, negativo = atrás). */
  moveDisc(turns: number): void {
    if (this.discHeld) this.#discTarget = this.#discHoldBeat + turns * DISC_BEATS_PER_TURN;
  }

  /** Soltar: vuelve a su sitio en la línea de tiempo con un fundido de ~15 ms. */
  releaseDisc(beat: number, beatsPerFrame: number): void {
    if (!this.discHeld) return;
    this.discHeld = false;
    this.show(this.content, beat, beatsPerFrame, this.releaseFade);
  }

  /** ¿Suena alguna voz que sigue al disco (agarrado o apagándose al soltarlo)? */
  hasDiscVoice(): boolean {
    for (let i = 0; i < VOICES_PER_LAYER; i++) {
      const voice = this.voices[i]!;
      if (voice.active && voice.disc) return true;
    }
    return false;
  }

  /** Corta todo en seco (cargar una sesión con la salida ya apagada). */
  silence(): void {
    for (let i = 0; i < VOICES_PER_LAYER; i++) this.voices[i]!.release();
    this.#current = -1;
    this.discHeld = false;
  }

  // --- Mezcla -------------------------------------------------------------------------------------

  setMix(level: number, muted: boolean, pan: number): void {
    this.level = level;
    this.muted = muted;
    this.pan = pan;
    const gain = muted ? 0 : level;
    const angle = ((pan + 1) * Math.PI) / 4;
    // En los extremos, silencio exacto en el otro canal (cos(π/2) no da 0 en coma flotante).
    this.#targetL = pan >= 1 ? 0 : gain * Math.cos(angle);
    this.#targetR = pan <= -1 ? 0 : gain * Math.sin(angle);
  }

  /** Salta a los objetivos de la mezcla sin suavizar (al cargar una sesión). */
  settleMix(): void {
    this.#gainL = this.#targetL;
    this.#gainR = this.#targetR;
  }

  setFilter(amount: number): void {
    this.amountTarget = amount;
    if (amount > 0 && this.#filterState === 'bypass') {
      this.#filterState = 'on';
      this.#amount = 0;
      this.#coefficientCountdown = 0;
      this.#settlePending = true;
      this.#wet.set(0);
      this.#wet.start(1);
    } else if (amount > 0 && this.#wet.target === 0) {
      this.#wet.start(1);
    }
  }

  /** Salta al estado final del filtro sin fundidos (al cargar una sesión con la salida parada). */
  settleFilter(): void {
    this.#coefficientCountdown = 0;
    if (this.amountTarget > 0) {
      this.#filterState = 'on';
      this.#amount = this.amountTarget;
      this.#settlePending = true;
      this.#wet.set(1);
    } else {
      this.#filterState = 'bypass';
      this.#amount = 0;
      this.#wet.set(0);
      this.#svf.reset();
    }
  }

  // --- Render -------------------------------------------------------------------------------------

  /**
   * Suma la capa a `busL`/`busR` en las `frames` primeras muestras. `advancing`: el transporte
   * avanza en este tramo; `transport`: su ganancia (o `null` si vale 1).
   */
  renderAdd(
    busL: Float32Array,
    busR: Float32Array,
    frames: number,
    advancing: boolean,
    transport: Float32Array | null,
  ): void {
    const buffer = this.#buffer;
    let sounding = false;
    buffer.fill(0, 0, frames);
    for (let i = 0; i < VOICES_PER_LAYER; i++) {
      const voice = this.voices[i]!;
      if (!voice.active) continue;
      if (voice.disc) {
        voice.discTarget = this.#discTarget;
        voice.renderDiscAdd(buffer, frames, this.#gains);
        sounding = true;
      } else if (advancing) {
        voice.renderTimelineAdd(buffer, frames, this.#gains, transport);
        sounding = true;
      } else {
        voice.skip(frames);
      }
      if (!voice.active && this.#current === i) this.#current = -1;
    }
    if (this.#filterState !== 'bypass') {
      this.#renderFilter(buffer, frames);
      sounding = true;
    }
    if (!sounding) {
      this.#gainL = this.#targetL;
      this.#gainR = this.#targetR;
      return;
    }
    this.#renderMix(buffer, busL, busR, frames);
  }

  #renderMix(buffer: Float32Array, busL: Float32Array, busR: Float32Array, frames: number): void {
    const targetL = this.#targetL;
    const targetR = this.#targetR;
    let gainL = this.#gainL;
    let gainR = this.#gainR;
    let sum = 0;
    if (gainL === targetL && gainR === targetR) {
      for (let i = 0; i < frames; i++) {
        const y = buffer[i]!;
        busL[i] = busL[i]! + y * gainL;
        busR[i] = busR[i]! + y * gainR;
        sum += y * y;
      }
    } else {
      // El encaje en el objetivo se decide muestra a muestra: así no depende del tamaño de bloque.
      const a = this.#smoothing;
      for (let i = 0; i < frames; i++) {
        gainL += (targetL - gainL) * a;
        gainR += (targetR - gainR) * a;
        if (Math.abs(targetL - gainL) < SNAP && Math.abs(targetR - gainR) < SNAP) {
          gainL = targetL;
          gainR = targetR;
        }
        const y = buffer[i]!;
        busL[i] = busL[i]! + y * gainL;
        busR[i] = busR[i]! + y * gainR;
        sum += y * y;
      }
    }
    this.#gainL = gainL;
    this.#gainR = gainR;
    this.#meterSum += sum;
    this.#meterFrames += frames;
  }

  /** Filtro con el corte recalculado cada `FILTER_BLOCK` muestras y fundido con la señal seca. */
  #renderFilter(buffer: Float32Array, frames: number): void {
    if (this.#settlePending) {
      this.#svf.settle(buffer[0]!);
      this.#settlePending = false;
    }
    const wetMixing = this.#wet.ramping || this.#wet.value < 1;
    if (wetMixing) {
      const dry = this.#dry;
      for (let j = 0; j < frames; j++) dry[j] = buffer[j]!;
      this.#wet.renderInto(this.#wetGains, frames);
    }
    let i = 0;
    while (i < frames) {
      if (this.#coefficientCountdown === 0) {
        this.#amount += (this.amountTarget - this.#amount) * this.#amountStep;
        if (Math.abs(this.amountTarget - this.#amount) < SNAP) this.#amount = this.amountTarget;
        this.#svf.setCutoff(cutoffForAmount(this.#amount, this.#sampleRate));
        this.#coefficientCountdown = FILTER_BLOCK;
        // Con el brazo de vuelta al extremo exterior, el filtro se retira (en un instante que no
        // depende del tamaño de bloque) y, al terminar el fundido, pasa a bypass.
        if (
          this.amountTarget === 0 &&
          this.#amount < FILTER_RELEASE_AMOUNT &&
          this.#wet.target === 1
        ) {
          this.#wet.start(0);
        }
      }
      const n = Math.min(frames - i, this.#coefficientCountdown);
      this.#svf.processInPlace(buffer, i, n);
      this.#coefficientCountdown -= n;
      i += n;
    }
    if (wetMixing) {
      const dry = this.#dry;
      const wet = this.#wetGains;
      for (let j = 0; j < frames; j++) {
        const d = dry[j]!;
        buffer[j] = d + wet[j]! * (buffer[j]! - d);
      }
    }
    this.#svf.sanitize();
    if (this.amountTarget === 0 && this.#wet.target === 0 && !this.#wet.ramping) {
      this.#filterState = 'bypass';
      this.#amount = 0;
      this.#svf.reset();
    }
  }

  #acquire(): number {
    let quietest = 0;
    let quietestLevel = Infinity;
    for (let i = 0; i < VOICES_PER_LAYER; i++) {
      const voice = this.voices[i]!;
      if (!voice.active) return i;
      if (voice.level < quietestLevel) {
        quietestLevel = voice.level;
        quietest = i;
      }
    }
    this.voices[quietest]!.release();
    return quietest;
  }
}
