/**
 * LoopCore (PLAN §4.4): el instrumento entero a nivel de muestras. Es la fuente de verdad del audio
 * y se ejecuta igual en el worklet, en la exportación (`renderOffline`) y en los tests de Node.
 *
 * - `handle(comando)` cambia el estado entre bloques. Puede reservar memoria (los búferes de una
 *   toma), pero nunca hace trabajo pesado.
 * - `process(...)` genera la salida por tramos de ≤ 128 muestras partidos en los instantes exactos
 *   (límite de compás de la cola, inicio y final de una toma, fin de un fundido, anclas de las
 *   voces), así que el resultado no depende del tamaño del bloque. No reserva memoria.
 * - `status` se actualiza como mucho 30 veces por segundo, contado en muestras.
 */
import {
  BEATS_PER_BAR,
  COUNT_IN_BEATS,
  DEFAULT_BPM,
  JUNCTION_FADE_SECONDS,
  LAYER_COUNT,
  MAX_BPM,
  MAX_DISC_TURNS,
  MAX_INPUT_GAIN,
  MAX_LATENCY_SECONDS,
  MAX_LAYER_SECONDS,
  MAX_TAKE_SECONDS,
  MIN_BPM,
  MIN_FREE_TAKE_SECONDS,
  NOTICE_CAPACITY,
  SMOOTHING_SECONDS,
  STATUS_RATE_HZ,
  TAKE_BARS,
  TRANSPORT_FADE_SECONDS,
} from './constants';
import { CalibrationRun } from './calibration';
import { LayerChannel } from './channel';
import { RECORDING_SOURCE, type LayerContent, type MutableLayerContent } from './content';
import { fadeTable, framesOf, INSTANT_FADE, onePoleCoefficient, Ramp, wrap } from './dsp';
import { Limiter } from './limiter';
import { MEMORY_BUDGET_BYTES, MemoryCounter } from './memory';
import { Metronome } from './metronome';
import {
  PROTOCOL_VERSION,
  type CalibrationEvent,
  type CoreCommand,
  type CoreCommandType,
  type CoreStatus,
  type LayerStatus,
  type LibrarySound,
  type CancelReason,
  type Notice,
  type NoticeCode,
  type NoticeReason,
  type RejectReason,
  type TransportState,
} from './protocol';
import { Recorder, type TakeKind } from './recorder';
import { EMPTY_LAYER, validateSessionState, type LayerState, type SessionState } from './session';
import { barAtOrAfter, nextBarAfter, Transport, type Clock } from './transport';

/** Tramo máximo de proceso (el bloque del AudioWorklet). */
export const MAX_SEGMENT = 128;
/** Cada 128 muestras del transporte, las voces recalculan su posición exacta: deriva 0. */
export const ANCHOR_FRAMES = 128;

/** Una sesión validada con sus contenidos ya creados: aplicarla no reserva memoria. */
interface PreparedSession {
  readonly bpm: number;
  readonly layers: readonly LayerState[];
  readonly contents: readonly (LayerContent | null)[];
}

export interface LoopCoreOptions {
  readonly sampleRate: number;
  /** En directo suena el metrónomo; en la exportación, no. */
  readonly live?: boolean;
  /** Presupuesto de memoria (por defecto, el de §5). */
  readonly memoryBudgetBytes?: number;
}

/** Compases enteros que mejor encajan una toma de `frames` muestras (0 si ninguno cabe en 40–240). */
export function fitBars(frames: number, bpm: number, sampleRate: number): number {
  // Tempo con el que `bars` compases duran exactamente `frames` muestras: bars × perBar.
  const perBar = (BEATS_PER_BAR * 60 * sampleRate) / frames;
  let bars = Math.max(1, Math.round((frames * bpm) / (60 * sampleRate) / BEATS_PER_BAR));
  while (bars * perBar < MIN_BPM) bars++;
  while (bars > 1 && bars * perBar > MAX_BPM) bars--;
  const fitted = bars * perBar;
  return fitted >= MIN_BPM && fitted <= MAX_BPM ? bars : 0;
}

export class LoopCore {
  readonly sampleRate: number;
  readonly live: boolean;
  /** Latencia que añade el núcleo a la salida (la anticipación del limitador), en muestras. */
  readonly outputLatency: number;
  readonly status: CoreStatus;
  /** `process` ha dejado un estado nuevo en `status` (≤ 30/s); lo baja quien lo envía. */
  statusReady = false;
  /** Grabación de una calibración terminada, para enviarla; quien la envía la pone a `null`. */
  calibrationResult: CalibrationEvent | null = null;

  readonly #transport: Transport;
  readonly #channels: LayerChannel[] = [];
  readonly #recorder: Recorder;
  readonly #limiter: Limiter;
  readonly #metronome: Metronome;
  readonly #memory = new MemoryCounter(LAYER_COUNT * 8);
  readonly #memoryBudget: number;
  readonly #fixedBytes: number;
  #memoryBytes = 0;
  #memoryDirty = true;

  #transportStateValue: TransportState = 'stopped';
  readonly #transportGain: Ramp;
  #stopAfterFade = false;
  /** Cambia cada vez que el transporte vuelve al principio (las tomas lo comprueban). */
  #generation = 0;
  #takeGeneration = 0;
  #pendingLoad: PreparedSession | null = null;
  #calibration: CalibrationRun | null = null;

  #metronomeEnabled = false;
  #nextClickBeat = Number.NaN;
  #timerRunning = false;
  #timerTotal = 0;
  #timerClick = 0;

  #latency = 0;
  #volumeTarget = 1;
  #volume = 1;
  #inputGainTarget = 1;
  #inputGain = 1;
  readonly #smoothing: number;

  #plannedFrames = 0;
  #discLayer = -1;
  #anchorDirty = true;
  /** Pulso y velocidad del transporte al principio del tramo: las voces los leen de aquí. */
  readonly #clock: Clock = { beat: 0, beatsPerFrame: 0 };
  /**
   * Los instantes programados (cola, inicio de la toma, clics) se guardan en muestras enteras del
   * transporte; si el tempo o la línea de tiempo cambian, se recalculan.
   */
  #scheduleDirty = false;
  #takeStartFrame = 0;
  #nextClickFrame = 0;

  readonly #statusInterval: number;
  #statusCountdown: number;
  readonly #queued: Notice[] = [];
  #queuedCount = 0;
  #dropped = 0;

  readonly #busL = new Float32Array(MAX_SEGMENT);
  readonly #busR = new Float32Array(MAX_SEGMENT);
  readonly #transportBuffer = new Float32Array(MAX_SEGMENT);
  readonly #inputGains = new Float32Array(MAX_SEGMENT);
  readonly #clicks = new Float32Array(MAX_SEGMENT);
  readonly #minFreeFrames: number;
  readonly #maxTakeFrames: number;
  readonly #maxLayerFrames: number;

