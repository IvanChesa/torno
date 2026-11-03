/**
 * Los gestos que dicen que hay alguien delante de la página: cualquiera de ellos pide el 3D. Con el
 * ratón basta moverlo; con el dedo, tocar o desplazar; con el teclado, una tecla o pasar el foco.
 * Y `click`: al activar un enlace o un botón, NVDA, JAWS, Narrador o TalkBack mandan un clic sin
 * nada antes (revisión de la fase 8, #2).
 */
export const PRESENCE_GESTURES = [
  'pointerdown',
  'pointermove',
  'mousedown',
  'touchstart',
  'wheel',
  'keydown',
  'focusin',
  'click',
] as const;

/** Sin un gesto, el 3D llega cuando la página lleva este tiempo sin tareas largas desde la carga. */
export const QUIET_MS = 6000;

/**
 * Y, pase lo que pase, a este tiempo desde la carga: con tareas largas cada pocos segundos (un móvil
 * lento, una extensión), la página nunca se queda quieta (revisión de la fase 8, #7).
 */
export const MAX_WAIT_MS = 15_000;

/**
 * Llama a `wanted` una sola vez (PLAN fase 8, el 3D fuera de la carga): con el primer gesto en la
 * página o cuando, ya cargada, lleva `quietMs` sin una tarea larga (donde el navegador las cuenta:
 * Chromium; en los demás, `quietMs` desde la carga). Así el escenario 3D, que bloquea el hilo
 * principal al llegar, no compite con la carga de la página: quien lee y se desplaza no lo nota, y
 * quien se acerca al instrumento lo tiene en cuanto mueve el ratón o el dedo. Como mucho,
 * `maxWaitMs` desde la carga.
 *
 * Devuelve cómo cancelarlo (al destruir la página).
 */
export function onPresenceOrQuiet(
  win: Window,
  wanted: () => void,
  quietMs = QUIET_MS,
  maxWaitMs = MAX_WAIT_MS,
): () => void {
  let done = false;
  let loaded = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let observer: PerformanceObserver | undefined;

  const cleanup = () => {
    clearTimeout(timer);
    clearTimeout(deadline);
    observer?.disconnect();
    for (const type of PRESENCE_GESTURES) win.removeEventListener(type, finish, true);
    win.removeEventListener('load', onLoad);
  };
  function finish() {
    if (done) return;
    done = true;
    cleanup();
    wanted();
  }
  const restart = () => {
    if (!loaded || done) return;
    clearTimeout(timer);
    timer = setTimeout(finish, quietMs);
  };
  function onLoad() {
    loaded = true;
    deadline = setTimeout(finish, maxWaitMs);
    restart();
  }

  for (const type of PRESENCE_GESTURES) {
    win.addEventListener(type, finish, { capture: true, passive: true });
  }
  const Observer = (win as Window & { PerformanceObserver?: typeof PerformanceObserver })
    .PerformanceObserver;
  if (Observer?.supportedEntryTypes?.includes('longtask')) {
    observer = new Observer(restart);
    observer.observe({ type: 'longtask' });
  }
  if (win.document.readyState === 'complete') onLoad();
  else win.addEventListener('load', onLoad, { once: true });
  return cleanup;
}
