/**
 * Desbloqueo del audio (PLAN §4.9). Va en el bundle inicial y tiene que ser diminuto (< 2 kB).
 *
 * Es una escucha **nativa** en fase de captura sobre el documento, registrada en `main.ts` antes de
 * arrancar Angular: así actúa en el gesto real aunque la página aún no esté hidratada (con la
 * repetición de eventos, un toque anterior a la hidratación llega a Angular después, fuera del
 * gesto). Reacciona al primer `click`, `pointerup`, `touchend` o `keydown` sobre un elemento marcado
 * con `data-audio-unlock` (el instrumento y los botones «Tocar») y, en ese gesto y antes de
 * cualquier `await`:
 * 1. pone `navigator.audioSession.type` (`playback`; en iOS, suena con el interruptor de silencio);
 * 2. crea y reanuda el `AudioContext` (o reanuda el que hay, tras una interrupción);
 * 3. reproduce un búfer silencioso de una muestra, que es lo que Safari en iOS necesita.
 *
 * El `AudioEngine`, que se carga después con `import()`, adopta este mismo contexto: nunca crea uno.
 */

type AudioSessionType = 'playback' | 'play-and-record';

interface AudioSessionNavigator {
  readonly audioSession?: { type: string };
}

const SELECTOR = '[data-audio-unlock]';
/** Teclas que no son un gesto de tocar el instrumento (navegar, salir, modificadores). */
const IGNORED_KEYS = new Set(['Tab', 'Escape', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);
const GESTURES = ['click', 'pointerup', 'touchend', 'keydown'] as const;

let context: AudioContext | undefined;
/** En reposo, los gestos no reanudan el contexto: solo lo hace «salir del reposo». */
let held = false;
let sessionType: AudioSessionType = 'playback';
/** Un mismo toque da `pointerup` y `click`: con una reanudación en marcha, no se pide otra. */
let resuming: Promise<void> | undefined;
const listeners = new Set<() => void>();

/** Registra la escucha del desbloqueo (una vez, al arrancar). */
export function installAudioUnlock(target: Document): void {
  for (const type of GESTURES) target.addEventListener(type, onGesture, { capture: true });
}

function onGesture(event: Event): void {
  if (event.type === 'keydown' && IGNORED_KEYS.has((event as KeyboardEvent).key)) return;
  const element = event.target;
  if (held || !(element instanceof Element) || !element.closest(SELECTOR)) return;
  unlockAudio();
}

/**
 * Crea o reanuda el contexto y lo desbloquea. Solo tiene efecto dentro de un gesto del usuario; la
 * escucha lo llama sola, y «salir del reposo» lo llama desde su propio gesto.
 */
export function unlockAudio(): void {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) session.type = sessionType;
  if (context?.state === 'running' || resuming) return;
  if (!context || context.state === 'closed') {
    if (typeof AudioContext === 'undefined') return;
    // Sin `sampleRate`: la del dispositivo (PLAN D22); si no, el navegador remuestrea.
    context = new AudioContext({ latencyHint: 'interactive' });
  }
  // Sin `await`: la promesa se resuelve después, pero la petición sale dentro del gesto.
  resuming = context
    .resume()
    .catch(() => undefined)
    .finally(() => (resuming = undefined));
  const source = context.createBufferSource();
  source.buffer = context.createBuffer(1, 1, context.sampleRate);
  source.connect(context.destination);
  source.start();
  for (const listener of listeners) listener();
}

/** El contexto desbloqueado, si lo hay (para el motor; no forma parte de la API pública). */
export function unlockedContext(): AudioContext | undefined {
  return context;
}

/** Avisa cada vez que un gesto desbloquea o reanuda el audio. Devuelve la baja. */
export function onAudioUnlock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reposo: mientras dura, los gestos sobre el instrumento no reanudan el contexto. */
export function holdAudioUnlock(value: boolean): void {
  held = value;
}

/**
 * Tipo de sesión de audio que se pide en cada gesto y ahora mismo: `playback` al escuchar,
 * `play-and-record` al grabar (PLAN §4.3).
 */
export function setAudioSessionType(type: AudioSessionType): void {
  sessionType = type;
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) session.type = type;
}
