import { computed, Directive, ElementRef, inject, input, type OnDestroy } from '@angular/core';
import {
  control,
  controlValue,
  gesture,
  HOLD_MS,
  IDLE,
  keyDown,
  keyUp,
  PX_PER_STEP,
  type ControlId,
  type GestureOutput,
  type GestureState,
  type KeyAction,
  type KeyInput,
} from '../../instrument';
import { SessionStore } from '../../state';

/** El `click` que llega tras soltar el puntero, como mucho este tiempo después. */
const CLICK_AFTER_POINTER_MS = 600;

/**
 * Un control del instrumento (PLAN §4.7, D10): el mismo elemento recibe el puntero, el táctil, el
 * teclado y el lector de pantalla. En las teclas (`button` nativo), pulsar es su `click` (también
 * con Intro, Espacio o el clic virtual de un lector) y mantener sale del puntero o de Mayús+Intro.
 * En los diales, el disco, el brazo y la rueda (`role="slider"`), los gestos van por la máquina de
 * `instrument/gestures` y el teclado por `instrument/keyboard`.
 */
@Directive({
  selector: '[trnControl]',
  host: {
    '[attr.role]': 'isButton() ? null : "slider"',
    '[attr.tabindex]': 'isButton() ? null : 0',
    '[attr.aria-label]': 'spec().name',
    '[attr.aria-valuemin]': 'value()?.min',
    '[attr.aria-valuemax]': 'value()?.max',
    '[attr.aria-valuenow]': 'value()?.now',
    '[attr.aria-valuetext]': 'value()?.text',
    '[attr.aria-pressed]': 'pressed()',
    '[attr.data-control]': 'trnControl()',
    '[style.--value]': 'fraction()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerCancel()',
    '(lostpointercapture)': 'onPointerCancel()',
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeyDown($event)',
    '(keyup)': 'onKeyUp($event)',
  },
})
export class ControlDirective implements OnDestroy {
  readonly trnControl = input.required<ControlId>();

  private readonly store = inject(SessionStore);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly spec = computed(() => control(this.trnControl()));
  protected readonly isButton = computed(() => this.spec().role === 'button');
  protected readonly value = computed(() =>
    controlValue(this.trnControl(), this.store.state(), this.store.audio()),
  );
  /** Posición del valor entre 0 y 1 (para dibujar la aguja del dial). */
  protected readonly fraction = computed(() => {
    const value = this.value();
    return value && value.max > value.min ? (value.now - value.min) / (value.max - value.min) : 0;
  });
  protected readonly pressed = computed(() => {
    const audio = this.store.audio();
    if (this.trnControl() === 'play') return audio.transport === 'playing';
    if (this.trnControl() === 'record') return audio.recording !== 'idle';
    if (this.trnControl() === 'standby') return audio.standby;
    return null;
  });

  private gestureState: GestureState = IDLE;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  /** Hasta cuándo el `click` que sigue a un gesto de puntero ya está atendido. */
  private suppressClickUntil = 0;
  private remainder = 0;
  /** Disco: ángulo del puntero y vueltas desde que se agarró. */
  private angle = 0;
  private turns = 0;