  constructor(options: LoopCoreOptions) {
    const rate = options.sampleRate;
    if (!(rate >= 8000 && rate <= 384_000)) throw new RangeError(`Frecuencia no válida: ${rate}`);
    this.sampleRate = rate;
    this.live = options.live ?? true;
    this.#memoryBudget = options.memoryBudgetBytes ?? MEMORY_BUDGET_BYTES;
    this.#transport = new Transport(rate, DEFAULT_BPM);
    for (let i = 0; i < LAYER_COUNT; i++) this.#channels.push(new LayerChannel(rate, MAX_SEGMENT));
    this.#recorder = new Recorder(rate, fadeTable(framesOf(JUNCTION_FADE_SECONDS, rate)));
    this.#limiter = new Limiter(rate);
    this.#metronome = new Metronome(rate);
    this.outputLatency = this.#limiter.lookahead;
    this.#transportGain = new Ramp(0, fadeTable(framesOf(TRANSPORT_FADE_SECONDS, rate)));
    this.#smoothing = onePoleCoefficient(SMOOTHING_SECONDS, rate);
    this.#statusInterval = Math.ceil(rate / STATUS_RATE_HZ);
    this.#statusCountdown = this.#statusInterval;
    this.#minFreeFrames = Math.round(MIN_FREE_TAKE_SECONDS * rate);
    this.#maxTakeFrames = Math.round(MAX_TAKE_SECONDS * rate);
    this.#maxLayerFrames = Math.round(MAX_LAYER_SECONDS * rate);
    // Memoria fija: espacio de trabajo, fundidos, limitador y clics (orden de magnitud).
    this.#fixedBytes =
      LAYER_COUNT * 4 * MAX_SEGMENT * 4 + 4 * MAX_SEGMENT * 4 + Math.ceil(rate * 0.2) * 4;
    for (let i = 0; i < NOTICE_CAPACITY; i++) this.#queued.push(emptyNotice());
    this.status = createStatus();
    this.#updateStatus();
  }

  // --- API ------------------------------------------------------------------------------------

  get bpm(): number {
    return this.#transport.bpm;
  }

  get beat(): number {
    return this.#transport.beat;
  }

  get transportFrame(): number {
    return this.#transport.frame;
  }

  get transportState(): TransportState {
    return this.#transportStateValue;
  }

  /** Contenido actual de una capa (para tests y para guardar). */
  layerContent(layer: number): LayerContent | null {
    return this.#channels[layer]?.content ?? null;
  }

  /**
   * Genera `frames` muestras estéreo en `outL`/`outR` desde `offset`. `input` es el micrófono (mono,
   * las mismas muestras desde `offset`) o `null`.
   */
  process(
    input: Float32Array | null,
    outL: Float32Array,
    outR: Float32Array,
    frames = outL.length,
    offset = 0,
  ): void {
    let done = 0;
    while (done < frames) {
      this.#processEvents();
      const n = this.#segmentLength(frames - done);
      this.#renderSegment(input, outL, outR, offset + done, n);
      done += n;
    }
  }

  /** Arranca sin fundido de entrada: la exportación empieza en el pulso 0 a volumen pleno. */
  playImmediately(): void {
    this.#transportStateValue = 'playing';
    this.#transportGain.set(1);
    this.#stopAfterFade = false;
    this.#anchorDirty = true;
  }

  /** Actualiza `status` ya, sin esperar al siguiente intervalo. */
  flushStatus(): CoreStatus {
    this.#updateStatus();
    return this.status;
  }

  /** Bytes de audio en uso (búferes vivos + memoria fija). */
  get memoryInUse(): number {
    this.#updateMemory();
    return this.#memoryBytes;
  }

