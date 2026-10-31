/**
 * Textos comunes a los dos instrumentos, el 3D y el HTML: el grupo, la chuleta de atajos, el
 * autoguardado y el selector de archivos. Pendientes de revisión de Iván (fase 7).
 */
export const INSTRUMENT_COMMON_CONTENT = {
  reviewed: false,
  label: 'Torno, instrumento de bucles',
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
  },
  autosave: {
    note: 'La sesión se autoguarda en este navegador y nunca sale de él.',
    clear: 'Borrar autoguardado',
  },
  fileInputLabel: 'Abrir una sesión de Torno',
  tools: {
    pauseMotion: 'Pausar movimiento',
    reducedBySystem: 'Tu sistema ya pide menos movimiento: nada se mueve solo.',
    shortcuts: 'Atajos',
  },
} as const;
