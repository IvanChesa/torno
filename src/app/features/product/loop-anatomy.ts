import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { loadAudioEngine } from '../../audio/engine';
import { LOOP_ANATOMY_CONTENT } from './loop-anatomy.content';
import { LOOP_ANATOMY_WAVES } from './loop-anatomy.data';

/** El radio de cada anillo (de fuera a dentro), lo que se abre la forma de onda y sus tramos. */
const RING_RADII = [96, 72, 48, 24] as const;
const WAVE_DEPTH = 9;
const RING_COLORS = [
  '--instrument-body',
  '--instrument-brass',
  '--instrument-glaze',
  '--instrument-key',
] as const;

/** La forma de onda de un sonido alrededor de su anillo: un trazo radial por tramo. */
function ringPath(wave: readonly number[], radius: number): string {
  return wave
    .map((peak, i) => {
      const angle = (2 * Math.PI * i) / wave.length - Math.PI / 2;
      const half = 0.8 + peak * WAVE_DEPTH;
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      const inner = radius - half;
      const outer = radius + half;
      return `M${(cos * inner).toFixed(2)} ${(sin * inner).toFixed(2)}L${(cos * outer).toFixed(2)} ${(sin * outer).toFixed(2)}`;
    })
    .join('');
}

/**
 * «Anatomía de un bucle» (PLAN fase 7): las cuatro capas como anillos de un mismo disco, con la
 * forma de onda real de cada sonido de la portada alrededor (calculada con la misma síntesis:
 * `scripts/loop-anatomy.mjs`). «Escuchar» suena una vuelta de su bucle, o de los cuatro a la vez,
 * **solo tras pulsar** y sin tocar la sesión del instrumento (`AudioEngine.preview`): el botón
 * lleva `data-audio-unlock`, así que el contexto se crea en el propio gesto.
 *
 * Mientras suena, el cabezal da una vuelta (CSS, `transform`): con movimiento reducido o «Pausar
 * movimiento», quieto (`base.css`). Lo que suena lo dice la región viva.
 */
