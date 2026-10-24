/**
 * Formato de proyecto `.torno` (PLAN §4.8, D15): la sesión editable, sin pérdidas y versionada.
 *
 *   0   8 B   firma «\x89TORNO\r\n» (como la de PNG: detecta transferencias de 7 bits y cambios de
 *             fin de línea)
 *   8   2 B   versión del formato (u16 LE) = 1
 *   10  2 B   reservado (0)
 *   12  4 B   longitud H de la cabecera (u32 LE), ≤ 64 KiB
 *   16  H B   cabecera JSON en ASCII (lo que no lo es va escapado como `\uXXXX`): tempo, frecuencia,
 *             ajustes y, por capa, muestras, duración, fase, origen y mezcla
 *   …         relleno con ceros hasta un múltiplo de 4
 *   …         PCM float32 LE de cada capa con sonido, en orden
 *
 * Todo lo que llega de fuera se valida **entero** antes de devolver nada: tamaños, límites, tipos,
 * `NaN`/`Infinity` y versión. No se guarda el historial de deshacer.
 */
import {
  LAYER_COUNT,
  MAX_BPM,
  MAX_INPUT_GAIN,
  MAX_LAYER_SECONDS,
  MIN_BPM,
} from '../core/constants';
import type { LayerSource } from '../core/content';
import {
  validateSessionState,
  type LayerState,
  type SessionError,
  type SessionState,
} from '../core/session';

export const TORNO_VERSION = 1;
export const TORNO_EXTENSION = '.torno';
export const TORNO_MIME = 'application/x-torno';
const SIGNATURE = [0x89, 0x54, 0x4f, 0x52, 0x4e, 0x4f, 0x0d, 0x0a];
const PREAMBLE = 16;
export const MAX_HEADER_BYTES = 65_536;
/** Tope de un archivo: 4 capas de 60 s a 384 kHz más la cabecera. */
export const MAX_TORNO_BYTES = PREAMBLE + MAX_HEADER_BYTES + LAYER_COUNT * 60 * 384_000 * 4 + 3;

/** Ajustes del instrumento que viajan con la sesión (los del dispositivo, como la latencia, no). */
export interface TornoSettings {
  /** Duración de la toma: 0 = libre; si no, compases. */
  readonly takeBars: 0 | 1 | 2 | 4;
  readonly countIn: boolean;
  readonly metronome: boolean;
  /** Ajustar el tempo a la primera toma libre. */
  readonly fitTempo: boolean;
  /** Ganancia de entrada, 0–2. */
  readonly inputGain: number;
}

export const DEFAULT_SETTINGS: TornoSettings = {
  takeBars: 0,
  countIn: true,
  metronome: false,
  fitTempo: true,
  inputGain: 1,
};

export interface TornoFile {
  readonly session: SessionState;
  readonly settings: TornoSettings;
}

/** Por qué no vale un archivo. */
export type TornoError =
  | 'too-small'
  | 'too-large'
  | 'signature'
  | 'version'
  | 'header'
  | 'settings'
  | 'size'
  | SessionError;

interface LayerHeader {
  readonly frames: number;
  readonly lengthBeats: number;
  readonly offsetBeats: number;
  readonly source: LayerSource | null;
  readonly level: number;
  readonly muted: boolean;
  readonly pan: number;
  readonly reversed: boolean;
  readonly filter: number;
}

interface Header {
  readonly app: 'torno';
  readonly sampleRate: number;
  readonly bpm: number;
  readonly settings: TornoSettings;
  readonly layers: readonly LayerHeader[];
}

// --- Escribir ---------------------------------------------------------------------------------

/** Serializa una sesión (ya válida) con sus ajustes. */
export function writeTorno(
  session: SessionState,
  settings: TornoSettings,
): Uint8Array<ArrayBuffer> {
  const header: Header = {
    app: 'torno',
    sampleRate: session.sampleRate,
    bpm: session.bpm,
    settings: {
      takeBars: settings.takeBars,
      countIn: settings.countIn,
      metronome: settings.metronome,
      fitTempo: settings.fitTempo,
      inputGain: settings.inputGain,
    },
    layers: session.layers.map((layer) => ({
      frames: layer.pcm?.length ?? 0,
      lengthBeats: layer.pcm ? layer.lengthBeats : 0,
      offsetBeats: layer.pcm ? layer.offsetBeats : 0,
      source: layer.pcm ? layer.source : null,
      level: layer.level,
      muted: layer.muted,
      pan: layer.pan,
      reversed: layer.reversed,
      filter: layer.filter,
    })),
  };
  const json = asciiBytes(JSON.stringify(header));
  const dataStart = align4(PREAMBLE + json.length);
  const samples = session.layers.reduce((sum, layer) => sum + (layer.pcm?.length ?? 0), 0);
  const bytes = new Uint8Array(dataStart + samples * 4);
  const view = new DataView(bytes.buffer);
  bytes.set(SIGNATURE, 0);
  view.setUint16(8, TORNO_VERSION, true);
  view.setUint32(12, json.length, true);
  bytes.set(json, PREAMBLE);
  let at = dataStart;
  for (const layer of session.layers) {
    const pcm = layer.pcm;
    if (!pcm) continue;
    for (let i = 0; i < pcm.length; i++, at += 4) view.setFloat32(at, pcm[i]!, true);
  }
  return bytes;
}

// --- Leer y validar ---------------------------------------------------------------------------

