import { Component, ElementRef, inject, output, viewChildren } from '@angular/core';
import { control, type ControlId, type ControlKind } from '../../instrument';
import type { ControlBox } from '../../scene';
import { ControlDirective, type ScreenAxis } from '../instrument-common/control.directive';
import { controlHintId } from '../instrument-common/instrument-shell';

/** El orden del tabulador: el de siempre (el del plato HTML). */
const ORDER: readonly ControlId[] = [
  'main',
  'layer-0',
  'layer-1',
  'layer-2',
  'layer-3',
  'play',
  'record',
  'undo',
  'disc',
  'arm',
  'volume',
  'standby',
];

/** Hacia arriba o hacia la derecha, sube (lo de siempre, mientras no llega la proyección). */
const DEFAULT_AXIS: ScreenAxis = { x: 1, y: -1 };

interface ZoneItem {
  readonly id: ControlId;
  readonly name: string;
  readonly kind: ControlKind;
  readonly button: boolean;
  readonly hint: string;
  /** El eje del arrastre que da la cámara (el brazo y la rueda); `null`: el de siempre. */
  readonly axis: (() => ScreenAxis) | null;
}

/**
 * La capa de controles del 3D (PLAN §4.7, D10): un elemento nativo por control, encima de su pieza,
 * con la misma directiva que el plato HTML (los mismos gestos, el mismo teclado y los mismos
 * nombres). Las teclas son `button` y lo demás `role="slider"`.
 *
 * Las posiciones las escribe `place()` directamente en el DOM, fuera de los signals, solo cuando
 * cambian la cámara o el tamaño. Cada zona es la cara de su pieza proyectada y nunca menos de
 * 44×44 px; la del disco es una elipse (redonda también para el puntero). Hasta la primera
 * proyección no se ven. Lo que tapa otra pieza en «Inspeccionar» se oculta y deja de recibir el foco.
 *
 * Los controles no dejan desplazar la página (`touch-action: none`); el lienzo de debajo, sí.
 */
@Component({
  selector: 'trn-stage-controls',
  imports: [ControlDirective],
  template: `
    @for (item of items; track item.id) {
      @if (item.button) {
        <button
          #zone
          type="button"
          class="zone zone--{{ item.kind }}"
          [trnControl]="item.id"
          [attr.aria-describedby]="item.hint"
          (focus)="onFocus(item.id, $event)"
          (blur)="onBlur(item.id)"
          (pointerenter)="onEnter(item.id, $event)"
          (pointerleave)="onLeave(item.id)"
        >
          <span class="visually-hidden">{{ item.name }}</span>
        </button>
      } @else {
        <div
          #zone
          class="zone zone--{{ item.kind }}"
          [trnControl]="item.id"
          [trnAxisSource]="item.axis"
          [attr.aria-describedby]="item.hint"
          (focus)="onFocus(item.id, $event)"
          (blur)="onBlur(item.id)"
          (pointerenter)="onEnter(item.id, $event)"
          (pointerleave)="onLeave(item.id)"
        ></div>
      }
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    :host(:not(.is-placed)) .zone {
      visibility: hidden;
    }

    .zone {
      position: absolute;
      inset-inline-start: var(--x, 0);
      inset-block-start: var(--y, 0);
      box-sizing: border-box;
      inline-size: max(var(--target-min), var(--w, 0px));
      block-size: max(var(--target-min), var(--h, 0px));
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      translate: -50% -50%;
      pointer-events: auto;
      touch-action: none;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .zone--dial,
    .zone--disc,
    .zone--button {
      border-radius: 50%;
    }

    .zone--key,
    .zone--wheel,
    .zone--arm {
      border-radius: var(--radius-s);
    }

    .zone--dial,
    .zone--wheel,
    .zone--arm {
      cursor: grab;
    }

    .zone--disc {
      cursor: grab;
    }

    .zone:focus-visible {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }
  `,
})
export class StageControls {
  /** El control enfocado con el teclado o bajo el puntero (el anillo de luz del 3D), o ninguno. */
  readonly highlight = output<ControlId | null>();
  /** El control enfocado ha quedado tapado (en «Inspeccionar»): el foco tiene que ir a otro sitio. */
  readonly focusLost = output<void>();

  protected readonly items: readonly ZoneItem[] = ORDER.map((id) => {
    const spec = control(id);
    const projected = id === 'arm' || id === 'volume';
    return {
      id,
      name: spec.name,
      kind: spec.kind,
      button: spec.role === 'button',
      hint: controlHintId(id),
      axis: projected ? () => this.axes.get(id) ?? DEFAULT_AXIS : null,
    };
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zones = viewChildren<ElementRef<HTMLElement>>('zone');
  private readonly axes = new Map<ControlId, ScreenAxis>();
  private focused: ControlId | null = null;
  private hovered: ControlId | null = null;
  private shown: ControlId | null = null;

  /** Pone cada control encima de su pieza (en píxeles del lienzo). Fuera de los signals. */
  place(boxes: readonly ControlBox[]): void {
    const byId = new Map(boxes.map((box) => [box.id, box]));
    for (const zone of this.zones()) {
      const element = zone.nativeElement;
      const box = byId.get(element.dataset['control'] as ControlId);
      if (!box) continue;
      element.style.setProperty('--x', `${box.x.toFixed(1)}px`);
      element.style.setProperty('--y', `${box.y.toFixed(1)}px`);
      element.style.setProperty('--w', `${box.width.toFixed(1)}px`);
      element.style.setProperty('--h', `${box.height.toFixed(1)}px`);
      const hide = !box.visible;
      if (hide && element.style.visibility !== 'hidden' && element === document.activeElement) {
        this.focusLost.emit();
      }
      element.style.visibility = hide ? 'hidden' : '';
      this.axes.set(box.id, box.axis);
    }
    this.host.nativeElement.classList.toggle('is-placed', boxes.length > 0);
  }

  protected onFocus(id: ControlId, event: FocusEvent): void {
    // El anillo del 3D acompaña al del elemento: solo con el teclado (`:focus-visible`).
    this.focused = (event.target as HTMLElement).matches(':focus-visible') ? id : null;
    this.update();
  }

  protected onBlur(id: ControlId): void {
    if (this.focused === id) this.focused = null;
    this.update();
  }

  protected onEnter(id: ControlId, event: PointerEvent): void {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    this.hovered = id;
    this.update();
  }

  protected onLeave(id: ControlId): void {
    if (this.hovered === id) this.hovered = null;
    this.update();
  }

  private update(): void {
    const next = this.focused ?? this.hovered;
    if (next === this.shown) return;
    this.shown = next;
    this.highlight.emit(next);
  }
}
