/**
 * Textos de /sobre-el-proyecto (PLAN fase 7): el caso de estudio y los créditos. Cada cifra es una
 * medición con su informe (docs/ESTILO.md §5). Revisados por Iván (05-11).
 */
export const ABOUT_CONTENT = {
  reviewed: true,
  title: 'Sobre el proyecto',
  lead: 'Torno es una pieza de portafolio: un instrumento de audio en tiempo real hecho desde cero, con el sonido, el 3D y la web escritos a mano.',
  intro: [
    'El reto era que se tocara como un objeto: sin cortes en el audio, sin retrasos al tocar y sin que la página pese más de lo que vale. Debajo hay tres piezas que no se conocen entre sí: un núcleo de audio en TypeScript, un motor 3D con Three.js y una web en Angular que los une.',
  ],
  architecture: {
    title: 'Cuatro hilos y un solo reloj',
    text: [
      'El sonido no se hace en la página, sino en el hilo de audio del navegador (un AudioWorklet). Allí vive el núcleo, que guarda las cuatro capas, cuenta las muestras y mezcla. Es la única fuente de verdad: el disco del 3D, la pantalla y los medidores leen su reloj, nunca al revés.',
      'La página le manda órdenes con mensajes tipados y recibe su estado agrupado, como mucho 30\u00a0veces por segundo. Los sonidos de la biblioteca se sintetizan en un hilo aparte (un worker), y la exportación a WAV usa otra copia del mismo núcleo, así que lo que se exporta es lo que suena.',
      'El núcleo es TypeScript puro: sin navegador, sin Angular y sin reservar memoria mientras suena. Por eso se prueba en Node, muestra a muestra.',
    ],
    diagram:
      'Diagrama de hilos. El hilo principal lleva la web en Angular, el motor 3D y el motor de audio. Envía órdenes por un canal de mensajes al hilo de audio, donde el núcleo mezcla las capas y las manda a los altavoces, y recibe su estado. El micrófono entra al hilo de audio. Aparte, un hilo sintetiza los sonidos y otro exporta los WAV con el mismo núcleo.',
    labels: {
      main: 'Hilo principal',
      mainItems: ['Web en Angular (signals)', 'Motor 3D (Three.js)', 'Motor de audio'],
      audio: 'Hilo de audio',
      audioItems: ['AudioWorklet', 'Núcleo: capas, reloj, mezcla'],
      commands: 'órdenes',
      status: 'estado ≤ 30/s',
      synth: 'Hilo de síntesis',
      export: 'Hilo de exportación',
      mic: 'Micrófono',
      out: 'Altavoces',
    },
  },
  decisions: {
    title: 'Decisiones',
    items: [
      {
        title: 'Audio propio, sin librerías',
        text: 'Web Audio y un AudioWorklet con el procesado escrito a mano: filtro de variables de estado, interpolación cúbica al cambiar de tempo y un limitador que no deja pasar de −0,3\u00a0dBFS.',
      },
      {
        title: 'Los controles son la página',
        text: 'Encima de cada pieza del 3D hay un control de verdad (un botón o un deslizador), colocado donde se ve su pieza. El ratón, el dedo, el teclado y el lector de pantalla tocan el mismo elemento.',
      },
      {
        title: 'Un 3D que se genera con código',
        text: 'Sin modelos ni texturas que descargar: la geometría, el grano del barro y el cepillado del latón salen del código al cargar. Y solo se pinta cuando algo se mueve: quieto, 0 fotogramas por segundo.',
      },
      {
        title: 'Primero la página, luego el resto',
        text: 'La web está prerenderizada: llega el texto y una imagen del aparato. El 3D y el audio se cargan después, al acercarse, y el contexto de audio nace en el propio gesto de tocar.',
      },
      {
        title: 'Nada sale del navegador',
        text: 'Sin cookies, sin analítica y sin peticiones a terceros; las fuentes y todo lo demás se sirven desde aquí. El micrófono y lo que grabas no salen de tu equipo.',
      },
    ],
  },
  measurements: {
    title: 'Cómo se ha medido',
    text: [
      'Las cifras de la ficha técnica son mediciones, cada una con su informe. El núcleo se mide en Node: su rendimiento frente al tiempo real, la exactitud de la cola y de las tomas (a la muestra) y la ausencia de clics en las juntas.',
      'El navegador se mide con pruebas automáticas en Chromium con un micrófono sintético y el AudioWorklet real: el primer sonido, el retraso del gesto al audio y la alineación de una toma grabada de la propia salida. El 3D se mide con la tarjeta gráfica de verdad: el primer fotograma, la memoria de vídeo y los fotogramas por segundo.',
      'Lo que todavía no se ha medido en un móvil, la ficha lo dice.',
    ],
    link: 'La ficha técnica',
  },
  accessibility: {
    title: 'Accesibilidad',
    items: [
      'Cada control tiene nombre y valor en español, y se toca con el teclado: flechas, Mayús para pasos grandes, Intro, Esc y atajos con la chuleta a mano.',
      'Sin WebGL, o si se prefiere, el mismo instrumento en plano, con los mismos controles.',
      'Con movimiento reducido o «Pausar movimiento», nada se mueve solo: ni el disco, ni la cámara, ni la página.',
      'Los colores pasan el contraste AA (comprobado en las pruebas), y ninguna página tiene errores de axe.',
    ],
  },
  author: {
    title: 'Autor',
    text: (name: string, role: string) =>
      `${name}, ${role}. Torno es una pieza de su portafolio: el diseño, el audio, el 3D y la web.`,
    web: 'Su web',
    contact: 'Contacto',
    code: 'El código, en GitHub',
  },
  credits: {
    title: 'Créditos',
    sounds: {
      title: 'Sonidos',
      text: 'Síntesis propia en código: osciladores, ruido, envolventes y filtros, siempre con el mismo resultado. Sin muestras de nadie, sin audio de terceros y sin audio generado por inteligencia artificial. No hay nada que atribuir.',
    },
    fonts: {
      title: 'Tipografías',
      items: [
        { name: 'Fraunces', author: 'Undercase Type', license: '/licencias/fraunces-OFL.txt' },
        { name: 'Geist Mono', author: 'Vercel', license: '/licencias/geist-mono-OFL.txt' },
      ],
      license: 'Licencia OFL 1.1',
    },
    libraries: {
      title: 'Librerías',
      text: 'Angular, RxJS, tslib y three.js.',
      link: 'Sus licencias',
      url: '/licencias/terceros.txt',
    },
    inspiration: {
      title: 'Inspiración',
      before: 'Inspirado en',
      name: 'TAPE, de Ethan',
      url: 'https://tape.ethanplus.ai',
      after:
        '. Es cortesía: de él viene la idea de un instrumento de bucles que se toca en la web; el código, los sonidos, los textos y el diseño de Torno son propios.',
    },
  },
} as const;
