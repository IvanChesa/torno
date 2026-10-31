/**
 * El motor del 3D (PLAN §4.6 y fase 5.b): monta el aparato en un lienzo, le pone la pose que le
 * llega (lo que enseña cada pieza), lo encuadra y lo pinta **solo cuando algo cambia** (0 fps
 * quieto). Lleva la calidad (y la baja sola si los FPS no llegan), recupera la pérdida del contexto
 * y lo libera todo en `dispose()`. No sabe nada del audio ni de Angular: lo carga `scene/index.ts`
 * con `import()`.
 *
 * El arranque va por tramos (texturas, modelo, entorno, subida de las texturas y cada *shader*), con
 * una pausa entre ellos para que el navegador atienda lo demás: ninguna tarea larga.
 */
import {
  Box3,
  BufferGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BODY,
  DECK_HEIGHT,
  LAYER_CONTROLS,
  samePose,
  SCREEN,
  TRAY,
  type ControlId,
  type InstrumentPose,
} from '../instrument';
import { SHADOW_RADIUS, shadowRing, shotPoints, silhouette } from './camera/shots';
import {
  blend,
  ease,
  fit,
  FOV,
  orbitPlacement,
  place,
  shotPlacement,
  VIEW_ANGLES,
  type CameraPlacement,
} from './camera/views';
import { disposeObject } from './dispose';
import {
  createMaterials,
  materialList,
  materialTextures,
  type InstrumentMaterials,
} from './materials/materials';
import { printTexture } from './materials/print';
import {
  ScreenPainter,
  screenOverlay,
  type ScreenLane,
  type ScreenOverlay,
} from './materials/screen';
import { contactShadowTexture, labelTexture, loadScreenFont } from './materials/textures';
import { MM, rad } from './model/geometry';
import { Highlight } from './model/highlight';
import { buildInstrument, type InstrumentModel } from './model/instrument';
import { applyPose } from './model/pose';
import {
  ORBIT_LIMITS,
  type CameraGoal,
  type ControlBox,
  type Orbit,
  type SceneMotion,
  type Shot,
  type View,
  type Waveform,
} from './options';
import { controlShapes, projectControls, type ControlShape } from './projection';
import {
  antialiasFor,
  drawingBufferBytes,
  FrameMonitor,
  initialQuality,
  pixelRatioFor,
  QUALITY,
  textureBytes,
  type DeviceHints,
  type QualityLevel,
} from './quality';

export interface SceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly pose: InstrumentPose;
  /** El nivel con el que se empieza; si no, el que toca al dispositivo. */
  readonly quality?: QualityLevel;
  /** Lo que encuadra la cámara al empezar; si no, el aparato entero («Tocar», completo). */
  readonly camera?: CameraGoal;
  /** `?captura=1`: todo fijo, en calidad alta y sin bajada automática. */
  readonly capture: boolean;
  readonly onEvent?: (event: SceneEvent) => void;
}

export type SceneEvent =
  /** El primer fotograma ya está pintado. */
  | { readonly type: 'ready' }
  | { readonly type: 'context-lost' }
  | { readonly type: 'context-restored' }
  | { readonly type: 'quality'; readonly level: QualityLevel; readonly automatic: boolean }
  /** La cámara o el tamaño han cambiado: las cajas de los controles ya no valen (`project()`). */
  | { readonly type: 'camera' };

/** Lo que cuesta pintar el aparato y lo que ocupa (para el informe y el indicador de desarrollo). */
export interface SceneStats {
  readonly quality: QualityLevel;
  readonly pixelRatio: number;
  readonly antialias: boolean;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  /** Fotogramas pintados desde que se creó. */
  readonly frames: number;
  /** Lo que tardó en generarse el modelo con sus texturas, en ms (la última vez). */
  readonly buildMs: number;
  /** Memoria de vídeo estimada, en MB: texturas, geometría, entorno y lienzo. */
  readonly vramMb: number;
  /** Lo que ha girado el disco (vueltas) con lo último que llegó del audio. */
  readonly disc: number;
  /** La hora del fotograma de ese giro (reloj de `performance.now()`): su velocidad, en los e2e. */
  readonly discTime: number;
  /** El control con el anillo de luz (el enfocado con el teclado o bajo el puntero), o `null`. */
  readonly highlight: ControlId | null;
  /**
   * El cuerpo de la letra de la primera fila de la pantalla, en píxeles CSS (su alto en el centro
   * de la pantalla, con esta cámara): si se lee (revisión del bloque C, hallazgo 1).
   */
  readonly screenFontPx: number;
}

/** Una medida de los FPS pintando seguido. */
export interface FrameStats {
  readonly frames: number;
  readonly fps: number;
  /** El percentil 95 de lo que tardó cada fotograma, en ms. */
  readonly p95Ms: number;
}

