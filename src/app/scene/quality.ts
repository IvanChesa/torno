/**
 * Niveles de calidad del 3D (PLAN §4.6 y §5): lo que se pinta por píxel CSS, los segmentos de las
 * piezas torneadas, el tamaño del entorno y de las texturas, y el antialiasing. Lógica pura, sin
 * `three`: se prueba en Node.
 *
 * El nivel inicial sale del dispositivo (el escritorio empieza en alto y el móvil en bajo, como
 * mide §5) y **solo baja**, nunca sube solo: si los FPS no llegan mientras algo se mueve, pasa al
 * siguiente. Subir y bajar en bucle sería peor que quedarse abajo.
 */

export type QualityLevel = 'low' | 'medium' | 'high';

export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

export interface QualitySettings {
  /** Lo más que se pinta por píxel CSS. */
  readonly maxPixelRatio: number;
  /** Segmentos alrededor de las piezas torneadas grandes (cuerpo, disco) y de las pequeñas. */
  readonly roundSegments: number;
  readonly smallSegments: number;
  /** Lado de cada cara del entorno (PMREM). */
  readonly environmentSize: number;
  /** Lado de la textura de la cubierta impresa (rótulos y escalas). */
  readonly printSize: number;
  /** Lado de las texturas en mosaico de la cerámica (grano, rugosidad y poros). */
  readonly grainSize: number;
  /** FPS por debajo de los que se baja de nivel (`0`: no hay nivel más bajo). */
  readonly minFps: number;
}

export const QUALITY: Readonly<Record<QualityLevel, QualitySettings>> = {
  low: {
    maxPixelRatio: 1.25,
    roundSegments: 72,
    smallSegments: 24,
    environmentSize: 64,
    printSize: 1024,
    grainSize: 256,
    minFps: 0,
  },
  medium: {
    maxPixelRatio: 1.5,
    roundSegments: 112,
    smallSegments: 36,
    environmentSize: 128,
    printSize: 1024,
    grainSize: 512,
    minFps: 40,
  },
  high: {
    maxPixelRatio: 2,
    roundSegments: 160,
    smallSegments: 48,
    environmentSize: 256,
    printSize: 2048,
    grainSize: 512,
    minFps: 50,
  },
};

/** Lo que se sabe del dispositivo antes de crear el contexto. */
export interface DeviceHints {
  readonly pixelRatio: number;
  /** Puntero grueso (táctil) como principal: un móvil o una tableta. */
  readonly coarsePointer: boolean;
  /** `navigator.hardwareConcurrency` (0 si no se sabe). */
  readonly cores: number;
  /** `navigator.deviceMemory` en GB (0 si no se sabe). */
  readonly memoryGb: number;
  /** El usuario pide ahorrar datos (`navigator.connection.saveData`). */
  readonly saveData: boolean;
}

/** El nivel con el que se empieza. */
export function initialQuality(device: DeviceHints): QualityLevel {
  if (device.saveData || device.coarsePointer) return 'low';
  const weak =
    (device.cores > 0 && device.cores < 4) || (device.memoryGb > 0 && device.memoryGb < 4);
  return weak ? 'medium' : 'high';
}

/**
 * Píxeles por píxel CSS para un nivel. Con más de 1,5 ya no hace falta el antialiasing (MSAA): los
 * bordes se suavizan solos, y el MSAA multiplicaría la memoria del lienzo.
 */
export function pixelRatioFor(level: QualityLevel, devicePixelRatio: number): number {
  return Math.max(1, Math.min(devicePixelRatio || 1, QUALITY[level].maxPixelRatio));
}

/** MSAA al crear el contexto (no se puede cambiar después): solo si se pinta a menos de 1,5. */
export function antialiasFor(level: QualityLevel, devicePixelRatio: number): boolean {
  return pixelRatioFor(level, devicePixelRatio) < 1.5;
}

/** El nivel de debajo, o `null` si ya es el más bajo. */
export function lowerQuality(level: QualityLevel): QualityLevel | null {
  const index = QUALITY_LEVELS.indexOf(level);
  return index > 0 ? QUALITY_LEVELS[index - 1]! : null;
}

/** Fotogramas seguidos que se miden antes de decidir (unos 2 s a 60 fps). */
export const MONITOR_FRAMES = 120;
/** Un hueco mayor que este no es un fotograma lento: la pestaña estuvo oculta o en pausa. */
const MAX_FRAME_MS = 250;

/**
 * Vigila los FPS mientras el 3D pinta seguido (algo se mueve) y dice cuándo bajar de nivel. Solo
 * cuenta fotogramas consecutivos: entre dos animaciones no hay nada que medir.
 */
export class FrameMonitor {
  #level: QualityLevel;
  #frames = 0;
  #elapsed = 0;
  #last: number | null = null;

  constructor(level: QualityLevel) {
    this.#level = level;
  }

  get level(): QualityLevel {
    return this.#level;
  }

  /** El nivel cambió por otra vía (a mano): se empieza a medir de cero. */
  reset(level: QualityLevel): void {
    this.#level = level;
    this.#frames = 0;
    this.#elapsed = 0;
    this.#last = null;
  }

  /** Se dejó de pintar seguido: el siguiente fotograma no cuenta el hueco. */
  pause(): void {
    this.#last = null;
  }

  /**
   * Un fotograma pintado en `time` (ms). Devuelve el nivel al que hay que bajar, o `null`.
   */
  frame(time: number): QualityLevel | null {
    const last = this.#last;
    this.#last = time;
    if (last === null) return null;
    const delta = time - last;
    if (delta <= 0 || delta > MAX_FRAME_MS) return null;
    this.#frames++;
    this.#elapsed += delta;
    if (this.#frames < MONITOR_FRAMES) return null;
    const fps = (1000 * this.#frames) / this.#elapsed;
    this.#frames = 0;
    this.#elapsed = 0;
    const lower = lowerQuality(this.#level);
    if (!lower || fps >= QUALITY[this.#level].minFps) return null;
    this.reset(lower);
    return lower;
  }
}

// --- Memoria de vídeo estimada (PLAN §5: ≤ 96 MB en alto, ≤ 48 MB en bajo) ------------------------

/** Una textura: su lado, bytes por texel y si lleva mipmaps (un tercio más). */
export interface TextureSize {
  readonly width: number;
  readonly height: number;
  readonly bytesPerTexel: number;
  readonly mipmaps: boolean;
}

export function textureBytes({ width, height, bytesPerTexel, mipmaps }: TextureSize): number {
  const base = width * height * bytesPerTexel;
  return mipmaps ? Math.round((base * 4) / 3) : base;
}

/**
 * El lienzo: el búfer de color que se ve, el de detrás y el de profundidad (24 bits + 8 de
 * plantilla); con MSAA, el color y la profundidad multiplicados por las muestras, más la copia
 * resuelta.
 */
export function drawingBufferBytes(width: number, height: number, samples: number): number {
  const pixels = width * height;
  const color = 4 * pixels;
  if (samples <= 1) return 3 * color;
  return 2 * samples * color + 2 * color;
}
