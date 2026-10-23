/** Textos de /sobre-el-proyecto en la fase 0. Pendientes de revisión de Iván (fase 7). */
export const ABOUT_CONTENT = {
  reviewed: false,
  title: 'Sobre el proyecto',
  lead: 'Torno es una pieza de portfolio: un instrumento de audio en tiempo real hecho desde cero con Angular, Web Audio y Three.js.',
  paragraphs: [
    'Todo el sonido es propio. Un núcleo de procesado escrito en TypeScript se ejecuta en un AudioWorklet, el hilo de audio del navegador, y los sonidos de la biblioteca se sintetizan con código, sin muestras de nadie.',
    'Aquí se contará cómo está hecho: la arquitectura del audio, las decisiones y las mediciones. Esta página se completa al final del proyecto.',
  ],
} as const;
