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
 *   si se pide, sustituye el micrófono por un **bucle de retorno**: la salida del propio contexto
 *   por un `MediaStreamAudioDestinationNode`, para saber cuándo suena cada ataque;
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
  /** El micrófono es la salida del propio contexto (bucle de retorno). */
  readonly loopback?: boolean;
}

export async function instrumentAudio(page: Page, options: InstrumentOptions = {}): Promise<void> {
  await page.addInitScript(({ moduleDelayMs = 0, loopback = false }) => {
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

    const taps = new WeakMap<
      BaseAudioContext,
      { analyser: AnalyserNode; back: MediaStreamAudioDestinationNode | null }
    >();
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
        taps.set(this, { analyser, back: loopback ? this.createMediaStreamDestination() : null });
      }
    };

    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      const result = (connect as (...a: unknown[]) => unknown).apply(this, args);
      if (args[0] instanceof AudioDestinationNode) {
        const tap = taps.get(this.context);
        if (tap) {
          (connect as (...a: unknown[]) => unknown).call(this, tap.analyser);
          if (tap.back) (connect as (...a: unknown[]) => unknown).call(this, tap.back);
        }
      }
      return result;
    } as typeof AudioNode.prototype.connect;

    const addModule = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = async function (url, moduleOptions) {
      log.modules.push(String(url));
      if (moduleDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, moduleDelayMs));
      return addModule.call(this, url, moduleOptions);
    };

    const media = navigator.mediaDevices;
    if (media) {
      const getUserMedia = media.getUserMedia.bind(media);
      media.getUserMedia = async (constraints?: MediaStreamConstraints) => {
        let stream: MediaStream;
        const back = log.contexts[0] ? taps.get(log.contexts[0])?.back : null;
        if (loopback && back) {
          stream = new MediaStream(back.stream.getAudioTracks().map((track) => track.clone()));
        } else {
          stream = await getUserMedia(constraints);
        }
        log.streams.push(stream);
        return stream;
      };
    }
  }, options);
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
