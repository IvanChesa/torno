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
}

export async function instrumentAudio(page: Page, options: InstrumentOptions = {}): Promise<void> {
  await page.addInitScript(
    ({ moduleDelayMs = 0, moduleDelayOnce = false, loopback = false, micDenied = false }) => {
      const log: AudioLog = {
        contexts: [],
        modules: [],
        calls: [],
        streams: [],
        analysers: [],
        unlockReady: false,
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
        log.calls.push(`resume:${currentEvent()}`);
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