/** Lo más que se filtran las texturas vistas de lado. */
const MAX_ANISOTROPY = 8;
/** Lo que dura el viaje de la cámara de un encuadre a otro. */
const CAMERA_TRAVEL_MS = 650;
/** Cada cuánto, como mucho, se mira qué controles tapa otra pieza (al girar en «Inspeccionar»). */
const OCCLUSION_MS = 100;
/** Los pilotos laten con el nivel: a nivel 0, esta fracción de su luz; a nivel 1, toda. */
const PILOT_PULSE_FLOOR = 0.45;
/** Lo que se aviva el piloto de grabar con cada pulso de la cuenta previa. */
const RECORD_FLASH = 1.2;

/**
 * Lo que se construye para un nivel de calidad (y se libera entero al cambiarlo). Los rótulos de las
 * teclas llevan material propio, colgado de sus piezas; la sombra va aparte del aparato.
 */
interface Build {
  readonly level: QualityLevel;
  readonly model: InstrumentModel;
  readonly materials: InstrumentMaterials;
  readonly screen: ScreenPainter;
  readonly overlay: ScreenOverlay;
  readonly shadow: Mesh;
  /** Las piezas de los controles, para proyectarlas. */
  readonly shapes: readonly ControlShape[];
  /** Los puntos que encuadra cada encuadre de «Tocar» (y el aparato sin sombra, para el móvil). */
  readonly shots: Readonly<Record<Shot | 'aparato', readonly Vector3[]>>;
  /** La esfera que envuelve el aparato con su sombra (la órbita de «Inspeccionar»). */
  readonly sphere: Sphere;
}

/** Lo que se usa de dentro de `PMREMGenerator` (three 0.186) para compilar sus *shaders* antes. */
interface PmremInternals {
  _setSize?(cubeSize: number): void;
  _allocateTargets?(): WebGLRenderTarget;
  _pingPongRenderTarget?: WebGLRenderTarget | null;
  _blurMaterial?: Material | null;
  _ggxMaterial?: Material | null;
}

/** Cede el hilo al navegador entre dos tramos del arranque. */
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Lo que se sabe del dispositivo antes de crear el contexto. */
export function deviceHints(): DeviceHints {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    pixelRatio: globalThis.devicePixelRatio || 1,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    cores: nav.hardwareConcurrency || 0,
    memoryGb: nav.deviceMemory ?? 0,
    saveData: nav.connection?.saveData ?? false,
  };
}

export class SceneEngine {
  readonly #canvas: HTMLCanvasElement;
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #camera = new PerspectiveCamera(FOV, 1, 0.01, 10);
  readonly #onEvent: ((event: SceneEvent) => void) | undefined;
  readonly #capture: boolean;
  readonly #antialias: boolean;
  readonly #monitor: FrameMonitor;
  #level: QualityLevel;
  #pose: InstrumentPose;
  #goal: CameraGoal;
  /** Dónde está la cámara, y el viaje de un encuadre a otro (si lo hay). */
  #placement: CameraPlacement | null = null;
  #travel: { from: CameraPlacement; to: CameraPlacement; start: number } | null = null;
  /** Las cajas de los controles con la cámara de ahora (`null`: hay que proyectarlas otra vez). */
  #boxes: ControlBox[] | null = null;
  #occlusionAt = -Infinity;
  #occluded: ReadonlySet<ControlId> = new Set();
  readonly #raycaster = new Raycaster();
  #highlight: Highlight | null = null;
  #motion: SceneMotion | null = null;
  #motionTime = 0;
  /** De dónde sale el movimiento de cada fotograma mientras suena (o `null`: quieto). */
  #motionSource: ((time: number) => SceneMotion) | null = null;
  readonly #scratch = new PerspectiveCamera(FOV, 1, 0.01, 10);
  /** La luz de cada piloto (y del de grabar, el último) según la pose, sin latir. */
  #pilotBase: number[] = [];
  #waveforms: readonly Waveform[] = [];
  #build: Build | null = null;
  #environment: { readonly target: WebGLRenderTarget; readonly size: number } | null = null;
  #width = 0;
  #height = 0;
  /** El `requestAnimationFrame` pedido, o 0. */
  #frame = 0;
  #frames = 0;
  #buildMs = 0;
  #ready = false;
  #lost = false;
  #disposed = false;
  /** Los cambios de calidad, uno detrás de otro. */
  #work: Promise<void> = Promise.resolve();
  /** Pintar seguido (una medida o, desde la fase 6, algo que se mueve) hasta este momento. */
  #continuousUntil = 0;
  #benchmark: { times: number[]; last: number } | null = null;

  /** Crea el motor cuando la fuente de la pantalla está lista. Falla si no hay WebGL. */
  static async create(options: SceneOptions): Promise<SceneEngine> {
    await loadScreenFont();
    const engine = new SceneEngine(options);
    try {
      await engine.#rebuild(engine.#level);
    } catch (error) {
      engine.dispose();
      throw error;
    }
    engine.#invalidate();
    return engine;
  }

