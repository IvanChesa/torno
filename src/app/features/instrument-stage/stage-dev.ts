import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  QUALITY_LEVELS,
  type FrameStats,
  type QualityLevel,
  type SceneEngine,
  type SceneStats,
} from '../../scene';
import { STAGE_DEV_CONTENT } from './stage-dev.content';

/** Cada cuánto se leen las cifras (2 veces por segundo: los signals, por debajo de 10/s). */
const STATS_MS = 500;
/** Lo que dura la medida de FPS. */
const BENCHMARK_MS = 5000;

/**
 * El panel de la escena (PLAN fase 5.b): FPS y `renderer.info`, y botones para forzar la calidad,
 * perder y recuperar el contexto y medir los FPS pintando seguido. Sale en desarrollo y con
 * `?diagnostico=1` (en su propio trozo: `@defer`). Lo usan los e2e del servidor de desarrollo
 * (memoria tras 10 cambios de calidad, contexto y reposo) y la medida de los FPS en el móvil.
 */
@Component({
  selector: 'trn-stage-dev',
  template: `
    <section
      class="dev"
      [attr.aria-label]="text.title"
      [attr.data-fotogramas]="stats()?.frames"
      [attr.data-geometrias]="stats()?.geometries"
      [attr.data-texturas]="stats()?.textures"
    >
      <p class="dev__line">{{ line() }}</p>
      <div class="dev__buttons">
        <div role="group" [attr.aria-label]="text.quality">
          @for (level of levels; track level) {
            <button
              type="button"
              [attr.aria-pressed]="stats()?.quality === level"
              (click)="setQuality(level)"
            >
              {{ text.levels[level] }}
            </button>
          }
        </div>
        <button type="button" (click)="engine().loseContext()">{{ text.lose }}</button>
        <button type="button" (click)="engine().restoreContext()">{{ text.restore }}</button>
        <button type="button" [disabled]="measuring()" (click)="benchmark()">
          {{ text.benchmark }}
        </button>
      </div>
      @if (result(); as result) {
        <p class="dev__line" data-medida>
          {{ result.fps }} fps · p95 {{ result.p95Ms }} ms · {{ result.frames }} fotogramas
        </p>
      }
    </section>
  `,
  styles: `
    .dev {
      display: grid;
      gap: var(--space-2);
      margin-block-start: var(--space-3);
      padding: var(--space-3);
      border: 1px dashed var(--color-ink-faint);
      border-radius: var(--radius-s);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .dev__line {
      margin: 0;
    }

    .dev__buttons,
    [role='group'] {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    button {
      min-block-size: var(--target-min);
      padding-inline: var(--space-3);
      border: 0;
      border-radius: var(--radius-s);
      background: var(--color-surface-2);
      color: var(--color-ink);
      font: inherit;
      cursor: pointer;
    }

    button[aria-pressed='true'] {
      background: var(--color-ink);
      color: var(--color-bg);
    }
  `,
})
export class StageDev {
  readonly engine = input.required<SceneEngine>();

  protected readonly text = STAGE_DEV_CONTENT;
  protected readonly levels = QUALITY_LEVELS;
  protected readonly stats = signal<SceneStats | null>(null);
  protected readonly result = signal<FrameStats | null>(null);
  protected readonly measuring = signal(false);
  protected readonly line = computed(() => {
    const stats = this.stats();
    if (!stats) return '';
    return [
      `${stats.quality} ${stats.pixelRatio}×${stats.antialias ? ' MSAA' : ''}`,
      `${stats.drawCalls} llamadas`,
      `${stats.triangles} triángulos`,
      `${stats.geometries} geometrías`,
      `${stats.textures} texturas`,
      `${stats.programs} programas`,
      `${stats.vramMb} MB`,
      `${stats.frames} fotogramas`,
      `${stats.buildMs} ms`,
    ].join(' · ');
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const read = () => this.stats.set(this.engine().stats());
      read();
      const timer = setInterval(read, STATS_MS);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  protected setQuality(level: QualityLevel): void {
    void this.engine().setQuality(level);
  }

  protected async benchmark(): Promise<void> {
    this.measuring.set(true);
    this.result.set(await this.engine().benchmark(BENCHMARK_MS));
    this.measuring.set(false);
  }
}
