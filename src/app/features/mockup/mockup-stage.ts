import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isCaptureMode } from '../../core/capture-mode';
import { formatQuantity } from '../../core/format';
import { BODY, DECK_HEIGHT, DISC, DISC_OUTER_RADIUS, TRAY } from '../../instrument';
import {
  createMockupViewer,
  TONE_MAPPINGS,
  VARIANTS,
  VIEWS,
  type MockupState,
  type MockupViewer,
  type ToneMapping,
  type Variant,
  type View,
} from '../../scene';
import { MOCKUP_CONTENT } from './mockup.content';

/** Los parámetros de la URL que fijan lo elegido (para enlazarlo y para las capturas). */
const PARAMS = { variant: 'variante', toneMapping: 'tono', view: 'vista' } as const;

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

/**
 * La maqueta del instrumento (`?maqueta=1`, PLAN fase 5.a): el aparato en bloques en 3D, con
 * botones para la variante de color, el mapeo de tonos y la vista. Lo elegido va a la URL, así que
 * se puede enlazar. `three` se carga solo aquí, con `import()` (por `scene/index.ts`).
 */
@Component({
  selector: 'trn-mockup-stage',
  template: `
    <section class="mockup" aria-labelledby="trn-maqueta">
      <h2 id="trn-maqueta">{{ text.title }}</h2>
      <p class="intro">{{ text.intro }}</p>
      <div
        class="viewer"
        #viewer
        [attr.data-listo]="ready() ? '' : null"
        [attr.data-estadisticas]="stats()"
      >
        <canvas #canvas role="img" [attr.aria-label]="label()"></canvas>
        @if (!ready()) {
          <p class="viewer__status" role="status">
            {{ failed() ? text.noWebgl : text.loading }}
          </p>
        }
      </div>
      <div class="options">
        <div class="option" role="group" aria-labelledby="trn-maqueta-variante">
          <p class="option__label" id="trn-maqueta-variante">{{ text.groups.variant }}</p>
          <div class="option__buttons">
            @for (variant of variants; track variant) {
              <button
                type="button"
                class="chip"
                [attr.aria-pressed]="state().variant === variant"
                (click)="choose({ variant })"
              >
                {{ text.variants[variant] }}
              </button>
            }
          </div>
        </div>
        <div class="option" role="group" aria-labelledby="trn-maqueta-tono">
          <p class="option__label" id="trn-maqueta-tono">{{ text.groups.toneMapping }}</p>
          <div class="option__buttons">
            @for (toneMapping of toneMappings; track toneMapping) {
              <button
                type="button"
                class="chip"
                [attr.aria-pressed]="state().toneMapping === toneMapping"
                (click)="choose({ toneMapping })"
              >
                {{ text.toneMappings[toneMapping] }}
              </button>
            }
          </div>
        </div>
        <div class="option" role="group" aria-labelledby="trn-maqueta-vista">
          <p class="option__label" id="trn-maqueta-vista">{{ text.groups.view }}</p>
          <div class="option__buttons">
            @for (view of views; track view) {
              <button
                type="button"
                class="chip"
                [attr.aria-pressed]="state().view === view"
                (click)="choose({ view })"
              >
                {{ text.views[view] }}
              </button>
            }
          </div>
        </div>
      </div>
      <div class="measures">
        <h3>{{ text.measures.title }}</h3>
        <dl>
          @for (row of measures; track row.label) {
            <div>
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          }
        </dl>
      </div>
    </section>
  `,
  styles: `
    .mockup {
      display: grid;
      gap: var(--space-5);
    }

    h2,
    .intro {
      margin: 0;
    }

    .intro {
      max-inline-size: var(--measure);
    }

    /* Un objeto redondo: en el móvil, el lienzo es cuadrado; en el escritorio, apaisado. */
    .viewer {
      position: relative;
      aspect-ratio: 1;
    }

    @media (min-width: 48rem) {
      .viewer {
        aspect-ratio: 16 / 10;
      }
    }

    canvas {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }

    .viewer__status {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      margin: 0;
      padding: var(--space-5);
      color: var(--color-ink-muted);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-align: center;
      text-transform: uppercase;
    }

    .options {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-5) var(--space-7);
    }

    .option {
      display: grid;
      gap: var(--space-2);
    }

    .option__label {
      margin: 0;
      color: var(--color-ink-muted);
      font-size: var(--text-s);
    }

    .option__buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .chip {
      min-block-size: var(--target-min);
      padding: var(--space-2) var(--space-4);
      border: 0;
      border-radius: var(--radius-pill);
      background: var(--color-surface-2);
      color: var(--color-ink);
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-out);
    }

    .chip:hover {
      background: var(--color-surface);
    }

    /* Lo elegido, invertido: forma y contraste, no solo color. */
    .chip[aria-pressed='true'] {
      background: var(--color-ink);
      color: var(--color-bg);
      font-weight: var(--weight-strong);
    }

    .measures {
      display: grid;
      gap: var(--space-3);
      max-inline-size: var(--measure);
    }

    h3 {
      margin: 0;
      font-size: var(--text-m);
    }

    dl {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      font-size: var(--text-s);
    }

    dl div {
      display: flex;
      flex-wrap: wrap;
      gap: 0 var(--space-3);
    }

    dt {
      color: var(--color-ink-muted);
    }

    dd {
      margin: 0;
    }
  `,
})
export class MockupStage {
  protected readonly text = MOCKUP_CONTENT;
  protected readonly variants = VARIANTS;
  protected readonly toneMappings = TONE_MAPPINGS;
  protected readonly views = VIEWS;

