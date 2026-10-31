import { TestBed } from '@angular/core/testing';
import type {
  AudioEngine,
  AutosaveDates,
  AutosaveSlot,
  CoreStatus,
  EngineEvent,
  EngineState,
  LayerStatus,
  Notice,
  TornoSettings,
} from '../audio/engine';
import {
  AUDIO_ENGINE_API,
  SessionStore,
  STATUS_INTERVAL_MS,
  type AudioEngineApi,
} from './session.store';

/** Un motor de mentira: apunta lo que se le pide y deja emitir eventos. */
class FakeEngine {
  state: EngineState = 'ready';
  error = null;
  latency = { mode: 'auto' as const, ms: 0 };
  autoLatencyMs = 31;
  readonly calls: unknown[][] = [];
  readonly #listeners = new Set<(event: EngineEvent) => void>();

  subscribe(listener: (event: EngineEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  emit(event: EngineEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
  #log(name: string, ...args: unknown[]): void {
    this.calls.push([name, ...args]);
  }
  async start(): Promise<void> {
    this.#log('start');
  }
  prepare(sounds: readonly string[]): void {
    this.#log('prepare', [...sounds]);
  }
  /** Si `retry` vuelve a cargar el audio (sin Web Audio no se puede). */
  retryable = true;
  async retry(): Promise<void> {
    this.#log('retry');
    if (!this.retryable) return;
    // Como el motor: vuelve a cargar el módulo y, un poco después, queda listo.
    this.state = 'loading';
    setTimeout(() => {
      this.state = 'ready';
      this.emit({ type: 'state', state: 'ready', error: null });
    });
  }
  send(command: unknown): void {
    this.#log('send', command);
  }
  heardAt(): number {
    return performance.now();
  }
  async record(options: unknown): Promise<void> {
    this.#log('record', options);
  }
  cancelRecording(): void {
    this.#log('cancelRecording');
  }
  /** Si se pone, `setSound` espera a esta promesa (un render que tarda). */
  soundGate: Promise<void> | null = null;
  async setSound(layer: number, id: string | null): Promise<void> {
    this.#log('setSound', layer, id);
    if (this.soundGate) await this.soundGate;
  }
  setLatency(setting: unknown): void {
    this.#log('setLatency', setting);
  }
  /** Lo que devuelve `calibrate`: la latencia en ms, o `null` si se cancela a propósito. */
  calibrated: number | null = 23.46;
  async calibrate(): Promise<number | null> {
    this.#log('calibrate');
    return this.calibrated;
  }
  async standby(): Promise<void> {
    this.#log('standby');
  }
  wake(): void {
    this.#log('wake');
  }
  async saveFile(settings: unknown): Promise<void> {
    this.#log('saveFile', settings);
  }
  async exportMix(repeats: number, fadeOut: boolean): Promise<void> {
    this.#log('exportMix', repeats, fadeOut);
  }
  async exportStems(): Promise<void> {
    this.#log('exportStems');
  }
  scheduleAutosave(settings: unknown, slot: unknown): void {
    this.#log('scheduleAutosave', settings, slot);
  }
  cancelAutosave(): void {
    this.#log('cancelAutosave');
  }
  async autosaveNow(settings: unknown, slot: unknown): Promise<void> {
    this.#log('autosaveNow', settings, slot);
  }
  /** Lo que devuelve `openFile`: los ajustes, `null` (el motor ya ha avisado) o un fallo. */
  opened: TornoSettings | null | 'throw' = null;
  async openFile(file: Blob): Promise<TornoSettings | null> {
    this.#log('openFile', file.size);
    if (this.opened === 'throw') throw new Error('inesperado');
    return this.opened;
  }
  /** Lo que devuelve `recoverAutosave`: los ajustes de la sesión autoguardada. */
  recovered: TornoSettings | null = null;
  async recoverAutosave(slot: unknown): Promise<TornoSettings | null> {
    this.#log('recoverAutosave', slot);
    return this.recovered;
  }
  sent(): unknown[] {
    return this.calls.filter((call) => call[0] === 'send').map((call) => call[1]);
  }
  /** Lo que tarda en sonar (ms) cada vez que se mide. */
  soundDelays: (number | null)[] = [];
  async measureFirstSound(since: number): Promise<number | null> {
    this.#log('measureFirstSound', since);
    return this.soundDelays.shift() ?? null;
  }
  diagnostics(): unknown {
    return { contextState: 'running' };
  }
}

function layer(change: Partial<LayerStatus> = {}): LayerStatus {
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
    contentVersion: 0,
    ...change,
  };
}

function status(change: Partial<CoreStatus> = {}, notices: Notice[] = []): CoreStatus {
  return {
    v: 4,
    type: 'status',
    frame: 0,
    beat: 0,
    contextFrame: 0,
    bpm: 90,
    transport: 'stopped',
    recording: 'idle',
    recordLayer: -1,
    recordProgress: 0,
    recordSeconds: 0,
    countInBeats: 0,
    layers: [layer(), layer(), layer(), layer()],
    memoryBytes: 0,
    limiterGain: 1,
    notices,
    noticeCount: notices.length,
    noticesDropped: 0,
    ...change,
  };
}

const notice = (change: Partial<Notice>): Notice => ({
  code: 'rejected',
  layer: -1,
  value: 0,
  command: 'none',
  reason: 'none',
  ...change,
});

/** Los dos huecos del autoguardado, de mentira: fechas y lo que se ha pedido borrar o pasar. */
class FakeAutosave {
  dates: AutosaveDates = { main: 1_700_000_000_000, pending: null };
  readonly calls: unknown[][] = [];
  readonly api: Omit<AudioEngineApi, 'load'> = {
    autosaveDates: async () => this.dates,
    deleteAutosave: async (slot?: AutosaveSlot) => {
      this.calls.push(['delete', slot ?? 'both']);
      return true;
    },
    promoteAutosave: async () => {
      this.calls.push(['promote']);
      return true;
    },
  };
}

async function setup(): Promise<{
  store: SessionStore;
  engine: FakeEngine;
  autosave: FakeAutosave;
}> {
  const engine = new FakeEngine();
  const autosave = new FakeAutosave();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AUDIO_ENGINE_API,
        useValue: { load: async () => engine as unknown as AudioEngine, ...autosave.api },
      },
    ],
  });
  const store = TestBed.inject(SessionStore);
  await store.start();
  return { store, engine, autosave };
}

