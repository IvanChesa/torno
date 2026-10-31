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
  controlLayer,
  LAYER_CONTROLS,
  PLATE,
  type ControlId,
  type PlateLabel,
  type PlateLabelId,
} from '../../instrument';
import { isCaptureMode } from '../../core/capture-mode';
import { MotionPreference } from '../../core/motion';
import { SessionStore } from '../../state';
import { ControlDirective } from '../instrument-common/control.directive';
import { InstrumentScreen } from '../instrument-common/instrument-screen';
import { controlHintId, InstrumentShell } from '../instrument-common/instrument-shell';
import { HTML_INSTRUMENT_CONTENT } from './html-instrument.content';
import { InstrumentTracks } from './instrument-tracks';

/** El rótulo de fuera del plato de cada control. */
function labelText(id: PlateLabelId): string {
  const labels = HTML_INSTRUMENT_CONTENT.labels;
  const layer = controlLayer(id);
  if (layer >= 0) return labels.layer(layer + 1);
  return labels[id as Exclude<PlateLabelId, `layer-${number}`>];
}

/**
 * Instrumento HTML (PLAN §4.7): todos los controles como elementos HTML enfocables, la pantalla, el
 * menú y el teclado. Desde la fase 6 es la alternativa al 3D: con `?sin3d=1` y sin WebGL. También
 * es la base de los e2e del audio. Lo común con el 3D (atajos, avisos, archivos y autoguardado)
 * está en `InstrumentShell`.
 *
 * Desde la fase 5.b es un plato redondo con las mismas posiciones que el aparato en 3D
 * (`instrument/plate.ts`) y la pantalla encima. Los rótulos van alrededor del plato y, en el móvil,
 * en una leyenda debajo.
 *
 * Los medidores y la marca del disco se pintan fuera de los signals, en `requestAnimationFrame`,
 * y solo mientras el transporte está en marcha (0 fotogramas en reposo). Con «Pausar movimiento» o
 * movimiento reducido no se pintan: el disco no gira y los medidores se quedan a cero.
 */
@Component({
  selector: 'trn-html-instrument',
  imports: [ControlDirective, InstrumentScreen, InstrumentShell, InstrumentTracks],
  templateUrl: './html-instrument.html',
  styleUrl: './html-instrument.css',
})
export class HtmlInstrument {
  protected readonly store = inject(SessionStore);
  protected readonly text = HTML_INSTRUMENT_CONTENT;
  protected readonly layers = LAYER_CONTROLS.map((id, layer) => ({
    id: id as `layer-${0 | 1 | 2 | 3}`,
    layer,
    number: layer + 1,
  }));
  protected readonly plate = PLATE;
  protected readonly labels = (Object.entries(PLATE.labels) as [PlateLabelId, PlateLabel][]).map(
    ([id, label]) => ({ id, ...label, text: labelText(id) }),
  );

  private readonly motion = inject(MotionPreference);
  private readonly meters = viewChildren<ElementRef<HTMLElement>>('meter');
  private readonly disc = viewChild.required<ElementRef<HTMLElement>>('disc');

  protected readonly selected = computed(() => this.store.state().selected);
  protected readonly pilots = computed(() => this.store.display().pilots);
  protected readonly playing = computed(() => this.store.audio().transport === 'playing');
  private frame = 0;
  /** Solo se pinta en el navegador, tras el primer render. */
  private rendered = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.rendered = true;
      this.paint();
    });
    // Los medidores y el disco se animan solo con el transporte en marcha o el disco agarrado, y
    // sin la pausa de movimiento (sistema externo: requestAnimationFrame). En reposo, 0 fotogramas.
    effect(() => {
      const running = (this.playing() || this.store.state().discHeld) && !this.motion.still();
      if (!this.rendered) return;
      if (running && !this.frame && !isCaptureMode(location.search)) this.loop();
      if (!running) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.paint();
      }
    });
    destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));
  }

  protected hintId(id: ControlId): string {
    return controlHintId(id);
  }

  private loop(): void {
    this.frame = requestAnimationFrame(() => {
      this.paint();
      this.loop();
    });
  }

  /**
   * Medidores (RMS de cada capa) y marca del disco, directamente en el DOM. Con la pausa de
   * movimiento, los medidores a cero y el disco donde estaba.
   */
  private paint(): void {
    const still = this.motion.still();
    const status = this.store.latestStatus;
    const playing = status?.transport === 'playing' && !still;
    this.meters().forEach((meter, layer) => {
      const rms = playing ? (status?.layers[layer]?.rms ?? 0) : 0;
      // Escala de nivel en dB: −48 dBFS abajo, 0 dBFS arriba.
      const level = rms > 0 ? Math.min(1, Math.max(0, 1 + (20 * Math.log10(rms)) / 48)) : 0;
      meter.nativeElement.style.setProperty('--level', level.toFixed(3));
    });
    if (still || !status) return;
    const state = this.store.state();
    const beat = state.discHeld ? (status.layers[state.selected]?.positionBeats ?? 0) : status.beat;
    this.disc().nativeElement.style.setProperty('--turn', ((beat / BEATS_PER_TURN) % 1).toFixed(4));
  }
}
