/**
 * Materiales provisionales de la maqueta (PLAN fase 5.a; DISENO.md §7): `MeshPhysicalMaterial` con
 * los valores de partida de cada pieza, sin texturas procedurales (llegan en la 5.b). Los colores se
 * escriben en sRGB; `three` los pasa a lineal.
 */
import { Color, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { FIXED_COLORS, VARIANT_SPECS, type Variant } from './variants';

export interface InstrumentMaterials {
  readonly body: MeshPhysicalMaterial;
  readonly glaze: MeshPhysicalMaterial;
  /** Latón de las piezas que giran (anillos y diales), con cepillado circular. */
  readonly brass: MeshPhysicalMaterial;
  /** Latón del brazo, la rueda y los tornillos, sin cepillado. */
  readonly brassPlain: MeshPhysicalMaterial;
  readonly key: MeshPhysicalMaterial;
  readonly screen: MeshPhysicalMaterial;
  readonly pilotOn: MeshStandardMaterial;
  readonly pilotOff: MeshStandardMaterial;
  readonly ledRecord: MeshStandardMaterial;
  readonly rubber: MeshStandardMaterial;
  readonly recess: MeshStandardMaterial;
}

/** Un piloto apagado es un tono apagado de su color, no negro (DISENO.md §7). */
const PILOT_OFF_TONE = 0.22;
const PILOT_OFF_INTENSITY = 0.06;

export function createMaterials(variant: Variant): InstrumentMaterials {
  const materials: InstrumentMaterials = {
    body: new MeshPhysicalMaterial({ name: 'cuerpo', metalness: 0, roughness: 0.85 }),
    glaze: new MeshPhysicalMaterial({
      name: 'esmalte',
      metalness: 0,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    brass: new MeshPhysicalMaterial({ name: 'latón', metalness: 1, anisotropy: 0.4 }),
    brassPlain: new MeshPhysicalMaterial({ name: 'latón liso', metalness: 1 }),
    key: new MeshPhysicalMaterial({
      name: 'tecla',
      metalness: 0,
      roughness: 0.45,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
    }),
    screen: new MeshPhysicalMaterial({
      name: 'pantalla',
      color: FIXED_COLORS.screen,
      metalness: 0,
      roughness: 0.05,
      clearcoat: 1,
      emissive: new Color(1, 1, 1),
      emissiveIntensity: 1,
    }),
    pilotOn: new MeshStandardMaterial({
      name: 'piloto encendido',
      color: FIXED_COLORS.phosphor,
      emissive: FIXED_COLORS.phosphor,
      emissiveIntensity: 1.2,
      roughness: 0.3,
    }),
    pilotOff: new MeshStandardMaterial({
      name: 'piloto apagado',
      color: new Color(FIXED_COLORS.phosphor).multiplyScalar(PILOT_OFF_TONE),
      emissive: FIXED_COLORS.phosphor,
      emissiveIntensity: PILOT_OFF_INTENSITY,
      roughness: 0.3,
    }),
    ledRecord: new MeshStandardMaterial({
      name: 'piloto de grabar',
      color: new Color(FIXED_COLORS.ledRecord).multiplyScalar(PILOT_OFF_TONE),
      emissive: FIXED_COLORS.ledRecord,
      emissiveIntensity: PILOT_OFF_INTENSITY,
      roughness: 0.3,
    }),
    rubber: new MeshStandardMaterial({ name: 'goma', color: FIXED_COLORS.rubber, roughness: 0.9 }),
    recess: new MeshStandardMaterial({ name: 'hueco', color: FIXED_COLORS.recess, roughness: 0.9 }),
  };
  applyVariant(materials, variant);
  return materials;
}

/** Cambia de variante sin crear nada nuevo: solo colores y rugosidades. */
export function applyVariant(materials: InstrumentMaterials, variant: Variant): void {
  const spec = VARIANT_SPECS[variant];
  materials.body.color.set(spec.body);
  materials.glaze.color.set(spec.glaze);
  for (const brass of [materials.brass, materials.brassPlain]) {
    brass.color.set(spec.brass);
    brass.roughness = spec.brassRoughness;
  }
  materials.key.color.set(spec.key);
}
