/**
 * Las tres variantes de color de la maqueta (PLAN fase 5.a; DISENO.md §7), todas dentro de la
 * dirección «Barro». La primera es la de `tokens.css` (lo comprueba un test); la que elija Iván pasa
 * a ser la de `tokens.css` y las otras dos se quitan en la 5.b.
 */
export type Variant = 'terracota' | 'barro-oscuro' | 'arcilla-clara';

export const VARIANTS: readonly Variant[] = ['terracota', 'barro-oscuro', 'arcilla-clara'];

export interface VariantSpec {
  /** Cuerpo: barro cocido sin esmaltar. */
  readonly body: string;
  /** Esmalte del disco. */
  readonly glaze: string;
  /** Latón envejecido: diales, anillo del disco, brazo, rueda y tornillos. */
  readonly brass: string;
  readonly brassRoughness: number;
  /** Cerámica crema de las teclas, el reposo y la marca del disco. */
  readonly key: string;
}

export const VARIANT_SPECS: Readonly<Record<Variant, VariantSpec>> = {
  // Barro rojo claro, esmalte oliva y teclas crema (la de DISENO.md §7 y tokens.css).
  terracota: {
    body: '#aa5c40',
    glaze: '#626838',
    brass: '#c4a269',
    brassRoughness: 0.38,
    key: '#e7ddc8',
  },
  // Barro más rojo y oscuro, esmalte crema y latón más brillante.
  'barro-oscuro': {
    body: '#8e4632',
    glaze: '#dcd0b6',
    brass: '#cfab69',
    brassRoughness: 0.26,
    key: '#e7ddc8',
  },
  // Bizcocho claro, esmalte oliva oscuro y latón oscuro.
  'arcilla-clara': {
    body: '#c9a27e',
    glaze: '#3e4422',
    brass: '#9c7c48',
    brassRoughness: 0.46,
    key: '#e7ddc8',
  },
};

/** Colores que no cambian con la variante (DISENO.md §2 y §7). */
export const FIXED_COLORS = {
  screen: '#0c1a0f',
  phosphor: '#79f481',
  ledRecord: '#f6623d',
  rubber: '#1d1d19',
  /** Los huecos: la ranura de la rueda, el hueco bajo el disco y la raya de los diales. */
  recess: '#17110b',
  /** La tinta de los rótulos de las teclas (`--color-bg`). */
  ink: '#252712',
} as const;
