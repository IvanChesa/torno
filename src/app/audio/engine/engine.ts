/**
 * AudioEngine (PLAN §4.3): el audio en el hilo principal. Se carga con `import()` (nunca va en el
 * bundle inicial) y es el único sitio que toca el `AudioContext`, el micrófono y los archivos.
 *
 * - **Arranque.** Adopta el contexto que creó el desbloqueo en el gesto (nunca crea uno), carga el
 *   módulo del worklet con 5 s de espera y conecta el nodo. Si no hay contexto, o el sistema lo
 *   tiene suspendido, espera a un toque («Toca para activar el sonido» / «Toca para reanudar»).
 * - **Comandos** hacia `LoopCore` (los de antes de que el nodo exista esperan en una cola) y
 *   **estado** de vuelta (≤ 30/s), que se reparte a quien escuche.
 * - **Micrófono** solo al grabar o calibrar, con `play-and-record` en la sesión de audio, y suelto
 *   al acabar la toma, en reposo y con la pestaña oculta.
 * - **Reposo**: cancela la toma, pausa, suelta el micrófono y suspende el contexto.
 *
 * Devuelve códigos de error, nunca textos: los pone la interfaz.
 */
import { measureLatency } from '../core/calibration';
import {
  PROCESSOR_NAME,
  PROTOCOL_VERSION,
  isCurrentMessage,
  type CalibrationEvent,
  type CoreCommand,
  type CoreCommandBody,
  type CoreStatus,
  type LibrarySound,
  type Notice,
  type RenderSoundResponse,
  type SynthWorkerRequest,
  type SynthWorkerResponse,
  type WorkletEvent,
  type WorkletRequest,
} from '../core/protocol';
import type { SessionState } from '../core/session';
import {
  autoLatencySeconds,
  latencyFrames,
  loadLatency,
  saveLatency,
  type LatencySetting,
} from './latency';
import { Microphone, MicrophoneError, type MicrophoneErrorCode } from './microphone';
import { resampleSession } from './resample';
import { holdAudioUnlock, onAudioUnlock, setAudioSessionType, unlockedContext } from './unlock';
import { WORKLET_PATH } from './worklet-url.generated';

export type EngineState =
  /** Sin arrancar. */
  | 'idle'
  /** Cargando el módulo del worklet. */
  | 'loading'
  /** Listo: el contexto está en marcha y el núcleo responde. */
  | 'ready'
  /** Hace falta un toque para activar el sonido (el toque llegó antes que el JS, o no hubo). */
  | 'needs-gesture'
  /** El sistema ha suspendido el audio (una llamada, otra app…): hace falta un toque. */
  | 'interrupted'
  | 'standby'
  /** No se puede seguir: ver `error` (algunos se pueden reintentar). */
  | 'error';

export type EngineErrorCode =
  | 'no-web-audio'
  | 'worklet-timeout'
  | 'worklet-failed'
  | 'calibration-failed'
  | 'sound-failed'
  | MicrophoneErrorCode;

export type MicState = 'off' | 'requesting' | 'on';

export type EngineEvent =
  | { readonly type: 'state'; readonly state: EngineState; readonly error: EngineErrorCode | null }
  | { readonly type: 'status'; readonly status: CoreStatus }
  | { readonly type: 'mic'; readonly mic: MicState }
  /** Algo no ha salido (el motor sigue funcionando): la interfaz lo cuenta. */
  | { readonly type: 'problem'; readonly code: EngineErrorCode };

export interface RecordOptions {
  readonly layer: number;
  readonly bars: 0 | 1 | 2 | 4;
  readonly countIn: boolean;
  readonly fitTempo: boolean;
}

const MODULE_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 10_000;
/** Tras pedir el reposo, se espera a que la salida se apague antes de suspender el contexto. */
const STANDBY_FADE_MS = 150;

/** Una carga del módulo por contexto; si falla, el siguiente intento vuelve a cargarlo. */
const modules = new WeakMap<AudioContext, Promise<void>>();

