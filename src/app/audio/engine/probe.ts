/**
 * Sondas de la prueba técnica de la fase 0. Se cargan con `import()`: nunca van en el bundle
 * inicial.
 * - Worklet: carga el módulo con hash, hace sonar un pitido de 0,5 s y mide el pico de la salida.
 * - Worker: renderiza un tono en el worker de síntesis, lo reproduce y mide el pico.
 * Las dos usan el contexto que creó `unlockAudio()` en el gesto.
 */
import { secondsToFrames } from '../core/beep';
import {
  PROCESSOR_NAME,
  PROTOCOL_VERSION,
  isCurrentMessage,
  type RenderToneResponse,
  type SynthWorkerRequest,
  type SynthWorkerResponse,
  type WorkletCommand,
  type WorkletEvent,
} from '../core/protocol';
import { unlockedContext } from './unlock';
import { WORKLET_PATH } from './worklet-url.generated';

const BEEP = { frequency: 440, seconds: 0.5, gain: 0.25 } as const;
const TONE_SECONDS = 1;
const MODULE_TIMEOUT_MS = 5000;
const WORKER_TIMEOUT_MS = 5000;
/** Cada cuánto se lee el `AnalyserNode` (su ventana de 2048 muestras dura ≥ 42 ms a 48 kHz). */
const METER_INTERVAL_MS = 15;

export interface WorkletProbeResult {
  /** Estado del contexto al terminar. */
  readonly contextState: AudioContextState;
  readonly sampleRate: number;
  /** Lo que tardó `audioWorklet.addModule()`, en ms. */
  readonly moduleLoadMs: number;
  /** Duración del pitido según el propio worklet, en muestras. */
  readonly frames: number;
  readonly expectedFrames: number;
  /** Pico medido a la salida, en dBFS. */
  readonly peakDbfs: number;
}

export interface SynthProbeResult {
  readonly sampleRate: number;
  /** Muestras que devolvió el worker. */
  readonly frames: number;
  readonly expectedFrames: number;
  /** Lo que tardó el render dentro del worker, en ms. */
  readonly renderMs: number;
  readonly peakDbfs: number;
}

export async function runWorkletProbe(): Promise<WorkletProbeResult> {
  const context = unlockedContext();
  const moduleLoadMs = await loadWorklet(context);
  const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const analyser = new AnalyserNode(context, { fftSize: 2048 });
  node.connect(analyser).connect(context.destination);
  const send = (command: WorkletCommand) => node.port.postMessage(command);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const ended = new Promise<number>((resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('El worklet no ha terminado el pitido: ¿está el audio en pausa?')),
      (BEEP.seconds + 3) * 1000,
    );
    node.port.onmessage = (event: MessageEvent<unknown>) => {
      if (!isCurrentMessage(event.data)) return;
      const message = event.data as WorkletEvent;
      if (message.type === 'beep-ended') resolve(message.frames);
    };
  });
  send({ v: PROTOCOL_VERSION, type: 'beep', ...BEEP });
  try {
    const { peak, value: frames } = await measurePeak(analyser, ended);
    return {
      contextState: context.state,
      sampleRate: context.sampleRate,
      moduleLoadMs,
      frames,
      expectedFrames: secondsToFrames(BEEP.seconds, context.sampleRate),
      peakDbfs: toDbfs(peak),
    };
  } finally {
    clearTimeout(timer);
    send({ v: PROTOCOL_VERSION, type: 'dispose' });
    node.port.onmessage = null;
    node.disconnect();
    analyser.disconnect();
  }
}

export async function runSynthProbe(): Promise<SynthProbeResult> {
  const context = unlockedContext();
  const { pcm, renderMs } = await renderInWorker({
    v: PROTOCOL_VERSION,
    type: 'render-tone',
    id: 1,
    sampleRate: context.sampleRate,
    seconds: TONE_SECONDS,
  });
  const buffer = context.createBuffer(1, pcm.length, context.sampleRate);
  buffer.copyToChannel(pcm, 0);
  const source = new AudioBufferSourceNode(context, { buffer });
  const analyser = new AnalyserNode(context, { fftSize: 2048 });
  source.connect(analyser).connect(context.destination);
  // Con el contexto suspendido o interrumpido, `ended` no llega nunca: mejor un error que esperar.
  const ended = withTimeout(
    new Promise<void>((resolve) =>
      source.addEventListener('ended', () => resolve(), { once: true }),
    ),
    (TONE_SECONDS + 3) * 1000,
    'El tono no ha terminado de sonar: ¿está el audio en pausa?',
  );
  source.start();
  try {
    const { peak } = await measurePeak(analyser, ended);
    return {
      sampleRate: context.sampleRate,
      frames: pcm.length,
      expectedFrames: secondsToFrames(TONE_SECONDS, context.sampleRate),
      renderMs,
      peakDbfs: toDbfs(peak),
    };
  } finally {
    source.disconnect();
    analyser.disconnect();
  }
}

/** Una carga del módulo por contexto; si falla, el siguiente intento vuelve a cargarlo. */
const modules = new WeakMap<AudioContext, Promise<number>>();

function loadWorklet(context: AudioContext): Promise<number> {
  let loading = modules.get(context);
  if (!loading) {
    const url = new URL(WORKLET_PATH, document.baseURI).href;
    const start = performance.now();
    loading = withTimeout(
      context.audioWorklet.addModule(url),
      MODULE_TIMEOUT_MS,
      'El módulo de audio no ha cargado en 5 s.',
    ).then(() => performance.now() - start);
    loading.catch(() => modules.delete(context));
    modules.set(context, loading);
  }
  return loading;
}

function renderInWorker(request: SynthWorkerRequest): Promise<RenderToneResponse> {
  const worker = new Worker(new URL('../workers/synth.worker', import.meta.url), {
    type: 'module',
    name: 'torno-sintesis',
  });
  const response = new Promise<RenderToneResponse>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isCurrentMessage(event.data)) return;
      const message = event.data as SynthWorkerResponse;
      if (message.id !== request.id) return;
      if (message.type === 'tone') resolve(message);
      else reject(new Error(`El worker de síntesis ha fallado: ${message.message}`));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      reject(new Error(`El worker de síntesis no ha arrancado: ${event.message || 'error'}`));
    };
    worker.postMessage(request);
  });
  return withTimeout(
    response,
    WORKER_TIMEOUT_MS,
    'El worker de síntesis no ha respondido.',
  ).finally(() => worker.terminate());
}

/** Mide el pico de la salida de `analyser` hasta que `done` se cumple. */
async function measurePeak<T>(
  analyser: AnalyserNode,
  done: Promise<T>,
): Promise<{ peak: number; value: T }> {
  const samples = new Float32Array(analyser.fftSize);
  let peak = 0;
  const read = () => {
    analyser.getFloatTimeDomainData(samples);
    for (const sample of samples) {
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
  };
  const meter = setInterval(read, METER_INTERVAL_MS);
  try {
    const value = await done;
    read();
    return { peak, value };
  } finally {
    clearInterval(meter);
  }
}

function toDbfs(peak: number): number {
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
