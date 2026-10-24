/**
 * SessionStore (PLAN §4.1, §4.5): el puente entre el modelo del instrumento (`instrument/`), el
 * motor de audio y la interfaz.
 *
 * - Las entradas (gestos y teclas) pasan por el reductor del modelo; sus **intenciones** se
 *   traducen aquí a llamadas del motor. El motor se carga y arranca con la primera que lo necesita.
 * - El estado del audio llega hasta 30 veces por segundo; los signals se actualizan como mucho 10
 *   (`STATUS_INTERVAL_MS`). Los medidores no pasan por signals: leen `latestStatus`.
 * - Los valores en directo (niveles, panoramas, filtros, tempo) son del modelo; el estado del audio
 *   los confirma cuando el usuario no los está moviendo (al cargar una sesión, por ejemplo).
 * - Los códigos de aviso del núcleo y del motor se convierten en textos (`session.content.ts`).
 */
import { computed, inject, InjectionToken, Service, signal } from '@angular/core';
import {
  autosavedAt,
  deleteAutosave,
  loadAudioEngine,
  missedAudioGesture,
  onAudioUnlock,
  preloadAudioEngine,
  type AudioEngine,
  type CoreStatus,
  type EngineErrorCode,
  type EngineEvent,
  type EngineState,
  type MicState,
  type Notice,
  type TornoSettings,
} from '../audio/engine';
import {
  displayModel,
  initialState,
  LAYER_COUNT,
  reduce,
  type DisplayModel,
  type InstrumentInput,
  type InstrumentIntent,
  type InstrumentSettings,
  type InstrumentState,
  type InstrumentStatus,
  type LayerControls,
} from '../instrument';
import { SESSION_CONTENT, type MessageText } from './session.content';

/** Como mucho 10 actualizaciones por segundo de los signals del estado del audio. */
export const STATUS_INTERVAL_MS = 100;
/** Lo que dura un aviso en pantalla. */
const MESSAGE_MS = 3000;
/** Tras mover un control, el estado del audio no lo pisa durante este tiempo. */
const LOCAL_GRACE_MS = 400;
/** Antirrebote de lo que se lee en voz (región `aria-live`): sin ruido al girar un dial. */
const ANNOUNCE_MS = 700;
/** Lo que se espera a que el audio esté listo para recuperar la sesión anterior. */
const RECOVER_WAIT_MS = 10_000;

/** Espera a que el motor esté listo (o falla: error, o `ms` sin conseguirlo). */
function whenReady(engine: AudioEngine, ms: number): Promise<boolean> {
  if (engine.state === 'ready') return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ready: boolean) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(ready);
    };
    const timer = setTimeout(() => done(false), ms);
    const unsubscribe = engine.subscribe((event) => {
      if (event.type !== 'state') return;
      if (event.state === 'ready') done(true);
      else if (event.state === 'error') done(false);
    });
  });
}

export type StoreEngineState = EngineState | 'off';

/** Lo que el store usa del motor (inyectable: los tests ponen uno de mentira). */
export interface AudioEngineApi {
  load(): Promise<AudioEngine>;
  autosavedAt(): Promise<number | null>;
  deleteAutosave(): Promise<boolean>;
}

export const AUDIO_ENGINE_API = new InjectionToken<AudioEngineApi>('AUDIO_ENGINE_API', {
  providedIn: 'root',
  factory: () => ({ load: loadAudioEngine, autosavedAt, deleteAutosave }),
});
export type Busy = 'idle' | 'calibrating' | 'exporting' | 'saving' | 'opening' | 'recovering';

export interface StoreMessage extends MessageText {
  readonly id: number;
  readonly tone: 'info' | 'error';
}

const SILENT_STATUS: InstrumentStatus = {
  transport: 'stopped',
  recording: 'idle',
  recordLayer: -1,
  standby: false,
  layers: Array.from({ length: LAYER_COUNT }, () => ({
    hasContent: false,
    source: 'empty' as const,
    soundId: '',
    pending: false,
    undo: 0,
    redo: 0,
    lengthBeats: 0,
    positionBeats: 0,
  })),
};

const text = SESSION_CONTENT;
const decimal = (value: number, digits = 0) => value.toFixed(digits).replace('.', ',');

