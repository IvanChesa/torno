/**
 * Micrófono (PLAN §4.3): se pide solo tras la acción de grabar o calibrar, mono y sin cancelación de
 * eco, supresión de ruido ni control de ganancia automáticos (con respaldo si el navegador no los
 * acepta), y se suelta siempre: al terminar o cancelar la toma, en reposo y con la pestaña oculta.
 * Si se suelta mientras la petición está pendiente, la pista se para en cuanto llega.
 *
 * El audio del usuario nunca sale del dispositivo: va del micrófono al worklet y de ahí a la capa.
 */

export type MicrophoneErrorCode =
  /** El usuario o el navegador han denegado el permiso. */
  | 'mic-denied'
  /** No hay ningún micrófono. */
  | 'mic-not-found'
  /** El micrófono está ocupado o el sistema no lo deja abrir. */
  | 'mic-busy'
  /** La página no está en HTTPS (el navegador no ofrece el micrófono). */
  | 'mic-insecure'
  | 'mic-failed';

export class MicrophoneError extends Error {
  constructor(readonly code: MicrophoneErrorCode) {
    super(code);
  }
}

/** Lo que pedimos: la señal tal cual, para grabar instrumentos y voces sin procesar. */
const RAW_AUDIO: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
};

function codeFor(error: unknown): MicrophoneErrorCode {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'mic-denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'mic-not-found';
  if (name === 'NotReadableError' || name === 'AbortError') return 'mic-busy';
  return 'mic-failed';
}

function stopTracks(stream: MediaStream | null): void {
  if (stream) for (const track of stream.getTracks()) track.stop();
}

export class Microphone {
  #stream: MediaStream | null = null;
  #source: MediaStreamAudioSourceNode | null = null;
  /** Cada petición y cada cierre cambian el número: una respuesta vieja se descarta al llegar. */
  #request = 0;
  #pending = false;

  /** Se está esperando el permiso o la pista. */
  get isPending(): boolean {
    return this.#pending;
  }

  /**
   * Pide el micrófono y lo conecta a `input`. Devuelve `false` si se cerró mientras se esperaba (la
   * pista ya se ha parado). Lanza `MicrophoneError` si no se puede abrir.
   */
  async connect(context: AudioContext, input: AudioNode): Promise<boolean> {
    this.close();
    const request = ++this.#request;
    const media = navigator.mediaDevices as MediaDevices | undefined;
    if (!media?.getUserMedia) {
      throw new MicrophoneError(globalThis.isSecureContext ? 'mic-failed' : 'mic-insecure');
    }
    this.#pending = true;
    let stream: MediaStream;
    try {
      stream = await media.getUserMedia(RAW_AUDIO).catch((error: unknown) => {
        // Algún navegador no acepta las restricciones: se pide el micrófono sin más.
        if (codeFor(error) === 'mic-not-found') return media.getUserMedia({ audio: true });
        throw error;
      });
    } catch (error) {
      if (request === this.#request) this.#pending = false;
      throw new MicrophoneError(codeFor(error));
    }
    if (request !== this.#request) {
      stopTracks(stream);
      return false;
    }
    this.#pending = false;
    this.#stream = stream;
    this.#source = new MediaStreamAudioSourceNode(context, { mediaStream: stream });
    this.#source.connect(input);
    return true;
  }

  /** Latencia de entrada que informa la pista, en segundos (0 si no la da). */
  get inputLatency(): number {
    const track = this.#stream?.getAudioTracks()[0];
    const latency = (track?.getSettings() as { latency?: unknown } | undefined)?.latency;
    return typeof latency === 'number' && latency >= 0 && latency < 1 ? latency : 0;
  }

  /** Suelta el micrófono: para las pistas y desconecta. También anula una petición pendiente. */
  close(): void {
    this.#request++;
    this.#pending = false;
    this.#source?.disconnect();
    this.#source = null;
    stopTracks(this.#stream);
    this.#stream = null;
  }
}
