import type { ControlId } from '../../instrument';
import type { Shot } from '../../scene';

/**
 * Unas teclas y lo que hacen, en la línea de atajos de cada control: cada tecla en su `kbd`,
 * juntas (`combo`: una y otra a la vez) o como alternativas.
 */
export interface GuideKey {
  readonly keys: readonly string[];
  readonly combo?: boolean;
  readonly text: string;
}

export interface GuideEntry {
  readonly title: string;
  readonly text: string;
  readonly keys: readonly GuideKey[];
  /** El control que señala «Ver en el instrumento». */
  readonly control: ControlId;
  /** Un encuadre de «Tocar» en lugar del de cerca (las capas, que son cuatro diales). */
  readonly shot?: Shot;
}

/**
 * «Conoce tu instrumento» (PLAN fase 7): la guía de los 9 controles. Los gestos y las teclas son
 * los del modelo del instrumento (`instrument/`). Pendientes de revisión de Iván.
 */
export const GUIDE_CONTENT = {
  reviewed: false,
  title: 'Conoce tu instrumento',
  intro:
    'Nueve cosas y ya lo tocas. «Ver en el instrumento» te lleva a cada control: la cámara viaja hasta él y lo señala, sin que suene nada.',
  show: 'Ver en el instrumento',
  /** El nombre accesible del botón: dice qué control. */
  showLabel: (title: string) => `Ver en el instrumento: ${title.toLowerCase()}`,
  entries: [
    {
      title: 'Reproducir y pausar',
      text: 'Pulsa la tecla de reproducir para que suenen las capas y otra vez para pausar. Mantenla pulsada para parar y volver al principio. La primera vez, la capa 1 arranca con una batería.',
      keys: [
        { keys: ['Espacio'], text: 'reproduce o pausa' },
        { keys: ['Mayús', 'Intro'], combo: true, text: 'en la tecla, mantener' },
      ],
      control: 'play',
    },
    {
      title: 'Grabar',
      text: 'Pulsa la tecla de grabar para grabar con el micrófono en la capa elegida, y otra vez para cerrar la toma. Si la capa ya suena, lo que grabes se suma. Deshacer quita la última toma; mantenlo pulsado para rehacer.',
      keys: [
        { keys: ['R'], text: 'graba' },
        { keys: ['Z'], text: 'deshace' },
      ],
      control: 'record',
    },
    {
      title: 'Mezclar las capas',
      text: 'Cada capa tiene su dial: gíralo para subir o bajar su nivel, púlsalo para elegirla y mantenlo pulsado para silenciarla. El piloto de al lado dice si tiene sonido.',
      keys: [
        { keys: ['1–4'], text: 'eligen la capa' },
        { keys: ['↑', '↓'], text: 'en el dial, el nivel' },
      ],
      control: 'layer-0',
      shot: 'capas',
    },
    {
      title: 'Tempo',
      text: 'Gira el dial principal, el grande de detrás: de 40 a 240 BPM. Velocidad y tono cambian juntos, como en un tocadiscos.',
      keys: [
        { keys: ['↑', '↓'], text: 'de uno en uno' },
        { keys: ['Mayús'], text: 'con la flecha, de diez en diez' },
      ],
      control: 'main',
    },
    {
      title: 'El disco',
      text: 'Mantén el disco para congelar la capa elegida y arrástralo hacia delante o hacia atrás: una vuelta es un compás. Al soltarlo, la capa vuelve a su sitio en el tiempo.',
      keys: [{ keys: ['Espacio'], text: 'en el disco, mantenerlo' }],
      control: 'disc',
    },
    {
      title: 'El brazo',
      text: 'Desliza el brazo para filtrar la capa elegida: hacia el disco, más apagada. En el otro extremo, sin filtro.',
      keys: [{ keys: ['←', '→'], text: 'en el brazo, moverlo' }],
      control: 'arm',
    },
    {
      title: 'Ajustes del bucle',
      text: 'Pulsa el dial principal y entra en BUCLE: la duración de la toma (libre o de 1, 2 o 4 compases), la cuenta previa, el metrónomo, el reverso y el panorama de la capa, y marcar el tempo con pulsaciones.',
      keys: [
        { keys: ['Intro'], text: 'en el dial, entra' },
        { keys: ['Esc'], text: 'vuelve atrás' },
      ],
      control: 'main',
    },
    {
      title: 'Sonidos',
      text: 'En SONIDO hay doce bucles propios: tres baterías, tres bajos, tres acordes y tres texturas. Recorrer la lista no cambia nada; el que eliges entra al empezar el compás siguiente.',
      keys: [{ keys: ['Intro'], text: 'en el dial, elige' }],
      control: 'main',
    },
    {
      title: 'Sesión',
      text: 'En SESIÓN guardas y abres tu proyecto (un archivo .torno), exportas la mezcla en WAV o una pista por capa, borras una capa o empiezas de cero. Todo se queda en tu equipo.',
      keys: [{ keys: ['Intro'], text: 'en el dial, entra' }],
      control: 'main',
    },
  ] as readonly GuideEntry[],
} as const;