@Component({
  selector: 'trn-loop-anatomy',
  template: `
    <figure>
      <svg viewBox="-112 -112 224 224" role="img" [attr.aria-label]="text.figure">
        <circle r="110" class="plate" />
        @for (ring of rings; track ring.id) {
          <g class="ring" [class.is-quiet]="quiet(ring.id)" [style.color]="ring.color">
            <circle [attr.r]="ring.radius" class="track" />
            <path [attr.d]="ring.path" />
          </g>
        }
        <line
          class="head"
          [class.is-turning]="turning()"
          [style.animation-delay.ms]="delay()"
          x1="0"
          y1="0"
          x2="0"
          y2="-108"
        />
        <circle r="8" class="hub" />
      </svg>
    </figure>
    <div class="text">
      <h2 id="anatomia">{{ text.title }}</h2>
      <p>{{ text.intro }}</p>
      <ul class="layers" role="list">
        @for (layer of text.layers; track layer.id; let i = $index) {
          <li>
            <span class="swatch" [style.background]="'var(' + colors[i] + ')'"></span>
            <p>
              <strong>{{ layer.role }} · {{ layer.name }}</strong>
              <span>{{ layer.text }}</span>
            </p>
            <button
              type="button"
              class="button button--secondary"
              data-audio-unlock
              [attr.aria-label]="
                isPlaying([layer.id]) ? text.stop : text.listenLabel(layer.role, layer.name)
              "
              [attr.aria-pressed]="isPlaying([layer.id])"
              (click)="listen([layer.id])"
            >
              {{ isPlaying([layer.id]) ? text.stop : text.listen }}
            </button>
          </li>
        }
      </ul>
      <p>
        <button
          type="button"
          class="button"
          data-audio-unlock
          [attr.aria-pressed]="isPlaying(all)"
          (click)="listen(all)"
        >
          {{ isPlaying(all) ? text.stop : text.listenAll }}
        </button>
      </p>
      <p class="status" aria-live="polite">{{ status() }}</p>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 6fr) minmax(0, 6fr);
      gap: var(--space-8);
      align-items: center;
    }

    figure {
      margin: 0;
    }

    svg {
      inline-size: 100%;
      max-inline-size: 34rem;
      margin-inline: auto;
      overflow: visible;
    }

    .plate {
      fill: var(--color-surface);
    }

    .track {
      fill: none;
      stroke: currentColor;
      stroke-opacity: 0.25;
      stroke-width: 1;
    }

    .ring path {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
    }

    .ring {
      transition: opacity var(--duration) var(--ease-out);
    }

    .ring.is-quiet {
      opacity: 0.3;
    }

    .head {
      stroke: var(--color-ink);
      stroke-width: 1.5;
      transform-origin: 0 0;
    }

    /* Una vuelta del cabezal: un bucle de 2 compases a 90 BPM (8 pulsos, 5,33 s). */
    .head.is-turning {
      animation: turn calc(8 * 60s / 90) linear both;
    }

    @keyframes turn {
      to {
        transform: rotate(1turn);
      }
    }

    .hub {
      fill: var(--instrument-brass);
    }

    .text {
      display: grid;
      gap: var(--space-5);
    }

    .layers {
      display: grid;
      gap: var(--space-3);
      padding: 0;
      list-style: none;
    }

    .layers li {
      display: grid;
      grid-template-columns: 1.25rem minmax(0, 1fr) auto;
      gap: var(--space-4);
      align-items: center;
    }

    .swatch {
      inline-size: 1.25rem;
      aspect-ratio: 1;
      border-radius: 50%;
    }

    .layers strong {
      display: block;
    }

    .layers span:not(.swatch),
    .status {
      color: var(--color-ink-muted);
      font-size: var(--text-s);
    }

    .status {
      min-block-size: 1.5em;
    }

    @media (max-width: 47.99rem) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-6);
      }
    }
  `,
})
export class LoopAnatomy {
  protected readonly text = LOOP_ANATOMY_CONTENT;
  protected readonly colors = RING_COLORS;
  protected readonly all = LOOP_ANATOMY_CONTENT.layers.map((layer) => layer.id);
  protected readonly rings = LOOP_ANATOMY_CONTENT.layers.map((layer, i) => ({
    id: layer.id,
    radius: RING_RADII[i],
    color: `var(${RING_COLORS[i]})`,
    path: ringPath(LOOP_ANATOMY_WAVES[layer.id] ?? [], RING_RADII[i] ?? 0),
  }));

  /** Lo que suena (o lo que se ha pedido y aún no suena), o `null`. */
  private readonly playing = signal<readonly string[] | null>(null);
  protected readonly turning = signal(false);
  protected readonly delay = signal(0);
  protected readonly status = signal('');
  private readonly names = computed(() => {
    const playing = this.playing() ?? [];
    return this.text.layers
      .filter((layer) => playing.includes(layer.id))
      .map((layer) => layer.name)
      .join(', ');
  });
  /** Cada escucha, con su número: al acabar una que ya no es la última, no se toca nada. */
  private token = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.playing()) void loadAudioEngine().then((engine) => engine.stopPreview());
    });
  }

  protected isPlaying(ids: readonly string[]): boolean {
    const playing = this.playing();
    return !!playing && playing.length === ids.length && ids.every((id) => playing.includes(id));
  }

  protected quiet(id: string): boolean {
    const playing = this.playing();
    return !!playing && !playing.includes(id);
  }

  /** Escucha esos sonidos; si ya suenan, los para. */
  protected async listen(ids: readonly string[]): Promise<void> {
    const token = ++this.token;
    const engine = await loadAudioEngine();
    if (this.isPlaying(ids)) {
      engine.stopPreview();
      this.finish(token, this.text.stopped);
      return;
    }
    this.turning.set(false);
    this.playing.set(ids);
    let finished: boolean;
    try {
      finished = await engine.preview(ids, (delay) => {
        if (token !== this.token) return;
        this.delay.set(Math.round(delay));
        this.turning.set(true);
        this.status.set(this.text.playing(this.names()));
      });
    } catch {
      finished = false;
    }
    if (token !== this.token) return;
    this.finish(token, finished || this.turning() ? this.text.stopped : this.text.failed);
  }

  private finish(token: number, message: string): void {
    if (token !== this.token) return;
    this.playing.set(null);
    this.turning.set(false);
    this.status.set(message);
  }
}
