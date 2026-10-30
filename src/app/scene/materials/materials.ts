/**
 * Los materiales del aparato (PLAN §4.6; DISENO.md §7): `MeshPhysicalMaterial` con las texturas
 * procedurales de la cerámica y del moleteado. Los colores se escriben en sRGB; `three` los pasa a
 * lineal. Los pilotos tienen un material cada uno: su luz depende del estado de su capa.
 */
import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Texture,
} from 'three';
import { LAYER_COUNT } from '../../instrument';
import { PALETTE } from './palette';
import { CERAMIC_ROUGHNESS, COLOR_MEAN } from './procedural';
import { ceramicTextures, knurlTexture } from './textures';

export interface InstrumentMaterials {
  /** Barro cocido: el cuerpo, la cubierta y la bandeja. */
  readonly body: MeshPhysicalMaterial;
  /** Esmalte oliva del disco, más oscuro hacia el borde (colores por vértice). */
  readonly glaze: MeshPhysicalMaterial;
  /** Latón cepillado en círculo: el anillo del disco, el cubo y las tapas de los diales. */
  readonly brass: MeshPhysicalMaterial;
  /** Latón moleteado: el faldón de los diales y el canto de la rueda. */
  readonly knurl: MeshPhysicalMaterial;
  /** Latón liso: el brazo y los tornillos. */
  readonly brassPlain: MeshPhysicalMaterial;
  readonly key: MeshPhysicalMaterial;
  readonly screen: MeshPhysicalMaterial;
  /** Lo impreso en la cubierta (rótulos y escalas): engobe crema sobre el barro. */
  readonly print: MeshStandardMaterial;
  /** Un piloto por capa, y el de grabar. */
  readonly pilots: readonly MeshStandardMaterial[];
  readonly ledRecord: MeshStandardMaterial;
  /** El anillo de luz alrededor del dial de la capa elegida. */
  readonly selection: MeshStandardMaterial;
  readonly rubber: MeshStandardMaterial;
  readonly recess: MeshStandardMaterial;
}

/** Un piloto apagado es un tono apagado de su color, no negro (DISENO.md §7). */
export const PILOT_OFF_TONE = 0.22;
export const PILOT_OFF_INTENSITY = 0.06;

/** El tamaño de las texturas en mosaico de la cerámica (según la calidad). */
export interface MaterialOptions {
  readonly grainSize: number;
}

/** Un color de la paleta, aclarado para compensar la media del grano (que lo multiplica). */
function grained(hex: string): Color {
  return new Color(hex).multiplyScalar(1 / COLOR_MEAN);
}

function pilot(name: string, hex: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color: new Color(hex).multiplyScalar(PILOT_OFF_TONE),
    emissive: hex,
    emissiveIntensity: PILOT_OFF_INTENSITY,
    roughness: 0.3,
  });
}

export function createMaterials({ grainSize }: MaterialOptions): InstrumentMaterials {
  const ceramic = ceramicTextures(grainSize);
  const knurl = knurlTexture();
  return {
    body: new MeshPhysicalMaterial({
      name: 'cuerpo',
      color: grained(PALETTE.body),
      map: ceramic.color,
      metalness: 0,
      roughness: CERAMIC_ROUGHNESS,
      roughnessMap: ceramic.roughness,
      normalMap: ceramic.normal,
    }),
    glaze: new MeshPhysicalMaterial({
      name: 'esmalte',
      color: PALETTE.glaze,
      vertexColors: true,
      metalness: 0,
      roughness: 0.3,
      // Visto desde arriba, el brillo rugoso de la base reflejaba las luces del techo de la
      // habitación por todo el disco y lavaba el oliva (nota de la sesión de plan). El brillo del
      // vidriado es el de la capa de encima, lisa: refleja las luces donde tocan y deja ver el color
      // en el resto. La base apenas brilla.
      specularIntensity: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 0.85,
    }),
    brass: new MeshPhysicalMaterial({
      name: 'latón',
      color: PALETTE.brass,
      vertexColors: true,
      metalness: 1,
      roughness: PALETTE.brassRoughness,
      anisotropy: 0.4,
    }),
    knurl: new MeshPhysicalMaterial({
      name: 'latón moleteado',
      color: PALETTE.brass,
      metalness: 1,
      roughness: PALETTE.brassRoughness + 0.06,
      normalMap: knurl,
    }),
    brassPlain: new MeshPhysicalMaterial({
      name: 'latón liso',
      color: PALETTE.brass,
      metalness: 1,
      roughness: PALETTE.brassRoughness,
    }),
    key: new MeshPhysicalMaterial({
      name: 'tecla',
      color: PALETTE.key,
      metalness: 0,
      roughness: 0.45,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
    }),
    screen: new MeshPhysicalMaterial({
      name: 'pantalla',
      color: PALETTE.screen,
      metalness: 0,
      roughness: 0.05,
      clearcoat: 1,
      emissive: new Color(1, 1, 1),
      emissiveIntensity: 1,
    }),
    print: new MeshStandardMaterial({
      name: 'cubierta impresa',
      color: PALETTE.key,
      roughness: 0.7,
      transparent: true,
      depthWrite: false,
      // Encima de la cubierta sin pelearse con ella por la profundidad.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    pilots: Array.from({ length: LAYER_COUNT }, (_, i) =>
      pilot(`piloto ${i + 1}`, PALETTE.phosphor),
    ),
    ledRecord: pilot('piloto de grabar', PALETTE.ledRecord),
    selection: new MeshStandardMaterial({
      name: 'capa elegida',
      color: new Color(PALETTE.phosphor).multiplyScalar(0.5),
      emissive: PALETTE.phosphor,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    }),
    rubber: new MeshStandardMaterial({ name: 'goma', color: PALETTE.rubber, roughness: 0.9 }),
    recess: new MeshStandardMaterial({ name: 'hueco', color: PALETTE.recess, roughness: 0.9 }),
  };
}

/** Todos los materiales, en una lista (para liberarlos con las piezas). */
export function materialList(materials: InstrumentMaterials): Material[] {
  return Object.values(materials).flatMap((value: Material | readonly Material[]) =>
    Array.isArray(value) ? [...(value as readonly Material[])] : [value as Material],
  );
}

/** Todas las texturas de los materiales (para filtrarlas mejor y medirlas). */
export function materialTextures(materials: InstrumentMaterials): Texture[] {
  const found = new Set<Texture>();
  for (const material of materialList(materials)) {
    for (const property of Object.values(material)) {
      if ((property as Partial<Texture> | null)?.isTexture) found.add(property as Texture);
    }
  }
  return [...found];
}