@Service()
export class SessionStore {
  readonly #api = inject(AUDIO_ENGINE_API);
  readonly #state = signal<InstrumentState>(initialState());
  readonly #audio = signal<InstrumentStatus>(SILENT_STATUS);
  readonly #details = signal({ recordSeconds: 0, countInBeats: 0 });
  readonly #engineState = signal<StoreEngineState>('off');
  readonly #engineError = signal<EngineErrorCode | null>(null);
  readonly #mic = signal<MicState>('off');
  readonly #message = signal<StoreMessage | null>(null);
  readonly #busy = signal<Busy>('idle');
  readonly #recovery = signal<number | null>(null);
  /** Un toque llegó antes de que el JS pudiera activar el sonido (se lee al crear el store). */
  readonly #needsGesture = signal(missedAudioGesture());
  readonly #autoLatencyMs = signal(0);
  readonly #announcement = signal('');

  /** El modelo del instrumento (controles, ajustes, menú). */
  readonly state = this.#state.asReadonly();
  /** El estado del audio que necesita el modelo (≤ 10/s). */
  readonly audio = this.#audio.asReadonly();
  readonly engineState = this.#engineState.asReadonly();
  readonly engineError = this.#engineError.asReadonly();
  readonly mic = this.#mic.asReadonly();
  readonly message = this.#message.asReadonly();
  readonly busy = this.#busy.asReadonly();
  /** Fecha de una sesión autoguardada que se puede recuperar (o `null`). */
  readonly recovery = this.#recovery.asReadonly();
  /** Un toque llegó antes de poder activar el sonido: hay que pedir otro. */
  readonly needsGesture = computed(
    () => this.#needsGesture() || this.#engineState() === 'needs-gesture',
  );
  /** Lo que se lee en voz, con antirrebote (para la región `aria-live`). */
  readonly announcement = this.#announcement.asReadonly();
  readonly display = computed<DisplayModel>(() => {
    const details = this.#details();
    return displayModel(this.#state(), this.#audio(), {
      recordSeconds: details.recordSeconds,
      countInBeats: details.countInBeats,
      mic: this.#mic(),
      autoLatencyMs: this.#autoLatencyMs(),
      message: this.#message()?.screen ?? '',
    });
  });

  #engine: AudioEngine | null = null;
  #starting: Promise<AudioEngine | null> | null = null;
  #latest: CoreStatus | null = null;
  #statusTimer: ReturnType<typeof setTimeout> | undefined;
  #messageTimer: ReturnType<typeof setTimeout> | undefined;
  #announceTimer: ReturnType<typeof setTimeout> | undefined;
  /** Cuándo se movió un control por última vez (`-Infinity`: nunca, o ya no cuenta). */
  #lastLocalChange = -Infinity;
  #nextMessageId = 1;
  #filePicker: (() => void) | null = null;

  constructor() {
    // En cuanto un gesto activa el sonido, deja de pedirse otro toque.
    onAudioUnlock(() => this.#needsGesture.set(false));
  }

  /** El último estado del audio, sin signals (los medidores lo leen en cada fotograma). */
  get latestStatus(): CoreStatus | null {
    return this.#latest;
  }

  // --- Entradas ---------------------------------------------------------------------------------

  /** Un gesto o una tecla sobre el instrumento. Se llama dentro del propio evento. */
  input(input: InstrumentInput): void {
    const before = this.#state();
    const { state, intents } = reduce(before, input, this.#audio());
    this.#state.set(state);
    for (const intent of intents) this.#apply(intent);
    if (state.settings !== before.settings) this.#autosave();
    // Lo que cambia al girar un control lo lee el propio control (su `aria-valuetext`): no se
    // repite en la región viva. Los avisos se anuncian igual (`#show`).
    if (input.type !== 'turn' && input.type !== 'set' && input.type !== 'drag') this.#announce();
  }

  /** Abre el selector de archivos (lo registra el instrumento: tiene que abrirse en el gesto). */
  setFilePicker(open: (() => void) | null): void {
    this.#filePicker = open;
  }

  // --- Arranque ---------------------------------------------------------------------------------

  /** Precarga el motor (el puntero o el foco se acercan al instrumento). */
  preload(): void {
    preloadAudioEngine();
  }

  /** Carga y arranca el motor (una vez). Se llama tras un gesto, que ya ha desbloqueado el audio. */
  start(): Promise<AudioEngine | null> {
    if (this.#engine) {
      if (this.#engine.state === 'needs-gesture' || this.#engine.state === 'idle') {
        void this.#engine.start();
      }
      return Promise.resolve(this.#engine);
    }
    this.#starting ??= this.#api
      .load()
      .then(async (engine) => {
        this.#engine = engine;
        engine.subscribe((event) => this.#onEngine(event));
        this.#state.update((state) => ({
          ...state,
          settings: { ...state.settings, latency: engine.latency },
        }));
        await engine.start();
        this.#syncEngineState(engine);
        return engine;
      })
      .catch(() => {
        this.#starting = null;
        this.#engineState.set('error');
        this.#engineError.set('worklet-failed');
        return null;
      });
    return this.#starting;
  }

  /** Reintentar tras un error del audio. */
  retry(): void {
    void this.#engine?.retry().then(() => this.#syncEngineState(this.#engine!));
    if (!this.#engine) void this.start();
  }

  // --- Archivos y autoguardado ------------------------------------------------------------------

  /** Abre un `.torno` elegido en el selector de archivos. */
  async openFile(file: File): Promise<void> {
    const engine = await this.start();
    if (!engine) return;
    this.#busy.set('opening');
    try {
      // «Cargada» solo si el motor la ha cargado; si no, ya ha avisado él.
      const settings = await engine.openFile(file);
      if (settings) {
        this.#loaded(settings, text.messages.loaded);
        // Si se recarga justo después, se ofrece recuperar la sesión cargada, no la de antes.
        this.#autosave();
      }
    } catch {
      this.#show(text.problems['load-failed'], 'error');
    } finally {
      this.#busy.set('idle');
    }
  }

  /** Mira si hay una sesión autoguardada (solo lee IndexedDB: no toca el audio). */
  async checkAutosave(): Promise<void> {
    this.#recovery.set(await this.#api.autosavedAt());
  }

  /**
   * «Recuperar la sesión anterior» (desde un gesto). Espera a que el audio esté listo (sale del
   * reposo si hace falta, dentro del gesto) y no suelta la sesión guardada hasta haberla cargado:
   * mientras tanto, el autoguardado no la pisa. Si el audio no arranca, el panel sigue y se avisa.
   */
  async recover(): Promise<void> {
    if (this.#busy() === 'recovering') return;
    if (this.#engine?.state === 'standby') this.#engine.wake();
    this.#busy.set('recovering');
    try {
      const engine = await this.start();
      if (!engine || !(await whenReady(engine, RECOVER_WAIT_MS))) {
        this.#show(text.messages.recoverLater, 'error');
        return;
      }
      const settings = await engine.recoverAutosave();
      this.#recovery.set(null);
      if (settings) {
        this.#loaded(settings, text.messages.recovered);
        this.#autosave();
      }
    } finally {
      this.#busy.set('idle');
    }
  }

  /** «Empezar de cero»: borra el autoguardado. */
  async discardAutosave(): Promise<void> {
    this.#recovery.set(null);
    await this.#api.deleteAutosave();
  }

  /** Borrar el autoguardado desde la web o el menú. */
  async clearAutosave(): Promise<void> {
    this.#recovery.set(null);
    if (await this.#api.deleteAutosave()) this.#show(text.messages.autosaveCleared);
  }

  // --- Intenciones ------------------------------------------------------------------------------

  #apply(intent: InstrumentIntent): void {
    switch (intent.type) {
      case 'locked':
        this.#show(text.messages.locked);
        return;
      case 'open':
        // El selector de archivos tiene que abrirse dentro del gesto.
        this.#filePicker?.();
        return;
      case 'wake':
        // Reanudar el contexto, también dentro del gesto.
        this.#engine?.wake();
        return;
      case 'clear-autosave':
        void this.clearAutosave();
        return;
      case 'set-level':
      case 'set-mute':
      case 'set-pan':
      case 'set-reverse':
      case 'set-filter':
      case 'set-tempo':
        this.#lastLocalChange = performance.now();
        break;
    }
    if (this.#engine) this.#run(this.#engine, intent);
    else void this.start().then((engine) => engine && this.#run(engine, intent));
  }

  #run(engine: AudioEngine, intent: InstrumentIntent): void {
    switch (intent.type) {
      case 'play':
      case 'pause':
      case 'stop':
      case 'disc-release':
        engine.send({ type: intent.type });
        return;
      case 'record':
        void engine.record(intent);
        return;
      case 'cancel-recording':
        engine.cancelRecording();
        return;
      case 'undo':
      case 'redo':
      case 'clear-layer':
      case 'disc-hold':
        engine.send({ type: intent.type, layer: intent.layer });
        if (intent.type !== 'disc-hold') this.#autosave();
        return;
      case 'disc-move':
        engine.send({ type: 'disc-move', turns: intent.turns });
        return;
      case 'set-level':
        engine.send({ type: 'set-level', layer: intent.layer, level: intent.level });
        this.#autosave();
        return;
      case 'set-mute':
        engine.send({ type: 'set-mute', layer: intent.layer, muted: intent.muted });
        this.#autosave();
        return;
      case 'set-pan':
        engine.send({ type: 'set-pan', layer: intent.layer, pan: intent.pan });
        this.#autosave();
        return;
      case 'set-reverse':
        engine.send({ type: 'set-reverse', layer: intent.layer, reversed: intent.reversed });
        this.#autosave();
        return;
      case 'set-filter':
        engine.send({ type: 'set-filter', layer: intent.layer, amount: intent.amount });
        this.#autosave();
        return;
      case 'set-tempo':
        engine.send({ type: 'set-tempo', bpm: intent.bpm });
        this.#autosave();
        return;
      case 'set-volume':
        engine.send({ type: 'set-volume', volume: intent.volume });
        return;
      case 'set-metronome':
        engine.send({ type: 'set-metronome', enabled: intent.enabled });
        return;
      case 'set-input-gain':
        engine.send({ type: 'set-input-gain', gain: intent.gain });
        return;
      case 'set-sound':
        void engine.setSound(intent.layer, intent.sound);
        return;
      case 'set-latency':
        engine.setLatency({ mode: intent.mode, ms: intent.ms });
        this.#autoLatencyMs.set(engine.autoLatencyMs);
        return;
      case 'reset':
        engine.send({ type: 'reset' });
        this.#lastLocalChange = -Infinity;
        this.#autosave();
        return;
      case 'calibrate':
        void this.#calibrate(engine);
        return;
      case 'save':
        void this.#task('saving', async () => {
          await engine.saveFile(this.#tornoSettings());
          this.#show(text.messages.saved);
        });
        return;
      case 'export-mix':
        void this.#task('exporting', () => engine.exportMix(intent.repeats, intent.fadeOut));
        return;
      case 'export-stems':
        void this.#task('exporting', () => engine.exportStems());
        return;
      case 'standby':
        void engine.standby();
        return;
      default:
        return;
    }
  }

  async #task(busy: Busy, run: () => Promise<void>): Promise<void> {
    if (this.#busy() !== 'idle') return;
    this.#busy.set(busy);
    if (busy === 'exporting') this.#show(text.messages.exporting);
    try {
      await run();
    } finally {
      this.#busy.set('idle');
    }
  }

  async #calibrate(engine: AudioEngine): Promise<void> {
    if (this.#busy() !== 'idle') return;
    this.#busy.set('calibrating');
    this.#show(text.messages.calibrating);
    try {
      const ms = await engine.calibrate();
      // Cancelada a propósito (reposo o pestaña oculta): nada que avisar.
      if (ms === null) return;
      this.#state.update((state) => ({
        ...state,
        settings: { ...state.settings, latency: engine.latency },
      }));
      this.#show(text.messages.calibrated(decimal(ms, 1)));
    } catch (error) {
      const code = (error as { code?: EngineErrorCode }).code ?? 'calibration-failed';
      this.#show(text.problems[code] ?? text.problems['calibration-failed'], 'error');
    } finally {
      this.#busy.set('idle');
    }
  }

  /** Tras cargar un archivo o el autoguardado: sus ajustes, y los controles vuelven a escuchar. */
  #loaded(settings: TornoSettings, message: MessageText): void {
    this.#lastLocalChange = -Infinity;
    // Solo las cinco claves de un `.torno`, una a una (nada más del archivo entra en el modelo).
    const { takeBars, countIn, metronome, fitTempo, inputGain } = settings;
    this.#state.update((state) => ({
      ...state,
      settings: { ...state.settings, takeBars, countIn, metronome, fitTempo, inputGain },
    }));
    this.#engine?.send({ type: 'set-metronome', enabled: settings.metronome });
    this.#engine?.send({ type: 'set-input-gain', gain: settings.inputGain });
    this.#show(message);
  }

  #tornoSettings(): TornoSettings {
    const { takeBars, countIn, metronome, fitTempo, inputGain }: InstrumentSettings =
      this.#state().settings;
    return { takeBars, countIn, metronome, fitTempo, inputGain };
  }

  /** Autoguardado tras una edición (no mientras haya una sesión anterior sin recuperar). */
  #autosave(): void {
    if (this.#recovery() !== null) return;
    this.#engine?.scheduleAutosave(this.#tornoSettings());
  }

  // --- Eventos del motor ------------------------------------------------------------------------

  #onEngine(event: EngineEvent): void {
    switch (event.type) {
      case 'state':
        this.#syncEngineState(this.#engine!);
        return;
      case 'status':
        this.#latest = event.status;
        for (let i = 0; i < event.status.noticeCount; i++) this.#onNotice(event.status.notices[i]!);
        this.#scheduleStatus();
        return;
      case 'mic':
        this.#mic.set(event.mic);
        return;
      case 'problem':
        this.#show(text.problems[event.code], 'error');
        return;
    }
  }

  #syncEngineState(engine: AudioEngine): void {
    if (engine.state !== this.#engineState()) this.#announce();
    this.#engineState.set(engine.state);
    this.#engineError.set(engine.error);
    if (engine.state === 'ready') {
      this.#needsGesture.set(false);
      this.#autoLatencyMs.set(engine.autoLatencyMs);
    }
    const standby = engine.state === 'standby';
    if (this.#audio().standby !== standby) this.#audio.update((audio) => ({ ...audio, standby }));
  }

  #onNotice(notice: Notice): void {
    const m = text.messages;
    switch (notice.code) {
      case 'locked':
        this.#show(m.locked);
        return;
      case 'rejected':
        if (notice.command === 'record') {
          if (notice.reason === 'too-long') this.#show(m.tooLong, 'error');
          else if (notice.reason === 'no-memory') this.#show(m.noMemory, 'error');
          else if (notice.reason === 'disc') this.#show(m.releaseDisc, 'error');
        } else if (notice.reason === 'empty') {
          this.#show(notice.command === 'redo' ? m.nothingToRedo : m.nothingToUndo);
        } else if (notice.command === 'calibrate') {
          this.#show(m.stopFirst, 'error');
        } else if (notice.command === 'load-session') {
          this.#show(text.problems['file-invalid'], 'error');
        }
        return;
      case 'take-cancelled':
        if (notice.reason === 'too-short') this.#show(m.tooShort);
        return;
      case 'tempo-fitted':
        this.#show(m.tempoFitted(decimal(notice.value, 1)));
        this.#autosave();
        return;
      case 'take-committed':
      case 'sound-applied':
        this.#autosave();
        return;
      default:
        return;
    }
  }

  #scheduleStatus(): void {
    if (this.#statusTimer !== undefined) return;
    this.#statusTimer = setTimeout(() => {
      this.#statusTimer = undefined;
      const status = this.#latest;
      if (status) this.#publish(status);
    }, STATUS_INTERVAL_MS);
  }

  /** Pasa el último estado del audio a los signals (como mucho 10 veces por segundo). */
  #publish(status: CoreStatus): void {
    const before = this.#audio();
    if (before.transport !== status.transport || before.recording !== status.recording) {
      this.#announce();
    }
    this.#audio.set({
      transport: status.transport,
      recording: status.recording,
      recordLayer: status.recordLayer,
      standby: this.#engineState() === 'standby',
      layers: status.layers.map((layer) => ({
        hasContent: layer.hasContent,
        source: layer.sourceKind,
        soundId: layer.sourceId,
        pending: layer.pending,
        undo: layer.undo,
        redo: layer.redo,
        lengthBeats: layer.lengthBeats,
        positionBeats: layer.positionBeats,
      })),
    });
    const details = this.#details();
    if (
      details.recordSeconds !== status.recordSeconds ||
      details.countInBeats !== status.countInBeats
    ) {
      this.#details.set({
        recordSeconds: status.recordSeconds,
        countInBeats: status.countInBeats,
      });
    }
    this.#syncControls(status);
  }

  /** Los valores en directo vuelven a los del audio si nadie los está moviendo. */
  #syncControls(status: CoreStatus): void {
    if (performance.now() - this.#lastLocalChange < LOCAL_GRACE_MS) return;
    const state = this.#state();
    let changed = state.controls.bpm !== status.bpm;
    const layers = state.controls.layers.map((controls, i): LayerControls => {
      const layer = status.layers[i];
      if (!layer) return controls;
      const same =
        controls.level === layer.level &&
        controls.muted === layer.muted &&
        controls.pan === layer.pan &&
        controls.reversed === layer.reversed &&
        controls.filter === layer.filter;
      if (same) return controls;
      changed = true;
      const { level, muted, pan, reversed, filter } = layer;
      return { level, muted, pan, reversed, filter };
    });
    if (changed) {
      this.#state.set({ ...state, controls: { ...state.controls, layers, bpm: status.bpm } });
    }
  }

  #show(message: MessageText, tone: StoreMessage['tone'] = 'info'): void {
    clearTimeout(this.#messageTimer);
    this.#message.set({ ...message, tone, id: this.#nextMessageId++ });
    this.#messageTimer = setTimeout(() => this.#message.set(null), MESSAGE_MS);
    this.#announce();
  }

  /** Programa la lectura del resumen de la pantalla (los cambios seguidos se juntan en uno). */
  #announce(): void {
    clearTimeout(this.#announceTimer);
    this.#announceTimer = setTimeout(
      () => this.#announcement.set(this.display().summary),
      ANNOUNCE_MS,
    );
  }
}
