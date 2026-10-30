/**
 * El motor del 3D (PLAN §4.6 y fase 5.b): monta el aparato en un lienzo, le pone la pose que le
 * llega (lo que enseña cada pieza), lo encuadra y lo pinta **solo cuando algo cambia** (0 fps
 * quieto). Lleva la calidad (y la baja sola si los FPS no llegan), recupera la pérdida del contexto
 * y lo libera todo en `dispose()`. No sabe nada del audio ni de Angular: lo carga `scene/index.ts`
 * con `import()`.
 *
 * El arranque va por tramos (texturas, modelo, entorno y *shaders*, estos con `compileAsync`), con
 * una pausa entre ellos para que el navegador atienda lo demás: ninguna tarea larga.
 */
import {
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BODY, type InstrumentPose } from '../instrument';
import { FOV, frame, VIEW_ANGLES } from './camera/views';
import { disposeObject } from './dispose';
import {
  createMaterials,
  materialList,
  materialTextures,
  type InstrumentMaterials,
} from './materials/materials';
import { printTexture } from './materials/print';
import { ScreenPainter } from './materials/screen';
import { contactShadowTexture, labelTexture, loadScreenFont } from './materials/textures';
import { MM, rad } from './model/geometry';
import { buildInstrument, type InstrumentModel } from './model/instrument';
import { applyPose } from './model/pose';
import type { View } from './options';
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
  readonly view?: View;
  /** `?captura=1`: todo fijo, en calidad alta y sin bajada automática. */
  readonly capture: boolean;
  readonly onEvent?: (event: SceneEvent) => void;
}

export type SceneEvent =
  /** El primer fotograma ya está pintado. */
  | { readonly type: 'ready' }
  | { readonly type: 'context-lost' }
  | { readonly type: 'context-restored' }
  | { readonly type: 'quality'; readonly level: QualityLevel; readonly automatic: boolean };

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
}

/** Una medida de los FPS pintando seguido. */
export interface FrameStats {
  readonly frames: number;
  readonly fps: number;
  /** El percentil 95 de lo que tardó cada fotograma, en ms. */
  readonly p95Ms: number;
}

/** Lado del plano de la sombra de contacto, en mm. */
const SHADOW_SIZE = 440;
/** Cada cuántos vértices se toma uno para la silueta del encuadre. */
const SILHOUETTE_STEP = 5;
/** Lo más que se filtran las texturas vistas de lado. */
const MAX_ANISOTROPY = 8;

/**
 * Lo que se construye para un nivel de calidad (y se libera entero al cambiarlo). Los rótulos de las
 * teclas llevan material propio, colgado de sus piezas; la sombra va aparte del aparato.
 */
