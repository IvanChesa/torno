/**
 * ZIP sin compresión («stored»), para entregar las pistas por separado en una sola descarga (varios
 * archivos sueltos harían que el navegador pidiera permiso). Los WAV apenas se comprimen.
 * Sin ZIP64: cada archivo y el total, por debajo de 4 GB.
 */

export interface ZipEntry {
  /** Nombre en ASCII. */
  readonly name: string;
  readonly bytes: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en formato DOS (la de modificación de cada archivo). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function createZip(entries: readonly ZipEntry[], modified: Date): Uint8Array<ArrayBuffer> {
  const stamp = dosDateTime(modified);
  const names = entries.map((entry) => {
    if (!/^[\x20-\x7e]+$/.test(entry.name)) throw new RangeError(`Nombre no válido: ${entry.name}`);
    return Uint8Array.from(entry.name, (char) => char.charCodeAt(0));
  });
  const localSize = entries.reduce(
    (sum, entry, i) => sum + 30 + names[i]!.length + entry.bytes.length,
    0,
  );
  const centralSize = names.reduce((sum, name) => sum + 46 + name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  const offsets: number[] = [];
  const crcs: number[] = [];
  let at = 0;
  entries.forEach((entry, i) => {
    const name = names[i]!;
    const crc = crc32(entry.bytes);
    offsets.push(at);
    crcs.push(crc);
    view.setUint32(at, 0x04034b50, true);
    view.setUint16(at + 4, 10, true);
    view.setUint16(at + 6, 0, true);
    view.setUint16(at + 8, 0, true);
    view.setUint16(at + 10, stamp.time, true);
    view.setUint16(at + 12, stamp.date, true);
    view.setUint32(at + 14, crc, true);
    view.setUint32(at + 18, entry.bytes.length, true);
    view.setUint32(at + 22, entry.bytes.length, true);
    view.setUint16(at + 26, name.length, true);
    view.setUint16(at + 28, 0, true);
    out.set(name, at + 30);
    out.set(entry.bytes, at + 30 + name.length);
    at += 30 + name.length + entry.bytes.length;
  });
  const central = at;
  entries.forEach((entry, i) => {
    const name = names[i]!;
    view.setUint32(at, 0x02014b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, 10, true);
    view.setUint16(at + 8, 0, true);
    view.setUint16(at + 10, 0, true);
    view.setUint16(at + 12, stamp.time, true);
    view.setUint16(at + 14, stamp.date, true);
    view.setUint32(at + 16, crcs[i]!, true);
    view.setUint32(at + 20, entry.bytes.length, true);
    view.setUint32(at + 24, entry.bytes.length, true);
    view.setUint16(at + 28, name.length, true);
    // Comentario, disco, atributos internos y externos: 0.
    view.setUint32(at + 42, offsets[i]!, true);
    out.set(name, at + 46);
    at += 46 + name.length;
  });
  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, at - central, true);
  view.setUint32(at + 16, central, true);
  return out;
}

/** Lee un ZIP sin compresión (para los tests): nombre → contenido, con el CRC comprobado. */
export function readZip(bytes: Uint8Array): Map<string, Uint8Array> | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) return null;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50 || view.getUint16(at + 10, true) !== 0) return null;
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = String.fromCharCode(...bytes.subarray(at + 46, at + 46 + nameLength));
    const data = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const content = bytes.slice(data, data + size);
    if (crc32(content) !== crc) return null;
    files.set(name, content);
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}
