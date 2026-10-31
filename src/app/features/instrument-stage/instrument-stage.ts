import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  isDevMode,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isCaptureMode } from '../../core/capture-mode';
import { isDiagnosticsMode } from '../../core/diagnostics-mode';
import { MotionPreference } from '../../core/motion';
import { InstrumentMotion, instrumentPose, samePose } from '../../instrument';
import {
  createSceneEngine,
  ORBIT_LIMITS,
  QUALITY_LEVELS,
  SHOTS,
  VIEWS,
  type CameraGoal,
  type Orbit,
  type QualityLevel,
  type SceneEngine,
  type SceneEvent,
  type SceneMotion,
  type Shot,
  type View,
  type Waveform,
} from '../../scene';
import { SessionStore } from '../../state';
import { InstrumentScreen } from '../instrument-common/instrument-screen';
import { InstrumentShell } from '../instrument-common/instrument-shell';
import { INSTRUMENT_STAGE_CONTENT } from './instrument-stage.content';
import { StageControls } from './stage-controls';
import { StageDev } from './stage-dev';
import { StageToolbar } from './stage-toolbar';
import { STAGE_POSTER } from './stage-poster';

function pick<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

/** Grados de órbita por píxel de arrastre (acimut y elevación) y por pulsación de una flecha. */
const ORBIT_DEGREES_PER_PX = { azimuth: 0.4, elevation: 0.25 } as const;
const ORBIT_KEY_STEP = { azimuth: 10, elevation: 5 } as const;
/** «Inspeccionar» empieza de frente si no hay cámara de la que partir. */
const FRONT: Orbit = { azimuth: 0, elevation: 40 };
/** Con `?captura=1&encuadre=inspeccionar`: tres cuartos desde la derecha, algo bajo. */
const CAPTURE_ORBIT: Orbit = { azimuth: 35, elevation: 28 };
/** Tras girar, otra mirada a qué controles tapa otra pieza (el motor la hace 10 veces por segundo). */
const SETTLE_MS = 120;

const clamp = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, value));

/**
 * El instrumento en 3D (PLAN §4.6, §4.7 y fase 6): el aparato pintado por `SceneEngine` y, encima
 * de cada pieza, su control (`StageControls`). Desde la fase 6 es el instrumento de la portada; el
 * plato HTML queda para `?sin3d=1` y para cuando no hay WebGL (lo dice `failed`).
 *
 * - Encima, el espejo de la pantalla en HTML: la del 3D no se lee a todos los tamaños.
 * - La caja: 5:4 en el escritorio y 1:1, de borde a borde, en el móvil (su encuadre).
 * - Debajo, la barra: los encuadres de «Tocar», «Inspeccionar», la pantalla completa, «Pausar
 *   movimiento» y los atajos.
 *
 * Lo común con el plato HTML (atajos, avisos, archivos y autoguardado) está en `InstrumentShell`.
 * Mientras llega el primer fotograma se ve el póster, en la misma caja. `three` se carga aquí, con
 * `import()`.
 *
 * Sincronía con el audio (PLAN §4.6): mientras suena, el motor pide a `InstrumentMotion` en cada
 * fotograma el giro del disco (una vuelta por compás), el latido de los pilotos, los medidores y los
 * cabezales, leyendo el último estado del audio sin pasar por los signals. Quieto, 0 fps. Con
 * «Pausar movimiento», nada se mueve solo: el disco solo va con la mano.
 *
 * Con `?captura=1`, todo fijo y las cifras en `data-estadisticas`. `?vista=` elige un ángulo de las
 * capturas, `?encuadre=` un encuadre (o `inspeccionar`) y `?calidad=` el nivel. En desarrollo y con
 * `?diagnostico=1`, el panel de la escena.
 */
