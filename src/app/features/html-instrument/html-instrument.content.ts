/**
 * Textos del instrumento HTML (los del plato; los comunes con el 3D, en
 * `instrument-common.content.ts`). Pendientes de revisión de Iván.
 */
export const HTML_INSTRUMENT_CONTENT = {
  reviewed: false,
  labels: {
    play: 'Reproducir',
    record: 'Grabar',
    undo: 'Deshacer',
    layer: (n: number) => `Capa ${n}`,
    main: 'Tempo y menú',
    disc: 'Disco',
    arm: 'Brazo',
    volume: 'Volumen',
    standby: 'Reposo',
  },
  /**
   * En el móvil, los rótulos no caben alrededor del plato: van aquí, debajo (cada control conserva
   * su nombre accesible).
   */
  legend: [
    '1–4 capas · ▶ reproducir · ● grabar · ↶ deshacer',
    'Detrás: tempo y menú, volumen y reposo · A la derecha: brazo · En el centro: disco',
  ],
} as const;
