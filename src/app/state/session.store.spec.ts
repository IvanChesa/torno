import { TestBed } from '@angular/core/testing';
import type {
  AudioEngine,
  CoreStatus,
  EngineEvent,
  EngineState,
  LayerStatus,
  Notice,
  TornoSettings,
} from '../audio/engine';
import { AUDIO_ENGINE_API, SessionStore, STATUS_INTERVAL_MS } from './session.store';

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
  async record(options: unknown): Promise<void> {
    this.#log('record', options);
  }
  cancelRecording(): void {
    this.#log('cancelRecording');
  }
  async setSound(layer: number, id: string | null): Promise<void> {
    this.#log('setSound', layer, id);
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
  scheduleAutosave(settings: unknown): void {
    this.#log('scheduleAutosave', settings);
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
  async recoverAutosave(): Promise<TornoSettings | null> {
    this.#log('recoverAutosave');
    return this.recovered;
  }
  sent(): unknown[] {
    return this.calls.filter((call) => call[0] === 'send').map((call) => call[1]);
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
    ...change,
  };
}

function status(change: Partial<CoreStatus> = {}, notices: Notice[] = []): CoreStatus {
  return {
    v: 3,
    type: 'status',
    frame: 0,
    beat: 0,
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

async function setup(): Promise<{ store: SessionStore; engine: FakeEngine }> {
  const engine = new FakeEngine();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AUDIO_ENGINE_API,
        useValue: {
          load: async () => engine as unknown as AudioEngine,
          autosavedAt: async () => 1_700_000_000_000,
          deleteAutosave: async () => true,
        },
      },
    ],
  });
  const store = TestBed.inject(SessionStore);
  await store.start();
  return { store, engine };
}

describe('SessionStore', () => {
  afterEach(() => vi.useRealTimers());

  it('traduce las intenciones del modelo a llamadas del motor', async () => {
    const { store, engine } = await setup();
    store.input({ type: 'turn', control: 'layer-1', steps: -30 });
    store.input({ type: 'hold', control: 'layer-1' });
    store.input({ type: 'press', control: 'play' });
    store.input({ type: 'press', control: 'record' });
    expect(engine.sent()).toEqual([
      { type: 'set-level', layer: 1, level: 0.7 },
      { type: 'set-mute', layer: 1, muted: true },
      { type: 'play' },
    ]);
    expect(engine.calls).toContainEqual([
      'record',
      { type: 'record', layer: 0, bars: 0, countIn: true, fitTempo: true },
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
    const { store } = await setup();
    await store.checkAutosave();
    expect(store.recovery()).toBe(1_700_000_000_000);
    await store.discardAutosave();
    expect(store.recovery()).toBeNull();
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
    expect(store.recovery()).toBe(1_700_000_000_000);
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
      sourceId: 'prueba-bateria',
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
    expect(store.announcement()).toBe('Batería. Prueba: en uso. Toma libre.');
  });
});
