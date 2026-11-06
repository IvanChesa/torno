/** Textos de «Qué es» (PLAN fase 7). Revisados por Iván (05-11). */
export const INTRO_CONTENT = {
  reviewed: true,
  title: 'Cuatro capas, un solo reloj',
  statement:
    'Cada capa repite un sonido: un ritmo, un bajo, unos acordes, una textura o lo que grabes. Las mezclas con sus diales y arrastras el tiempo con el disco.',
  facts: [
    {
      term: 'Doce bucles propios',
      text: 'Sintetizados con código, en re menor y a 90\u00a0BPM. Sin muestras de nadie.',
    },
    {
      term: 'Graba encima',
      text: 'Tomas libres o de 1, 2 o 4\u00a0compases, con cuenta previa, metrónomo y sobregrabación.',
    },
    {
      term: 'Nada sale de aquí',
      text: 'Tu audio no sale del navegador. Sin cookies, sin analítica y sin cuentas.',
    },
  ],
  image: {
    src: '/img/capas.webp',
    width: 1000,
    height: 800,
    alt: 'Los cuatro diales de las capas, de latón, en arco sobre el cuerpo de barro, con sus pilotos verdes.',
  },
} as const;
