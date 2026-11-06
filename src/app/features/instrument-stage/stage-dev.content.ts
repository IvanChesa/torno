/**
 * Textos del panel de la escena (desarrollo y `?diagnostico=1`). Van aparte de los del escenario:
 * solo los carga el trozo del panel. Revisados por Iván (05-11).
 */
export const STAGE_DEV_CONTENT = {
  reviewed: true,
  title: 'Escena 3D (desarrollo y diagnóstico)',
  quality: 'Calidad',
  levels: { low: 'Baja', medium: 'Media', high: 'Alta' },
  lose: 'Perder el contexto',
  restore: 'Recuperarlo',
  benchmark: 'Medir 5 s',
} as const;