export class AudioEngine {
  #state: EngineState = 'idle';
  #error: EngineErrorCode | null = null;
  #context: AudioContext | null = null;
  #node: AudioWorkletNode | null = null;
  #starting: Promise<void> | null = null;
  #status: CoreStatus | null = null;
  readonly #queue: { command: CoreCommand; transfer: Transferable[] }[] = [];
  readonly #listeners = new Set<(event: EngineEvent) => void>();
  readonly #statusWaiters = new Set<(status: CoreStatus) => void>();
  readonly #sessions = new Map<number, (session: SessionState) => void>();
  #calibration: {
    resolve: (event: CalibrationEvent) => void;
    reject: (error: Error) => void;
  } | null = null;
  #nextId = 1;

  readonly #mic = new Microphone();
  #micState: MicState = 'off';
  /** Capa que se graba con el micrófono abierto (−1 si ninguna). */
  #micLayer = -1;
  #latency: LatencySetting = loadLatency();

  #synth: Worker | null = null;
  readonly #sounds = new Map<string, { pcm: Float32Array; lengthBeats: number }>();

  constructor() {
    onAudioUnlock(() => this.#onUnlock());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.#onHidden();
      });
    }
  }

  get state(): EngineState {
    return this.#state;
  }

  get error(): EngineErrorCode | null {
    return this.#error;
  }

  /** El último estado del núcleo (o `null` antes de arrancar). */
  get status(): CoreStatus | null {
    return this.#status;
  }

  get sampleRate(): number | null {
    return this.#context?.sampleRate ?? null;
  }

  get mic(): MicState {
    return this.#micState;
  }

  get latency(): LatencySetting {
    return this.#latency;
  }

  /** Estimación automática de la latencia de ida y vuelta, en ms (con el contexto en marcha). */
  get autoLatencyMs(): number {
    return this.#context ? autoLatencySeconds(this.#context, this.#mic.inputLatency) * 1000 : 0;
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // --- Arranque --------------------------------------------------------------------------------

  /** Arranca (o espera a que arranque). Sin contexto desbloqueado, pasa a `needs-gesture`. */
  start(): Promise<void> {
    if (this.#state === 'ready' || this.#state === 'standby') return Promise.resolve();
    if (this.#starting) return this.#starting;
    if (typeof AudioContext === 'undefined') {
      this.#setState('error', 'no-web-audio');
      return Promise.resolve();
    }
    const context = unlockedContext();
    if (!context) {
      this.#setState('needs-gesture');
      return Promise.resolve();
    }
    this.#starting = this.#boot(context).finally(() => (this.#starting = null));
    return this.#starting;
  }

  /** Reintentar tras un error del módulo (5 s sin cargar o fallo de red). */
  retry(): Promise<void> {
    if (this.#state === 'error' && this.#error === 'no-web-audio') return Promise.resolve();
    if (this.#state === 'error') this.#setState('idle');
    return this.start();
  }

  async #boot(context: AudioContext): Promise<void> {
    this.#setState('loading');
    if (this.#context !== context) {
      this.#context = context;
      context.addEventListener('statechange', () => this.#onContextState());
    }
    try {
      await loadModule(context);
    } catch (error) {
      this.#setState(
        'error',
        error instanceof ModuleTimeout ? 'worklet-timeout' : 'worklet-failed',
      );
      return;
    }
    if (!this.#node) {
      const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
      node.port.onmessage = (event: MessageEvent<unknown>) => this.#receive(event.data);
      node.connect(context.destination);
      this.#node = node;
      for (const { command, transfer } of this.#queue.splice(0)) {
        node.port.postMessage(command, transfer);
      }
    }
    this.#onContextState();
  }

  #onUnlock(): void {
    // Un gesto ha desbloqueado (o reanudado) el audio: si se esperaba, se sigue.
    if (this.#state === 'needs-gesture' && !this.#starting) void this.start();
  }

  #onContextState(): void {
    const context = this.#context;
    if (!context || !this.#node) return;
    if (this.#state === 'standby' || this.#state === 'error') return;
    if (context.state === 'running') this.#setState('ready');
    else if (this.#state === 'ready' || this.#state === 'interrupted')
      this.#setState('interrupted');
    else this.#setState('needs-gesture');
  }

  // --- Comandos y estado -----------------------------------------------------------------------

  /** Envía un comando al núcleo (si el nodo aún no existe, espera en la cola). */
  send(command: CoreCommandBody, transfer: Transferable[] = []): void {
    const message = { v: PROTOCOL_VERSION, ...command } as CoreCommand;
    if (this.#node) this.#node.port.postMessage(message, transfer);
    else this.#queue.push({ command: message, transfer });
  }

  #request(request: WorkletRequest, transfer: Transferable[] = []): void {
    this.#node?.port.postMessage(request, transfer);
  }

  #receive(data: unknown): void {
    if (!isCurrentMessage(data)) return;
    const event = data as WorkletEvent;
    switch (event.type) {
      case 'status':
        this.#status = event;
        for (let i = 0; i < event.noticeCount; i++) this.#onNotice(event.notices[i]!);
        for (const waiter of this.#statusWaiters) waiter(event);
        this.#emit({ type: 'status', status: event });
        return;
      case 'session':
        this.#sessions.get(event.id)?.(event.session);
        this.#sessions.delete(event.id);
        return;
      case 'calibration':
        this.#calibration?.resolve(event);
        this.#calibration = null;
        return;
    }
  }

  #onNotice(notice: Notice): void {
    const takeOver =
      (notice.code === 'take-committed' || notice.code === 'take-cancelled') &&
      notice.layer === this.#micLayer;
    const recordRejected = notice.code === 'rejected' && notice.command === 'record';
    if (takeOver || recordRejected) this.#closeMic();
  }

  /** Espera a que el estado cumpla `predicate` (o falla a los `ms`). */
  #until(predicate: (status: CoreStatus) => boolean, ms: number): Promise<CoreStatus> {
    if (this.#status && predicate(this.#status)) return Promise.resolve(this.#status);
    return new Promise((resolve, reject) => {
      const done = (status: CoreStatus) => {
        if (!predicate(status)) return;
        clearTimeout(timer);
        this.#statusWaiters.delete(done);
        resolve(status);
      };
      const timer = setTimeout(() => {
        this.#statusWaiters.delete(done);
        reject(new Error('timeout'));
      }, ms);
      this.#statusWaiters.add(done);
    });
  }

  // --- Grabación y micrófono -------------------------------------------------------------------

  /**
   * Grabar: si no hay toma, pide el micrófono, aplica la latencia y empieza (el núcleo decide cuándo,
   * según la duración y la cuenta previa). Con una toma en marcha, la cierra o cancela la cuenta
   * previa. Pulsar otra vez mientras se espera el permiso lo cancela.
   */
  async record(options: RecordOptions): Promise<void> {
    const status = this.#status;
    if (status && status.recording !== 'idle') {
      this.send({ type: 'record', ...options });
      return;
    }
    if (this.#mic.isPending) {
      this.#closeMic();
      return;
    }
    const context = this.#context;
    const node = this.#node;
    if (!context || !node || this.#state !== 'ready') return;
    setAudioSessionType('play-and-record');
    this.#setMic('requesting');
    let opened: boolean;
    try {
      opened = await this.#mic.connect(context, node);
    } catch (error) {
      this.#closeMic();
      this.#emit({ type: 'problem', code: micCode(error) });
      return;
    }
    if (!opened) return;
    this.#micLayer = options.layer;
    this.#setMic('on');
    this.send({ type: 'set-latency', frames: this.#latencyFrames() });
    this.send({ type: 'record', ...options });
  }

  /** Cancelar la toma (o la cuenta previa, o la petición del micrófono). */
  cancelRecording(): void {
    this.send({ type: 'cancel-recording' });
    this.#closeMic();
  }

  #closeMic(): void {
    this.#mic.close();
    this.#micLayer = -1;
    setAudioSessionType('playback');
    this.#setMic('off');
  }

  #setMic(mic: MicState): void {
    if (mic === this.#micState) return;
    this.#micState = mic;
    this.#emit({ type: 'mic', mic });
  }

  #latencyFrames(): number {
    const rate = this.#context?.sampleRate ?? 48_000;
    return latencyFrames(this.#latency, this.autoLatencyMs / 1000, rate);
  }

  /** Cambia el modo o el valor de la latencia y lo guarda en este dispositivo. */
  setLatency(setting: LatencySetting): void {
    this.#latency = setting;
    saveLatency(setting);
    if (this.#node) this.send({ type: 'set-latency', frames: this.#latencyFrames() });
  }

  /**
   * Calibración por clic: para el transporte, abre el micrófono, hace sonar 8 clics y mide cuánto
   * tardan en volver. Guarda el resultado (modo «calibrada») y lo devuelve en ms.
   */
  async calibrate(): Promise<number> {
    const context = this.#context;
    const node = this.#node;
    if (!context || !node || this.#state !== 'ready') throw new EngineError('calibration-failed');
    this.send({ type: 'pause' });
    try {
      await this.#until((status) => status.transport === 'stopped', 2000);
    } catch {
      throw new EngineError('calibration-failed');
    }
    setAudioSessionType('play-and-record');
    this.#setMic('requesting');
    try {
      if (!(await this.#mic.connect(context, node))) throw new EngineError('calibration-failed');
    } catch (error) {
      this.#closeMic();
      throw error instanceof MicrophoneError ? new EngineError(error.code) : error;
    }
    this.#setMic('on');
    try {
      const recording = await withTimeout(
        new Promise<CalibrationEvent>((resolve, reject) => {
          this.#calibration = { resolve, reject };
          this.send({ type: 'calibrate' });
        }),
        REQUEST_TIMEOUT_MS,
      );
      const result = measureLatency(recording.pcm, recording.clickFrames, recording.sampleRate);
      if (!result) throw new EngineError('calibration-failed');
      const ms = (1000 * result.latencyFrames) / recording.sampleRate;
      this.setLatency({ mode: 'calibrated', ms: Math.round(ms * 10) / 10 });
      return ms;
    } catch (error) {
      this.send({ type: 'cancel-recording' });
      throw error instanceof EngineError ? error : new EngineError('calibration-failed');
    } finally {
      this.#calibration = null;
      this.#closeMic();
    }
  }

  // --- Reposo y pestaña oculta -----------------------------------------------------------------

  /** Reposo: cancela la toma, pausa, suelta el micrófono y suspende el contexto. */
  async standby(): Promise<void> {
    if (this.#state === 'standby') return;
    holdAudioUnlock(true);
    this.send({ type: 'standby' });
    this.#closeMic();
    this.#setState('standby');
    await new Promise((resolve) => setTimeout(resolve, STANDBY_FADE_MS));
    // Si entretanto se ha salido del reposo, el contexto sigue en marcha.
    if (this.state === ('standby' as EngineState)) {
      await this.#context?.suspend().catch(() => undefined);
    }
  }

  /** Salir del reposo. Se llama dentro del gesto: reanuda el contexto antes de cualquier `await`. */
  wake(): void {
    if (this.#state !== 'standby') return;
    holdAudioUnlock(false);
    const context = this.#context;
    if (!context) {
      this.#setState('idle');
      return;
    }
    this.#setState('loading');
    context.resume().then(
      () => this.#onContextState(),
      () => this.#setState('interrupted'),
    );
  }

  #onHidden(): void {
    // Pestaña oculta: la toma (o la cuenta previa, o la calibración) se cancela, se pausa y se
    // suelta el micrófono.
    if (!this.#node) return;
    this.send({ type: 'cancel-recording' });
    this.send({ type: 'pause' });
    this.#calibration?.reject(new EngineError('calibration-failed'));
    this.#calibration = null;
    this.#closeMic();
  }

  // --- Sonidos y sesión ------------------------------------------------------------------------

  /** Un sonido de la biblioteca a la frecuencia del contexto (renderizado una vez y guardado). */
  async loadSound(id: string): Promise<LibrarySound> {
    const rate = this.#context?.sampleRate;
    if (!rate) throw new EngineError('sound-failed');
    let cached = this.#sounds.get(id);
    if (!cached) {
      const response = await this.#renderSound(id, rate);
      cached = { pcm: response.pcm, lengthBeats: response.lengthBeats };
      this.#sounds.set(id, cached);
    }
    // El núcleo se queda con su copia (transferida): la de la caché sirve para la próxima vez.
    return { id, pcm: cached.pcm.slice(), lengthBeats: cached.lengthBeats };
  }

  /** Cambia el sonido de una capa (o la apaga con `null`): en marcha, entra en el compás siguiente. */
  async setSound(layer: number, id: string | null): Promise<void> {
    if (id === null) {
      this.send({ type: 'set-sound', layer, sound: null });
      return;
    }
    try {
      const sound = await this.loadSound(id);
      this.send({ type: 'set-sound', layer, sound }, [sound.pcm.buffer as ArrayBuffer]);
    } catch {
      this.#emit({ type: 'problem', code: 'sound-failed' });
    }
  }

  #renderSound(id: string, sampleRate: number): Promise<RenderSoundResponse> {
    const worker = (this.#synth ??= new Worker(
      new URL('../workers/synth.worker', import.meta.url),
      {
        type: 'module',
        name: 'torno-sintesis',
      },
    ));
    const request: SynthWorkerRequest = {
      v: PROTOCOL_VERSION,
      type: 'render-sound',
      id: this.#nextId++,
      sound: id,
      sampleRate,
    };
    const response = new Promise<RenderSoundResponse>((resolve, reject) => {
      const onMessage = (event: MessageEvent<unknown>) => {
        if (!isCurrentMessage(event.data)) return;
        const message = event.data as SynthWorkerResponse;
        if (message.id !== request.id) return;
        worker.removeEventListener('message', onMessage);
        if (message.type === 'sound') resolve(message);
        else reject(new EngineError('sound-failed'));
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage(request);
    });
    return withTimeout(response, REQUEST_TIMEOUT_MS);
  }

  /** Copia de la sesión que suena (para guardar, autoguardar o exportar). */
  copySession(): Promise<SessionState> {
    const id = this.#nextId++;
    const copy = new Promise<SessionState>((resolve) => {
      this.#sessions.set(id, resolve);
      this.#request({ v: PROTOCOL_VERSION, type: 'copy-session', id });
    });
    return withTimeout(copy, REQUEST_TIMEOUT_MS).finally(() => this.#sessions.delete(id));
  }

  /**
   * Carga una sesión ya validada. Si su frecuencia no es la del contexto, se remuestrea antes (con
   * `OfflineAudioContext`). El núcleo la vuelve a comprobar y, si no vale, no cambia nada.
   */
  async loadSession(state: SessionState): Promise<void> {
    const rate = this.#context?.sampleRate;
    if (!rate) return;
    const session = state.sampleRate === rate ? state : await resampleSession(state, rate);
    const transfer: Transferable[] = [];
    for (const layer of session.layers)
      if (layer.pcm) transfer.push(layer.pcm.buffer as ArrayBuffer);
    this.send({ type: 'load-session', session }, transfer);
  }

  // --- Eventos ---------------------------------------------------------------------------------

  #setState(state: EngineState, error: EngineErrorCode | null = null): void {
    if (state === this.#state && error === this.#error) return;
    this.#state = state;
    this.#error = error;
    this.#emit({ type: 'state', state, error });
  }

  #emit(event: EngineEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

/** Error de una operación del motor, con su código (los textos los pone la interfaz). */
export class EngineError extends Error {
  constructor(readonly code: EngineErrorCode) {
    super(code);
  }
}

function micCode(error: unknown): EngineErrorCode {
  return error instanceof MicrophoneError ? error.code : 'mic-failed';
}

class ModuleTimeout extends Error {}

function loadModule(context: AudioContext): Promise<void> {
  let loading = modules.get(context);
  if (!loading) {
    const url = new URL(WORKLET_PATH, document.baseURI).href;
    loading = withTimeout(context.audioWorklet.addModule(url), MODULE_TIMEOUT_MS, ModuleTimeout);
    loading.catch(() => modules.delete(context));
    modules.set(context, loading);
  }
  return loading;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  Failure: new () => Error = Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Failure()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

let instance: AudioEngine | undefined;

/** El motor (uno por página). */
export function audioEngine(): AudioEngine {
  return (instance ??= new AudioEngine());
}
