/**
 * Los gestos que dicen que hay alguien delante de la página: cualquiera de ellos pide el 3D. Con el
 * ratón basta moverlo; con el dedo, tocar o desplazar; con el teclado, una tecla.
 */
export const PRESENCE_GESTURES = [
  'pointerdown',
  'pointermove',
  'touchstart',
  'wheel',
  'keydown',
] as const;

/** Sin un gesto, el 3D llega cuando la página lleva este tiempo sin tareas largas desde la carga. */
export const QUIET_MS = 6000;

/**
 * Llama a `wanted` una sola vez (PLAN fase 8, el 3D fuera de la carga): con el primer gesto en la
 * página o cuando, ya cargada, lleva `quietMs` sin una tarea larga (donde el navegador las cuenta:
 * Chromium; en los demás, `quietMs` desde la carga). Así el escenario 3D, que bloquea el hilo
 * principal al llegar, no compite con la carga de la página: quien lee y se desplaza no lo nota, y
 * quien se acerca al instrumento lo tiene en cuanto mueve el ratón o el dedo.
 *
 * Devuelve cómo cancelarlo (al destruir la página).
 */
export function onPresenceOrQuiet(win: Window, wanted: () => void, quietMs = QUIET_MS): () => void {
  let done = false;
  let loaded = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: PerformanceObserver | undefined;

  const cleanup = () => {
    clearTimeout(timer);
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
