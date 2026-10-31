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
  autosaveDates,
  deleteAutosave,
  loadAudioEngine,
  missedAudioGesture,
  onAudioUnlock,
  promoteAutosave,
  type AudioEngine,
  type AutosaveDates,
  type AutosaveSlot,
  type CoreStatus,
  type EngineDiagnostics,
  type EngineErrorCode,
  type EngineEvent,
  type EngineState,
  type MicState,
  type Notice,
  type TornoSettings,
} from '../audio/engine';
import {
  displayModel,
  FIRST_PLAY_SOUND,
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
/** Tramos de la forma de onda de cada capa en la pantalla del aparato. */
export const WAVEFORM_BINS = 96;
/** Tras un cambio de sonido, lo que se espera antes de pedir las formas de onda (antirrebote). */
const WAVEFORM_DELAY_MS = 300;

/** Espera a que el motor esté listo (o falla: error, o `ms` sin conseguirlo). */
function whenReady(engine: AudioEngine, ms: number): Promise<boolean> {
  if (engine.state === 'ready') return Promise.resolve(true);
  // Un error que no se ha podido reintentar (sin Web Audio): no hay nada que esperar.
  if (engine.state === 'error') return Promise.resolve(false);
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
  autosaveDates(): Promise<AutosaveDates>;
  deleteAutosave(slot?: AutosaveSlot): Promise<boolean>;
  promoteAutosave(): Promise<boolean>;
}

export const AUDIO_ENGINE_API = new InjectionToken<AudioEngineApi>('AUDIO_ENGINE_API', {
  providedIn: 'root',
  factory: () => ({ load: loadAudioEngine, autosaveDates, deleteAutosave, promoteAutosave }),
});
export type Busy = 'idle' | 'calibrating' | 'exporting' | 'saving' | 'opening' | 'recovering';

/**
 * Lo que se puede recuperar al volver (PLAN §4.8): la sesión anterior (`main`) y, si se tocó algo
 * sin contestar al panel y se recargó, también eso (`pending`). Fechas en ms desde 1970.
 */
export interface Recovery {
  readonly main: number;
  readonly pending: number | null;
}

/** Una medida del diagnóstico: del toque de «reproducir» al primer sonido. */
export interface FirstSound {
  /** En ms; `null` si no sonó en 5 s. */
  readonly ms: number | null;
  /**
   * La primera reproducción de la página (se mida o no): incluye arrancar el audio, crear el worker
   * y renderizar el sonido.
   */
  readonly cold: boolean;
}

/** Medidas del primer sonido que se guardan (las últimas). */
const FIRST_SOUNDS_KEPT = 8;

/**
 * El momento de un evento (`event.timeStamp`) va en el reloj de `performance.now()`. Uno de más de
 * un minuto en el futuro es de otro reloj (jsdom y algunos navegadores antiguos dan la fecha): se
 * usa el de ahora.
 */
const EVENT_CLOCK_SLACK_MS = 60_000;

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
  readonly #recovery = signal<Recovery | null>(null);
  readonly #confirmRecover = signal<AutosaveSlot | null>(null);
  /** Un toque llegó antes de que el JS pudiera activar el sonido (se lee al crear el store). */
  readonly #needsGesture = signal(missedAudioGesture());
  readonly #autoLatencyMs = signal(0);
  readonly #announcement = signal('');
  readonly #firstSounds = signal<readonly FirstSound[]>([]);
  readonly #waveforms = signal<readonly (Float32Array | null)[]>([]);

  /** El modelo del instrumento (controles, ajustes, menú). */
  readonly state = this.#state.asReadonly();
  /** El estado del audio que necesita el modelo (≤ 10/s). */
  readonly audio = this.#audio.asReadonly();
  readonly engineState = this.#engineState.asReadonly();
  readonly engineError = this.#engineError.asReadonly();
  readonly mic = this.#mic.asReadonly();
  readonly message = this.#message.asReadonly();
  readonly busy = this.#busy.asReadonly();
  /** Las sesiones autoguardadas que se pueden recuperar (o `null`). */
  readonly recovery = this.#recovery.asReadonly();
  /** «Recuperar» espera confirmación (hay sonido en la sesión actual que se perdería). */
  readonly confirmRecover = this.#confirmRecover.asReadonly();
  /** Un toque llegó antes de poder activar el sonido: hay que pedir otro. */
  readonly needsGesture = computed(
    () => this.#needsGesture() || this.#engineState() === 'needs-gesture',
  );
  /** Lo que se lee en voz, con antirrebote (para la región `aria-live`). */
  readonly announcement = this.#announcement.asReadonly();
  /** Con el diagnóstico abierto: cuánto tardó en sonar cada «reproducir». */
  readonly firstSounds = this.#firstSounds.asReadonly();
  /**
   * La forma de onda de cada capa (picos por tramo, de 0 a 1) o `null` si está vacía. Cambia solo
   * cuando cambia el sonido de una capa: la pinta la pantalla del aparato 3D.
   */
  readonly waveforms = this.#waveforms.asReadonly();
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
  /** Cuándo llegó `#latest` (reloj de `performance.now()`): el disco extrapola desde ahí. */
  #latestAt = 0;
  #statusTimer: ReturnType<typeof setTimeout> | undefined;
  /** Las versiones del sonido de las capas de las últimas formas de onda pedidas. */
  #waveformKey = '';
  /**
   * Hay una edición sin autoguardar que espera a que se conteste el panel de recuperar (o su
   * confirmación): se guarda al contestar.
   */
  #autosaveDeferred = false;
  #waveformTimer: ReturnType<typeof setTimeout> | undefined;
  #messageTimer: ReturnType<typeof setTimeout> | undefined;
  #announceTimer: ReturnType<typeof setTimeout> | undefined;
  /** Cuándo se movió un control por última vez (`-Infinity`: nunca, o ya no cuenta). */
  #lastLocalChange = -Infinity;
  #nextMessageId = 1;
  #filePicker: (() => void) | null = null;
  /**
   * La primera reproducción está esperando a que su sonido llegue a la capa. Mientras, otro
   * «reproducir» no hace nada (si no, el transporte arrancaría vacío y el sonido entraría en cola un
   * compás después) y pausar o parar cancelan el arranque.
   */
  #startingWithSound = false;
  /** El panel de diagnóstico está abierto (`?diagnostico=1`) y si hay una medida en marcha. */
  #diagnosing = false;
  #measuring = false;
  /** Ya ha habido una reproducción en la página (con el panel abierto o no). */
  #played = false;
  /** La primera reproducción ya se está preparando en silencio (`preload`). */
  #preloading = false;

  constructor() {
    // En cuanto un gesto activa el sonido, deja de pedirse otro toque.
    onAudioUnlock(() => this.#needsGesture.set(false));
  }

  /** El último estado del audio, sin signals (los medidores lo leen en cada fotograma). */
  get latestStatus(): CoreStatus | null {
    return this.#latest;
  }

  /** Cuándo llegó el último estado del audio (reloj de `performance.now()`). */
  get latestStatusAt(): number {
    return this.#latestAt;
  }

  // --- Entradas ---------------------------------------------------------------------------------

  /** Un gesto o una tecla sobre el instrumento. Se llama dentro del propio evento. */
  input(input: InstrumentInput): void {
    // Con el último estado del audio, no con el de los signals (hasta 100 ms más viejo): pausar
    // justo después de que empiece a sonar tiene que pausar, no pedir «reproducir» otra vez.
    this.#flushStatus();
    // Cada pulsación lleva su momento: el del evento, si viene (el tempo por pulsaciones y el
    // diagnóstico lo necesitan). Si no viene, o no es del reloj de `performance.now()`, el de ahora.
    if (input.type === 'press') {
      const now = performance.now();
      if (input.at === undefined || !(input.at >= 0 && input.at <= now + EVENT_CLOCK_SLACK_MS))
        input = { ...input, at: now };
    }
    const before = this.#state();
    const { state, intents } = reduce(before, input, this.#audio());
    this.#state.set(state);
    for (const intent of intents) this.#apply(intent);
    const starts = intents.some(
      (intent) => intent.type === 'play' || intent.type === 'start-with-sound',
    );
    if (starts) {
      // La primera reproducción de la página es la «en frío», se mida o no.
      const cold = !this.#played;
      this.#played = true;
      if (this.#diagnosing && input.type === 'press' && input.at !== undefined) {
        void this.#measureFirstSound(input.at, cold);
      }
    }
    if (state.settings !== before.settings) this.#autosave();
    // Lo que cambia al girar un control lo lee el propio control (su `aria-valuetext`): no se
    // repite en la región viva. Los avisos se anuncian igual (`#show`).
    if (input.type !== 'turn' && input.type !== 'set' && input.type !== 'drag') this.#announce();
  }

  /** Abre el selector de archivos (lo registra el instrumento: tiene que abrirse en el gesto). */
  setFilePicker(open: (() => void) | null): void {
    this.#filePicker = open;
  }

  // --- Diagnóstico (`?diagnostico=1`) -----------------------------------------------------------

  /** El panel de diagnóstico está abierto: cada «reproducir» mide cuánto tarda en sonar. */
  enableDiagnostics(): void {
    this.#diagnosing = true;
  }

  /** Lo que el navegador dice del audio ahora mismo, o `null` si el audio aún no ha arrancado. */
  diagnostics(): EngineDiagnostics | null {
    return this.#engine?.diagnostics() ?? null;
  }

  /** Mide del toque (`at`, reloj de `performance.now()`) al primer sonido; una medida a la vez. */
  async #measureFirstSound(at: number, cold: boolean): Promise<void> {
    if (this.#measuring) return;
    this.#measuring = true;
    try {
      const engine = await this.start();
      const ms = engine ? await engine.measureFirstSound(at) : null;
      this.#firstSounds.update((list) => [...list, { ms, cold }].slice(-FIRST_SOUNDS_KEPT));
    } finally {
      this.#measuring = false;
    }
  }

  // --- Arranque ---------------------------------------------------------------------------------

  /**
   * Prepara en silencio la primera reproducción (el puntero, el foco o la vista se acercan al
   * instrumento): carga el motor y renderiza ALFAR, sin crear el contexto ni sonar (PLAN §5,
   * «Síntesis»). Una vez; si la carga falla, se intenta otra vez en la siguiente.
   */
  preload(): void {
    if (this.#preloading) return;
    this.#preloading = true;
    this.#api.load().then(
      (engine) => engine.prepare([FIRST_PLAY_SOUND]),
      () => (this.#preloading = false),
    );
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

  /**
   * Mira si hay una sesión autoguardada (solo lee IndexedDB: no toca el audio). Si solo quedó el
   * hueco nuevo (se borró el principal a medias), pasa a ser la sesión anterior.
   */
  async checkAutosave(): Promise<void> {
    let { main, pending } = await this.#api.autosaveDates();
    if (main === null && pending !== null) {
      await this.#api.promoteAutosave();
      [main, pending] = [pending, null];
    }
    this.#recovery.set(main === null ? null : { main, pending });
  }

  /**
   * «Recuperar la sesión anterior» (o lo que se tocó sin contestar, `slot = 'pending'`), desde un
   * gesto. Si la sesión actual ya tiene sonido, primero pide confirmación (`confirmRecover`).
   * Espera a que el audio esté listo (sale del reposo dentro del gesto, o reintenta la carga si el
   * audio no cargó a tiempo) y no suelta la sesión guardada hasta haberla cargado: mientras tanto, lo
   * nuevo se autoguarda en el otro hueco. Si el audio no arranca, el panel sigue y se avisa. Al
   * recuperar, queda un solo hueco: el de la sesión recuperada.
   */
  async recover(slot: AutosaveSlot = 'main'): Promise<void> {
    if (this.#busy() === 'recovering') return;
    if (this.#hasContent() && this.#confirmRecover() !== slot) {
      // Mientras se confirma, nada se autoguarda (tampoco lo que ya esperaba): pisaría la sesión
      // que se va a recuperar. Si se cancela, se guarda entonces.
      this.#confirmRecover.set(slot);
      this.#engine?.cancelAutosave();
      this.#autosaveDeferred = true;
      return;
    }
    this.#confirmRecover.set(null);
    if (this.#engine?.state === 'standby') this.#engine.wake();
    else if (this.#engine?.state === 'error') this.retry();
    this.#busy.set('recovering');
    try {
      const engine = await this.start();
      if (!engine || !(await whenReady(engine, RECOVER_WAIT_MS))) {
        this.#show(text.messages.recoverLater, 'error');
        // El panel sigue: lo que esperaba se guarda (o sigue esperando) como siempre.
        if (this.#autosaveDeferred) this.#autosave();
        return;
      }
      engine.cancelAutosave();
      const settings = await engine.recoverAutosave(slot);
      if (settings) {
        if (slot === 'pending') await this.#api.promoteAutosave();
        else await this.#api.deleteAutosave('pending');
      }
      this.#recovery.set(null);
      if (settings) {
        this.#loaded(settings, text.messages.recovered);
        this.#autosave();
      }
    } finally {
      this.#busy.set('idle');
    }
  }

  /** Vuelve del paso de confirmar «Recuperar» al panel (y lo que esperaba se autoguarda). */
  cancelRecover(): void {
    this.#confirmRecover.set(null);
    if (this.#autosaveDeferred) this.#autosave();
  }

  /**
   * «Empezar de cero»: borra la sesión anterior. Si ya se ha tocado algo con sonido, eso pasa a ser
   * la sesión autoguardada (un solo hueco).
   */
  async discardAutosave(): Promise<void> {
    this.#recovery.set(null);
    this.#confirmRecover.set(null);
    if (this.#engine && this.#hasContent()) {
      await this.#engine.autosaveNow(this.#tornoSettings(), 'main');
      await this.#api.deleteAutosave('pending');
    } else {
      this.#engine?.cancelAutosave();
      await this.#api.deleteAutosave();
    }
  }

  /** Borrar el autoguardado (los dos huecos) desde la web o el menú. */
  async clearAutosave(): Promise<void> {
    this.#recovery.set(null);
    this.#confirmRecover.set(null);
    this.#autosaveDeferred = false;
    this.#engine?.cancelAutosave();
    if (await this.#api.deleteAutosave()) this.#show(text.messages.autosaveCleared);
  }

  /** Si alguna capa de la sesión actual tiene sonido (lo que se perdería al recuperar otra). */
  #hasContent(): boolean {
    return (this.#latest?.layers ?? []).some((layer) => layer.hasContent);
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
        if (this.#startingWithSound) return;
        engine.send({ type: 'play' });
        return;
      case 'pause':
      case 'stop':
        this.#startingWithSound = false;
        engine.send({ type: intent.type });
        return;
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
      case 'start-with-sound':
        // Reproducir cuando el sonido ya está en la capa: sin un compás vacío al empezar.
        this.#startingWithSound = true;
        void engine.setSound(intent.layer, intent.sound).then(() => {
          if (this.#startingWithSound) engine.send({ type: 'play' });
          this.#startingWithSound = false;
        });
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
      // Con una sesión cargada, reproducir ya no pone la batería de la primera vez.
      firstPlay: false,
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

  /**
   * Autoguardado tras una edición. Mientras el panel de recuperar sigue sin contestar, va al hueco
   * nuevo y no pisa la sesión anterior.
   *
   * Lo nuevo espera, sin guardarse, en dos casos (la carrera vista en la fase 5): con la confirmación
   * de «Recuperar» abierta, y con los dos huecos ofrecidos (el nuevo ya guarda «lo que tocaste
   * después»: 1,5 s después de tocar algo, lo pisaba). Se guarda al contestar.
   */
  #autosave(): void {
    const recovery = this.#recovery();
    if (this.#confirmRecover() !== null || (recovery !== null && recovery.pending !== null)) {
      this.#autosaveDeferred = true;
      this.#engine?.cancelAutosave();
      return;
    }
    this.#autosaveDeferred = false;
    this.#engine?.scheduleAutosave(this.#tornoSettings(), recovery === null ? 'main' : 'pending');
  }

  // --- Eventos del motor ------------------------------------------------------------------------

  #onEngine(event: EngineEvent): void {
    switch (event.type) {
      case 'state':
        this.#syncEngineState(this.#engine!);
        return;
      case 'status':
        this.#latest = event.status;
        this.#latestAt = performance.now();
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

  /** El estado del audio que esperaba su turno pasa ya (una entrada del usuario lo necesita). */
  #flushStatus(): void {
    if (this.#statusTimer === undefined) return;
    clearTimeout(this.#statusTimer);
    this.#statusTimer = undefined;
    if (this.#latest) this.#publish(this.#latest);
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
    this.#watchWaveforms(status);
  }

  /**
   * Las formas de onda se vuelven a pedir cuando cambia el sonido de alguna capa (su versión), con
   * antirrebote. Durante una toma, no: la copia de la sesión coincidiría con la de la toma (el pico
   * de memoria de PLAN §5); al terminarla, sí.
   */
  #watchWaveforms(status: CoreStatus): void {
    if (status.recording !== 'idle') return;
    const key = status.layers
      .map((layer) => (layer.hasContent ? layer.contentVersion : -1))
      .join(',');
    if (key === this.#waveformKey) return;
    this.#waveformKey = key;
    clearTimeout(this.#waveformTimer);
    if (status.layers.every((layer) => !layer.hasContent)) {
      this.#waveforms.set(status.layers.map(() => null));
      return;
    }
    this.#waveformTimer = setTimeout(() => void this.#refreshWaveforms(key), WAVEFORM_DELAY_MS);
  }

  async #refreshWaveforms(key: string): Promise<void> {
    const engine = this.#engine;
    try {
      if (!engine || engine.state !== 'ready') throw new Error('sin audio');
      const waveforms = await engine.waveforms(WAVEFORM_BINS);
      if (key === this.#waveformKey) this.#waveforms.set(waveforms);
    } catch {
      // Se vuelve a intentar con el siguiente estado del audio.
      if (key === this.#waveformKey) this.#waveformKey = '';
    }
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