  protected readonly state = signal<MockupState>({
    variant: 'terracota',
    toneMapping: 'neutral',
    view: 'frente',
  });
  /** El primer fotograma ya está pintado (las capturas esperan a `data-listo`). */
  private readonly painted = signal(false);
  /**
   * Con `?captura=1`, lo que cuesta pintar la maqueta (llamadas, triángulos, memoria y tiempo de
   * generación), en `data-estadisticas`: lo leen las capturas para el informe.
   */
  protected readonly stats = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly ready = computed(() => this.painted() && !this.failed());
  protected readonly label = computed(() => {
    const { variant, view } = this.state();
    return this.text.canvas(this.text.variants[variant], this.text.views[view].toLowerCase());
  });

  protected readonly measures = [
    { label: this.text.measures.diameter, value: `Ø ${formatQuantity(2 * BODY.radius, 'mm')}` },
    {
      label: this.text.measures.height,
      value: this.text.measures.heightWithTray(
        formatQuantity(DECK_HEIGHT, 'mm'),
        formatQuantity(DECK_HEIGHT + TRAY.height, 'mm'),
      ),
    },
    {
      label: this.text.measures.disc,
      value: this.text.measures.discWithRing(
        formatQuantity(2 * DISC.radius, 'mm'),
        formatQuantity(2 * DISC_OUTER_RADIUS, 'mm'),
      ),
    },
    { label: this.text.measures.zones, value: this.text.measures.zonesValue },
  ];

  private readonly viewer = signal<MockupViewer | null>(null);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('viewer');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destroyed = false;
    let observer: ResizeObserver | undefined;
    afterNextRender(() => {
      const params = new URLSearchParams(location.search);
      const initial: MockupState = {
        variant: pick<Variant>(params.get(PARAMS.variant), VARIANTS, 'terracota'),
        toneMapping: pick<ToneMapping>(params.get(PARAMS.toneMapping), TONE_MAPPINGS, 'neutral'),
        view: pick<View>(params.get(PARAMS.view), VIEWS, 'frente'),
      };
      this.state.set(initial);
      const capture = isCaptureMode(location.search);
      let viewer: MockupViewer | null = null;
      createMockupViewer({
        canvas: this.canvas().nativeElement,
        state: initial,
        screenLines: this.text.screen,
        capture,
        onRender: () => {
          this.painted.set(true);
          if (capture && viewer) this.stats.set(JSON.stringify(viewer.stats()));
        },
      }).then(
        (created) => {
          if (destroyed) {
            created.dispose();
            return;
          }
          viewer = created;
          const host = this.host().nativeElement;
          observer = new ResizeObserver(([entry]) => {
            if (entry) created.setSize(entry.contentRect.width, entry.contentRect.height);
          });
          observer.observe(host);
          created.setSize(host.clientWidth, host.clientHeight);
          this.viewer.set(created);
        },
        () => this.failed.set(true),
      );
    });
    // Lo elegido pasa al visor (sistema externo) y a la URL.
    effect(() => {
      const state = this.state();
      const viewer = this.viewer();
      if (!viewer) return;
      viewer.setState(state);
      const url = new URL(location.href);
      url.searchParams.set(PARAMS.variant, state.variant);
      url.searchParams.set(PARAMS.toneMapping, state.toneMapping);
      url.searchParams.set(PARAMS.view, state.view);
      history.replaceState(history.state, '', url);
    });
    destroyRef.onDestroy(() => {
      destroyed = true;
      observer?.disconnect();
      this.viewer()?.dispose();
    });
  }

  protected choose(change: Partial<MockupState>): void {
    this.state.update((state) => ({ ...state, ...change }));
  }
}
