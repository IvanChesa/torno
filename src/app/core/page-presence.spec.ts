import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onPresenceOrQuiet, PRESENCE_GESTURES } from './page-presence';

/** Una ventana de mentira: eventos, `readyState` y, si se pide, tareas largas. */
function fakeWindow(readyState: DocumentReadyState, longTasks = false) {
  const target = new EventTarget();
  let notify: (() => void) | undefined;
  class FakeObserver {
    static supportedEntryTypes = longTasks ? ['longtask'] : ['paint'];
    constructor(callback: () => void) {
      notify = callback;
    }
    observe() {}
    disconnect() {
      notify = undefined;
    }
  }
  const win = Object.assign(target, {
    document: { readyState },
    PerformanceObserver: FakeObserver,
  }) as unknown as Window;
  return { win, longTask: () => notify?.() };
}

describe('onPresenceOrQuiet', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('con la página quieta, a los 6 s de la carga', () => {
    const { win } = fakeWindow('loading');
    const wanted = vi.fn();
    onPresenceOrQuiet(win, wanted);
    vi.advanceTimersByTime(10_000);
    expect(wanted).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(5999);
    expect(wanted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(wanted).toHaveBeenCalledOnce();
  });

  it('cada tarea larga tras la carga vuelve a empezar la cuenta', () => {
    const { win, longTask } = fakeWindow('complete', true);
    const wanted = vi.fn();
    onPresenceOrQuiet(win, wanted);
    vi.advanceTimersByTime(5000);
    longTask();
    vi.advanceTimersByTime(5000);
    expect(wanted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(wanted).toHaveBeenCalledOnce();
  });

  it.each(PRESENCE_GESTURES)('con un %s, al momento y una sola vez', (type) => {
    const { win } = fakeWindow('loading');
    const wanted = vi.fn();
    onPresenceOrQuiet(win, wanted);
    win.dispatchEvent(new Event(type));
    win.dispatchEvent(new Event(type));
    win.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(10_000);
    expect(wanted).toHaveBeenCalledOnce();
  });

  it('cancelado, no llama', () => {
    const { win } = fakeWindow('complete');
    const wanted = vi.fn();
    const cancel = onPresenceOrQuiet(win, wanted);
    cancel();
    win.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(10_000);
    expect(wanted).not.toHaveBeenCalled();
  });
});
