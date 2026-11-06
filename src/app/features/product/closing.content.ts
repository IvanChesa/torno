/** Textos del cierre de la portada (PLAN fase 7). Revisados por Iván (05-11). */
export const CLOSING_CONTENT = {
  reviewed: true,
  title: 'Ahora, tócalo',
  play: 'Tocar',
  about: 'Cómo está hecho',
  contact: 'Escribe a Iván',
  code: 'El código, en GitHub',
  share: 'Compartir',
  /** Lo que se comparte (con el menú del sistema, si lo hay). */
  shareText: 'Torno: un instrumento de bucles de cuatro capas que se toca en el navegador.',
  copied: 'Enlace copiado.',
  /** Sin menú del sistema ni portapapeles: el enlace, para copiarlo a mano. */
  manual: (url: string) => `Copia el enlace: ${url}`,
} as const;