@Component({
  selector: 'trn-instrument-stage',
  imports: [InstrumentScreen, InstrumentShell, StageControls, StageDev, StageToolbar],
  template: `
    <trn-instrument-shell>
      <div class="frame" #frame>
        <trn-instrument-screen class="mirror" [compact]="true" [display]="store.display()" />
        <div
          class="stage3d"
          #box
          [attr.data-listo]="shown() ? '' : null"
          [attr.data-contexto]="lost() ? 'perdido' : 'activo'"
          [attr.data-calidad]="quality()"
          [attr.data-camara]="cameraName()"
          [attr.data-estadisticas]="stats()"
        >
          <picture>
            <source
              [attr.media]="poster.mobileMedia"
              [attr.srcset]="poster.mobile.src"
              [attr.width]="poster.mobile.width"
              [attr.height]="poster.mobile.height"
            />
            <img
              class="stage3d__poster"
              [class.is-gone]="shown()"
              [src]="poster.src"
              [width]="poster.width"
              [height]="poster.height"
              alt=""
              decoding="async"
            />
          </picture>
          <canvas
            #canvas
            role="img"
            [attr.aria-label]="text.canvas"
            [class.is-shown]="shown()"
          ></canvas>
          @if (inspecting()) {
            <div
              #orbitSurface
              class="stage3d__orbit"
              tabindex="0"
              role="slider"
              [attr.aria-label]="text.orbit.name"
              [attr.aria-valuemin]="limits.azimuth.min"
              [attr.aria-valuemax]="limits.azimuth.max"
              [attr.aria-valuenow]="orbitView().azimuth"
              [attr.aria-valuetext]="orbitText()"
              aria-describedby="trn-orbita-pista"
              (pointerdown)="onOrbitDown($event)"
              (pointermove)="onOrbitMove($event)"
              (pointerup)="onOrbitUp()"
              (pointercancel)="onOrbitUp()"
              (keydown)="onOrbitKey($event)"
            ></div>
            <span id="trn-orbita-pista" hidden>{{ text.orbit.hint }}</span>
          }
          <trn-stage-controls
            [orbit]="inspecting()"
            (highlight)="onHighlight($event)"
            (focusLost)="onFocusLost()"
          />
          @if (lost()) {
            <p class="stage3d__status" role="status">{{ text.contextLost }}</p>
          }
        </div>
        <trn-stage-toolbar
          [camera]="camera()"
          [fullscreen]="fullscreen()"
          [fullscreenAvailable]="fullscreenAvailable"
          (shotChange)="setShot($event)"
          (inspect)="inspect()"
          (fullscreenChange)="toggleFullscreen()"
        />
      </div>
    </trn-instrument-shell>
    <!--
      El panel de la escena, en su propio trozo: el build de producción solo lo pide con
      ?diagnostico=1 (para medir los FPS en el móvil, PRUEBAS-MOVIL.md).
    -->
    @if (panel) {
      @if (engine(); as engine) {
        @defer (on immediate) {
          <trn-stage-dev [engine]="engine" />
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .frame {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      inline-size: 100%;
    }

    .mirror {
      inline-size: min(100%, 38rem);
    }

    /*
     * La caja del póster, del lienzo y de los controles: la misma que la del marcador de la
     * portada. En el escritorio, 5:4 y nunca más alta que la pantalla (con el espejo y la barra);
     * en el móvil, cuadrada y de borde a borde (su encuadre, con las zonas de 44 px).
     */
    .stage3d {
      position: relative;
      inline-size: min(100%, (100svh - 13rem) * 1.25);
      aspect-ratio: 5 / 4;
    }

    @media (max-width: 47.99rem) {
      .stage3d {
        inline-size: calc(100% + 2 * var(--page-margin));
        margin-inline: calc(-1 * var(--page-margin));
        aspect-ratio: 1;
      }
    }

    .frame:fullscreen {
      align-content: center;
      padding: var(--space-4);
      background: var(--color-bg);
    }

    .frame:fullscreen .stage3d {
      inline-size: min(100%, (100dvh - 14rem) * 1.25);
      margin-inline: 0;
    }

    .stage3d__poster,
    canvas,
    .stage3d__orbit {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }

    .stage3d__poster,
    canvas {
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

    /* Fuera de los controles, la página se desplaza por encima del aparato. */
    canvas {
      touch-action: pan-y;
    }

    .stage3d__orbit {
      touch-action: pan-y;
      cursor: grab;
    }

    .stage3d__orbit:focus-visible {
      outline: var(--focus-ring);
      outline-offset: calc(-1 * var(--focus-offset));
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
  /** No hay WebGL: la portada pone el plato HTML. */
  readonly failed = output<void>();

  protected readonly text = INSTRUMENT_STAGE_CONTENT;
  protected readonly poster = STAGE_POSTER;
  protected readonly limits = ORBIT_LIMITS;
  /** El panel de la escena: en desarrollo y con `?diagnostico=1`. */
  protected readonly panel = isDevMode() || isDiagnosticsMode(globalThis.location?.search ?? '');
  protected readonly fullscreenAvailable = globalThis.document?.fullscreenEnabled ?? false;

  protected readonly store = inject(SessionStore);
  private readonly motion = inject(MotionPreference);
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly frameRef = viewChild<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly controls = viewChild(StageControls);
  private readonly toolbar = viewChild(StageToolbar);
  private readonly orbitSurface = viewChild<ElementRef<HTMLElement>>('orbitSurface');

  protected readonly engine = signal<SceneEngine | null>(null);
  private readonly painted = signal(false);
  protected readonly lost = signal(false);
  protected readonly quality = signal<QualityLevel | null>(null);
  /** Con `?captura=1`, lo que cuesta pintar el aparato (lo leen las capturas para el informe). */
  protected readonly stats = signal<string | null>(null);
  /** El lienzo se ve (y el póster se va) en cuanto hay un fotograma y mientras hay contexto. */
  protected readonly shown = computed(() => this.painted() && !this.lost());
  protected readonly fullscreen = signal(false);

  /** Lo que encuadra la cámara (la barra y el motor). */
  protected readonly camera = signal<CameraGoal>({ kind: 'shot', shot: 'completo' });
  protected readonly inspecting = computed(() => this.camera().kind === 'orbit');
  protected readonly cameraName = computed(() => {
    const camera = this.camera();
    return camera.kind === 'shot' ? camera.shot : camera.kind === 'orbit' ? 'inspeccionar' : null;
  });
  /**
   * La órbita, para la superficie de «Inspeccionar». Al arrastrar cambia a cada movimiento: va al
   * motor sin pasar por los signals, y este (para el lector de pantalla) se pone al soltar.
   */
  protected readonly orbitView = signal<Orbit>(FRONT);
  protected readonly orbitText = computed(() =>
    this.text.orbit.value(
      Math.round(this.orbitView().azimuth),
      Math.round(this.orbitView().elevation),
    ),
  );

  /** Lo que enseña el aparato: solo cambia si cambia algo que se ve (no repinta por repintar). */
  private readonly pose = computed(
    () => instrumentPose(this.store.state(), this.store.audio(), this.store.display()),
    { equal: samePose },
  );

  private readonly capture = isCaptureMode(globalThis.location?.search ?? '');
  /** Lo que se mueve con el audio, fotograma a fotograma (un solo reloj: el del worklet). */
  private readonly motionClock = new InstrumentMotion();
  /**
   * Se pinta seguido mientras suena, en la cuenta previa o con el disco agarrado; con la pausa de
   * movimiento, nunca.
   */
  private readonly moving = computed(() => {
    const audio = this.store.audio();
    const running = audio.transport === 'playing' || audio.recording === 'count-in';
    return !this.motion.still() && (running || this.store.state().discHeld);
  });
  /** Las formas de onda que se ven: las de las capas al revés, del revés (como suenan). */
  private readonly reversedLayers = computed(() =>
    this.store
      .state()
      .controls.layers.map((layer) => (layer.reversed ? '1' : '0'))
      .join(''),
  );
  private readonly shownWaveforms = computed((): readonly Waveform[] => {
    const reversed = this.reversedLayers();
    return this.store
      .waveforms()
      .map((wave, i) => (wave && reversed[i] === '1' ? wave.slice().reverse() : wave));
  });
  /** El movimiento de un fotograma (lo pide el motor, con la hora del fotograma). */
  private readonly motionSource = (time: number): SceneMotion => {
    this.readStatus();
    const state = this.store.state();
    return this.motionClock.frame(time, state.discHeld ? state.discTurns : null);
  };

  private orbit: Orbit = FRONT;
  private drag: { x: number; y: number; touch: boolean } | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destroyed = false;
    let observer: ResizeObserver | undefined;
    afterNextRender(() => {
      const canvas = this.canvas()?.nativeElement;
      const box = this.box()?.nativeElement;
      if (!canvas || !box) return;
      const params = new URLSearchParams(location.search);
      const capture = isCaptureMode(location.search);
      const view = capture ? pick<View>(params.get('vista'), VIEWS) : undefined;
      if (capture) this.captureCamera(params.get('encuadre'));
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
          case 'camera':
            if (created) this.placeControls(created);
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
        camera: view ? { kind: 'view', view } : this.camera(),
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
          // Medido como lo mide el `ResizeObserver` (con decimales): si no, su primer aviso
          // traería otro tamaño y otro fotograma.
          const { width, height } = box.getBoundingClientRect();
          engine.setSize(width, height);
          this.placeControls(engine);
          this.engine.set(engine);
          // Las formas de onda solo se calculan si alguien las pinta: desde ahora, el 3D.
          this.store.showWaveforms(true);
          // Si el primer fotograma llegó antes que el motor (en la misma vuelta), las cifras ahora.
          if (capture && this.painted()) this.stats.set(JSON.stringify(engine.stats()));
        },
        () => {
          if (!destroyed) this.failed.emit();
        },
      );
      const onFullscreen = () =>
        this.fullscreen.set(document.fullscreenElement === this.frameRef()?.nativeElement);
      document.addEventListener('fullscreenchange', onFullscreen);
      destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', onFullscreen));
    });
    // La pose pasa al motor (sistema externo) cada vez que cambia algo que se ve.
    effect(() => {
      const pose = this.pose();
      this.engine()?.setPose(pose);
    });
    // Lo que se mueve con el audio: el bucle del motor, solo mientras hay algo que mover.
    effect(() => {
      const engine = this.engine();
      if (!engine || this.capture) return;
      if (this.moving()) {
        engine.setMotionSource(this.motionSource);
      } else {
        engine.setMotionSource(null);
        untracked(() => this.rest(engine, null));
      }
    });
    // Con la pausa de movimiento, el disco agarrado sigue a la mano (no es movimiento automático).
    effect(() => {
      const engine = this.engine();
      const state = this.store.state();
      if (!engine || this.capture || !this.motion.still() || !state.discHeld) return;
      untracked(() => this.rest(engine, state.discTurns));
    });
    // Las formas de onda: solo cuando cambia el sonido de una capa (o su reverso).
    effect(() => {
      const waveforms = this.shownWaveforms();
      this.engine()?.setWaveforms(waveforms);
    });
    destroyRef.onDestroy(() => {
      destroyed = true;
      this.store.showWaveforms(false);
      clearTimeout(this.settleTimer);
      observer?.disconnect();
      this.engine()?.dispose();
    });
  }

  // --- Cámara ------------------------------------------------------------------------------------

  protected setShot(shot: Shot): void {
    this.setCamera({ kind: 'shot', shot }, true);
  }

  /**
   * «Inspeccionar»: la órbita empieza donde está la cámara. El foco se queda en el botón; la
   * superficie de girar va en el orden del tabulador justo antes de los controles.
   */
  protected inspect(): void {
    if (this.inspecting()) return;
    const start = this.engine()?.angles ?? FRONT;
    this.orbit = {
      azimuth: clamp(Math.round(start.azimuth), ORBIT_LIMITS.azimuth),
      elevation: clamp(Math.round(start.elevation), ORBIT_LIMITS.elevation),
    };
    this.orbitView.set(this.orbit);
    this.setCamera({ kind: 'orbit', orbit: this.orbit }, true);
  }

  /** Con `?captura=1&encuadre=`: el encuadre de la captura, también en la barra. */
  private captureCamera(name: string | null): void {
    const shot = pick<Shot>(name, SHOTS);
    if (shot) this.camera.set({ kind: 'shot', shot });
    if (name !== 'inspeccionar') return;
    this.orbit = CAPTURE_ORBIT;
    this.orbitView.set(CAPTURE_ORBIT);
    this.camera.set({ kind: 'orbit', orbit: CAPTURE_ORBIT });
  }

  /** Con la pausa de movimiento, la cámara corta; si no, viaja. */
  private setCamera(goal: CameraGoal, travel: boolean): void {
    this.camera.set(goal);
    this.engine()?.setCamera(goal, travel && !this.motion.still());
  }

  private moveOrbit(azimuth: number, elevation: number, announce: boolean): void {
    this.orbit = {
      azimuth: clamp(azimuth, ORBIT_LIMITS.azimuth),
      elevation: clamp(elevation, ORBIT_LIMITS.elevation),
    };
    this.engine()?.setCamera({ kind: 'orbit', orbit: this.orbit });
    if (announce) {
      this.orbitView.set(this.orbit);
      this.camera.set({ kind: 'orbit', orbit: this.orbit });
    }
  }

  protected onOrbitDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.drag = { x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch' };
  }

  protected onOrbitMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    this.drag = { ...drag, x: event.clientX, y: event.clientY };
    // Con el dedo, en vertical se desplaza la página (`pan-y`): solo se gira.
    const elevation = drag.touch ? 0 : dy * ORBIT_DEGREES_PER_PX.elevation;
    this.moveOrbit(
      this.orbit.azimuth - dx * ORBIT_DEGREES_PER_PX.azimuth,
      this.orbit.elevation + elevation,
      false,
    );
  }

  protected onOrbitUp(): void {
    if (!this.drag) return;
    this.drag = null;
    this.moveOrbit(Math.round(this.orbit.azimuth), Math.round(this.orbit.elevation), true);
  }

  protected onOrbitKey(event: KeyboardEvent): void {
    const big = event.shiftKey ? 3 : 1;
    let { azimuth, elevation } = this.orbit;
    switch (event.key) {
      case 'ArrowLeft':
        azimuth -= ORBIT_KEY_STEP.azimuth * big;
        break;
      case 'ArrowRight':
        azimuth += ORBIT_KEY_STEP.azimuth * big;
        break;
      case 'ArrowUp':
        elevation += ORBIT_KEY_STEP.elevation * big;
        break;
      case 'ArrowDown':
        elevation -= ORBIT_KEY_STEP.elevation * big;
        break;
      case 'Home':
        ({ azimuth, elevation } = FRONT);
        break;
      default:
        return;
    }
    event.preventDefault();
    this.moveOrbit(azimuth, elevation, true);
  }

  /**
   * El control enfocado ha dejado de verse (tapado al girar, o fuera del encuadre al cambiar de
   * tamaño): el foco no se pierde en la página. En la órbita, a la superficie de girar; si no, al
   * botón del encuadre de la barra.
   */
  protected onFocusLost(): void {
    const orbit = this.orbitSurface()?.nativeElement;
    if (orbit) orbit.focus();
    else this.toolbar()?.focusCurrent();
  }

  protected toggleFullscreen(): void {
    const frame = this.frameRef()?.nativeElement;
    if (!frame) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.requestFullscreen().catch(() => undefined);
  }

  // --- Controles y anillo ----------------------------------------------------------------------

  /**
   * Los controles, encima de sus piezas (fuera de los signals). En «Inspeccionar», el motor mira
   * qué tapa qué 10 veces por segundo como mucho: un poco después del último cambio, otra vez.
   */
  private placeControls(engine: SceneEngine): void {
    this.controls()?.place(engine.project());
    if (engine.camera.kind !== 'orbit') return;
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.controls()?.place(engine.project()), SETTLE_MS);
  }

  protected onHighlight(id: Parameters<SceneEngine['setHighlight']>[0]): void {
    this.engine()?.setHighlight(id);
  }

  // --- Sincronía --------------------------------------------------------------------------------

  private readStatus(): void {
    const status = this.store.latestStatus;
    if (status) this.motionClock.update(status, this.store.latestStatusAt);
  }

  /** Quieto: un último fotograma con los medidores a cero (y el disco donde está o en la mano). */
  private rest(engine: SceneEngine, held: number | null): void {
    this.readStatus();
    engine.setMotion(this.motionClock.rest(performance.now(), held));
  }
}