interface Build {
  readonly level: QualityLevel;
  readonly model: InstrumentModel;
  readonly materials: InstrumentMaterials;
  readonly screen: ScreenPainter;
  readonly shadow: Mesh;
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
  #view: View;
  #build: Build | null = null;
  #environment: { readonly target: WebGLRenderTarget; readonly size: number } | null = null;
  #silhouette: Vector3[] = [];
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
    this.#view = options.view ?? 'frente';
    const hints = deviceHints();
    this.#level = options.capture ? 'high' : (options.quality ?? initialQuality(hints));
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
    this.#pose = pose;
    const build = this.#build;
    if (!build) return;
    applyPose(build.model, build.materials, pose);
    build.screen.paint(pose.display);
    this.#invalidate();
  }

  setView(view: View): void {
    if (view === this.#view) return;
    this.#view = view;
    this.#frameView();
    this.#invalidate();
  }

  /** Cambia de nivel a mano (y se empieza a medir de cero para la bajada automática). */
  setQuality(level: QualityLevel): Promise<void> {
    this.#monitor.reset(level);
    return this.#changeQuality(level, false);
  }

  /** El tamaño del lienzo en píxeles CSS (el motor no toca su CSS). */
  setSize(width: number, height: number): void {
    if (this.#disposed || width <= 0 || height <= 0) return;
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
        if (disc) disc.rotation.y = 0;
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
    this.#environment?.target.dispose();
    this.#environment = null;
    this.#renderer.dispose();
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
    screen.paint(this.#pose.display);
    materials.screen.emissiveMap = screen.texture;
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
    applyPose(model, materials, this.#pose);
    const anisotropy = Math.min(MAX_ANISOTROPY, this.#renderer.capabilities.getMaxAnisotropy());
    for (const texture of materialTextures(materials)) texture.anisotropy = anisotropy;
    elapsed += performance.now() - start;
    this.#buildMs = elapsed;
    await yieldToMain();
    if (this.#disposed) {
      this.#disposeBuild({ level, model, materials, screen, shadow });
      return;
    }

    if (this.#environment?.size !== settings.environmentSize) {
      this.#environment?.target.dispose();
      this.#environment = null;
      this.#environment = this.#makeEnvironment(settings.environmentSize);
      await yieldToMain();
    }

    const old = this.#build;
    this.#build = { level, model, materials, screen, shadow };
    this.#scene.add(model.root, shadow);
    if (old) {
      this.#scene.remove(old.model.root, old.shadow);
      this.#disposeBuild(old);
    }
    this.#level = level;
    model.root.updateMatrixWorld(true);
    this.#silhouette = silhouette(model);
    this.#applySize();
    // Los *shaders*, sin bloquear (KHR_parallel_shader_compile donde lo haya).
    await this.#renderer.compileAsync(this.#scene, this.#camera);
  }

  #makeEnvironment(size: number): { target: WebGLRenderTarget; size: number } {
    const pmrem = new PMREMGenerator(this.#renderer);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04, 0.1, 100, { size });
    room.dispose();
    pmrem.dispose();
    this.#scene.environment = target.texture;
    return { target, size };
  }

  /** Las piezas, todos los materiales (los rótulos incluidos) y sus texturas, cada uno una vez. */
  #disposeBuild(build: Build): void {
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
    this.#frameView();
  }

  #frameView(): void {
    if (this.#silhouette.length === 0) return;
    const target = frame(this.#camera, VIEW_ANGLES[this.#view], this.#silhouette);
    const distance = this.#camera.position.distanceTo(target);
    this.#camera.near = distance / 20;
    this.#camera.far = distance * 4;
    this.#camera.updateProjectionMatrix();
  }

  // --- Bucle bajo demanda --------------------------------------------------------------------------

  #invalidate(): void {
    if (this.#frame || this.#disposed || this.#lost || !this.#build) return;
    this.#frame = requestAnimationFrame((time) => this.#render(time));
  }

  #render(time: number): void {
    this.#frame = 0;
    if (this.#disposed || this.#lost || !this.#build) return;
    const benchmark = this.#benchmark;
    if (benchmark) {
      if (benchmark.last > 0) benchmark.times.push(time - benchmark.last);
      benchmark.last = time;
      const disc = this.#build.model.controls.get('disc');
      if (disc) disc.rotation.y = (time / 1000) * Math.PI;
    }
    this.#renderer.render(this.#scene, this.#camera);
    this.#frames++;
    if (!this.#ready) {
      this.#ready = true;
      this.#onEvent?.({ type: 'ready' });
    }
    if (performance.now() < this.#continuousUntil) {
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
    // a subir solas al pintar. Lo que se pintó en la GPU (el entorno) hay que hacerlo otra vez.
    this.#lost = false;
    const size = this.#environment?.size ?? QUALITY[this.#level].environmentSize;
    this.#environment?.target.dispose();
    this.#environment = this.#makeEnvironment(size);
    this.#onEvent?.({ type: 'context-restored' });
    this.#invalidate();
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
    new PlaneGeometry(SHADOW_SIZE * MM, SHADOW_SIZE * MM),
    new MeshBasicMaterial({
      name: 'sombra de contacto',
      map: contactShadowTexture(BODY.radius / (SHADOW_SIZE / 2)),
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

/** Unos cuantos vértices de todo el aparato, en coordenadas de la escena: su silueta. */
function silhouette(model: InstrumentModel): Vector3[] {
  const points: Vector3[] = [];
  model.root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += SILHOUETTE_STEP) {
      points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    }
  });
  return points;
}