  private constructor(options: SceneOptions) {
    this.#canvas = options.canvas;
    this.#onEvent = options.onEvent;
    this.#capture = options.capture;
    this.#pose = options.pose;
    this.#goal = options.camera ?? { kind: 'shot', shot: 'completo' };
    const hints = deviceHints();
    // En las capturas, alta salvo que pidan otra (`?calidad=`), para medir cada nivel.
    this.#level = options.quality ?? (options.capture ? 'high' : initialQuality(hints));
    // El MSAA se decide al crear el contexto: con el nivel de partida.
    this.#antialias = antialiasFor(this.#level, hints.pixelRatio);
    this.#monitor = new FrameMonitor(this.#level);
    this.#renderer = new WebGLRenderer({
      canvas: this.#canvas,
      antialias: this.#antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.toneMapping = NeutralToneMapping;

    // Una luz principal cálida para los brillos del latón y del esmalte (DISENO.md §7), desde
    // arriba, algo a la izquierda y detrás: la cubierta queda en su color y los cantos de delante,
    // en penumbra. Sin sombras en tiempo real: la de contacto va pintada.
    const key = new DirectionalLight(0xfffaf3, 1.3);
    key.position.set(-0.4, 1, -0.25);
    this.#scene.add(key);
    this.#scene.environmentIntensity = 0.55;
    // La luz del techo de la habitación, inclinada hacia el fondo: vista desde arriba, el esmalte
    // del disco la reflejaba entera y se lavaba (nota de la sesión de plan, 30-10).
    this.#scene.environmentRotation.set(rad(-25), 0, 0);

    this.#canvas.addEventListener('webglcontextlost', this.#onContextLost);
    this.#canvas.addEventListener('webglcontextrestored', this.#onContextRestored);
  }

  get quality(): QualityLevel {
    return this.#level;
  }

