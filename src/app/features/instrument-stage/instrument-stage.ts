import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { isCaptureMode } from '../../core/capture-mode';
import { isHtmlOnlyMode } from '../../core/html-only-mode';
import { instrumentPose, samePose } from '../../instrument';
import {
  createSceneEngine,
  QUALITY_LEVELS,
  VIEWS,
  type QualityLevel,
  type SceneEngine,
  type SceneEvent,
  type View,
} from '../../scene';
import { SessionStore } from '../../state';
import { INSTRUMENT_STAGE_CONTENT } from './instrument-stage.content';
import { StageDev } from './stage-dev';
import { STAGE_POSTER } from './stage-poster';

function pick<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

/**
 * El escenario 3D (PLAN §4.6 y §4.9, fase 5.b): el aparato pintado por `SceneEngine` con la pose
 * de la sesión. Lo carga la portada en `@defer`; mientras llega el primer fotograma se ve el póster
 * (en la misma caja, sin mover nada) y luego se funden. `three` se carga aquí, con `import()`.
 *
 * Hasta la fase 6 (la capa de controles) el 3D solo enseña: se toca con el instrumento HTML de
 * debajo. Con `?sin3d=1` no se monta. Con `?captura=1`, todo fijo y las cifras en
 * `data-estadisticas` (y `?vista=` y `?calidad=` eligen ángulo y nivel). En desarrollo, un panel
 * con los FPS, `renderer.info` y botones para forzar la calidad y perder el contexto.
 */
@Component({
  selector: 'trn-instrument-stage',
  imports: [StageDev],
  host: { '[class.is-hidden]': 'hidden' },
  template: `
    @if (!hidden) {
      <div
        class="stage3d"
        #box
        [attr.data-listo]="shown() ? '' : null"
        [attr.data-contexto]="lost() ? 'perdido' : 'activo'"
        [attr.data-calidad]="quality()"
        [attr.data-estadisticas]="stats()"
      >
        <img
          class="stage3d__poster"
          [class.is-gone]="shown()"
          [src]="poster.src"
          [width]="poster.width"
          [height]="poster.height"
          alt=""
          decoding="async"
        />
        <canvas
          #canvas
          role="img"
          [attr.aria-label]="text.canvas"
          [class.is-shown]="shown()"
        ></canvas>
        @if (failed() || lost()) {
          <p class="stage3d__status" role="status">
            {{ failed() ? text.noWebgl : text.contextLost }}
          </p>
        }
      </div>
      @if (dev) {
        @if (engine(); as engine) {
          <trn-stage-dev [engine]="engine" />
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    :host(.is-hidden) {
      display: none;
    }

    /* La caja del póster y del lienzo: la misma que la del marcador de la portada. */
    .stage3d {
      position: relative;
      aspect-ratio: 5 / 4;
    }

    .stage3d__poster,
    canvas {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      transition: opacity var(--duration-slow) var(--ease-out);
    }

    .stage3d__poster {
      object-fit: contain;
    }

    .stage3d__poster.is-gone,
    canvas {
      opacity: 0;
    }

    canvas.is-shown {
      opacity: 1;
    }

    .stage3d__status {
      position: absolute;
      inset-inline: var(--space-4);
      inset-block-end: var(--space-4);
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-s);
      background: var(--color-surface);
      color: var(--color-ink);
      font-size: var(--text-s);
    }

    @media (prefers-reduced-motion: reduce) {
      .stage3d__poster,
      canvas {
        transition: none;
      }
    }
  `,
})
export class InstrumentStage {
  protected readonly text = INSTRUMENT_STAGE_CONTENT;
  protected readonly poster = STAGE_POSTER;
  protected readonly dev = isDevMode();
  /**
   * `?sin3d=1`. El escenario va en `@defer` (solo en el navegador), así que la dirección ya se puede
   * leer al crearlo.
   */
  protected readonly hidden = isHtmlOnlyMode(globalThis.location?.search ?? '');

  private readonly store = inject(SessionStore);
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly engine = signal<SceneEngine | null>(null);
  private readonly painted = signal(false);
  protected readonly failed = signal(false);
  protected readonly lost = signal(false);
  protected readonly quality = signal<QualityLevel | null>(null);
  /** Con `?captura=1`, lo que cuesta pintar el aparato (lo leen las capturas para el informe). */
  protected readonly stats = signal<string | null>(null);
  /** El lienzo se ve (y el póster se va) en cuanto hay un fotograma y mientras hay contexto. */
  protected readonly shown = computed(() => this.painted() && !this.lost() && !this.failed());

  /** Lo que enseña el aparato: solo cambia si cambia algo que se ve (no repinta por repintar). */
  private readonly pose = computed(
    () => instrumentPose(this.store.state(), this.store.audio(), this.store.display()),
    { equal: samePose },
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destroyed = false;
    let observer: ResizeObserver | undefined;
    afterNextRender(() => {
      const canvas = this.canvas()?.nativeElement;
      const box = this.box()?.nativeElement;
      if (this.hidden || !canvas || !box) return;
      const params = new URLSearchParams(location.search);
      const capture = isCaptureMode(location.search);
      let created: SceneEngine | null = null;
      const onEvent = (event: SceneEvent) => {
        switch (event.type) {
          case 'ready':
            this.painted.set(true);
            break;
          case 'context-lost':
            this.lost.set(true);
            break;
          case 'context-restored':
            this.lost.set(false);
            break;
          case 'quality':
            this.quality.set(event.level);
            break;
        }
        if (capture && created && event.type === 'ready') {
          this.stats.set(JSON.stringify(created.stats()));
        }
      };
      createSceneEngine({
        canvas,
        pose: this.pose(),
        capture,
        view: capture ? pick<View>(params.get('vista'), VIEWS) : undefined,
        quality: capture
          ? (pick<QualityLevel>(params.get('calidad'), QUALITY_LEVELS) ?? 'high')
          : undefined,
        onEvent,
      }).then(
        (engine) => {
          if (destroyed) {
            engine.dispose();
            return;
          }
          created = engine;
          this.quality.set(engine.quality);
          observer = new ResizeObserver(([entry]) => {
            if (entry) engine.setSize(entry.contentRect.width, entry.contentRect.height);
          });
          observer.observe(box);
          engine.setSize(box.clientWidth, box.clientHeight);
          this.engine.set(engine);
          // Si el primer fotograma llegó antes que el motor (en la misma vuelta), las cifras ahora.
          if (capture && this.painted()) this.stats.set(JSON.stringify(engine.stats()));
        },
        () => this.failed.set(true),
      );
    });
    // La pose pasa al motor (sistema externo) cada vez que cambia algo que se ve.
    effect(() => {
      const pose = this.pose();
      this.engine()?.setPose(pose);
    });
    destroyRef.onDestroy(() => {
      destroyed = true;
      observer?.disconnect();
      this.engine()?.dispose();
    });
  }
}
