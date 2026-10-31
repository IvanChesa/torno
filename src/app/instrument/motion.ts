/**
 * Lo que se mueve con el audio en cada fotograma (PLAN §4.6 y fase 6, «Sincronía»): el disco a una
 * vuelta por compás, el nivel de cada capa, por dónde va cada una y el destello del piloto de grabar
 * en la cuenta previa. Lo calcula a partir del último estado del audio (llega como mucho 30 veces
 * por segundo) y del momento en que suena por el altavoz (`AudioEngine.heardAt`, del reloj del
 * contexto: no depende de cuándo llegó el mensaje). Entre dos estados, el pulso avanza con el tempo,
 * y con cada estado nuevo se vuelve a anclar en el del núcleo. Un solo reloj, el de muestras del
 * worklet: esto solo lo lee (CLAUDE.md, «Hilo de audio»).
 *
 * Sin DOM ni audio: se prueba en Node.
 */
import { BEATS_PER_TURN, LAYER_COUNT } from './constants';

/** Lo que se usa del estado del audio (`CoreStatus`, sin depender de `audio/`). */
export interface MotionStatus {
  readonly beat: number;
  readonly bpm: number;
  readonly transport: string;
  readonly recording: string;
  readonly layers: readonly {
    readonly hasContent: boolean;
    readonly lengthBeats: number;
    readonly positionBeats: number;
    readonly rms: number;
    readonly discHeld: boolean;
  }[];
}

/** Lo que se mueve en un fotograma (la forma de `SceneMotion`, sin depender de `scene/`). */
export interface MotionFrame {
  /** El giro del disco, en vueltas. */
  readonly disc: number;
  /** El nivel de cada capa, de 0 a 1 (escala en dB: −48 dBFS abajo, 0 arriba). */
  readonly levels: readonly number[];
  /** Por dónde va cada capa en su bucle, de 0 a 1 (negativo: vacía). */
  readonly heads: readonly number[];
  /** El destello del piloto de grabar con cada pulso de la cuenta previa, de 0 a 1. */
  readonly recordFlash: number;
}

/** La escala de los medidores: −48 dBFS abajo, 0 dBFS arriba (la del plato HTML). */
export const METER_FLOOR_DB = -48;
/** Lo que baja un medidor por segundo (sube al momento): se lee sin parpadeos. */
export const METER_RELEASE_PER_S = 1.6;
/** Un retroceso de más de esto no es un retraso del estado: es un salto del transporte. */
const JUMP_BEATS = 0.25;
/** Lo que dura el destello del piloto de grabar, en fracción de pulso. */
const FLASH_BEATS = 0.25;

/** Un RMS (escala ±1) en la escala de los medidores. */
export function meterLevel(rms: number): number {
  if (!(rms > 0)) return 0;
  return Math.min(1, Math.max(0, 1 + (20 * Math.log10(rms)) / -METER_FLOOR_DB));
}

export class InstrumentMotion {
  #status: MotionStatus | null = null;
  /** Cuándo suena el estado (reloj de `performance.now()`); puede ser dentro de unos ms. */
  #at = 0;
  #shownBeat = 0;
  #levels = new Array<number>(LAYER_COUNT).fill(0);
  #lastTime = -1;
  /** El disco agarrado: dónde estaba al agarrarlo (vueltas). */
  #heldBase: number | null = null;
  #disc = 0;

  /** El último estado del audio, que suena por el altavoz en `at`. */
  update(status: MotionStatus, at: number): void {
    if (status === this.#status) return;
    this.#status = status;
    this.#at = at;
  }

  /**
   * El pulso que suena en `time` (reloj de `performance.now()`), sin retroceder por retrasos. Antes
   * de `at` (lo que aún no ha salido por el altavoz), un poco antes del pulso del estado.
   */
  beat(time: number): number {
    const status = this.#status;
    if (!status) return 0;
    const playing = status.transport === 'playing';
    const target = playing ? status.beat + ((time - this.#at) * status.bpm) / 60_000 : status.beat;
    const back = this.#shownBeat - target;
    // Un estado que llega un poco tarde dejaría el disco atrás: se queda donde está hasta que el
    // tempo lo alcanza. Un salto (parar, cargar una sesión) sí se ve.
    if (playing && back > 0 && back < JUMP_BEATS) return this.#shownBeat;
    this.#shownBeat = target;
    return target;
  }

  /**
   * El movimiento de un fotograma. `held`: las vueltas que lleva el disco agarrado (desde que se
   * agarró) o `null`.
   */
  frame(time: number, held: number | null): MotionFrame {
    const status = this.#status;
    const beat = this.beat(time);
    const dt = this.#lastTime < 0 ? 0 : Math.max(0, (time - this.#lastTime) / 1000);
    this.#lastTime = time;
    // El disco: con el transporte, una vuelta por compás; agarrado, donde lo lleva la mano.
    if (held === null) {
      this.#heldBase = null;
      this.#disc = beat / BEATS_PER_TURN;
    } else {
      this.#heldBase ??= this.#disc;
      this.#disc = this.#heldBase + held;
    }
    const playing = status?.transport === 'playing';
    const levels = this.#levels.map((shown, i) => {
      const target = playing ? meterLevel(status?.layers[i]?.rms ?? 0) : 0;
      return Math.max(target, shown - METER_RELEASE_PER_S * dt);
    });
    this.#levels = levels;
    const advance = status && playing ? beat - status.beat : 0;
    const heads = Array.from({ length: LAYER_COUNT }, (_, i) => {
      const layer = status?.layers[i];
      if (!layer?.hasContent || !(layer.lengthBeats > 0)) return -1;
      // La capa del disco agarrado no avanza con el transporte.
      const position = layer.positionBeats + (layer.discHeld ? 0 : advance);
      const wrapped = position % layer.lengthBeats;
      return (wrapped < 0 ? wrapped + layer.lengthBeats : wrapped) / layer.lengthBeats;
    });
    const countIn = status?.recording === 'count-in';
    const phase = beat - Math.floor(beat);
    const recordFlash = countIn && phase < FLASH_BEATS ? 1 - phase / FLASH_BEATS : 0;
    return { disc: this.#disc, levels, heads, recordFlash };
  }

  /**
   * Quieto: los medidores a cero y los cabezales donde se quedaron; el disco, donde está (o donde lo
   * lleva la mano, si está agarrado: eso no es movimiento automático).
   */
  rest(time: number, held: number | null = null): MotionFrame {
    const moving = this.frame(time, held);
    this.#levels.fill(0);
    return { ...moving, levels: this.#levels.slice(), recordFlash: 0 };
  }
}
