/**
 * WAV PCM de 24 bits (PLAN §4.8): la mezcla en estéreo y las pistas en mono. `WavWriter` escribe
 * por tramos en el búfer del archivo (sin guardar además el render entero) y `readWav` lo lee para
 * los tests y para comprobar lo que se exporta.
 */

const HEADER_BYTES = 44;
const FULL_SCALE = 8_388_607; // 2²³ − 1

export class WavWriter {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly #channels: number;
  #at = HEADER_BYTES;

  constructor(channels: number, sampleRate: number, frames: number) {
    if (!Number.isInteger(channels) || channels < 1 || channels > 8) {
      throw new RangeError(`Canales no válidos: ${channels}`);
    }
    if (!Number.isInteger(frames) || frames < 0 || frames * channels * 3 > 0xffff_ffff - 36) {
      throw new RangeError(`Muestras no válidas: ${frames}`);
    }
    this.#channels = channels;
    const dataBytes = frames * channels * 3;
    this.bytes = new Uint8Array(HEADER_BYTES + dataBytes);
    const view = new DataView(this.bytes.buffer);
    ascii(this.bytes, 0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    ascii(this.bytes, 8, 'WAVE');
    ascii(this.bytes, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 3, true);
    view.setUint16(32, channels * 3, true);
    view.setUint16(34, 24, true);
    ascii(this.bytes, 36, 'data');
    view.setUint32(40, dataBytes, true);
  }

  /** Escribe `frames` muestras de cada canal (desde `offset`), entrelazadas y en 24 bits. */
  write(channels: readonly Float32Array[], frames: number, offset = 0): void {
    const bytes = this.bytes;
    let at = this.#at;
    if (at + frames * this.#channels * 3 > bytes.length)
      throw new RangeError('El WAV ya está lleno');
    for (let i = offset; i < offset + frames; i++) {
      for (let c = 0; c < this.#channels; c++) {
        const x = channels[c]![i]!;
        const clamped = x > 1 ? 1 : x < -1 ? -1 : x === x ? x : 0;
        const value = Math.round(clamped * FULL_SCALE);
        bytes[at] = value & 0xff;
        bytes[at + 1] = (value >> 8) & 0xff;
        bytes[at + 2] = (value >> 16) & 0xff;
        at += 3;
      }
    }
    this.#at = at;
  }

  /** ¿Se han escrito todas las muestras? */
  get complete(): boolean {
    return this.#at === this.bytes.length;
  }
}

/** Un WAV de 24 bits con estos canales (todos de la misma longitud). */
export function encodeWav(
  channels: readonly Float32Array[],
  sampleRate: number,
): Uint8Array<ArrayBuffer> {
  const frames = channels[0]?.length ?? 0;
  const writer = new WavWriter(channels.length, sampleRate, frames);
  writer.write(channels, frames);
  return writer.bytes;
}

/** Cabecera de un WAV en coma flotante: `fmt ` de 18 bytes y `fact`, como pide el formato. */
const FLOAT_HEADER_BYTES = 58;

/**
 * Un WAV mono en coma flotante de 32 bits con `pcm` repetido `times` veces, tal cual (sin recortar).
 * Sirve para remuestrear con `decodeAudioData` del navegador: no se exporta.
 */
export function encodeFloatWav(pcm: Float32Array, sampleRate: number, times = 1): ArrayBuffer {
  const frames = pcm.length * times;
  const buffer = new ArrayBuffer(FLOAT_HEADER_BYTES + frames * 4);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  ascii(bytes, 0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  ascii(bytes, 8, 'WAVE');
  ascii(bytes, 12, 'fmt ');
  view.setUint32(16, 18, true);
  view.setUint16(20, 3, true); // IEEE float
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 32, true);
  view.setUint16(36, 0, true);
  ascii(bytes, 38, 'fact');
  view.setUint32(42, 4, true);
  view.setUint32(46, frames, true);
  ascii(bytes, 50, 'data');
  view.setUint32(54, frames * 4, true);
  let at = FLOAT_HEADER_BYTES;
  for (let t = 0; t < times; t++) {
    for (let i = 0; i < pcm.length; i++, at += 4) view.setFloat32(at, pcm[i]!, true);
  }
  return buffer;
}

export interface DecodedWav {
  readonly sampleRate: number;
  readonly bitsPerSample: number;
  readonly channels: readonly Float32Array[];
}

/** Lee un WAV PCM de 16 o 24 bits (o `null` si no lo es). */
export function readWav(input: ArrayBuffer | Uint8Array): DecodedWav | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < HEADER_BYTES || text(bytes, 0) !== 'RIFF' || text(bytes, 8) !== 'WAVE') {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 12;
  let format: { channels: number; sampleRate: number; bits: number } | null = null;
  while (at + 8 <= bytes.length) {
    const id = text(bytes, at);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ' && size >= 16) {
      if (view.getUint16(body, true) !== 1) return null;
      format = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === 'data' && format) {
      const { channels, sampleRate, bits } = format;
      if (channels < 1 || (bits !== 16 && bits !== 24) || body + size > bytes.length) return null;
      const width = bits / 8;
      const frames = Math.floor(size / (channels * width));
      const out = Array.from({ length: channels }, () => new Float32Array(frames));
      let p = body;
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++, p += width) {
          out[c]![i] =
            bits === 16
              ? view.getInt16(p, true) / 32767
              : (((bytes[p]! | (bytes[p + 1]! << 8) | (bytes[p + 2]! << 16)) << 8) >> 8) /
                FULL_SCALE;
        }
      }
      return { sampleRate, bitsPerSample: bits, channels: out };
    }
    at = body + size + (size & 1);
  }
  return null;
}

function ascii(bytes: Uint8Array, at: number, value: string): void {
  for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i);
}

function text(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
}
