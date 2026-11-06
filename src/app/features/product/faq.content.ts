/** Las preguntas frecuentes (PLAN fase 7). Revisados por Iván (05-11). */
export const FAQ_CONTENT = {
  reviewed: true,
  title: 'Preguntas frecuentes',
  items: [
    {
      question: '¿Se sube mi audio a algún sitio?',
      answer:
        'No. Todo pasa en tu navegador: ni el micrófono, ni lo que grabas, ni tus proyectos salen de él. La página no usa cookies ni analítica, y no hace peticiones a nadie más.',
    },
    {
      question: '¿Necesito auriculares?',
      answer:
        'Para escuchar, no. Para grabar encima de lo que suena, sí: sin ellos, el micrófono recoge también los altavoces. Mejor con cable, porque los inalámbricos añaden mucho retraso.',
    },
    {
      question: '¿Funciona en el móvil?',
      answer:
        'Sí. Los controles miden 44\u00a0píxeles como poco, el aparato se encuadra para la pantalla pequeña y la página se desplaza por encima de él con el dedo. En un iPhone todavía no se ha probado a fondo.',
    },
    {
      question: '¿Y sin 3D, o con un lector de pantalla?',
      answer:
        'Cada control es un elemento de la página con su nombre y su valor: se toca igual con el teclado o con un lector de pantalla. Si el navegador no puede mostrar el 3D, aparece el instrumento en plano, con los mismos controles.',
    },
    {
      question: '¿Puedo guardar lo que hago?',
      answer:
        'Sí. La sesión se guarda sola en este navegador, y en el menú SESIÓN puedes guardarla en un archivo .torno, exportar la mezcla en WAV de 24\u00a0bits o una pista por capa.',
    },
    {
      question: '¿De dónde salen los sonidos?',
      answer:
        'Del propio código: los doce bucles se sintetizan en tu navegador, siempre igual, en re menor y a 90\u00a0BPM. No hay muestras de nadie ni audio generado por inteligencia artificial.',
    },
    {
      question: '¿Por qué cambia el tono al cambiar el tempo?',
      answer:
        'Porque Torno cambia la velocidad, como un tocadiscos: más rápido, más agudo. Es una decisión: así el sonido no se deforma.',
    },
  ],
} as const;
