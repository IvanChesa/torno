import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  BEATS_PER_TURN,
  CONTROLS,
  control,
  LAYER_CONTROLS,
  shortcutFor,
  type ControlId,
  type ControlSpec,
} from '../../instrument';
import { isCaptureMode } from '../../core/capture-mode';
import { SessionStore } from '../../state';
import { ControlDirective } from './control.directive';
import { HTML_INSTRUMENT_CONTENT } from './html-instrument.content';
import { InstrumentNotices } from './instrument-notices';
import { InstrumentScreen } from './instrument-screen';
import { InstrumentSide } from './instrument-side';

/** Con movimiento reducido, los medidores se repintan como mucho cada 250 ms y el disco no gira. */
const REDUCED_FRAME_MS = 250;

/**
 * Instrumento HTML (PLAN §4.7): todos los controles como elementos HTML enfocables, la pantalla, el
 * menú y el teclado. Es la alternativa sin WebGL (`?sin3d=1`) y la base de los e2e del audio.
 *
 * Los medidores y la marca del disco se pintan fuera de los signals, en `requestAnimationFrame`,
 * y solo mientras el transporte está en marcha (0 fotogramas en reposo).
 */
@Component({
  selector: 'trn-html-instrument',
  imports: [ControlDirective, InstrumentNotices, InstrumentScreen, InstrumentSide],
  templateUrl: './html-instrument.html',
  styleUrl: './html-instrument.css',
  host: {
    '(keydown)': 'onKeydown($event)',
    '(pointerenter)': 'store.preload()',
    '(focusin)': 'store.preload()',
  },
})
export class HtmlInstrument {
  protected readonly store = inject(SessionStore);
  protected readonly text = HTML_INSTRUMENT_CONTENT;
  protected readonly controls = CONTROLS;
  protected readonly layers = LAYER_CONTROLS.map((id, layer) => ({ id, layer, number: layer + 1 }));

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');
  private readonly meters = viewChildren<ElementRef<HTMLElement>>('meter');
  private readonly disc = viewChild.required<ElementRef<HTMLElement>>('disc');

  protected readonly selected = computed(() => this.store.state().selected);
  protected readonly pilots = computed(() => this.store.display().pilots);
  protected readonly playing = computed(() => this.store.audio().transport === 'playing');
  private frame = 0;
  private lastPaint = 0;
  /** Movimiento reducido: la consulta se crea una vez (su `matches` sigue los cambios). */
  private reducedMotion: MediaQueryList | null = null;
  /** Solo se pinta en el navegador, tras el primer render. */
  private rendered = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.rendered = true;
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      this.store.setFilePicker(() => this.fileInput().nativeElement.click());
      void this.store.checkAutosave();
      this.paint(performance.now());
    });
    // Los medidores y el disco se animan solo con el transporte en marcha o el disco agarrado
    // (sistema externo: requestAnimationFrame). En reposo, 0 fotogramas.
    effect(() => {
      const running = this.playing() || this.store.state().discHeld;
      if (!this.rendered) return;
      if (running && !this.frame && !isCaptureMode(location.search)) this.loop();
      if (!running) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.paint(performance.now());
      }
    });
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.frame);
      this.store.setFilePicker(null);
    });
  }

  protected hintId(id: ControlId): string {
    return `trn-pista-${id}`;
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.store.openFile(file);
  }

  /**
   * Atajos con el foco dentro del grupo de controles (las teclas que no ha usado el control). Los
   * botones de los avisos quedan fuera: ahí Espacio e Intro los pulsan, como a cualquier botón.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.instrument')) return;
    const id = target.closest<HTMLElement>('[data-control]')?.dataset['control'] as
      ControlId | undefined;
    const focused: ControlSpec | null = id ? control(id) : null;
    const shortcut = shortcutFor(event, focused);
    if (!shortcut) return;
    event.preventDefault();
    switch (shortcut.type) {
      case 'play':
      case 'record':
      case 'undo':
        this.store.input({ type: 'press', control: shortcut.type });
        return;
      case 'select':
        this.store.input({ type: 'select', layer: shortcut.layer });
        return;
      case 'help':
        this.store.input({ type: 'toggle-help' });
        return;
    }
  }

  private loop(): void {
    this.frame = requestAnimationFrame((time) => {
      this.paint(time);
      this.loop();
    });
  }

  /** Medidores (RMS de cada capa) y marca del disco, directamente en el DOM. */
  private paint(time: number): void {
    const reduced = this.reducedMotion?.matches ?? false;
    if (reduced && time - this.lastPaint < REDUCED_FRAME_MS) return;
    this.lastPaint = time;
    const status = this.store.latestStatus;
    const playing = status?.transport === 'playing';
    this.meters().forEach((meter, layer) => {
      const rms = playing ? (status?.layers[layer]?.rms ?? 0) : 0;
      // Escala de nivel en dB: −48 dBFS abajo, 0 dBFS arriba.
      const level = rms > 0 ? Math.min(1, Math.max(0, 1 + (20 * Math.log10(rms)) / 48)) : 0;
      meter.nativeElement.style.setProperty('--level', level.toFixed(3));
    });
    if (reduced || !status) return;
    const state = this.store.state();
    const beat = state.discHeld ? (status.layers[state.selected]?.positionBeats ?? 0) : status.beat;
    this.disc().nativeElement.style.setProperty('--turn', ((beat / BEATS_PER_TURN) % 1).toFixed(4));
  }
}
