/** Textos del instrumento HTML (los que no son del aparato). Pendientes de revisión de Iván. */
export const HTML_INSTRUMENT_CONTENT = {
  reviewed: false,
  label: 'Torno, instrumento de bucles',
  screenLabel: 'Pantalla del instrumento',
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
  help: {
    title: 'Atajos de teclado',
    intro: 'Con el foco dentro del instrumento:',
    close: 'Cerrar',
    shortcuts: [
      ['Espacio', 'reproducir o pausar'],
      ['R', 'grabar'],
      ['Z', 'deshacer'],
      ['1–4', 'elegir capa'],
      ['?', 'abrir y cerrar esta ayuda'],
    ],
    controls: [
      ['Flechas', 'girar un dial (con Mayús, de diez en diez)'],
      ['Intro', 'pulsar'],
      ['Mayús + Intro', 'mantener'],
      ['Esc', 'volver en el menú'],
      ['Espacio en el disco', 'mantenerlo; las flechas lo mueven'],
    ],
    open: 'Atajos',
  },
  autosave: {
    note: 'La sesión se autoguarda en este navegador y nunca sale de él.',
    clear: 'Borrar autoguardado',
  },
  fileInputLabel: 'Abrir una sesión de Torno',
} as const;
