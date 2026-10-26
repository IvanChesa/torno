import type { Download, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * Instrumentación del audio en la página para los e2e (no es código de la aplicación):
 * - anota cada `new AudioContext()` y cada `resume()` con el evento que se está despachando
 *   (`window.event`): así se demuestra que ocurren dentro del gesto;
 * - envuelve `AudioWorklet.addModule` para contar las cargas y retrasarlas (Playwright no deja
 *   retrasar ni ver esa descarga);
 * - conecta a un `AnalyserNode` todo lo que va a la salida, para medir lo que suena;
 * - guarda los `MediaStream` de `getUserMedia` (para comprobar que sus pistas acaban `ended`) y,
 *   si se pide, sustituye el micrófono por un **bucle de retorno**: la salida del propio contexto,
 *   retrasada 20 ms con un `DelayNode`, entra como si fuera el micrófono. Así se sabe cuándo suena
 *   cada ataque y la latencia es siempre la misma. (Un retorno por `MediaStream` no vale de
 *   referencia: en Chromium su latencia cambia en cada apertura, entre 12 y 21 ms medidos.)
 * - avisa de cuándo está registrada la escucha nativa del desbloqueo.
 *
 * Chromium deja sonar un contexto creado sin gesto, así que «está en running» no demuestra nada:
 * por eso se anota el evento. Límite: el código que sigue a un `await` sobre una promesa ya resuelta
 * corre todavía dentro del despacho y no se distinguiría.
 */

export interface AudioLog {
  contexts: AudioContext[];
  modules: string[];
  /** «new:<evento>» y «resume:<evento>», con el evento en curso o «ninguno». */
  calls: string[];
  streams: MediaStream[];
  analysers: AnalyserNode[];
  unlockReady: boolean;
  /** El tipo de cada mensaje enviado por un `MessagePort` (los comandos al worklet). */
  commands: string[];
  /** Los avisos del núcleo que llegan del worklet (en sus estados agrupados). */
  notices: { code: string; layer: number; value: number }[];
  /** La muestra del transporte del último estado del worklet. */
  frame: number;
  /** Esa muestra cuando se envió cada `set-sound` (el último estado llega con ≤ 33 ms de retraso). */
  setSoundFrames: number[];
}

declare global {
  interface Window {
    __torno?: AudioLog;
  }
}

export interface InstrumentOptions {
  /** Retraso de `audioWorklet.addModule`, en ms. */
  readonly moduleDelayMs?: number;
  /** El retraso solo en la primera carga (para probar «Reintentar»). */
  readonly moduleDelayOnce?: boolean;
  /** `getUserMedia` falla como si se hubiera denegado el permiso. */
  readonly micDenied?: boolean;
  /** El micrófono es la salida del propio contexto, retrasada 20 ms (bucle de retorno). */
  readonly loopback?: boolean;
  /**
   * Como en un sistema que no toma `pointerup` como gesto (iOS, por ejemplo): el contexto nace
   * suspendido y un `resume()` pedido en `pointerup` se queda pendiente para siempre.
   */
  readonly pointerupIsNotAGesture?: boolean;
}

export async function instrumentAudio(page: Page, options: InstrumentOptions = {}): Promise<void> {
  await page.addInitScript(
    ({
      moduleDelayMs = 0,
      moduleDelayOnce = false,
      loopback = false,
      micDenied = false,
      pointerupIsNotAGesture = false,
    }) => {
      const log: AudioLog = {
        contexts: [],
        modules: [],
        calls: [],
        streams: [],
        analysers: [],
        unlockReady: false,
        commands: [],
        notices: [],
        frame: 0,
        setSoundFrames: [],
      };
      window.__torno = log;
      const currentEvent = () => window.event?.type ?? 'ninguno';

      const addListener = Document.prototype.addEventListener;
      Document.prototype.addEventListener = function (
        this: Document,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) {
        const capture = options === true || (typeof options === 'object' && options.capture);
        if (type === 'pointerup' && capture) log.unlockReady = true;
        return addListener.call(this, type, listener, options);
      } as typeof Document.prototype.addEventListener;

      const taps = new WeakMap<BaseAudioContext, { analyser: AnalyserNode; back: GainNode }>();
      const Native = window.AudioContext;
      const resume = Native.prototype.resume;
      Native.prototype.resume = function (this: AudioContext) {
        const event = currentEvent();
        log.calls.push(`resume:${event}`);
        // Pendiente para siempre: no se resuelve ni se rechaza.
        if (pointerupIsNotAGesture && event === 'pointerup')
          return new Promise<void>(() => undefined);
        return resume.call(this);
      };
      window.AudioContext = class extends Native {
        constructor(contextOptions?: AudioContextOptions) {
          super(contextOptions);
          log.contexts.push(this);
          log.calls.push(`new:${currentEvent()}`);
          const analyser = new AnalyserNode(this, { fftSize: 2048 });
          log.analysers.push(analyser);
          taps.set(this, { analyser, back: new GainNode(this) });
          if (pointerupIsNotAGesture) void Native.prototype.suspend.call(this);
        }
      };

      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
        const result = (connect as (...a: unknown[]) => unknown).apply(this, args);
        if (args[0] instanceof AudioDestinationNode) {
          const tap = taps.get(this.context);
          if (tap) {
            (connect as (...a: unknown[]) => unknown).call(this, tap.analyser);
            (connect as (...a: unknown[]) => unknown).call(this, tap.back);
          }
        }
        return result;
      } as typeof AudioNode.prototype.connect;

      const post = MessagePort.prototype.postMessage;
      MessagePort.prototype.postMessage = function (this: MessagePort, ...args: unknown[]) {
        const message = args[0] as { type?: unknown } | null;
        if (message && typeof message.type === 'string') log.commands.push(message.type);
        if (message?.type === 'set-sound') log.setSoundFrames.push(log.frame);
        return (post as (...a: unknown[]) => void).apply(this, args);
      } as typeof MessagePort.prototype.postMessage;

      // Los avisos del núcleo: una escucha más en el puerto del nodo del worklet (el motor pone la
      // suya con `onmessage`, que arranca el puerto).
      const NativeWorkletNode = window.AudioWorkletNode;
      window.AudioWorkletNode = class extends NativeWorkletNode {
        constructor(
          context: BaseAudioContext,
          name: string,
          nodeOptions?: AudioWorkletNodeOptions,
        ) {
          super(context, name, nodeOptions);
          this.port.addEventListener('message', (event: MessageEvent) => {
            const data = event.data as {
              type?: string;
              frame?: number;
              noticeCount?: number;
              notices?: { code: string; layer: number; value: number }[];
            };
            if (data?.type !== 'status' || !data.notices) return;
            log.frame = data.frame ?? log.frame;
            for (let i = 0; i < (data.noticeCount ?? 0); i++) {
              const { code, layer, value } = data.notices[i]!;
              log.notices.push({ code, layer, value });
            }
          });
        }
      };

      const addModule = AudioWorklet.prototype.addModule;
      AudioWorklet.prototype.addModule = async function (url, moduleOptions) {
        log.modules.push(String(url));
        const delayed = moduleDelayMs > 0 && (!moduleDelayOnce || log.modules.length === 1);
        if (delayed) await new Promise((resolve) => setTimeout(resolve, moduleDelayMs));
        return addModule.call(this, url, moduleOptions);
      };

      if (loopback) {
        // El nodo del micrófono es un retraso de 20 ms de la salida (un ciclo con un DelayNode).
        window.MediaStreamAudioSourceNode = function (context: AudioContext) {
          const delay = new DelayNode(context, { delayTime: 0.02, maxDelayTime: 1 });
          taps.get(context)?.back.connect(delay);
          return delay;
        } as unknown as typeof MediaStreamAudioSourceNode;
      }
      const media = navigator.mediaDevices;
      if (media) {
        const getUserMedia = media.getUserMedia.bind(media);
        media.getUserMedia = async (constraints?: MediaStreamConstraints) => {
          if (micDenied) throw new DOMException('Permiso denegado', 'NotAllowedError');
          const context = log.contexts[0];
          // Con el bucle de retorno, la pista es de mentira (solo sirve para pararla).
          const stream =
            loopback && context
              ? context.createMediaStreamDestination().stream
              : await getUserMedia(constraints);
          log.streams.push(stream);
          return stream;
        };
      }
    },
    options,
  );
}

