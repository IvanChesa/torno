/** Textos de la portada (página base). Pendientes de revisión de Iván (fase 7). */
export const HOME_CONTENT = {
  reviewed: false,
  title: 'Torno',
  lead: 'Instrumento de bucles de cuatro capas, en 3D, que se toca en el navegador.',
  status:
    'Esto es la página base. El instrumento se construye por fases: primero el audio, luego el aparato en 3D y al final la web que lo presenta.',
  play: 'Tocar',
  instrument: {
    title: 'Tócalo',
    intro:
      'Cuatro capas en bucle: elige un sonido en el menú del dial principal o graba con el micrófono. Nada suena hasta que tocas, y tu audio nunca sale del navegador. Con el teclado: Espacio reproduce, R graba, Z deshace y ? enseña los atajos.',
    poster: 'Torno, el instrumento, visto de frente.',
    /** Sin WebGL, el plato HTML en su lugar (el aviso cuidado, en la fase 8). */
    noWebgl:
      'Este navegador no puede mostrar el 3D: aquí tienes el instrumento sin él, con los mismos controles.',
  },
  sample: {
    title: 'Muestrario del diseño',
    intro:
      'La dirección «Barro»: fondo de olivar, tinta de hueso, acento de terracota y tipografías con la forma suave del barro.',
  },
} as const;