  ngOnDestroy(): void {
    clearTimeout(this.holdTimer);
    if (this.gestureState.phase === 'grabbed') this.store.input({ type: 'drop' });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.element.nativeElement.setPointerCapture?.(event.pointerId);
    const spec = this.spec();
    this.remainder = 0;
    this.feed({ type: 'down', time: event.timeStamp, x: event.clientX, y: event.clientY });
    if (spec.kind === 'disc') {
      this.angle = this.angleOf(event);
      this.turns = 0;
    } else if (spec.gestures.includes('hold')) {
      clearTimeout(this.holdTimer);
      const start = event.timeStamp;
      this.holdTimer = setTimeout(
        () => this.feed({ type: 'tick', time: start + HOLD_MS }),
        HOLD_MS,
      );
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.gestureState.phase === 'idle') return;
    if (this.spec().kind === 'disc' && this.gestureState.phase === 'grabbed') {
      // El disco sigue al ángulo del puntero alrededor de su centro: una vuelta, un compás.
      const angle = this.angleOf(event);
      let delta = angle - this.angle;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      this.angle = angle;
      this.turns += delta / (2 * Math.PI);
      this.store.input({ type: 'drag', turns: this.turns });
      return;
    }
    this.feed({ type: 'move', time: event.timeStamp, x: event.clientX, y: event.clientY });
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.gestureState.phase === 'idle') return;
    clearTimeout(this.holdTimer);
    const outputs = this.feed({ type: 'up', time: event.timeStamp });
    // En los botones, una pulsación es su `click`, que llega justo después; lo demás (mantener,
    // arrastrar, los diales) ya está atendido y ese `click` se ignora.
    const buttonPress = this.isButton() && outputs.some((output) => output.type === 'press');
    this.suppressClickUntil = buttonPress ? 0 : event.timeStamp + CLICK_AFTER_POINTER_MS;
  }

  protected onPointerCancel(): void {
    if (this.gestureState.phase === 'idle') return;
    clearTimeout(this.holdTimer);
    this.feed({ type: 'cancel' });
  }

  protected onClick(event: MouseEvent): void {
    // Un clic sin gesto de puntero: Intro o Espacio en un botón, o el clic de un lector de pantalla.
    if (event.timeStamp < this.suppressClickUntil) {
      this.suppressClickUntil = 0;
      return;
    }
    if (this.spec().gestures.includes('press')) {
      this.store.input({ type: 'press', control: this.trnControl() });
    }
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const menu = this.store.state().menu;
    const listNavigation = this.trnControl() === 'main' && menu.open && !menu.edit && !menu.confirm;
    const action = keyDown(this.spec(), keyInput(event), listNavigation);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    this.run(action);
  }

  protected onKeyUp(event: KeyboardEvent): void {
    const action = keyUp(this.spec(), keyInput(event));
    if (!action) return;
    event.preventDefault();
    this.run(action);
  }

  private run(action: KeyAction): void {
    const id = this.trnControl();
    const spec = this.spec();
    switch (action.type) {
      case 'press':
      case 'hold':
        this.store.input({ type: action.type, control: id });
        return;
      case 'step':
        this.store.input({ type: 'turn', control: id, steps: action.steps });
        return;
      case 'min':
      case 'max':
        this.store.input({
          type: 'set',
          control: id,
          value: action.type === 'min' ? spec.min : spec.max,
        });
        return;
      case 'escape':
        this.store.input({ type: 'escape' });
        return;
      case 'grab':
      case 'drop':
        this.store.input({ type: action.type });
        return;
      case 'none':
        return;
    }
  }

  private feed(input: Parameters<typeof gesture>[1]): readonly GestureOutput[] {
    const spec = this.spec();
    const step = gesture(this.gestureState, input, {
      grab: spec.kind === 'disc',
      hold: spec.gestures.includes('hold'),
    });
    this.gestureState = step.state;
    for (const output of step.outputs) this.handle(output);
    return step.outputs;
  }

  private handle(output: GestureOutput): void {
    const id = this.trnControl();
    switch (output.type) {
      case 'press':
        // En los botones, pulsar es su `click` (que llega justo después).
        if (!this.isButton()) this.store.input({ type: 'press', control: id });
        return;
      case 'hold':
        this.store.input({ type: 'hold', control: id });
        return;
      case 'turn': {
        // Arrastrar hacia arriba o hacia la derecha sube el valor.
        this.remainder += (output.dx - output.dy) / PX_PER_STEP;
        const steps = Math.trunc(this.remainder);
        if (steps !== 0) {
          this.remainder -= steps;
          this.store.input({ type: 'turn', control: id, steps });
        }
        return;
      }
      case 'grab':
        this.store.input({ type: 'grab' });
        return;
      case 'drop':
        this.store.input({ type: 'drop' });
        return;
      default:
        return;
    }
  }

  private angleOf(event: PointerEvent): number {
    const box = this.element.nativeElement.getBoundingClientRect();
    return Math.atan2(
      event.clientY - (box.top + box.height / 2),
      event.clientX - (box.left + box.width / 2),
    );
  }
}

function keyInput(event: KeyboardEvent): KeyInput {
  return {
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    repeat: event.repeat,
  };
}
