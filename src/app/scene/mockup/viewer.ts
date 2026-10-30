/**
 * Visor de la maqueta (PLAN fase 5.a): el aparato en bloques con la variante, el *tone mapping* y
 * la vista elegidos, y órbita libre para inspeccionarlo. Pinta solo cuando algo cambia (0 fps
 * quieto) y lo libera todo en `dispose()`. Lo carga `scene/index.ts` con `import()`.
 */
import {
  AgXToneMapping,
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
  type Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BODY } from '../../instrument';
import { FOV, frame, VIEW_ANGLES } from '../camera/views';
import { disposeObject } from '../dispose';
import { applyVariant, createMaterials, type InstrumentMaterials } from '../materials/materials';
import {
  contactShadowTexture,
  labelTexture,
  loadScreenFont,
  screenTexture,
} from '../materials/textures';
import { MM, rad } from '../model/geometry';
import { buildInstrument, type InstrumentModel } from '../model/instrument';
import type { ToneMapping, Variant, View } from './options';

export interface MockupState {
  readonly variant: Variant;
  readonly toneMapping: ToneMapping;
  readonly view: View;
}

export interface MockupOptions {
  readonly canvas: HTMLCanvasElement;
  readonly state: MockupState;
  /** El texto de la pantalla (las líneas del modelo de pantalla). */
  readonly screenLines: readonly string[];
  /** `?captura=1`: sin órbita, todo fijo. */
  readonly capture: boolean;
  /** Tras cada fotograma pintado. */
  readonly onRender?: () => void;
}

/** Cifras para el informe: lo que cuesta pintar la maqueta y lo que ocupa. */
export interface MockupStats {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  /** Lo que tardaron en generarse el modelo y sus texturas, en ms. */
  readonly buildMs: number;
}

const TONE_MAPPING = { neutral: NeutralToneMapping, agx: AgXToneMapping } as const;
/** Lado del plano de la sombra de contacto, en mm. */
const SHADOW_SIZE = 440;
/** Más de 2 píxeles por píxel CSS no se notan y cuestan el doble o más (PLAN §4.6). */
const MAX_PIXEL_RATIO = 2;
/** Cada cuántos vértices se toma uno para la silueta del encuadre. */
const SILHOUETTE_STEP = 5;

export class MockupViewer {
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #camera = new PerspectiveCamera(FOV, 1, 0.01, 10);
  readonly #controls: OrbitControls | null;
  readonly #materials: InstrumentMaterials;
  readonly #model: InstrumentModel;
  readonly #environment: Texture;
  readonly #pmrem: PMREMGenerator;
  readonly #silhouette: Vector3[];
  readonly #onRender: (() => void) | undefined;
  readonly #buildMs: number;
  #state: MockupState;
  #frame = 0;
  #disposed = false;

  /** Crea el visor cuando la fuente de la pantalla está lista. Falla si no hay WebGL. */
  static async create(options: MockupOptions): Promise<MockupViewer> {
    await loadScreenFont();
    return new MockupViewer(options);
  }

  private constructor(options: MockupOptions) {
    this.#state = options.state;
    this.#onRender = options.onRender;
    this.#renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.toneMapping = TONE_MAPPING[this.#state.toneMapping];

    // Luz: el entorno de una habitación para los reflejos y una luz principal cálida para los
    // brillos del latón y del esmalte (DISENO.md §7). Sin sombras en tiempo real.
    this.#pmrem = new PMREMGenerator(this.#renderer);
    const room = new RoomEnvironment();
    this.#environment = this.#pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    this.#scene.environment = this.#environment;
    this.#scene.environmentIntensity = 0.55;
    // Desde arriba, algo a la izquierda y detrás: la cubierta queda en su color, los cantos de
    // delante en penumbra y el esmalte y el latón con su brillo hacia la cámara.
    const key = new DirectionalLight(0xfffaf3, 1.3);
    key.position.set(-0.4, 1, -0.25);
    this.#scene.add(key);

    const start = performance.now();
    this.#materials = createMaterials(this.#state.variant);
    this.#model = buildInstrument(this.#materials);
    this.#dress(options.screenLines);
    this.#scene.add(this.#model.root, this.#contactShadow());
    this.#buildMs = performance.now() - start;
    this.#model.root.updateMatrixWorld(true);
    this.#silhouette = silhouette(this.#model);

    if (options.capture) {
      this.#controls = null;
    } else {
      const controls = new OrbitControls(this.#camera, options.canvas);
      controls.enableDamping = false;
      controls.enablePan = false;
      controls.maxPolarAngle = rad(88);
      controls.addEventListener('change', () => this.#invalidate());
      this.#controls = controls;
    }
  }

  /** Cambia la variante, el *tone mapping* o la vista (la vista vuelve a encuadrar). */
  setState(state: MockupState): void {
    const before = this.#state;
    this.#state = state;
    if (state.variant !== before.variant) applyVariant(this.#materials, state.variant);
    if (state.toneMapping !== before.toneMapping) {
      this.#renderer.toneMapping = TONE_MAPPING[state.toneMapping];
    }
    if (state.view !== before.view) this.#frameView();
    this.#invalidate();
  }

  /** El tamaño del lienzo en píxeles CSS (el visor no toca su CSS). */
  setSize(width: number, height: number): void {
    if (this.#disposed || width <= 0 || height <= 0) return;
    this.#renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#frameView();
    this.#invalidate();
  }

  stats(): MockupStats {
    const info = this.#renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      buildMs: this.#buildMs,
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    cancelAnimationFrame(this.#frame);
    this.#controls?.dispose();
    disposeObject(this.#scene);
    this.#environment.dispose();
    this.#pmrem.dispose();
    this.#renderer.dispose();
  }

  /** Las texturas de canvas: la pantalla y los rótulos. */
  #dress(screenLines: readonly string[]): void {
    const screen = screenTexture(screenLines);
    screen.anisotropy = this.#renderer.capabilities.getMaxAnisotropy();
    this.#materials.screen.emissiveMap = screen;
    for (const [icon, label] of this.#model.labels) {
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
  }

  /** La sombra de contacto: un plano en la mesa con un degradado, pintado una vez. */
  #contactShadow(): Mesh {
    const shadow = new Mesh(
      new PlaneGeometry(SHADOW_SIZE * MM, SHADOW_SIZE * MM),
      new MeshBasicMaterial({
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

  #frameView(): void {
    const target = frame(this.#camera, VIEW_ANGLES[this.#state.view], this.#silhouette);
    const distance = this.#camera.position.distanceTo(target);
    this.#camera.near = distance / 20;
    this.#camera.far = distance * 4;
    this.#camera.updateProjectionMatrix();
    const controls = this.#controls;
    if (controls) {
      controls.target.copy(target);
      controls.minDistance = distance * 0.45;
      controls.maxDistance = distance * 1.8;
      controls.update();
    }
  }

  #invalidate(): void {
    if (this.#frame || this.#disposed) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#renderer.render(this.#scene, this.#camera);
      this.#onRender?.();
    });
  }
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
