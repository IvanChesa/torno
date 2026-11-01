/** Textos de la portada (fase 7). Pendientes de revisión de Iván (docs/ESTILO.md). */
export const HOME_CONTENT = {
  reviewed: false,
  title: 'Torno',
  lead: 'Un instrumento de bucles de cuatro capas, de barro y latón, que se toca en el navegador.',
  play: 'Tocar',
  guide: 'Cómo se toca',
  /** La nota de debajo: nada suena solo, y el teclado. Las teclas van en `kbd`. */
  note: {
    before: 'Nada suena hasta que tocas. Con el teclado,',
    play: 'Espacio',
    middle: 'reproduce y',
    help: '?',
    after: 'enseña los atajos.',
  },
  instrument: {
    /** El nombre de la región del instrumento (no se ve: el titular está al lado). */
    label: 'El instrumento',
    poster: 'Torno, el instrumento, visto de frente.',
    /** Sin WebGL, el plato HTML en su lugar (el aviso cuidado, en la fase 8). */
    noWebgl:
      'Este navegador no puede mostrar el 3D: aquí tienes el instrumento sin él, con los mismos controles.',
  },
} as const;