export const contextStates = (page: Page) =>
  page.evaluate(() => (window.__torno?.contexts ?? []).map((context) => context.state));
export const audioCalls = (page: Page) => page.evaluate(() => window.__torno?.calls ?? []);
export const loadedModules = (page: Page) => page.evaluate(() => window.__torno?.modules ?? []);
export const workletCommands = (page: Page) => page.evaluate(() => window.__torno?.commands ?? []);
export const coreNotices = (page: Page, code: string) =>
  page.evaluate((wanted) => (window.__torno?.notices ?? []).filter((n) => n.code === wanted), code);
export const streamCount = (page: Page) => page.evaluate(() => window.__torno?.streams.length ?? 0);
/** ¿Todas las pistas de micrófono que se han abierto están paradas? */
export const tracksEnded = (page: Page) =>
  page.evaluate(() =>
    (window.__torno?.streams ?? [])
      .flatMap((stream) => stream.getTracks())
      .every((track) => track.readyState === 'ended'),
  );

/** Pico de la salida durante `ms` (lo que suena de verdad, tras el limitador y el volumen). */
export function outputPeak(page: Page, ms = 600): Promise<number> {
  return page.evaluate(async (duration) => {
    const analyser = window.__torno?.analysers[0];
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize);
    let peak = 0;
    const end = performance.now() + duration;
    while (performance.now() < end) {
      analyser.getFloatTimeDomainData(data);
      for (const x of data) peak = Math.max(peak, Math.abs(x));
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    return peak;
  }, ms);
}

/** El contenido de una descarga. */
export async function downloadBytes(download: Download): Promise<Uint8Array> {
  const file = await download.path();
  return new Uint8Array(await readFile(file));
}
