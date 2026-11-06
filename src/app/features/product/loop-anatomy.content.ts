/** Textos de «Anatomía de un bucle» (PLAN fase 7). Revisados por Iván (05-11). */
export const LOOP_ANATOMY_CONTENT = {
  reviewed: true,
  title: 'Anatomía de un bucle',
  intro:
    'Las cuatro capas suenan sobre el mismo reloj. Cada anillo es una capa, y una vuelta del anillo, su bucle entero: dos compases, algo más de cinco segundos a 90\u00a0BPM. Alrededor, la forma de onda de su sonido. Escúchalas una a una o juntas.',
  /** Del anillo de fuera al de dentro, como las capas de la 1 a la 4. */
  layers: [
    {
      id: 'alfar',
      role: 'Batería',
      name: 'Alfar',
      text: 'Bombo, caja y charles, con el pulso algo arrastrado.',
    },
    { id: 'raiz', role: 'Bajo', name: 'Raíz', text: 'Un bajo redondo que sigue los acordes.' },
    { id: 'olivo', role: 'Acordes', name: 'Olivo', text: 'Piano eléctrico cálido, sincopado.' },
    { id: 'cierzo', role: 'Textura', name: 'Cierzo', text: 'Viento: ruido que sopla y silba.' },
  ],
  listen: 'Escuchar',
  listenLabel: (role: string, name: string) => `Escuchar ${role.toLowerCase()}: ${name}`,
  listenAll: 'Escuchar las cuatro',
  stop: 'Parar',
  /** La figura, para los lectores de pantalla. */
  figure:
    'Cuatro anillos concéntricos, uno por capa, con la forma de onda de cada sonido a su alrededor: los golpes de la batería en el de fuera, el bajo, los acordes y, dentro, el viento de la textura.',
  /** Lo que dice la región viva al sonar y al parar. */
  playing: (names: string) => `Suena: ${names}.`,
  stopped: 'Parado.',
  failed: 'No se ha podido escuchar. Toca otra vez.',
  standby: 'El instrumento está en reposo: despiértalo con su botón de reposo para escuchar.',
} as const;
