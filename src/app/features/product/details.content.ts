/** Textos de «Los detalles» (PLAN fase 7). Revisados por Iván (05-11). */
export const DETAILS_CONTENT = {
  reviewed: true,
  title: 'Barro, latón y fósforo',
  intro:
    'Torno es un objeto, no un dibujo: cada pieza tiene su material, con su color, su brillo y su textura, generados con código al cargar la página.',
  explode: 'Despiezar el instrumento',
  /** Sin el 3D (o sin WebGL) no hay piezas que separar: lo dice en lugar del botón. */
  noExplode: 'Despiézalo en el 3D, en un navegador con WebGL.',
  image: {
    src: '/img/despiezado.webp',
    width: 1200,
    height: 960,
    alt: 'Torno despiezado: abajo, el cuerpo de barro; encima, la cubierta, la bandeja con la pantalla, el disco de esmalte y, arriba del todo, los diales, las teclas y el brazo.',
  },
  /** Cada material con su muestra (un token de color de tokens.css). */
  materials: [
    {
      name: 'Barro cocido',
      text: 'El cuerpo y la cubierta: mate, con su grano y sus poros.',
      color: '--instrument-body',
    },
    {
      name: 'Latón envejecido',
      text: 'Diales, brazo y anillo del disco, cepillado en círculo y moleteado en los cantos.',
      color: '--instrument-brass',
    },
    {
      name: 'Esmalte oliva',
      text: 'El disco, vidriado como un plato, más oscuro hacia el borde.',
      color: '--instrument-glaze',
    },
    {
      name: 'Cerámica crema',
      text: 'Las teclas, esmaltadas, que se hunden mientras suenan o graban.',
      color: '--instrument-key',
    },
    {
      name: 'Fósforo verde',
      text: 'La pantalla, curva detrás del disco, y los pilotos de las capas.',
      color: '--color-phosphor',
    },
  ],
} as const;
