/**
 * Los colores del aparato (DISENO.md §7): la variante Terracota, la que eligió Iván el 30-10 (fase
 * 5.a), que es la de `tokens.css` (lo comprueba un test). Se escriben en sRGB; `three` los pasa a
 * lineal.
 */
export const PALETTE = {
  /** Cuerpo: barro cocido sin esmaltar. */
  body: '#aa5c40',
  /** Esmalte oliva del disco. */
  glaze: '#626838',
  /** Latón envejecido: diales, anillo del disco, brazo, rueda y tornillos. */
  brass: '#c4a269',
  brassRoughness: 0.38,
  /** Cerámica crema de las teclas, el reposo, la marca del disco y lo impreso en la cubierta. */
  key: '#e7ddc8',
  screen: '#0c1a0f',
  phosphor: '#79f481',
  /** Un sonido en cola (`--color-warning`). */
  warning: '#eec469',
  ledRecord: '#f6623d',
  rubber: '#1d1d19',
  /** Los huecos: la ranura de la rueda, el hueco bajo el disco y la raya de los diales. */
  recess: '#17110b',
  /** La tinta de los rótulos de las teclas (`--color-bg`). */
  ink: '#252712',
} as const;