  /** Copia del estado de la sesión para guardar, autoguardar o exportar (reserva memoria). */
  exportState(): SessionState {
    const layers: LayerState[] = this.#channels.map((channel) => {
      const content = channel.content;
      return {
        pcm: content ? content.data.slice(0, content.frames) : null,
        lengthBeats: content ? content.lengthBeats : 0,
        offsetBeats: content ? content.offsetBeats : 0,
        source: content ? content.source : null,
        level: channel.level,
        muted: channel.muted,
        pan: channel.pan,
        reversed: channel.reversed,
        filter: channel.amountTarget,
      };
    });
    return { sampleRate: this.sampleRate, bpm: this.#transport.bpm, layers };
  }

  // --- Comandos -----------------------------------------------------------------------------

  /**
   * Aplica un comando entre dos bloques. Lo que llega por el puerto no es de fiar: cada campo se
   * comprueba, y un comando no válido se ignora con un aviso `rejected`.
   */
  handle(command: CoreCommand): void {
    const transport = this.#transport;
    switch (command.type) {
      case 'play':
        if (this.#calibration) return this.#reject(command.type, 'busy');
        this.#startTransport();
        return;
      case 'pause':
        this.#pause(false);
        return;
      case 'stop':
        this.#pause(true);
        return;
      case 'set-tempo':
        if (this.#locked(command.type)) return;
        if (!isNumberIn(command.bpm, MIN_BPM, MAX_BPM)) return this.#reject(command.type, 'range');
        transport.setTempo(command.bpm);
        this.#timelineMoved();
        return;
      case 'set-level': {
        const channel = this.#channelAt(command.layer);
        if (!channel || !isNumberIn(command.level, 0, 1))
          return this.#reject(command.type, 'range');
        channel.setMix(command.level, channel.muted, channel.pan);
        return;
      }
      case 'set-mute': {
        const channel = this.#channelAt(command.layer);
        if (!channel || typeof command.muted !== 'boolean')
          return this.#reject(command.type, 'range');
        channel.setMix(channel.level, command.muted, channel.pan);
        return;
      }
      case 'set-pan': {
        const channel = this.#channelAt(command.layer);
        if (!channel || !isNumberIn(command.pan, -1, 1)) return this.#reject(command.type, 'range');
        channel.setMix(channel.level, channel.muted, command.pan);
        return;
      }
      case 'set-reverse': {
        if (this.#locked(command.type)) return;
        const channel = this.#channelAt(command.layer);
        if (!channel || typeof command.reversed !== 'boolean') {
          return this.#reject(command.type, 'range');
        }
        channel.setReversed(command.reversed, transport.beat, transport.beatsPerFrame);
        return;
      }
      case 'set-filter': {
        const channel = this.#channelAt(command.layer);
        if (!channel || !isNumberIn(command.amount, 0, 1))
          return this.#reject(command.type, 'range');
        channel.setFilter(command.amount);
        return;
      }
      case 'set-sound':
        if (this.#locked(command.type)) return;
        this.#setSound(command.layer, command.sound);
        return;
      case 'clear-layer': {
        if (this.#locked(command.type)) return;
        const channel = this.#channelAt(command.layer);
        if (!channel) return this.#reject(command.type, 'range');
        channel.pendingActive = false;
        channel.pendingContent = null;
        this.#applyContent(command.layer, null);
        return;
      }
      case 'undo':
      case 'redo':
        if (this.#locked(command.type)) return;
        this.#moveHistory(command.layer, command.type === 'undo');
        return;
      case 'disc-hold': {
        if (this.#locked(command.type)) return;
        const channel = this.#channelAt(command.layer);
        if (!channel) return this.#reject(command.type, 'range');
        if (this.#discLayer >= 0 && this.#discLayer !== command.layer) this.#releaseDisc();
        this.#discLayer = command.layer;
        channel.holdDisc(transport.beat, transport.beatsPerFrame);
        return;
      }
      case 'disc-move':
        if (this.#discLayer < 0) return;
        if (!isNumberIn(command.turns, -MAX_DISC_TURNS, MAX_DISC_TURNS)) {
          return this.#reject(command.type, 'range');
        }
        this.#channels[this.#discLayer]!.moveDisc(command.turns);
        return;
      case 'disc-release':
        this.#releaseDisc();
        return;
      case 'record':
        if (this.#calibration) return this.#reject(command.type, 'busy');
        this.#record(command.layer, command.bars, command.countIn, command.fitTempo);
        return;
      case 'cancel-recording':
        this.#cancelTake('cancelled');
        this.#cancelCalibration('cancelled');
        return;
      case 'set-volume':
        if (!isNumberIn(command.volume, 0, 1)) return this.#reject(command.type, 'range');
        this.#volumeTarget = command.volume;
        return;
      case 'set-input-gain':
        if (!isNumberIn(command.gain, 0, MAX_INPUT_GAIN))
          return this.#reject(command.type, 'range');
        this.#inputGainTarget = command.gain;
        return;
      case 'set-metronome':
        if (typeof command.enabled !== 'boolean') return this.#reject(command.type, 'range');
        this.#metronomeEnabled = command.enabled;
        return;
      case 'set-latency':
        if (
          !Number.isInteger(command.frames) ||
          !isNumberIn(command.frames, 0, MAX_LATENCY_SECONDS * this.sampleRate)
        ) {
          return this.#reject(command.type, 'range');
        }
        this.#latency = command.frames;
        return;
      case 'load-session':
        if (this.#locked(command.type)) return;
        if (this.#calibration) return this.#reject(command.type, 'busy');
        this.#load(command.session);
        return;
      case 'reset':
        if (this.#locked(command.type)) return;
        if (this.#calibration) return this.#reject(command.type, 'busy');
        this.#load(this.#emptySession());
        return;
      case 'standby':
        // Reposo: nada sigue sonando, tampoco una capa agarrada con el disco.
        this.#cancelTake('standby');
        this.#cancelCalibration('standby');
        this.#releaseDisc();
        this.#pause(false);
        return;
      case 'calibrate':
        // Con el transporte parado y sin toma: si no, los clics se mezclarían con la música.
        if (this.#recorder.active || this.#calibration || this.#transportStateValue !== 'stopped') {
          return this.#reject(command.type, 'busy');
        }
        this.#calibration = new CalibrationRun(this.sampleRate);
        this.calibrationResult = null;
        this.#memoryDirty = true;
        return;
      default:
        this.#reject('none', 'unknown');
    }
  }

  #channelAt(layer: number): LayerChannel | undefined {
    return Number.isInteger(layer) && layer >= 0 && layer < LAYER_COUNT
      ? this.#channels[layer]
      : undefined;
  }

  /** Durante una toma (también en la cuenta previa) se bloquean los cambios que la romperían. */
  #locked(type: CoreCommandType): boolean {
    if (!this.#recorder.active) return false;
    this.#notify('locked', this.#recorder.layer, 0, type, 'none');
    return true;
  }

  #reject(command: CoreCommandType | 'none', reason: RejectReason): void {
    this.#notify('rejected', -1, 0, command, reason);
  }

  #setSound(layer: number, sound: LibrarySound | null): void {
    const channel = this.#channelAt(layer);
    if (!channel) return this.#reject('set-sound', 'range');
    let content: LayerContent | null = null;
    if (sound !== null) {
      if (!this.#isValidSound(sound)) return this.#reject('set-sound', 'invalid');
      if (!this.#ensureMemory(sound.pcm.byteLength)) return this.#reject('set-sound', 'no-memory');
      content = {
        data: sound.pcm,
        frames: sound.pcm.length,
        lengthBeats: sound.lengthBeats,
        offsetBeats: 0,
        source: { kind: 'library', id: sound.id },
      };
    }
    if (this.#transportStateValue === 'playing') {
      // En marcha: espera al siguiente límite de compás (exacto a la muestra).
      channel.pendingActive = true;
      channel.pendingContent = content;
      channel.pendingBeat = nextBarAfter(this.#transport.beat);
      channel.pendingFrame = this.#transport.frameAtBeat(channel.pendingBeat);
      this.#memoryDirty = true;
      return;
    }
    channel.pendingActive = false;
    channel.pendingContent = null;
    this.#applyContent(layer, content);
    this.#notify('sound-applied', layer, this.#transport.frame, 'none', 'none');
  }

  #isValidSound(sound: LibrarySound): boolean {
    if (typeof sound !== 'object' || sound === null) return false;
    const { pcm, lengthBeats, id } = sound;
    if (!(pcm instanceof Float32Array) || typeof id !== 'string' || id.length > 64) return false;
    if (pcm.length < 1 || pcm.length > this.#maxLayerFrames) return false;
    if (!isNumberIn(lengthBeats, 1e-3, 10_000)) return false;
    const nativeBpm = (60 * this.sampleRate * lengthBeats) / pcm.length;
    return nativeBpm >= MIN_BPM * 0.99 && nativeBpm <= MAX_BPM * 1.01;
  }

  /** Deshacer o rehacer. Deshacer con un cambio en cola solo cancela la cola. */
  #moveHistory(layer: number, undo: boolean): void {
    const channel = this.#channelAt(layer);
    if (!channel) return this.#reject(undo ? 'undo' : 'redo', 'range');
    if (undo && channel.pendingActive) {
      channel.pendingActive = false;
      channel.pendingContent = null;
      this.#memoryDirty = true;
      return;
    }
    const moved = undo ? channel.history.undo() : channel.history.redo();
    if (!moved) return this.#reject(undo ? 'undo' : 'redo', 'empty');
    channel.show(channel.content, this.#transport.beat, this.#transport.beatsPerFrame);
  }

  #releaseDisc(): void {
    if (this.#discLayer < 0) return;
    const channel = this.#channels[this.#discLayer]!;
    channel.releaseDisc(this.#transport.beat, this.#transport.beatsPerFrame);
    this.#discLayer = -1;
  }

  // --- Transporte -----------------------------------------------------------------------------

  #startTransport(): void {
    if (this.#transportStateValue === 'playing') return;
    this.#transportStateValue = 'playing';
    this.#transportGain.start(1);
    this.#stopAfterFade = false;
    this.#anchorDirty = true;
  }

  /** Pausar (o parar y volver al pulso 0): cierra la toma o cancela la cuenta previa. */
  #pause(stop: boolean): void {
    const recorder = this.#recorder;
    if (recorder.state === 'count-in') this.#cancelTake('cancelled');
    else if (recorder.state === 'recording') recorder.close(this.#transport.frame);
    if (this.#transportStateValue === 'stopped') {
      if (stop) this.#rewind();
      return;
    }
    if (stop) this.#stopAfterFade = true;
    if (this.#transportStateValue === 'playing') {
      this.#transportStateValue = 'pausing';
      this.#transportGain.start(0);
    }
  }

  /** La salida ya se ha apagado: se aplica la cola y, si era parar, se vuelve al principio. */
  #finishPause(): void {
    this.#transportStateValue = 'stopped';
    for (let i = 0; i < LAYER_COUNT; i++) {
      if (this.#channels[i]!.pendingActive) this.#applyPending(i);
    }
    if (this.#stopAfterFade) {
      this.#stopAfterFade = false;
      this.#rewind();
    }
    this.#notify('stopped', -1, 0, 'none', 'none');
  }

  #rewind(): void {
    this.#transport.rewind();
    this.#generation++;
    this.#timelineMoved();
  }

  /** La línea de tiempo ha cambiado de golpe: las voces y el metrónomo se recolocan. */
  #timelineMoved(): void {
    this.#anchorDirty = true;
    this.#nextClickBeat = Number.NaN;
    this.#scheduleDirty = true;
  }

  /** Recalcula en muestras los instantes programados (tras un cambio de tempo o de línea de tiempo). */
  #reschedule(): void {
    const transport = this.#transport;
    for (let i = 0; i < LAYER_COUNT; i++) {
      const channel = this.#channels[i]!;
      if (channel.pendingActive) channel.pendingFrame = transport.frameAtBeat(channel.pendingBeat);
    }
    const recorder = this.#recorder;
    if (recorder.state === 'count-in' && recorder.startBeat === recorder.startBeat) {
      this.#takeStartFrame = transport.frameAtBeat(recorder.startBeat);
    }
    this.#scheduleDirty = false;
  }

  // --- Cola y contenido -----------------------------------------------------------------------

  #applyPending(layer: number): void {
    const channel = this.#channels[layer]!;
    const content = channel.pendingContent;
    channel.pendingActive = false;
    channel.pendingContent = null;
    this.#applyContent(layer, content);
    this.#notify('sound-applied', layer, this.#transport.frame, 'none', 'none');
  }

  /** Una edición: el contenido nuevo entra en el historial y suena con un fundido cruzado. */
  #applyContent(layer: number, content: LayerContent | null): void {
    const channel = this.#channels[layer]!;
    this.#memoryDirty = true;
    if (content === channel.content) return;
    channel.history.push(content);
    channel.show(content, this.#transport.beat, this.#transport.beatsPerFrame);
  }

  /** Duración del bucle de la sesión: la de la capa más larga (también si está en cola). */
  #loopBeats(): number {
    let beats = 0;
    for (let i = 0; i < LAYER_COUNT; i++) {
      const channel = this.#channels[i]!;
      const content = channel.content;
      if (content && content.lengthBeats > beats) beats = content.lengthBeats;
      const pending = channel.pendingActive ? channel.pendingContent : null;
      if (pending && pending.lengthBeats > beats) beats = pending.lengthBeats;
    }
    return beats;
  }

  // --- Tomas ----------------------------------------------------------------------------------

  /** Grabar: empieza una toma, la termina o cancela la cuenta previa. */
  #record(layer: number, bars: number, countIn: boolean, fitTempo: boolean): void {
    const recorder = this.#recorder;
    if (!this.#channelAt(layer)) return this.#reject('record', 'range');
    if (recorder.active) {
      if (layer !== recorder.layer) {
        this.#notify('locked', recorder.layer, 0, 'record', 'none');
        return;
      }
      if (recorder.state === 'count-in') this.#cancelTake('cancelled');
      else recorder.close(this.#transport.frame);
      return;
    }
    if (!(TAKE_BARS as readonly number[]).includes(bars)) return this.#reject('record', 'range');
    if (this.#discLayer >= 0) return this.#reject('record', 'disc');
    const playing = this.#transportStateValue === 'playing';
    const withCountIn = countIn === true;
    // Con el transporte parado a mitad de compás, la cuenta previa empieza en el compás siguiente:
    // los clics de la cuenta siguen el ritmo de la toma y se graba desde ese compás.
    if (!playing && withCountIn) {
      const bar = barAtOrAfter(this.#transport.beat);
      if (bar !== this.#transport.beat) {
        this.#transport.locate(bar);
        this.#timelineMoved();
      }
    }
    const kind: TakeKind = bars > 0 ? 'fixed' : this.#loopBeats() > 0 ? 'follow' : 'first';
    // El tempo y el transporte ya no cambian hasta que empiece: el pulso de inicio se sabe ahora.
    const beat = this.#transport.beat;
    const startBeat = withCountIn
      ? playing
        ? barAtOrAfter(beat + COUNT_IN_BEATS)
        : beat
      : kind === 'fixed'
        ? barAtOrAfter(beat)
        : beat;
    if (!this.#planTake(layer, kind, bars, fitTempo === true, startBeat)) return;
    if (playing) {
      this.#scheduleTakeStart(withCountIn);
      return;
    }
    if (withCountIn) {
      // Con el transporte parado, la cuenta previa va antes de arrancarlo.
      const beatFrames = (60 * this.sampleRate) / this.#transport.bpm;
      recorder.timerBeatFrames = beatFrames;
      recorder.timerFrames = Math.round(COUNT_IN_BEATS * beatFrames);
      this.#timerTotal = recorder.timerFrames;
      this.#timerClick = 0;
      this.#timerRunning = true;
      return;
    }
    this.#startTransport();
    this.#scheduleTakeStart(false);
  }

  /**
   * Reserva el búfer de la toma (en el manejador del comando: aquí sí se puede reservar). Primera
   * toma libre: 60 s. Con duración: la de la toma o, si se sobregraba, una copia de lo que sonará
   * durante la toma, que es sobre lo que se graba.
   */
  #planTake(
    layer: number,
    kind: TakeKind,
    bars: number,
    fitTempo: boolean,
    startBeat: number,
  ): boolean {
    const channel = this.#channels[layer]!;
    // Un sonido en cola en esta capa: si entra (en su compás) antes de que empiece la toma, se graba
    // sobre él; si la toma empieza antes (una toma libre que empieza ya), entra ahora.
    if (channel.pendingActive && channel.pendingBeat > startBeat) this.#applyPending(layer);
    const content = channel.pendingActive ? channel.pendingContent : channel.content;
    const sessionBeats = this.#loopBeats();
    let target: MutableLayerContent;
    if (kind === 'first') {
      if (!this.#ensureMemory(this.#maxTakeFrames * 4)) return this.#rejectFalse('no-memory');
      this.#plannedFrames = -1;
      target = {
        data: new Float32Array(this.#maxTakeFrames),
        frames: 0,
        lengthBeats: 0,
        offsetBeats: 0,
        source: RECORDING_SOURCE,
      };
    } else {
      const takeBeats = kind === 'fixed' ? bars * BEATS_PER_BAR : sessionBeats;
      const frames = Math.round((takeBeats * 60 * this.sampleRate) / this.#transport.bpm);
      if (frames > this.#maxTakeFrames) return this.#rejectFalse('too-long');
      this.#plannedFrames = frames;
      if (!content) {
        if (!this.#ensureMemory(frames * 4)) return this.#rejectFalse('no-memory');
        target = {
          data: new Float32Array(frames),
          frames,
          lengthBeats: takeBeats,
          offsetBeats: 0,
          source: RECORDING_SOURCE,
        };
      } else if (takeBeats <= content.lengthBeats) {
        // La capa conserva su duración y su fase: la toma se suma a una copia.
        if (!this.#ensureMemory(content.frames * 4)) return this.#rejectFalse('no-memory');
        const data = new Float32Array(content.frames);
        data.set(content.data.subarray(0, content.frames));
        target = {
          data,
          frames: content.frames,
          lengthBeats: content.lengthBeats,
          offsetBeats: content.offsetBeats,
          source: RECORDING_SOURCE,
        };
      } else {
        // La toma es más larga que la capa: la capa crece hasta la duración de la toma y su vuelta
        // empieza donde empieza la toma. La copia es lo que sonará durante la toma, leído desde la
        // cabeza de la capa en ese pulso: «lo que oíste más lo que tocaste».
        const framesPerBeat = content.frames / content.lengthBeats;
        const total = Math.round(takeBeats * framesPerBeat);
        if (total > this.#maxLayerFrames) return this.#rejectFalse('too-long');
        if (!this.#ensureMemory(total * 4)) return this.#rejectFalse('no-memory');
        const head =
          Math.round(wrap(startBeat - content.offsetBeats, content.lengthBeats) * framesPerBeat) %
          content.frames;
        // En reverso, la cabeza de la capa nueva baja desde su final: una copia hacia delante que
        // empiece en −cabeza − total (módulo la capa) suena al revés igual que la capa original.
        const from = channel.reversed ? wrap(-head - total, content.frames) : head;
        const data = new Float32Array(total);
        copyLooped(content.data, content.frames, from, data, total);
        target = {
          data,
          frames: total,
          lengthBeats: takeBeats,
          offsetBeats: wrap(startBeat, takeBeats),
          source: RECORDING_SOURCE,
        };
      }
    }
    // Una toma en una capa vacía suena tal como se ha tocado.
    if (!content) channel.reversed = false;
    this.#recorder.arm(layer, kind, target, content !== null, fitTempo, this.#maxTakeFrames);
    this.#memoryDirty = true;
    return true;
  }

  #rejectFalse(reason: RejectReason): false {
    this.#reject('record', reason);
    return false;
  }

  /** Pulso de inicio: tras la cuenta previa, en el siguiente compás (fija) o ya (libre). */
  #scheduleTakeStart(withCountIn: boolean): void {
    const recorder = this.#recorder;
    const beat = this.#transport.beat;
    if (withCountIn) recorder.startBeat = barAtOrAfter(beat + COUNT_IN_BEATS);
    else if (recorder.kind === 'fixed') recorder.startBeat = barAtOrAfter(beat);
    else recorder.startBeat = beat;
    this.#takeStartFrame = this.#transport.frameAtBeat(recorder.startBeat);
    if (beat >= recorder.startBeat) this.#beginTake();
  }

  /** Empieza a grabar en la muestra actual del transporte. */
  #beginTake(): void {
    const recorder = this.#recorder;
    const transport = this.#transport;
    const channel = this.#channels[recorder.layer]!;
    const target = recorder.target!;
    const beat = transport.beat;
    recorder.startBeat = beat;
    this.#takeGeneration = this.#generation;
    let takeFrames = -1;
    let writeStart = 0;
    let direction = 1;
    let speed = 1;
    if (recorder.kind !== 'first') {
      takeFrames = this.#plannedFrames;
      if (!recorder.overdub) {
        // La muestra 0 de la toma suena en el pulso en que empieza.
        target.offsetBeats = wrap(beat, target.lengthBeats);
      } else {
        // Se escribe donde suena la cabeza de lectura de la capa.
        const framesPerBeat = target.frames / target.lengthBeats;
        let p = wrap(beat - target.offsetBeats, target.lengthBeats) * framesPerBeat;
        if (p >= target.frames) p -= target.frames;
        speed = transport.beatsPerFrame * framesPerBeat;
        if (channel.reversed) {
          direction = -1;
          writeStart = target.frames - 1 - p;
          if (writeStart < 0) writeStart += target.frames;
        } else {
          writeStart = p;
        }
      }
    }
    recorder.begin(
      transport.frame,
      takeFrames,
      this.#latency + this.outputLatency,
      writeStart,
      direction,
      speed,
    );
    this.#notify('take-started', recorder.layer, transport.frame, 'none', 'none');
  }

  /** La toma está completa (también su final cruzado con la junta): entra en la capa. */
  #commitTake(): void {
    const recorder = this.#recorder;
    const transport = this.#transport;
    const layer = recorder.layer;
    const channel = this.#channels[layer]!;
    const target = recorder.target!;
    if (recorder.kind === 'first') {
      const frames = recorder.closedFrames;
      if (frames < this.#minFreeFrames) {
        this.#cancelTake('too-short');
        return;
      }
      target.frames = frames;
      let bpm = transport.bpm;
      let beats = frames * transport.beatsPerFrame;
      if (recorder.fitTempo) {
        const bars = fitBars(frames, bpm, this.sampleRate);
        if (bars > 0) {
          beats = bars * BEATS_PER_BAR;
          bpm = (beats * 60 * this.sampleRate) / frames;
          this.#notify('tempo-fitted', layer, bpm, 'none', 'none');
        }
      }
      target.lengthBeats = beats;
      target.offsetBeats = 0;
      // La primera toma empieza en el pulso 0. Sin otras capas, redefinir la línea de tiempo no
      // mueve nada que suene; si se paró entre medias, ya está en el pulso 0.
      if (this.#takeGeneration === this.#generation)
        transport.redefine(recorder.startFrame, 0, bpm);
      else transport.setTempo(bpm);
      this.#timelineMoved();
      for (let i = 0; i < LAYER_COUNT; i++) {
        const other = this.#channels[i]!;
        if (other.pendingActive) other.pendingBeat = nextBarAfter(transport.beat);
      }
    }
    channel.history.push(target);
    channel.show(target, transport.beat, transport.beatsPerFrame);
    this.#notify('take-committed', layer, target.frames, 'none', 'none');
    recorder.finish();
    this.#memoryDirty = true;
  }

  #cancelCalibration(reason: CancelReason): void {
    if (!this.#calibration) return;
    this.#calibration = null;
    this.#metronome.stop();
    this.#memoryDirty = true;
    this.#notify('calibration-cancelled', -1, 0, 'none', reason);
  }

  #cancelTake(reason: CancelReason): void {
    const recorder = this.#recorder;
    if (!recorder.active) return;
    const layer = recorder.layer;
    this.#timerRunning = false;
    recorder.finish();
    this.#memoryDirty = true;
    this.#notify('take-cancelled', layer, 0, 'none', reason);
  }

  // --- Sesión ---------------------------------------------------------------------------------

  #emptySession(): SessionState {
    const layers: LayerState[] = [];
    for (let i = 0; i < LAYER_COUNT; i++) layers.push(EMPTY_LAYER);
    return { sampleRate: this.sampleRate, bpm: DEFAULT_BPM, layers };
  }

  /** Cargar (o sesión nueva): con la salida en marcha, primero se apaga y después se carga. */
  #load(session: SessionState): void {
    const checked = validateSessionState(session, {
      sampleRate: this.sampleRate,
      checkSamples: false,
    });
    if (typeof checked === 'string') return this.#reject('load-session', checked);
    // Los contenidos se crean aquí (en el manejador del comando): si hay que esperar al fundido,
    // aplicar la sesión dentro de `process()` ya no reserva nada.
    const prepared: PreparedSession = {
      bpm: checked.bpm,
      layers: checked.layers,
      contents: checked.layers.map((state) =>
        state.pcm
          ? {
              data: state.pcm,
              frames: state.pcm.length,
              lengthBeats: state.lengthBeats,
              offsetBeats: state.offsetBeats,
              source: state.source ?? RECORDING_SOURCE,
            }
          : null,
      ),
    };
    // El deshacer no sobrevive a una carga: se suelta ya, y el pico de memoria es el estado actual
    // más la sesión nueva. El disco se suelta (con su fundido) antes de cargar.
    for (let i = 0; i < LAYER_COUNT; i++) {
      const channel = this.#channels[i]!;
      channel.history.reset(channel.content);
    }
    this.#releaseDisc();
    this.#memoryDirty = true;
    if (this.#transportStateValue === 'stopped' && !this.#discSounding()) {
      this.#applyLoad(prepared);
      return;
    }
    // Sonando: primero se apaga la salida (y el disco), y `#processEvents` aplica la carga.
    this.#pendingLoad = prepared;
    this.#pause(true);
  }

  /** ¿Suena alguna voz del disco? (No pasan por el fundido del transporte.) */
  #discSounding(): boolean {
    for (let i = 0; i < LAYER_COUNT; i++) if (this.#channels[i]!.hasDiscVoice()) return true;
    return false;
  }

  #applyLoad(session: PreparedSession): void {
    this.#releaseDisc();
    this.#rewind();
    this.#transport.setTempo(session.bpm);
    const perFrame = this.#transport.beatsPerFrame;
    for (let i = 0; i < LAYER_COUNT; i++) {
      const state = session.layers[i] ?? EMPTY_LAYER;
      const content = session.contents[i] ?? null;
      const channel = this.#channels[i]!;
      channel.silence();
      channel.pendingActive = false;
      channel.pendingContent = null;
      channel.history.reset(content);
      channel.reversed = state.reversed;
      channel.setMix(state.level, state.muted, state.pan);
      channel.settleMix();
      channel.setFilter(state.filter);
      channel.settleFilter();
      // Con la salida parada, las voces entran ya a volumen pleno (el transporte hará el fundido).
      channel.show(content, 0, perFrame, INSTANT_FADE);
    }
    this.#memoryDirty = true;
  }

  // --- Estado, avisos y memoria ---------------------------------------------------------------

  #notify(
    code: NoticeCode,
    layer: number,
    value: number,
    command: CoreCommandType | 'none',
    reason: NoticeReason,
  ): void {
    if (this.#queuedCount >= NOTICE_CAPACITY) {
      this.#dropped++;
      return;
    }
    const notice = this.#queued[this.#queuedCount++]!;
    notice.code = code;
    notice.layer = layer;
    notice.value = value;
    notice.command = command;
    notice.reason = reason;
  }

  #updateStatus(): void {
    const status = this.status;
    const transport = this.#transport;
    const recorder = this.#recorder;
    const clock = this.#clock;
    transport.writeClock(clock);
    status.frame = transport.frame;
    status.beat = clock.beat;
    status.bpm = transport.bpm;
    status.transport = this.#transportStateValue;
    status.recording = recorder.state;
    status.recordLayer = recorder.layer;
    status.recordSeconds = 0;
    status.recordProgress = 0;
    status.countInBeats = 0;
    if (recorder.state === 'recording') {
      const length = recorder.kind === 'first' ? recorder.closedFrames : recorder.takeFrames;
      const elapsed = Math.max(0, transport.frame - recorder.startFrame);
      const shown = length >= 0 && elapsed > length ? length : elapsed;
      status.recordSeconds = shown / this.sampleRate;
      status.recordProgress = length > 0 ? shown / length : -1;
    } else if (recorder.state === 'count-in') {
      status.countInBeats = this.#timerRunning
        ? recorder.timerFrames / recorder.timerBeatFrames
        : Math.max(0, recorder.startBeat - clock.beat);
    }
    for (let i = 0; i < LAYER_COUNT; i++) this.#channels[i]!.writeStatus(status.layers[i]!, clock);
    this.#updateMemory();
    status.memoryBytes = this.#memoryBytes;
    status.limiterGain = this.#limiter.minGain;
    this.#limiter.resetMinGain();
    for (let i = 0; i < this.#queuedCount; i++) {
      const from = this.#queued[i]!;
      const to = status.notices[i]!;
      to.code = from.code;
      to.layer = from.layer;
      to.value = from.value;
      to.command = from.command;
      to.reason = from.reason;
    }
    status.noticeCount = this.#queuedCount;
    status.noticesDropped = this.#dropped;
    this.#queuedCount = 0;
    this.#dropped = 0;
  }

  /** Recalcula los bytes en uso si algo ha cambiado (sin reservas). */
  #updateMemory(): void {
    if (!this.#memoryDirty) return;
    const memory = this.#memory;
    memory.reset();
    for (let i = 0; i < LAYER_COUNT; i++) {
      const channel = this.#channels[i]!;
      const history = channel.history;
      for (let j = 0; j < history.size; j++) memory.add(history.at(j)?.data);
      if (channel.pendingActive) memory.add(channel.pendingContent?.data);
    }
    memory.add(this.#recorder.target?.data);
    memory.add(this.#calibration?.event.pcm);
    const load = this.#pendingLoad;
    if (load) for (let i = 0; i < LAYER_COUNT; i++) memory.add(load.contents[i]?.data);
    this.#memoryBytes = memory.total + this.#fixedBytes;
    this.#memoryDirty = false;
  }

  /**
   * ¿Caben `extra` bytes más en el presupuesto? Si no, se olvida el deshacer más antiguo de la capa
   * con más estados guardados, hasta que quepan o no quede nada que soltar.
   */
  #ensureMemory(extra: number): boolean {
    this.#memoryDirty = true;
    this.#updateMemory();
    while (this.#memoryBytes + extra > this.#memoryBudget) {
      let best = -1;
      let most = 1;
      for (let i = 0; i < LAYER_COUNT; i++) {
        const size = this.#channels[i]!.history.size;
        if (size > most) {
          most = size;
          best = i;
        }
      }
      if (best < 0) return false;
      this.#channels[best]!.history.dropOldest();
      this.#memoryDirty = true;
      this.#updateMemory();
    }
    return true;
  }

  // --- Proceso --------------------------------------------------------------------------------

  /** Lo que ocurre justo en la muestra actual: cola, inicio y cierre de tomas, fin de fundidos. */
  #processEvents(): void {
    const transport = this.#transport;
    const recorder = this.#recorder;
    if (this.#scheduleDirty) this.#reschedule();
    if (this.#transportStateValue === 'pausing' && !this.#transportGain.ramping) {
      this.#finishPause();
    }
    // Una carga espera a que la salida esté apagada del todo, también la voz del disco.
    if (this.#pendingLoad && this.#transportStateValue === 'stopped' && !this.#discSounding()) {
      const load = this.#pendingLoad;
      this.#pendingLoad = null;
      this.#applyLoad(load);
    }
    if (recorder.state === 'count-in' && this.#timerRunning && recorder.timerFrames <= 0) {
      this.#timerRunning = false;
      this.#startTransport();
      this.#scheduleTakeStart(false);
    }
    if (this.#transportStateValue === 'playing') {
      const frame = transport.frame;
      for (let i = 0; i < LAYER_COUNT; i++) {
        const channel = this.#channels[i]!;
        if (channel.pendingActive && frame >= channel.pendingFrame) this.#applyPending(i);
      }
      if (
        recorder.state === 'count-in' &&
        recorder.startBeat === recorder.startBeat &&
        frame >= this.#takeStartFrame
      ) {
        this.#beginTake();
      }
      if (
        recorder.state === 'recording' &&
        recorder.closedFrames < 0 &&
        transport.frame >= recorder.endFrame()
      ) {
        recorder.close(recorder.endFrame());
      }
    }
    if (recorder.complete) this.#commitTake();
  }

  /** Muestras hasta el siguiente instante exacto (o hasta el final del bloque). */
  #segmentLength(remaining: number): number {
    const transport = this.#transport;
    const recorder = this.#recorder;
    let n = remaining < MAX_SEGMENT ? remaining : MAX_SEGMENT;
    if (this.#transportStateValue !== 'stopped') {
      const toAnchor = ANCHOR_FRAMES - (transport.frame % ANCHOR_FRAMES);
      if (toAnchor < n) n = toAnchor;
    }
    if (this.#transportStateValue === 'pausing') {
      const left = this.#transportGain.remaining;
      if (left > 0 && left < n) n = left;
    }
    if (this.#transportStateValue === 'playing') {
      const frame = transport.frame;
      for (let i = 0; i < LAYER_COUNT; i++) {
        const channel = this.#channels[i]!;
        if (!channel.pendingActive) continue;
        const d = channel.pendingFrame - frame;
        if (d > 0 && d < n) n = d;
      }
      if (recorder.state === 'count-in' && recorder.startBeat === recorder.startBeat) {
        const d = this.#takeStartFrame - frame;
        if (d > 0 && d < n) n = d;
      }
      if (recorder.state === 'recording' && recorder.closedFrames < 0) {
        const d = recorder.endFrame() - frame;
        if (d > 0 && d < n) n = d;
      }
    }
    if (recorder.state === 'count-in' && this.#timerRunning) {
      const d = recorder.timerFrames;
      if (d > 0 && d < n) n = d;
    }
    if (recorder.state === 'recording' && recorder.closedFrames >= 0) {
      const d = recorder.framesToComplete;
      if (d > 0 && d < n) n = d;
    }
    return n;
  }

  #renderSegment(
    input: Float32Array | null,
    outL: Float32Array,
    outR: Float32Array,
    offset: number,
    n: number,
  ): void {
    const transport = this.#transport;
    const advancing = this.#transportStateValue !== 'stopped';
    transport.writeClock(this.#clock);
    if (advancing && (this.#anchorDirty || transport.frame % ANCHOR_FRAMES === 0)) {
      for (let i = 0; i < LAYER_COUNT; i++) this.#channels[i]!.syncTimeline(this.#clock);
      this.#anchorDirty = false;
    }
    let gain: Float32Array | null = null;
    if (this.#transportGain.ramping) {
      this.#transportGain.renderInto(this.#transportBuffer, n);
      gain = this.#transportBuffer;
    }
    const busL = this.#busL;
    const busR = this.#busR;
    busL.fill(0, 0, n);
    busR.fill(0, 0, n);
    for (let i = 0; i < LAYER_COUNT; i++) {
      this.#channels[i]!.renderAdd(busL, busR, n, advancing, gain);
    }
    this.#renderInput(input, offset, n);
    this.#limiter.processInto(busL, busR, outL, outR, offset, n);
    // El metrónomo va después del limitador: un clic no hace «bombear» la música.
    if (this.live && !this.#calibration) this.#renderClicks(outL, outR, offset, n);
    this.#renderVolume(outL, outR, offset, n);
    if (this.#calibration) this.#renderCalibration(input, outL, outR, offset, n);
    if (advancing) transport.advance(n);
    if (this.#timerRunning) this.#recorder.timerFrames -= n;
    this.#statusCountdown -= n;
    if (this.#statusCountdown <= 0) {
      this.#statusCountdown += this.#statusInterval;
      this.#updateStatus();
      this.statusReady = true;
    }
  }

  /**
   * Metrónomo y cuenta previa: un clic en la muestra exacta de cada pulso, sumado a la salida del
   * limitador con su saturación de seguridad (la suma nunca pasa del techo).
   */
  #renderClicks(outL: Float32Array, outR: Float32Array, offset: number, n: number): void {
    const transport = this.#transport;
    const recorder = this.#recorder;
    const countIn = recorder.state === 'count-in';
    const counting = countIn && !this.#timerRunning;
    if (this.#transportStateValue === 'playing' && (this.#metronomeEnabled || counting)) {
      if (this.#nextClickBeat !== this.#nextClickBeat) {
        this.#nextClickBeat = Math.ceil(this.#clock.beat);
        this.#nextClickFrame = transport.frameAtBeat(this.#nextClickBeat);
      }
      const delay = this.#nextClickFrame - transport.frame;
      if (delay < n) {
        this.#metronome.trigger(
          wrap(this.#nextClickBeat, BEATS_PER_BAR) === 0,
          delay + this.outputLatency,
        );
        this.#nextClickBeat++;
        this.#nextClickFrame = transport.frameAtBeat(this.#nextClickBeat);
      }
    } else {
      this.#nextClickBeat = Number.NaN;
    }
    if (countIn && this.#timerRunning && this.#timerClick < COUNT_IN_BEATS) {
      const elapsed = this.#timerTotal - recorder.timerFrames;
      const at = Math.round(this.#timerClick * recorder.timerBeatFrames);
      if (at - elapsed < n) {
        const delay = at > elapsed ? at - elapsed : 0;
        this.#metronome.trigger(this.#timerClick === 0, delay + this.outputLatency);
        this.#timerClick++;
      }
    }
    if (!this.#metronome.active) return;
    // Los clics salen con la latencia del limitador, como la música, para seguir en su pulso.
    const clicks = this.#clicks;
    clicks.fill(0, 0, n);
    this.#metronome.renderInto(clicks, n);
    const limiter = this.#limiter;
    for (let i = 0; i < n; i++) {
      const c = clicks[i]!;
      if (c === 0) continue;
      outL[offset + i] = limiter.clip(outL[offset + i]! + c);
      outR[offset + i] = limiter.clip(outR[offset + i]! + c);
    }
  }

  /**
   * Calibración: los clics suenan en sus muestras exactas, a nivel fijo (después del volumen: con
   * la rueda a cero también se oyen), y la entrada se graba sin tocar. Al terminar, la grabación
   * queda en `calibrationResult`.
   */
  #renderCalibration(
    input: Float32Array | null,
    outL: Float32Array,
    outR: Float32Array,
    offset: number,
    n: number,
  ): void {
    const run = this.#calibration!;
    const at = run.nextClickFrame;
    if (at >= 0 && at < run.frame + n) {
      this.#metronome.trigger(false, at > run.frame ? at - run.frame : 0);
      run.nextClick++;
    }
    if (this.#metronome.active) {
      const clicks = this.#clicks;
      clicks.fill(0, 0, n);
      this.#metronome.renderInto(clicks, n);
      const limiter = this.#limiter;
      for (let i = 0; i < n; i++) {
        const c = clicks[i]!;
        if (c === 0) continue;
        outL[offset + i] = limiter.clip(outL[offset + i]! + c);
        outR[offset + i] = limiter.clip(outR[offset + i]! + c);
      }
    }
    run.record(input, offset, n);
    if (!run.done) return;
    this.calibrationResult = run.event;
    this.#calibration = null;
    this.#memoryDirty = true;
    this.#notify('calibrated', -1, run.frame, 'none', 'none');
  }

  /** Ganancia de entrada suavizada y grabación. */
  #renderInput(input: Float32Array | null, offset: number, n: number): void {
    const target = this.#inputGainTarget;
    if (this.#recorder.state !== 'recording') {
      this.#inputGain = target;
      return;
    }
    const gains = this.#inputGains;
    const a = this.#smoothing;
    let g = this.#inputGain;
    for (let i = 0; i < n; i++) {
      g += (target - g) * a;
      if (Math.abs(target - g) < 1e-6) g = target;
      gains[i] = g;
    }
    this.#inputGain = g;
    this.#recorder.processInput(input, offset, n, gains);
  }

  /** Volumen general (rueda), suavizado, después del limitador. */
  #renderVolume(outL: Float32Array, outR: Float32Array, offset: number, n: number): void {
    const target = this.#volumeTarget;
    let v = this.#volume;
    const end = offset + n;
    if (v === target) {
      if (v === 1) return;
      for (let i = offset; i < end; i++) {
        outL[i] = outL[i]! * v;
        outR[i] = outR[i]! * v;
      }
      return;
    }
    const a = this.#smoothing;
    for (let i = offset; i < end; i++) {
      v += (target - v) * a;
      if (Math.abs(target - v) < 1e-6) v = target;
      outL[i] = outL[i]! * v;
      outR[i] = outR[i]! * v;
    }
    this.#volume = v;
  }
}

function emptyNotice(): Notice {
  return { code: 'stopped', layer: -1, value: 0, command: 'none', reason: 'none' };
}

function emptyLayerStatus(): LayerStatus {
  return {
    hasContent: false,
    sourceKind: 'empty',
    sourceId: '',
    lengthBeats: 0,
    positionBeats: 0,
    level: 1,
    muted: false,
    pan: 0,
    reversed: false,
    filter: 0,
    rms: 0,
    pending: false,
    undo: 0,
    redo: 0,
    discHeld: false,
  };
}

function createStatus(): CoreStatus {
  const layers: LayerStatus[] = [];
  for (let i = 0; i < LAYER_COUNT; i++) layers.push(emptyLayerStatus());
  const notices: Notice[] = [];
  for (let i = 0; i < NOTICE_CAPACITY; i++) notices.push(emptyNotice());
  return {
    v: PROTOCOL_VERSION,
    type: 'status',
    frame: 0,
    beat: 0,
    bpm: DEFAULT_BPM,
    transport: 'stopped',
    recording: 'idle',
    recordLayer: -1,
    recordProgress: 0,
    recordSeconds: 0,
    countInBeats: 0,
    layers,
    memoryBytes: 0,
    limiterGain: 1,
    notices,
    noticeCount: 0,
    noticesDropped: 0,
  };
}

function isNumberIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && value >= min && value <= max;
}

/** Copia `frames` muestras de un bucle de `loop` muestras desde la muestra `from`, dando vueltas. */
function copyLooped(
  source: Float32Array,
  loop: number,
  from: number,
  target: Float32Array,
  frames: number,
): void {
  let at = 0;
  let start = from;
  while (at < frames) {
    const n = Math.min(loop - start, frames - at);
    target.set(source.subarray(start, start + n), at);
    at += n;
    start = 0;
  }
}
