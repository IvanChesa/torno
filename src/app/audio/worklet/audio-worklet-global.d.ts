/**
 * Tipos mínimos de AudioWorkletGlobalScope (https://webaudio.github.io/web-audio-api/#AudioWorkletGlobalScope).
 * TypeScript no trae una `lib` para el worklet y la del DOM describe otro entorno (no hay `window`
 * ni `document`), así que el worklet se compila sin DOM y con estas declaraciones.
 */

interface WorkletMessageEvent {
  readonly data: unknown;
}

interface WorkletMessagePort {
  onmessage: ((event: WorkletMessageEvent) => void) | null;
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
  close(): void;
}

interface WorkletProcessorOptions {
  readonly numberOfInputs?: number;
  readonly numberOfOutputs?: number;
  readonly outputChannelCount?: readonly number[];
  readonly processorOptions?: unknown;
}

declare abstract class AudioWorkletProcessor {
  readonly port: WorkletMessagePort;
  constructor(options?: WorkletProcessorOptions);
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: WorkletProcessorOptions) => AudioWorkletProcessor,
): void;

/** Frecuencia de muestreo del contexto. */
declare const sampleRate: number;
/** Primera muestra del bloque que se está procesando. */
declare const currentFrame: number;
/** Tiempo del contexto, en segundos. */
declare const currentTime: number;
