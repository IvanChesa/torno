/**
 * Autoguardado local (PLAN §4.8, D16): la última sesión, como un `.torno`, en IndexedDB de este
 * navegador. Nunca sale del dispositivo. Todo va con `try/catch`: sin IndexedDB (modo privado,
 * navegador antiguo) el autoguardado simplemente no está, y la cuota llena se avisa.
 *
 * Dos huecos (decisión de Iván, 26-10): `main` es la sesión de siempre; `pending`, lo que se toca
 * mientras el panel de recuperar sigue sin contestar, para no pisar la sesión anterior. Al
 * contestar, queda solo `main`.
 *
 * La fecha va en su propia clave: saber si hay algo que recuperar no lee el archivo entero.
 */

const DATABASE = 'torno';
const STORE = 'autoguardado';

export type AutosaveSlot = 'main' | 'pending';

const KEYS: Record<AutosaveSlot, { readonly bytes: string; readonly date: string }> = {
  main: { bytes: 'sesion', date: 'fecha' },
  pending: { bytes: 'sesion-nueva', date: 'fecha-nueva' },
};

export interface Autosave {
  /** El `.torno` entero. */
  readonly bytes: ArrayBuffer;
  /** Cuándo se guardó (ms desde 1970). */
  readonly savedAt: number;
}

/** Cuándo se autoguardó cada hueco (ms desde 1970), o `null` si está vacío. */
export interface AutosaveDates {
  readonly main: number | null;
  readonly pending: number | null;
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

export async function saveAutosave(
  bytes: ArrayBuffer,
  slot: AutosaveSlot = 'main',
): Promise<AutosaveResult> {
  try {
    await transaction('readwrite', (store) => {
      store.put(bytes, KEYS[slot].bytes);
      store.put(Date.now(), KEYS[slot].date);
      return () => undefined;
    });
    return 'saved';
  } catch (error) {
    return error instanceof DOMException && error.name === 'QuotaExceededError'
      ? 'quota'
      : 'unavailable';
  }
}

/** Las fechas de los dos huecos (las dos `null` si no hay nada o no hay IndexedDB). */
export async function autosaveDates(): Promise<AutosaveDates> {
  try {
    const { main, pending } = await transaction('readonly', (store) => {
      const mainRequest = store.get(KEYS.main.date);
      const pendingRequest = store.get(KEYS.pending.date);
      return () => ({
        main: mainRequest.result as unknown,
        pending: pendingRequest.result as unknown,
      });
    });
    return {
      main: typeof main === 'number' ? main : null,
      pending: typeof pending === 'number' ? pending : null,
    };
  } catch {
    return { main: null, pending: null };
  }
}

export async function loadAutosave(slot: AutosaveSlot = 'main'): Promise<Autosave | null> {
  try {
    const { bytes, savedAt } = await transaction('readonly', (store) => {
      const bytesRequest = store.get(KEYS[slot].bytes);
      const dateRequest = store.get(KEYS[slot].date);
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

/** Borra un hueco, o los dos si no se dice cuál. */
export async function clearAutosave(slot?: AutosaveSlot): Promise<boolean> {
  try {
    await transaction('readwrite', (store) => {
      for (const key of slot ? [slot] : (['main', 'pending'] as const)) {
        store.delete(KEYS[key].bytes);
        store.delete(KEYS[key].date);
      }
      return () => undefined;
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pasa el hueco `pending` a `main` en una sola transacción (si `pending` está vacío, no cambia
 * nada). Para cuando solo queda el hueco nuevo.
 */
export async function promotePendingAutosave(): Promise<boolean> {
  try {
    await transaction('readwrite', (store) => {
      const bytesRequest = store.get(KEYS.pending.bytes);
      const dateRequest = store.get(KEYS.pending.date);
      dateRequest.onsuccess = () => {
        const bytes = bytesRequest.result as unknown;
        const savedAt = dateRequest.result as unknown;
        if (!(bytes instanceof ArrayBuffer) || typeof savedAt !== 'number') return;
        store.put(bytes, KEYS.main.bytes);
        store.put(savedAt, KEYS.main.date);
        store.delete(KEYS.pending.bytes);
        store.delete(KEYS.pending.date);
      };
      return () => undefined;
    });
    return true;
  } catch {
    return false;
  }
}