  /** Lo que enseña cada pieza. Solo se repinta lo que cambia (la pantalla, si cambia su texto). */
  setPose(pose: InstrumentPose): void {
    // La misma que ya enseña (la de `create()`, que el escenario vuelve a pasar al tener el motor):
    // nada que pintar.
    if (samePose(pose, this.#pose)) return;
    this.#pose = pose;
    const build = this.#build;
    if (!build) return;
    this.#applyPose(build);
    this.#invalidate();
  }

  /** Una vista de las capturas (el escenario usa `setCamera`). */
  setView(view: View): void {
    this.setCamera({ kind: 'view', view });
  }

  /**
   * Lo que encuadra la cámara: un encuadre de «Tocar», la órbita de «Inspeccionar» o una vista. Con
   * `travel`, la cámara viaja hasta él (quien llama lo pide solo sin la pausa de movimiento).
   */
  setCamera(goal: CameraGoal, travel = false): void {
    this.#goal = goal;
    const build = this.#build;
    if (!build || this.#width <= 0) return;
    const to = this.#goalPlacement(build);
    const from = this.#placement;
    if (travel && from && !this.#capture) {
      this.#travel = { from, to, start: performance.now() };
      this.#continuousUntil = Math.max(this.#continuousUntil, performance.now() + CAMERA_TRAVEL_MS);
    } else {
      this.#travel = null;
      this.#applyPlacement(to);
    }
    this.#invalidate();
  }

  get camera(): CameraGoal {
    return this.#goal;
  }

  /** Desde dónde mira la cámara ahora (para empezar la órbita donde está). */
  get angles(): Orbit | null {
    const angles = this.#placement?.angles;
    return angles ? { azimuth: angles.azimuth, elevation: angles.elevation } : null;
  }

  /**
   * Las cajas de los controles en píxeles CSS del lienzo, con la cámara de ahora (se recalculan solo
   * si ha cambiado: lo avisa el evento `camera`). En la órbita, los que tapa otra pieza no se ven.
   */
  project(): readonly ControlBox[] {
    const build = this.#build;
    if (!build || this.#width <= 0) return [];
    const orbit = this.#goal.kind === 'orbit';
    const now = performance.now();
    // Mientras se gira, mirar qué tapa qué es lo caro (un rayo por control): 10 veces por segundo.
    const occlusionDue = orbit && !this.#travel && now - this.#occlusionAt >= OCCLUSION_MS;
    if (this.#boxes && !occlusionDue) return this.#boxes;
    let boxes = projectControls(
      build.shapes,
      this.#camera,
      this.#width,
      this.#height,
      occlusionDue ? { raycaster: this.#raycaster, root: build.model.root } : null,
    );
    if (occlusionDue) {
      this.#occlusionAt = now;
      this.#occluded = new Set(boxes.filter((box) => !box.visible).map((box) => box.id));
    } else if (orbit) {
      boxes = boxes.map((box) => (this.#occluded.has(box.id) ? { ...box, visible: false } : box));
    } else {
      this.#occluded = new Set();
    }
    this.#boxes = boxes;
    return boxes;
  }

  /** El anillo de luz en el control enfocado o bajo el puntero (o ninguno). */
  setHighlight(id: ControlId | null): void {
    if (this.#highlight?.set(id, this.#pose.arm)) this.#invalidate();
  }

  /**
   * Lo que se mueve con el audio en este fotograma (el escenario lo pide en cada uno mientras suena
   * o se agarra el disco): el disco, el latido de los pilotos, el destello del de grabar y los
   * cabezales y medidores de la pantalla. Solo repinta si algo cambia.
   */
  setMotion(motion: SceneMotion): void {
    this.#motion = motion;
    this.#motionTime = performance.now();
    const build = this.#build;
    if (!build) return;
    if (this.#applyMotion(build, motion)) this.#invalidate();
  }

  /**
   * Pintar seguido mientras suena: en cada fotograma, antes de pintar, se pide el movimiento a
   * `source` con la hora del fotograma (en el mismo, sin uno de retraso). Con `null`, se para: 0 fps
   * sin nada que mover.
   */
  setMotionSource(source: ((time: number) => SceneMotion) | null): void {
    this.#motionSource = source;
    if (source) this.#invalidate();
  }

  /** Las formas de onda de las capas (solo cambian cuando cambia su sonido). */
  setWaveforms(waveforms: readonly Waveform[]): void {
    this.#waveforms = waveforms;
    const build = this.#build;
    if (build && this.#paintScreen(build)) this.#invalidate();
  }

  /** Cambia de nivel a mano (y se empieza a medir de cero para la bajada automática). */
  setQuality(level: QualityLevel): Promise<void> {
    this.#monitor.reset(level);
    return this.#changeQuality(level, false);
  }

  /** El tamaño del lienzo en píxeles CSS (el motor no toca su CSS). */
  setSize(width: number, height: number): void {
    if (this.#disposed || width <= 0 || height <= 0) return;
    // El mismo tamaño otra vez (el `ResizeObserver` avisa siempre al empezar a observar), salvo
    // decimales de píxel: nada que pintar.
    const ratio = pixelRatioFor(this.#level, globalThis.devicePixelRatio || 1);
    const same =
      Math.abs(width - this.#width) < 0.5 &&
      Math.abs(height - this.#height) < 0.5 &&
      ratio === this.#renderer.getPixelRatio();
    if (same) return;
    this.#width = width;
    this.#height = height;
    this.#applySize();
    this.#invalidate();
  }

  stats(): SceneStats {
    const info = this.#renderer.info;
    return {
      quality: this.#level,
      pixelRatio: this.#renderer.getPixelRatio(),
      antialias: this.#antialias,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      frames: this.#frames,
      buildMs: Math.round(this.#buildMs * 10) / 10,
      vramMb: Math.round((this.#vramBytes() / 2 ** 20) * 10) / 10,
      disc: this.#motion?.disc ?? 0,
      discTime: Math.round(this.#motionTime * 10) / 10,
      highlight: this.#highlight?.id ?? null,
      screenFontPx: Math.round(this.#screenFontPx() * 10) / 10,
    };
  }

  /**
   * Pinta seguido durante `ms` (el disco da vueltas) y mide los FPS: la herramienta de desarrollo
   * para las cifras del informe. No baja la calidad.
   */
  benchmark(ms: number): Promise<FrameStats> {
    this.#benchmark = { times: [], last: 0 };
    this.#continuousUntil = performance.now() + ms;
    this.#invalidate();
    return new Promise((resolve) => {
      setTimeout(() => {
        const times = this.#benchmark?.times ?? [];
        this.#benchmark = null;
        this.#continuousUntil = 0;
        const disc = this.#build?.model.controls.get('disc');
        if (disc) disc.rotation.y = discAngle(this.#motion?.disc ?? 0);
        this.#invalidate();
        const sorted = [...times].sort((a, b) => a - b);
        const total = times.reduce((sum, time) => sum + time, 0);
        resolve({
          frames: times.length,
          fps: total > 0 ? Math.round((1000 * times.length * 10) / total) / 10 : 0,
          p95Ms: Math.round((sorted[Math.floor(0.95 * (sorted.length - 1))] ?? 0) * 10) / 10,
        });
      }, ms + 50);
    });
  }

  /** Pierde el contexto a propósito (para probar que se recupera; desarrollo y e2e). */
  loseContext(): void {
    this.#renderer.forceContextLoss();
  }

  restoreContext(): void {
    this.#renderer.forceContextRestore();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#canvas.removeEventListener('webglcontextlost', this.#onContextLost);
    this.#canvas.removeEventListener('webglcontextrestored', this.#onContextRestored);
    if (this.#build) this.#disposeBuild(this.#build);
    this.#build = null;
    this.#highlight?.dispose();
    this.#highlight = null;
    this.#environment?.target.dispose();
    this.#environment = null;
    this.#renderer.dispose();
    // El contexto también, sin esperar al recolector: Chrome pierde el más antiguo pasados 16.
    this.#renderer.forceContextLoss();
  }

  // --- Construcción -----------------------------------------------------------------------------

  #changeQuality(level: QualityLevel, automatic: boolean): Promise<void> {
    this.#work = this.#work.then(async () => {
      if (this.#disposed || level === this.#build?.level) return;
      await this.#rebuild(level);
      this.#onEvent?.({ type: 'quality', level, automatic });
      this.#invalidate();
    });
    return this.#work;
  }

  async #rebuild(level: QualityLevel): Promise<void> {
    const settings = QUALITY[level];
    // Lo que se mide es la generación (texturas y modelo), sin las pausas entre tramos.
    let start = performance.now();
    const materials = createMaterials({ grainSize: settings.grainSize });
    let elapsed = performance.now() - start;
    await yieldToMain();
    start = performance.now();
    const model = buildInstrument(materials, settings);
    const screen = new ScreenPainter();
    materials.screen.emissiveMap = screen.texture;
    const overlay = screenOverlay(
      materials.screen,
      (screen.texture.image as { width: number }).width,
    );
    materials.print.map = printTexture(settings.printSize);
    for (const [icon, label] of model.labels) {
      label.material = new MeshStandardMaterial({
        name: `rótulo ${icon}`,
        map: labelTexture(icon),
        transparent: true,
        roughness: 0.5,
        // Encima de la tecla sin pelearse con ella por la profundidad.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
    }
    const shadow = contactShadow();
    model.root.updateMatrixWorld(true);
    const shapes = controlShapes(model);
    const outline = [...silhouette(model), ...shadowRing()];
    const sphere = new Box3().setFromPoints(outline).getBoundingSphere(new Sphere());
    const build: Build = {
      level,
      model,
      materials,
      screen,
      overlay,
      shadow,
      shapes,
      shots: shotPoints(model, shapes, outline),
      sphere,
    };
    this.#applyPose(build);
    const anisotropy = Math.min(MAX_ANISOTROPY, this.#renderer.capabilities.getMaxAnisotropy());
    for (const texture of materialTextures(materials)) texture.anisotropy = anisotropy;
    elapsed += performance.now() - start;
    this.#buildMs = elapsed;
    await yieldToMain();
    if (this.#disposed) {
      this.#disposeBuild(build);
      return;
    }

    // El entorno nuevo, si cambia de tamaño, aparte: el de ahora sigue en la escena hasta el cambio.
    const previous = this.#environment;
    const environment =
      previous?.size === settings.environmentSize
        ? previous
        : await this.#makeEnvironment(settings.environmentSize);
    await yieldToMain();

    // Antes de enseñarlo: las texturas a la GPU y los *shaders* compilados (con el entorno nuevo), de
    // uno en uno y con una pausa entre ellos. Mientras, se sigue viendo lo de antes.
    await this.#prepare([model.root, shadow], environment.target.texture);
    if (this.#disposed) {
      this.#disposeBuild(build);
      if (environment !== previous) environment.target.dispose();
      return;
    }

    // La pose de ahora (pudo cambiar mientras se construía) y, a la vez, el aparato y el entorno.
    this.#applyPose(build);
    const old = this.#build;
    this.#build = build;
    this.#scene.add(model.root, shadow);
    if (!this.#highlight) {
      this.#highlight = new Highlight(settings.smallSegments);
      this.#scene.add(this.#highlight.mesh);
    }
    this.#environment = environment;
    this.#scene.environment = environment.target.texture;
    if (old) {
      this.#scene.remove(old.model.root, old.shadow);
      this.#disposeBuild(old);
    }
    if (previous && previous !== environment) previous.target.dispose();
    this.#level = level;
    this.#applySize();
  }

  /** La pose en las piezas, la pantalla y lo que late encima (si suena). */
  #applyPose(build: Build): void {
    applyPose(build.model, build.materials, this.#pose);
    this.#pilotBase = [
      ...build.materials.pilots.map((material) => material.emissiveIntensity),
      build.materials.ledRecord.emissiveIntensity,
    ];
    this.#paintScreen(build);
    if (this.#motion) this.#applyMotion(build, this.#motion);
    if (this.#highlight?.id === 'arm') this.#highlight.set('arm', this.#pose.arm);
  }

  /** La pantalla: el texto y, en la principal, los carriles de las capas. Dice si ha repintado. */
  #paintScreen(build: Build): boolean {
    const pose = this.#pose;
    const lanes: ScreenLane[] = pose.layers.map((layer, i) => ({
      waveform: this.#waveforms[i] ?? null,
      active: layer.pilot !== 'off',
      muted: layer.muted,
      selected: i === pose.selected,
    }));
    const painted = build.screen.paint(pose.display, lanes);
    build.overlay.setLanes(build.screen.lanes);
    return painted;
  }

  /** El movimiento de un fotograma en las piezas. Dice si ha cambiado algo que se ve. */
  #applyMotion(build: Build, motion: SceneMotion): boolean {
    let changed = false;
    const disc = build.model.controls.get('disc');
    const angle = discAngle(motion.disc);
    if (disc && disc.rotation.y !== angle) {
      disc.rotation.y = angle;
      changed = true;
    }
    build.materials.pilots.forEach((material, i) => {
      const base = this.#pilotBase[i] ?? material.emissiveIntensity;
      // Solo laten los que tienen sonido (no la cola ni la grabación, que avisan de otra cosa).
      const level = motion.levels[i] ?? 0;
      const intensity =
        this.#pose.layers[i]?.pilot === 'content'
          ? base * (PILOT_PULSE_FLOOR + (1 - PILOT_PULSE_FLOOR) * level)
          : base;
      if (material.emissiveIntensity !== intensity) {
        material.emissiveIntensity = intensity;
        changed = true;
      }
    });
    const recordBase = this.#pilotBase[LAYER_CONTROLS.length] ?? 0;
    const record =
      this.#pose.recordLight === 'count-in'
        ? recordBase + RECORD_FLASH * motion.recordFlash
        : recordBase;
    if (build.materials.ledRecord.emissiveIntensity !== record) {
      build.materials.ledRecord.emissiveIntensity = record;
      changed = true;
    }
    if (build.overlay.set(motion.heads, motion.levels)) changed = true;
    return changed;
  }

  /**
   * Sube las texturas y compila los *shaders* de lo nuevo, de uno en uno y sin bloquear (`#gpuIdle`
   * y `compileAsync`): así la GPU tampoco se queda medio segundo sin pintar la página.
   */
  async #prepare(roots: readonly Object3D[], environment: Texture): Promise<void> {
    const materials = new Set<Material>();
    const firsts: Mesh[] = [];
    for (const root of roots) {
      root.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as Material;
        if (materials.has(material)) return;
        materials.add(material);
        firsts.push(mesh);
      });
    }
    const textures = new Set<Texture>();
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if ((value as Partial<Texture> | null)?.isTexture) textures.add(value as Texture);
      }
    }
    for (const texture of textures) {
      if (this.#disposed) return;
      this.#renderer.initTexture(texture);
      await this.#gpuIdle();
    }
    // Una escena con lo que entra en la clave de los programas: el entorno nuevo y las mismas luces.
    const target = new Scene();
    target.environment = environment;
    target.add(new DirectionalLight());
    for (const mesh of firsts) {
      if (this.#disposed) return;
      await this.#renderer.compileAsync(mesh, this.#camera, target);
      await yieldToMain();
    }
  }

  /**
   * Espera, sin bloquear, a que la GPU termine lo que tiene pendiente (subir una textura, pintar el
   * entorno). Una valla de WebGL 2 solo cambia de estado entre tareas, así que preguntarle no espera.
   */
  async #gpuIdle(): Promise<void> {
    const gl = this.#renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return;
    gl.flush();
    while (
      !this.#disposed &&
      !gl.isContextLost() &&
      gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, 8));
    }
    gl.deleteSync(sync);
  }

  /**
   * El entorno: la habitación de `RoomEnvironment` pasada por PMREM. Sus *shaders* (los de la
   * habitación y los del desenfoque y el GGX de PMREM) se compilan antes, con `compileAsync`: con la
   * caché de *shaders* vacía (una primera visita), compilarlos al pintar el entorno era una tarea de
   * más de 600 ms (medido con D3D11 en una RTX 3060), esperando a la GPU en `getUniforms`. Los dos
   * últimos son de dentro de `PMREMGenerator` (three 0.186): si otra versión los cambia, se compilan
   * al pintar, como antes.
   */
  async #makeEnvironment(size: number): Promise<{ target: WebGLRenderTarget; size: number }> {
    const pmrem = new PMREMGenerator(this.#renderer);
    const room = new RoomEnvironment();
    const camera = new OrthographicCamera();
    const internals = pmrem as unknown as PmremInternals;
    const precompile: Object3D[] = [room];
    // Solo con posición, como las mallas de PMREM: lo que tiene la geometría (posición, normales)
    // entra en la clave del programa.
    const quad = new BufferGeometry();
    quad.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    if (
      typeof internals._setSize === 'function' &&
      typeof internals._allocateTargets === 'function'
    ) {
      // Con el mismo tamaño, `fromScene` reutiliza estos materiales: ya estarán compilados.
      internals._setSize(size);
      internals._allocateTargets().dispose();
      for (const material of [internals._blurMaterial, internals._ggxMaterial]) {
        if (material) precompile.push(new Mesh(quad, material));
      }
    }
    // Igual que los pintará PMREM (en su destino lineal, sin tone mapping): si no, sus programas no
    // coincidirían con estos y se volverían a compilar al pintar, bloqueando.
    const renderer = this.#renderer;
    const target = renderer.getRenderTarget();
    const toneMapping = renderer.toneMapping;
    for (const object of precompile) {
      if (this.#disposed) break;
      renderer.setRenderTarget(internals._pingPongRenderTarget ?? null);
      renderer.toneMapping = NoToneMapping;
      const compiled = renderer.compileAsync(object, camera);
      renderer.setRenderTarget(target);
      renderer.toneMapping = toneMapping;
      await compiled;
      await yieldToMain();
    }
    const environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size });
    room.dispose();
    pmrem.dispose();
    quad.dispose();
    await this.#gpuIdle();
    return { target: environment, size };
  }

  /** Las piezas, todos los materiales (los rótulos incluidos) y sus texturas, cada uno una vez. */
  #disposeBuild(build: Pick<Build, 'model' | 'materials' | 'shadow'>): void {
    disposeObject(build.model.root, materialList(build.materials));
    disposeObject(build.shadow);
  }

  // --- Tamaño y encuadre --------------------------------------------------------------------------

  #applySize(): void {
    if (this.#width <= 0 || this.#height <= 0) return;
    const ratio = pixelRatioFor(this.#level, globalThis.devicePixelRatio || 1);
    this.#renderer.setPixelRatio(ratio);
    this.#renderer.setSize(this.#width, this.#height, false);
    this.#camera.aspect = this.#width / this.#height;
    this.#camera.updateProjectionMatrix();
    const build = this.#build;
    if (!build) return;
    // Otro tamaño, otro encuadre (el del móvil, si el lienzo pasa a cuadrado): sin viaje.
    this.#travel = null;
    this.#applyPlacement(this.#goalPlacement(build));
  }

  /** Dónde tiene que acabar la cámara para lo que se encuadra ahora. */
  #goalPlacement(build: Build): CameraPlacement {
    const scratch = this.#scratch;
    scratch.aspect = this.#camera.aspect;
    scratch.updateProjectionMatrix();
    const goal = this.#goal;
    switch (goal.kind) {
      case 'view':
        return fit(scratch, VIEW_ANGLES[goal.view], build.shots.completo);
      case 'shot':
        return shotPlacement(scratch, goal.shot, build.shots);
      case 'orbit':
        return orbitPlacement(
          scratch,
          clampOrbit(goal.orbit),
          build.sphere.center,
          build.sphere.radius,
        );
    }
  }

  /** Pone la cámara (y ajusta lo que ve de cerca y de lejos); las cajas de los controles caducan. */
  #applyPlacement(placement: CameraPlacement): void {
    place(this.#camera, placement);
    this.#camera.near = placement.distance / 20;
    this.#camera.far = placement.distance * 4;
    this.#camera.updateProjectionMatrix();
    this.#placement = placement;
    this.#boxes = null;
    this.#onEvent?.({ type: 'camera' });
  }

  /** El cuerpo de la primera fila de la pantalla, en píxeles CSS, con la cámara de ahora. */
  #screenFontPx(): number {
    const build = this.#build;
    if (!build || this.#height <= 0) return 0;
    const lean = Math.tan(rad(TRAY.lean));
    const point = (height: number) =>
      new Vector3(0, (DECK_HEIGHT + height) * MM, -(TRAY.innerRadius + height * lean) * MM).project(
        this.#camera,
      );
    const top = point(SCREEN.top);
    const bottom = point(SCREEN.bottom);
    const pixels = Math.hypot(
      ((top.x - bottom.x) / 2) * this.#width,
      ((top.y - bottom.y) / 2) * this.#height,
    );
    return pixels * build.screen.firstRowFont;
  }

  // --- Bucle bajo demanda --------------------------------------------------------------------------

  #invalidate(): void {
    if (this.#frame || this.#disposed || this.#lost || !this.#build) return;
    this.#frame = requestAnimationFrame((time) => this.#render(time));
  }

  #render(time: number): void {
    this.#frame = 0;
    if (this.#disposed || this.#lost || !this.#build) return;
    const build = this.#build;
    const travel = this.#travel;
    if (travel) {
      const t = (performance.now() - travel.start) / CAMERA_TRAVEL_MS;
      if (t >= 1) this.#travel = null;
      this.#applyPlacement(t >= 1 ? travel.to : blend(travel.from, travel.to, ease(t)));
    }
    if (this.#motionSource) {
      this.#motion = this.#motionSource(time);
      this.#motionTime = time;
      this.#applyMotion(build, this.#motion);
    }
    const benchmark = this.#benchmark;
    if (benchmark) {
      if (benchmark.last > 0) benchmark.times.push(time - benchmark.last);
      benchmark.last = time;
      const disc = build.model.controls.get('disc');
      if (disc) disc.rotation.y = (time / 1000) * Math.PI;
    }
    this.#renderer.render(this.#scene, this.#camera);
    this.#frames++;
    if (!this.#ready) {
      this.#ready = true;
      this.#onEvent?.({ type: 'ready' });
    }
    const moving = this.#motionSource !== null || this.#travel !== null;
    if (moving || performance.now() < this.#continuousUntil) {
      if (!benchmark && !this.#capture) {
        const lower = this.#monitor.frame(time);
        if (lower) void this.#changeQuality(lower, true);
      }
      this.#invalidate();
    } else {
      this.#monitor.pause();
    }
  }

  // --- Pérdida del contexto -----------------------------------------------------------------------

  readonly #onContextLost = (): void => {
    // `three` ya ha llamado a `preventDefault()`: el navegador lo podrá devolver.
    this.#lost = true;
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#onEvent?.({ type: 'context-lost' });
  };

  readonly #onContextRestored = (): void => {
    if (this.#disposed) return;
    // `three` ya ha rehecho su estado: las geometrías y las texturas de datos y de canvas se vuelven
    // a subir solas al pintar. Lo que se pintó en la GPU (el entorno) hay que hacerlo otra vez; hasta
    // entonces no se pinta (sigue «perdido»).
    const size = this.#environment?.size ?? QUALITY[this.#level].environmentSize;
    this.#environment?.target.dispose();
    this.#environment = null;
    this.#scene.environment = null;
    void this.#makeEnvironment(size).then((environment) => {
      if (this.#disposed) {
        environment.target.dispose();
        return;
      }
      this.#environment = environment;
      this.#scene.environment = environment.target.texture;
      this.#lost = false;
      this.#onEvent?.({ type: 'context-restored' });
      this.#invalidate();
    });
  };

  // --- Memoria -------------------------------------------------------------------------------------

  #vramBytes(): number {
    let bytes = 0;
    const textures = new Set<Texture>();
    const geometries = new Set<BufferGeometry>();
    this.#scene.traverse((object) => {
      const mesh = object as Partial<Mesh>;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const material = mesh.material;
      for (const item of Array.isArray(material) ? material : material ? [material] : []) {
        for (const value of Object.values(item)) {
          if ((value as Partial<Texture> | null)?.isTexture) textures.add(value as Texture);
        }
      }
    });
    for (const texture of textures) {
      const image = texture.image as { width?: number; height?: number } | undefined;
      if (!image?.width || !image.height) continue;
      bytes += textureBytes({
        width: image.width,
        height: image.height,
        bytesPerTexel: 4,
        mipmaps: texture.generateMipmaps,
      });
    }
    for (const geometry of geometries) {
      for (const attribute of Object.values(geometry.attributes)) {
        bytes += (attribute.array as ArrayLike<number> & { byteLength: number }).byteLength;
      }
      bytes += geometry.index?.array.byteLength ?? 0;
    }
    // El entorno: RGBA de media precisión (8 bytes por texel), sin mipmaps.
    const environment = this.#environment?.target;
    if (environment) bytes += environment.width * environment.height * 8;
    const gl = this.#renderer.getContext();
    const samples = this.#antialias ? Number(gl.getParameter(gl.SAMPLES)) || 4 : 0;
    bytes += drawingBufferBytes(this.#canvas.width, this.#canvas.height, samples);
    return bytes;
  }
}

/** La sombra de contacto: un plano en la mesa con un degradado, pintado una vez. */
function contactShadow(): Mesh {
  const shadow = new Mesh(
    new PlaneGeometry(2 * SHADOW_RADIUS * MM, 2 * SHADOW_RADIUS * MM),
    new MeshBasicMaterial({
      name: 'sombra de contacto',
      map: contactShadowTexture(BODY.baseRadius / SHADOW_RADIUS, BODY.radius / SHADOW_RADIUS),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  shadow.name = 'sombra de contacto';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.2 * MM;
  return shadow;
}

/** El giro del disco para unas vueltas: en el sentido de las agujas del reloj visto desde arriba. */
function discAngle(turns: number): number {
  return -2 * Math.PI * (turns % 1);
}

function clampOrbit({ azimuth, elevation }: Orbit): Orbit {
  const { azimuth: a, elevation: e } = ORBIT_LIMITS;
  return {
    azimuth: Math.min(a.max, Math.max(a.min, azimuth)),
    elevation: Math.min(e.max, Math.max(e.min, elevation)),
  };
}
