/** Textos del escenario 3D (PLAN fases 5.b y 6). Pendientes de revisión de Iván (fase 7). */
export const INSTRUMENT_STAGE_CONTENT = {
  reviewed: false,
  /** El lienzo: una imagen que cambia con lo que se toca (los controles van encima, uno por pieza). */
  canvas:
    'Torno en 3D. Cada pieza lleva encima su control: se toca con el ratón, el dedo o el teclado.',
  contextLost:
    'El 3D se ha detenido. Si no vuelve en unos segundos, sigues con el instrumento sin él.',
  play: 'Tocar',
  shots: { completo: 'Completo', capas: 'Capas', controles: 'Controles' },
  inspect: 'Inspeccionar',
  /** La vista despiezada (fase 7): las piezas suben por niveles; los controles no se tocan. */
  explode: 'Despiezar',
  orbit: {
    name: 'Girar el aparato',
    hint: 'Arrastra, o usa las flechas: izquierda y derecha lo giran; arriba y abajo lo miran desde más arriba o más abajo. Inicio lo pone de frente.',
    value: (azimuth: number, elevation: number) => {
      const side =
        azimuth === 0
          ? 'De frente'
          : `Girado ${Math.abs(azimuth)}° a la ${azimuth > 0 ? 'derecha' : 'izquierda'}`;
      return `${side}, visto desde ${elevation}° de altura`;
    },
  },
  fullscreen: 'Pantalla completa',
} as const;
