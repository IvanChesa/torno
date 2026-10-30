/**
 * Textos de la maqueta del instrumento (`?maqueta=1`, PLAN fase 5.a). Es una herramienta para que
 * Iván apruebe el diseño, no parte de la web. Pendientes de revisión de Iván (fase 7).
 */
export const MOCKUP_CONTENT = {
  reviewed: false,

  title: 'Maqueta del instrumento',
  intro:
    'Fase 5.a: el aparato en bloques, con materiales provisionales, para elegir la variante de color y cómo se pinta la luz. Arrastra para girarlo y usa la rueda o pellizca para acercarlo.',
  loading: 'Cargando la maqueta…',
  noWebgl:
    'Este navegador no puede pintar en 3D (WebGL). El instrumento de más abajo funciona igual.',

  groups: { variant: 'Variante de color', toneMapping: 'Mapeo de tonos', view: 'Vista' },
  variants: {
    terracota: 'Terracota',
    'barro-oscuro': 'Barro oscuro',
    'arcilla-clara': 'Arcilla clara',
  },
  toneMappings: { neutral: 'Neutral', agx: 'AgX' },
  views: { frente: 'Frente', 'tres-cuartos': 'Tres cuartos', cenital: 'Cenital', perfil: 'Perfil' },

  /** Lo que se lee en la pantalla de la maqueta (como en el instrumento HTML, con ALFAR). */
  screen: ['90 BPM · PAUSA', 'CAPA 1 · BATERÍA · ALFAR', 'TOMA LIBRE'],

  canvas: (variant: string, view: string) =>
    `Maqueta 3D de Torno, redondo como un torno de alfarero: variante ${variant}, vista ${view}.`,

  measures: {
    title: 'Medidas',
    diameter: 'Diámetro',
    height: 'Alto',
    heightWithTray: (deck: string, tray: string) => `${deck} (${tray} con la bandeja)`,
    disc: 'Disco',
    discWithRing: (disc: string, ring: string) => `Ø ${disc} (${ring} con su anillo)`,
    zones: 'Zonas',
    zonesValue:
      'capas a la izquierda, teclas delante, brazo a la derecha y, detrás, la bandeja con la pantalla, el dial principal, el volumen y el reposo',
  },
} as const;
