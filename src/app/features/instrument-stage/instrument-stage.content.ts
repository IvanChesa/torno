/** Textos del escenario 3D (PLAN fase 5.b). Pendientes de revisión de Iván (fase 7). */
export const INSTRUMENT_STAGE_CONTENT = {
  reviewed: false,
  /** El lienzo: una imagen que cambia con lo que se toca. */
  canvas: 'Torno en 3D, visto de frente: enseña lo que tocas con los controles de debajo.',
  noWebgl: 'Este navegador no puede mostrar el 3D. El instrumento de debajo funciona igual.',
  contextLost: 'El 3D se ha detenido. Vuelve solo en cuanto el navegador lo permita.',
  dev: {
    title: 'Escena (solo en desarrollo)',
    quality: 'Calidad',
    levels: { low: 'Baja', medium: 'Media', high: 'Alta' },
    lose: 'Perder el contexto',
    restore: 'Recuperarlo',
    benchmark: 'Medir 5 s',
  },
} as const;