/** La sesión actual con sonido en la capa 1. */
const withContent = (): EngineEvent => ({
  type: 'status',
  status: status({ layers: [layer({ hasContent: true }), layer(), layer(), layer()] }),
});

describe('SessionStore', () => {
  afterEach(() => vi.useRealTimers());

  it('primera reproducción: pone ALFAR en la capa 1 y reproduce cuando ya está', async () => {
    const { store, engine } = await setup();
    store.input({ type: 'press', control: 'play' });
    expect(engine.calls).toContainEqual(['setSound', 0, 'alfar']);
    await Promise.resolve();
    await Promise.resolve();
    const order = engine.calls.map((call) =>
      call[0] === 'send' ? (call[1] as { type: string }).type : call[0],
    );
    expect(order.indexOf('play')).toBeGreaterThan(order.indexOf('setSound'));
    expect(store.state().selected).toBe(1);
  });

  it('primera reproducción: mientras llega el sonido, otro «reproducir» no hace nada y pausar la cancela', async () => {
    const { store, engine } = await setup();
    let release = () => undefined as void;
    engine.soundGate = new Promise<void>((resolve) => (release = resolve));
    store.input({ type: 'press', control: 'play' });
    // El estado del audio sigue diciendo «parado»: el segundo toque pide `play` y se absorbe.
    store.input({ type: 'press', control: 'play' });
    expect(engine.sent()).toEqual([]);
    release();
    await new Promise((resolve) => setTimeout(resolve));
    expect(engine.sent()).toEqual([{ type: 'play' }]);
  });

  it('primera reproducción: parar antes de que llegue el sonido cancela el arranque', async () => {
    const { store, engine } = await setup();
    let release = () => undefined as void;
    engine.soundGate = new Promise<void>((resolve) => (release = resolve));
    store.input({ type: 'press', control: 'play' });
    store.input({ type: 'hold', control: 'play' });
    release();
    await new Promise((resolve) => setTimeout(resolve));
    expect(engine.sent()).toEqual([{ type: 'stop' }]);
  });

  /** Lo que dice el motor del transporte, ya publicado en los signals (≤ 10/s). */
  async function transport(engine: FakeEngine, value: CoreStatus['transport']): Promise<void> {
    engine.emit({ type: 'status', status: status({ transport: value }) });
    await new Promise((resolve) => setTimeout(resolve, STATUS_INTERVAL_MS + 20));
  }

  it('diagnóstico: con el panel abierto, cada «reproducir» mide cuánto tarda en sonar', async () => {
    const { store, engine } = await setup();
    store.enableDiagnostics();
    engine.soundDelays = [180, null];
    // La primera reproducción de la página es la «en frío».
    store.input({ type: 'press', control: 'play', at: 100 });
    await new Promise((resolve) => setTimeout(resolve));
    // Con el transporte en marcha, el toque pausa: no mide.
    await transport(engine, 'playing');
    store.input({ type: 'press', control: 'play', at: 200 });
    await new Promise((resolve) => setTimeout(resolve));
    await transport(engine, 'stopped');
    store.input({ type: 'press', control: 'play', at: 300 });
    await new Promise((resolve) => setTimeout(resolve));
    expect(engine.sent()).toContainEqual({ type: 'pause' });
    expect(engine.calls.filter((call) => call[0] === 'measureFirstSound')).toEqual([
      ['measureFirstSound', 100],
      ['measureFirstSound', 300],
    ]);
    expect(store.firstSounds()).toEqual([
      { ms: 180, cold: true },
      { ms: null, cold: false },
    ]);
    expect(store.diagnostics()).toEqual({ contextState: 'running' });
  });

  it('diagnóstico: si la primera reproducción fue sin el panel, ninguna medida sale «en frío»', async () => {
    const { store, engine } = await setup();
    // Sin el panel, no se mide.
    store.input({ type: 'press', control: 'play', at: 100 });
    await new Promise((resolve) => setTimeout(resolve));
    expect(engine.calls.some((call) => call[0] === 'measureFirstSound')).toBe(false);
    // El panel llega después (va en un @defer): el motor, el worker y ALFAR ya están listos.
    store.enableDiagnostics();
    engine.soundDelays = [9.5];
    store.input({ type: 'press', control: 'play', at: 200 });
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.firstSounds()).toEqual([{ ms: 9.5, cold: false }]);
  });

  it('el momento de una pulsación: el del evento, salvo que no sea del reloj de performance.now()', async () => {
    const { store, engine } = await setup();
    store.enableDiagnostics();
    // jsdom y algunos navegadores antiguos dan en `event.timeStamp` la fecha: se usa el de ahora.
    const date = Date.now();
    store.input({ type: 'press', control: 'play', at: date });
    await new Promise((resolve) => setTimeout(resolve));
    const [, at] = engine.calls.find((call) => call[0] === 'measureFirstSound') ?? [];
    expect(at).toBeLessThan(date / 2);
    expect(at).toBeLessThanOrEqual(performance.now());
  });

  it('cada pulsación lleva su momento (para el tempo por pulsaciones)', async () => {
    const { store, engine } = await setup();
    // BUCLE → MARCAR TEMPO y dos pulsaciones a 500 ms: 120 BPM.
    store.input({ type: 'press', control: 'main' });
    store.input({ type: 'turn', control: 'main', steps: 1 });
    store.input({ type: 'press', control: 'main' });
    store.input({ type: 'turn', control: 'main', steps: 5 });
    store.input({ type: 'press', control: 'main', at: 1000 });
    store.input({ type: 'press', control: 'main', at: 1500 });
    expect(engine.sent()).toContainEqual({ type: 'set-tempo', bpm: 120 });
    // Sin `at`, el store pone el del reloj.
    store.input({ type: 'press', control: 'main' });
    const last = store.state().taps.at(-1);
    expect(Number.isFinite(last)).toBe(true);
    expect(last).not.toBe(1500);
  });

  it('traduce las intenciones del modelo a llamadas del motor', async () => {
    const { store, engine } = await setup();
    // La primera reproducción (ALFAR en la capa 1, reproducir y la capa 2 elegida) ya está hecha.
    store.input({ type: 'press', control: 'play' });
    await new Promise((resolve) => setTimeout(resolve));
    store.input({ type: 'turn', control: 'layer-1', steps: -30 });
    store.input({ type: 'hold', control: 'layer-1' });
    store.input({ type: 'press', control: 'play' });
    store.input({ type: 'press', control: 'record' });
    expect(engine.sent()).toEqual([
      { type: 'play' },
      { type: 'set-level', layer: 1, level: 0.7 },
      { type: 'set-mute', layer: 1, muted: true },
      { type: 'play' },
    ]);
    expect(engine.calls).toContainEqual([
      'record',
      { type: 'record', layer: 1, bars: 0, countIn: true, fitTempo: true },
    ]);
    // Cada edición pide un autoguardado (con sus ajustes; el motor pone el antirrebote).
    expect(engine.calls.filter((call) => call[0] === 'scheduleAutosave')).toHaveLength(2);
  });

  it('el estado del audio llega a los signals como mucho 10 veces por segundo', async () => {
    vi.useFakeTimers();
    const { store, engine } = await setup();
    let publications = 0;
    let last = store.audio();
    for (let i = 0; i < 30; i++) {
      engine.emit({ type: 'status', status: status({ transport: 'playing', beat: i / 10 }) });
      vi.advanceTimersByTime(1000 / 30);
      if (store.audio() !== last) {
        publications++;
        last = store.audio();
      }
    }
    expect(publications).toBeGreaterThanOrEqual(9);
    expect(publications).toBeLessThanOrEqual(10);
    expect(store.audio().transport).toBe('playing');
    expect(STATUS_INTERVAL_MS).toBe(100);
  });

  it('los avisos del núcleo y del motor se convierten en textos', async () => {
    vi.useFakeTimers();
    const { store, engine } = await setup();
    engine.emit({
      type: 'status',
      status: status({}, [notice({ code: 'rejected', command: 'record', reason: 'too-long' })]),
    });
    expect(store.message()).toMatchObject({ screen: 'TOMA DEMASIADO LARGA', tone: 'error' });
    engine.emit({ type: 'problem', code: 'mic-denied' });
    expect(store.message()?.text).toContain('no deja usar el micrófono');
    expect(store.display().status).toBe('SIN PERMISO DEL MICRÓFONO');
    vi.advanceTimersByTime(3000);
    expect(store.message()).toBeNull();
    engine.emit({ type: 'status', status: status({}, [notice({ code: 'locked' })]) });
    expect(store.message()?.screen).toBe('BLOQUEADO EN LA TOMA');
  });

  it('los controles vuelven a lo que dice el audio, salvo los que se acaban de mover', async () => {
    vi.useFakeTimers();
    const { store, engine } = await setup();
    // Una sesión cargada trae otros niveles y otro tempo: los controles los adoptan.
    engine.emit({
      type: 'status',
      status: status({ bpm: 120, layers: [layer({ level: 0.5 }), layer(), layer(), layer()] }),
    });
    vi.advanceTimersByTime(STATUS_INTERVAL_MS);
    expect(store.state().controls.layers[0]?.level).toBe(0.5);
    expect(store.state().controls.bpm).toBe(120);
    // Mientras se mueve un dial, un estado viejo no lo pisa.
    store.input({ type: 'set', control: 'layer-0', value: 80 });
    engine.emit({
      type: 'status',
      status: status({ bpm: 120, layers: [layer({ level: 0.5 }), layer(), layer(), layer()] }),
    });
    vi.advanceTimersByTime(STATUS_INTERVAL_MS);
    expect(store.state().controls.layers[0]?.level).toBe(0.8);
  });

  it('calibrar guarda la latencia medida y la anuncia', async () => {
    vi.useFakeTimers();
    const { store, engine } = await setup();
    engine.latency = { mode: 'auto', ms: 0 };
    store.input({ type: 'press', control: 'main' });
    for (const steps of [2, 0, 1, 0, 1, 0]) {
      if (steps) store.input({ type: 'turn', control: 'main', steps });
      else store.input({ type: 'press', control: 'main' });
    }
    expect(engine.calls).toContainEqual(['calibrate']);
    await vi.waitFor(() => expect(store.message()?.screen).toBe('LATENCIA 23,5 MS'));
  });

  it('una calibración cancelada a propósito (reposo) no avisa de ningún error', async () => {
    const { store, engine } = await setup();
    engine.calibrated = null;
    store.input({ type: 'press', control: 'main' });
    for (const steps of [2, 0, 1, 0, 1, 0]) {
      if (steps) store.input({ type: 'turn', control: 'main', steps });
      else store.input({ type: 'press', control: 'main' });
    }
    expect(engine.calls).toContainEqual(['calibrate']);
    await vi.waitFor(() => expect(store.busy()).toBe('idle'));
    expect(store.message()?.screen).toBe('CALIBRANDO');
    expect(store.state().settings.latency).toEqual({ mode: 'auto', ms: 0 });
  });

  it('abrir un archivo dice «cargada» solo si el motor la ha cargado, y avisa si algo falla', async () => {
    const { store, engine } = await setup();
    const file = new File([new Uint8Array(8)], 'sesion.torno');
    engine.opened = null;
    await store.openFile(file);
    expect(store.message()).toBeNull();
    engine.opened = 'throw';
    await store.openFile(file);
    expect(store.message()).toMatchObject({ screen: 'NO SE HA PODIDO CARGAR', tone: 'error' });
    expect(store.busy()).toBe('idle');
    expect(engine.calls.some((call) => call[0] === 'scheduleAutosave')).toBe(false);
    engine.opened = { takeBars: 4, countIn: true, metronome: false, fitTempo: true, inputGain: 1 };
    await store.openFile(file);
    expect(store.message()?.screen).toBe('SESIÓN CARGADA');
    expect(store.state().settings.takeBars).toBe(4);
    // Cargada, se autoguarda (si se recarga, se ofrece la sesión cargada, no la de antes).
    expect(engine.calls.filter((call) => call[0] === 'scheduleAutosave').at(-1)?.[1]).toMatchObject(
      { takeBars: 4 },
    );
  });

  it('autoguardado: ofrece recuperar y, al empezar de cero, lo borra', async () => {
    const { store, autosave } = await setup();
    await store.checkAutosave();
    expect(store.recovery()).toEqual({ main: 1_700_000_000_000, pending: null });
    await store.discardAutosave();
    expect(store.recovery()).toBeNull();
    expect(autosave.calls).toEqual([['delete', 'both']]);
  });

  it('con el panel sin contestar, lo nuevo va al segundo hueco y la sesión anterior no se toca', async () => {
    const { store, engine } = await setup();
    const lastSlot = () =>
      engine.calls.filter((call) => call[0] === 'scheduleAutosave').at(-1)?.[2];
    store.input({ type: 'turn', control: 'layer-0', steps: -5 });
    expect(lastSlot()).toBe('main');
    await store.checkAutosave();
    store.input({ type: 'turn', control: 'layer-0', steps: -5 });
    expect(lastSlot()).toBe('pending');
  });

  it('si hay sonido en la sesión actual, «Recuperar» pide confirmación y queda un solo hueco', async () => {
    const { store, engine, autosave } = await setup();
    await store.checkAutosave();
    engine.recovered = {
      takeBars: 1,
      countIn: true,
      metronome: false,
      fitTempo: true,
      inputGain: 1,
    };
    engine.emit(withContent());
    await store.recover();
    expect(store.confirmRecover()).toBe('main');
    expect(engine.calls.some((call) => call[0] === 'recoverAutosave')).toBe(false);
    // «Cancelar» vuelve al panel sin cambiar nada.
    store.cancelRecover();
    expect(store.confirmRecover()).toBeNull();
    expect(store.recovery()).not.toBeNull();
    // Confirmado (segunda pulsación): recupera la anterior y borra el hueco nuevo.
    await store.recover();
    await store.recover();
    expect(engine.calls).toContainEqual(['recoverAutosave', 'main']);
    expect(engine.calls.map((call) => call[0])).toContain('cancelAutosave');
    expect(autosave.calls).toEqual([['delete', 'pending']]);
    expect(store.recovery()).toBeNull();
    expect(store.confirmRecover()).toBeNull();
  });

  it('tras recargar sin contestar se ofrecen las dos; recuperar la nueva la pasa al hueco principal', async () => {
    const { store, engine, autosave } = await setup();
    autosave.dates = { main: 1_700_000_000_000, pending: 1_700_000_600_000 };
    await store.checkAutosave();
    expect(store.recovery()).toEqual({ main: 1_700_000_000_000, pending: 1_700_000_600_000 });
    engine.recovered = {
      takeBars: 2,
      countIn: true,
      metronome: false,
      fitTempo: true,
      inputGain: 1,
    };
    // Sin sonido en la sesión actual: no hace falta confirmar.
    await store.recover('pending');
    expect(engine.calls).toContainEqual(['recoverAutosave', 'pending']);
    expect(autosave.calls).toEqual([['promote']]);
    expect(store.recovery()).toBeNull();
    expect(store.state().settings.takeBars).toBe(2);
  });

  it('con la confirmación de «Recuperar» abierta no se autoguarda nada; al cancelarla, sí', async () => {
    const { store, engine } = await setup();
    const scheduled = () => engine.calls.filter((call) => call[0] === 'scheduleAutosave');
    await store.checkAutosave();
    engine.emit(withContent());
    store.input({ type: 'turn', control: 'layer-0', steps: -5 });
    expect(scheduled().at(-1)?.[2]).toBe('pending');
    // «Recuperar» con sonido: pide confirmación y anula el autoguardado que esperaba (si llegara
    // mientras se confirma, pisaría el hueco que se va a recuperar).
    await store.recover();
    expect(store.confirmRecover()).toBe('main');
    expect(engine.calls.at(-1)?.[0]).toBe('cancelAutosave');
    const before = scheduled().length;
    store.input({ type: 'turn', control: 'layer-0', steps: -5 });
    expect(scheduled()).toHaveLength(before);
    // «Cancelar»: lo tocado se autoguarda, en el hueco nuevo.
    store.cancelRecover();
    expect(scheduled()).toHaveLength(before + 1);
    expect(scheduled().at(-1)?.[2]).toBe('pending');
  });

  it('con los dos huecos ofrecidos, lo nuevo espera a que se conteste: no pisa «lo que tocaste después»', async () => {
    const { store, engine, autosave } = await setup();
    autosave.dates = { main: 1_700_000_000_000, pending: 1_700_000_600_000 };
    await store.checkAutosave();
    engine.emit(withContent());
    store.input({ type: 'turn', control: 'layer-0', steps: -5 });
    expect(engine.calls.some((call) => call[0] === 'scheduleAutosave')).toBe(false);
    // Se contesta («Empezar de cero»): lo tocado pasa a ser la sesión autoguardada.
    await store.discardAutosave();
    expect(engine.calls.filter((call) => call[0] === 'autosaveNow').at(-1)?.[2]).toBe('main');
    store.input({ type: 'turn', control: 'layer-0', steps: -5 });
    expect(engine.calls.filter((call) => call[0] === 'scheduleAutosave').at(-1)?.[2]).toBe('main');
  });

  it('«Empezar de cero» con sonido en la sesión actual la deja como la única autoguardada', async () => {
    const { store, engine, autosave } = await setup();
    await store.checkAutosave();
    engine.emit(withContent());
    await store.discardAutosave();
    expect(engine.calls.filter((call) => call[0] === 'autosaveNow').at(-1)?.[2]).toBe('main');
    expect(autosave.calls).toEqual([['delete', 'pending']]);
    // Las ediciones siguientes ya van al hueco principal.
    store.input({ type: 'turn', control: 'layer-0', steps: -5 });
    expect(engine.calls.filter((call) => call[0] === 'scheduleAutosave').at(-1)?.[2]).toBe('main');
  });

  it('si solo quedó el hueco nuevo, pasa a ser la sesión anterior', async () => {
    const { store, autosave } = await setup();
    autosave.dates = { main: null, pending: 1_700_000_600_000 };
    await store.checkAutosave();
    expect(autosave.calls).toEqual([['promote']]);
    expect(store.recovery()).toEqual({ main: 1_700_000_600_000, pending: null });
  });

  it('recuperar tras un error del audio lo reintenta y suelta el panel solo al cargar', async () => {
    const { store, engine } = await setup();
    await store.checkAutosave();
    engine.state = 'error';
    engine.recovered = {
      takeBars: 2,
      countIn: false,
      metronome: true,
      fitTempo: false,
      inputGain: 1,
    };
    await store.recover();
    expect(engine.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['retry', 'recoverAutosave']),
    );
    expect(store.recovery()).toBeNull();
    expect(store.message()?.screen).toBe('SESIÓN RECUPERADA');
    expect(store.state().settings.takeBars).toBe(2);
    expect(store.busy()).toBe('idle');
  });

  it('si el audio no puede arrancar, recuperar avisa al momento y el panel sigue', async () => {
    const { store, engine } = await setup();
    await store.checkAutosave();
    engine.state = 'error';
    engine.retryable = false;
    // Sin la espera de 10 s: el error no se puede reintentar.
    await store.recover();
    expect(engine.calls.some((call) => call[0] === 'recoverAutosave')).toBe(false);
    expect(store.recovery()).toEqual({ main: 1_700_000_000_000, pending: null });
    expect(store.message()).toMatchObject({ screen: 'AÚN NO SE PUEDE RECUPERAR', tone: 'error' });
    expect(store.busy()).toBe('idle');
  });

  it('el resumen en voz se emite con antirrebote y en frases', async () => {
    vi.useFakeTimers();
    const { store } = await setup();
    store.input({ type: 'press', control: 'layer-1' });
    store.input({ type: 'press', control: 'layer-2' });
    expect(store.announcement()).toBe('');
    vi.advanceTimersByTime(700);
    expect(store.announcement()).toBe('90 bpm, pausa. Capa 3, vacía. Toma libre.');
  });

  it('girar un dial no se anuncia (lo lee el propio control) y el resumen no lee símbolos', async () => {
    vi.useFakeTimers();
    const { store, engine } = await setup();
    // El arranque del motor se anuncia; después, los giros ya no.
    vi.advanceTimersByTime(700);
    expect(store.announcement()).toBe('90 bpm, pausa. Capa 1, vacía. Toma libre.');
    store.input({ type: 'turn', control: 'main', steps: 5 });
    store.input({ type: 'turn', control: 'layer-0', steps: -2 });
    vi.advanceTimersByTime(700);
    expect(store.announcement()).toBe('90 bpm, pausa. Capa 1, vacía. Toma libre.');
    const drums = layer({
      hasContent: true,
      sourceKind: 'library',
      sourceId: 'alfar',
      lengthBeats: 8,
    });
    engine.emit({ type: 'status', status: status({ layers: [drums, layer(), layer(), layer()] }) });
    vi.advanceTimersByTime(STATUS_INTERVAL_MS);
    // En el menú: sin la flecha de los submenús, y el sonido de la capa dicho con palabras.
    store.input({ type: 'press', control: 'main' });
    vi.advanceTimersByTime(700);
    expect(store.announcement()).toBe('Menú. Sonido. Toma libre.');
    store.input({ type: 'press', control: 'main' });
    store.input({ type: 'press', control: 'main' });
    vi.advanceTimersByTime(700);
    expect(store.announcement()).toBe('Batería. Alfar: en uso. Toma libre.');
  });

  it('preparar: carga el motor y renderiza ALFAR en silencio, una vez y sin arrancar el audio', async () => {
    const engine = new FakeEngine();
    const autosave = new FakeAutosave();
    let loads = 0;
    let fail = true;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AUDIO_ENGINE_API,
          useValue: {
            load: async () => {
              loads++;
              if (fail) throw new Error('sin red');
              return engine as unknown as AudioEngine;
            },
            ...autosave.api,
          },
        },
      ],
    });
    const store = TestBed.inject(SessionStore);
    // Si la carga falla (la red), el siguiente acercamiento lo intenta otra vez.
    store.preload();
    await new Promise((resolve) => setTimeout(resolve));
    fail = false;
    store.preload();
    store.preload();
    await new Promise((resolve) => setTimeout(resolve));
    store.preload();
    expect(loads).toBe(2);
    expect(engine.calls).toEqual([['prepare', ['alfar']]]);
  });

  it('pausar justo después de arrancar pausa: la entrada lee el último estado del audio', async () => {
    vi.useFakeTimers();
    const { store, engine } = await setup();
    engine.emit(withContent());
    vi.advanceTimersByTime(STATUS_INTERVAL_MS);
    store.input({ type: 'press', control: 'play' });
    expect(engine.sent().at(-1)).toEqual({ type: 'play' });
    // El audio ya dice «en marcha», pero los signals aún no lo saben (llega antes de 100 ms).
    const playing = status({
      transport: 'playing',
      layers: [layer({ hasContent: true }), layer(), layer(), layer()],
    });
    engine.emit({ type: 'status', status: playing });
    store.input({ type: 'press', control: 'play' });
    expect(engine.sent().at(-1)).toEqual({ type: 'pause' });
  });
});