/** Lee y valida un `.torno` entero. Devuelve la sesión y sus ajustes, o el primer error. */
export function readTorno(input: ArrayBuffer | Uint8Array): TornoFile | TornoError {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < PREAMBLE) return 'too-small';
  if (bytes.length > MAX_TORNO_BYTES) return 'too-large';
  for (let i = 0; i < SIGNATURE.length; i++) if (bytes[i] !== SIGNATURE[i]) return 'signature';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(8, true) !== TORNO_VERSION) return 'version';
  if (view.getUint16(10, true) !== 0) return 'header';
  const headerLength = view.getUint32(12, true);
  if (headerLength < 2 || headerLength > MAX_HEADER_BYTES || PREAMBLE + headerLength > bytes.length)
    return 'header';

  let text = '';
  for (let i = PREAMBLE; i < PREAMBLE + headerLength; i++) {
    const byte = bytes[i]!;
    if (byte >= 0x80) return 'header';
    text += String.fromCharCode(byte);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'header';
  }
  const header = checkHeader(parsed);
  if (typeof header === 'string') return header;

  const dataStart = align4(PREAMBLE + headerLength);
  for (let i = PREAMBLE + headerLength; i < dataStart && i < bytes.length; i++) {
    if (bytes[i] !== 0) return 'header';
  }
  const samples = header.layers.reduce((sum, layer) => sum + layer.frames, 0);
  if (dataStart + samples * 4 !== bytes.length) return 'size';

  const layers: LayerState[] = [];
  let at = dataStart;
  for (const layer of header.layers) {
    let pcm: Float32Array | null = null;
    if (layer.frames > 0) {
      pcm = new Float32Array(layer.frames);
      for (let i = 0; i < layer.frames; i++, at += 4) pcm[i] = view.getFloat32(at, true);
    }
    layers.push({
      pcm,
      lengthBeats: layer.lengthBeats,
      offsetBeats: layer.offsetBeats,
      source: layer.source,
      level: layer.level,
      muted: layer.muted,
      pan: layer.pan,
      reversed: layer.reversed,
      filter: layer.filter,
    });
  }
  const session = validateSessionState(
    { sampleRate: header.sampleRate, bpm: header.bpm, layers },
    { checkSamples: true },
  );
  if (typeof session === 'string') return session;
  return { session, settings: header.settings };
}

/** ¿Es un error de `readTorno`? */
export function isTornoError(result: TornoFile | TornoError): result is TornoError {
  return typeof result === 'string';
}

function checkHeader(value: unknown): Header | TornoError {
  if (!isRecord(value) || value['app'] !== 'torno') return 'header';
  const { sampleRate, bpm, settings, layers } = value;
  if (!isInteger(sampleRate, 8000, 384_000)) return 'sample-rate';
  if (!isNumber(bpm, MIN_BPM, MAX_BPM)) return 'bpm';
  if (!isSettings(settings)) return 'settings';
  if (!Array.isArray(layers) || layers.length !== LAYER_COUNT) return 'layer-count';
  const checked: LayerHeader[] = [];
  for (const layer of layers as unknown[]) {
    if (!isRecord(layer)) return 'layer';
    const { frames, lengthBeats, offsetBeats, source, level, muted, pan, reversed, filter } = layer;
    if (!isInteger(frames, 0, MAX_LAYER_SECONDS * sampleRate)) return 'pcm';
    if (!isNumber(lengthBeats, 0, 10_000) || !isNumber(offsetBeats, -1e9, 1e9)) return 'length';
    if (
      !isNumber(level, 0, 1) ||
      typeof muted !== 'boolean' ||
      !isNumber(pan, -1, 1) ||
      typeof reversed !== 'boolean' ||
      !isNumber(filter, 0, 1)
    ) {
      return 'mix';
    }
    if (frames === 0 ? source !== null || lengthBeats !== 0 : !isSource(source)) return 'source';
    checked.push({
      frames,
      lengthBeats,
      offsetBeats,
      source: frames === 0 ? null : cleanSource(source as LayerSource),
      level,
      muted,
      pan,
      reversed,
      filter,
    });
  }
  // Objetos nuevos solo con las claves validadas: lo que sobre en el archivo no llega a nadie.
  const { takeBars, countIn, metronome, fitTempo, inputGain } = settings;
  return {
    app: 'torno',
    sampleRate,
    bpm,
    settings: { takeBars, countIn, metronome, fitTempo, inputGain },
    layers: checked,
  };
}

function isSettings(value: unknown): value is TornoSettings {
  if (!isRecord(value)) return false;
  const { takeBars, countIn, metronome, fitTempo, inputGain } = value;
  return (
    (takeBars === 0 || takeBars === 1 || takeBars === 2 || takeBars === 4) &&
    typeof countIn === 'boolean' &&
    typeof metronome === 'boolean' &&
    typeof fitTempo === 'boolean' &&
    isNumber(inputGain, 0, MAX_INPUT_GAIN)
  );
}

function cleanSource(source: LayerSource): LayerSource {
  return source.kind === 'library' ? { kind: 'library', id: source.id } : { kind: 'recording' };
}

function isSource(value: unknown): value is LayerSource {
  if (!isRecord(value)) return false;
  const { kind, id } = value;
  if (kind === 'recording') return Object.keys(value).length === 1;
  return kind === 'library' && typeof id === 'string' && id.length > 0 && id.length <= 64;
}

/** JSON en ASCII: lo que no lo es se escapa como `\uXXXX` (`JSON.parse` lo devuelve tal cual). */
function asciiBytes(json: string): Uint8Array {
  const ascii = json.replace(
    /[\u0080-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  const bytes = new Uint8Array(ascii.length);
  for (let i = 0; i < ascii.length; i++) bytes[i] = ascii.charCodeAt(i);
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && value >= min && value <= max;
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return isNumber(value, min, max) && Number.isInteger(value);
}

function align4(n: number): number {
  return (n + 3) & ~3;
}
