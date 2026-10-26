/**
 * Autoguardado local (PLAN §4.8, D16): la última sesión, como un `.torno`, en IndexedDB de este
 * navegador. Nunca sale del dispositivo. Todo va con `try/catch`: sin IndexedDB (modo privado,
 * navegador antiguo) el autoguardado simplemente no está, y la cuota llena se avisa.
 *
 * La fecha va en su propia clave: saber si hay algo que recuperar no lee el archivo entero.
 */

const DATABASE = 'torno';
const STORE = 'autoguardado';
const BYTES_KEY = 'sesion';
const DATE_KEY = 'fecha';

export interface Autosave {
  /** El `.torno` entero. */
  readonly bytes: ArrayBuffer;
  /** Cuándo se guardó (ms desde 1970). */
  readonly savedAt: number;
}

export type AutosaveResult = 'saved' | 'quota' | 'unavailable';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB'));
    request.onblocked = () => reject(new Error('indexedDB bloqueada'));
  });
}

/** Una transacción sobre el almacén; resuelve con lo que devuelva `action` al completarse. */
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => () => T,
): Promise<T> {
  const database = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(STORE, mode);
      const result = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result());
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB'));
      tx.onabort = () => reject(tx.error ?? new Error('abortada'));
    });
  } finally {
    database.close();
  }
}

export async function saveAutosave(bytes: ArrayBuffer): Promise<AutosaveResult> {
  try {
    await transaction('readwrite', (store) => {
      store.put(bytes, BYTES_KEY);
      store.put(Date.now(), DATE_KEY);
      return () => undefined;
    });
    return 'saved';
  } catch (error) {
    return error instanceof DOMException && error.name === 'QuotaExceededError'
      ? 'quota'
      : 'unavailable';
  }
}

/** Cuándo se autoguardó la sesión que hay, o `null` si no hay ninguna. */
export async function autosaveDate(): Promise<number | null> {
  try {
    const value = await transaction('readonly', (store) => {
      const request = store.get(DATE_KEY);
      return () => request.result as unknown;
    });
    return typeof value === 'number' ? value : null;
  } catch {
    return null;
  }
}

export async function loadAutosave(): Promise<Autosave | null> {
  try {
    const { bytes, savedAt } = await transaction('readonly', (store) => {
      const bytesRequest = store.get(BYTES_KEY);
      const dateRequest = store.get(DATE_KEY);
      return () => ({
        bytes: bytesRequest.result as unknown,
        savedAt: dateRequest.result as unknown,
      });
    });
    return bytes instanceof ArrayBuffer && typeof savedAt === 'number' ? { bytes, savedAt } : null;
  } catch {
    return null;
  }
}

export async function clearAutosave(): Promise<boolean> {
  try {
    await transaction('readwrite', (store) => {
      store.delete(BYTES_KEY);
      store.delete(DATE_KEY);
      return () => undefined;
    });
    return true;
  } catch {
    return false;
  }
}
