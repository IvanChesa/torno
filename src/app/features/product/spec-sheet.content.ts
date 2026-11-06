/**
 * La ficha técnica (PLAN fase 7): solo cifras **medidas**, cada una con cómo se midió y el informe
 * donde está el detalle (docs/ESTILO.md §5). Todas se han medido en el PC de desarrollo. Revisados
 * por Iván (05-11).
 */
export interface SpecRow {
  readonly name: string;
  readonly value: string;
  readonly how: string;
  /** El informe de la fase donde está la medición (`docs/informes/fase-N.md`). */
  readonly phase: number;
}

const ROWS: readonly SpecRow[] = [
  {
    name: 'Frecuencia de muestreo',
    value: '48\u00a0kHz',
    how: 'La del dispositivo, sin forzarla: el audio se procesa a la de la tarjeta de sonido, sin remuestrear. Medida con Chromium en el PC de desarrollo.',
    phase: 7,
  },
  {
    name: 'Capas',
    value: '4 · 3 deshacer',
    how: 'Cuatro capas de hasta 60\u00a0s con tres estados de deshacer cada una. En el peor caso, 195,8\u00a0MB de memoria a 48\u00a0kHz, contados por el propio núcleo.',
    phase: 1,
  },
  {
    name: 'Del gesto al audio',
    value: '0,4–4,3\u00a0ms',
    how: 'Del evento del navegador al mensaje que llega al hilo de audio, con el 3D pintando: mediana de 0,4\u00a0ms con una tecla y de 3,9\u00a0ms arrastrando un dial.',
    phase: 6,
  },
  {
    name: 'Primer sonido',
    value: '10–15\u00a0ms',
    how: 'De pulsar a la primera muestra en la salida, con el motor cargado, en 20 medidas con Chromium sin interfaz. Sin contar la latencia del dispositivo, que va aparte.',
    phase: 2,
  },
  {
    // Revisión del bloque E, #2: la cifra por red, tal como se mide (informe de la fase 8, §6).
    name: 'Primer toque de la visita',
    value: '205–225\u00a0ms',
    how: 'En una visita nueva y por red: tres segundos con el instrumento a la vista (el primer sonido se prepara solo, en silencio) y un toque en reproducir, hasta que sale por los altavoces. Incluye arrancar el audio del dispositivo (unos 66\u00a0ms) y la latencia de salida. Con Chromium en el PC de desarrollo; los toques siguientes van como en la fila anterior.',
    phase: 8,
  },
  {
    name: 'Latencia de salida',
    value: '50\u00a0ms',
    how: 'Lo que añaden el navegador y el sistema hasta los altavoces (10 + 40\u00a0ms), en el PC de desarrollo.',
    phase: 7,
  },
  {
    name: 'Toma alineada',
    value: '0,04\u00a0ms',
    how: 'Tras calibrar con clics, una toma grabada de la propia salida, retrasada 20\u00a0ms, cae a 2 muestras de su sitio.',
    phase: 2,
  },
  {
    name: 'CPU del audio',
    value: '218–232×',
    how: 'El núcleo con 4\u00a0capas, filtros y limitador, frente al tiempo real: 60\u00a0s de audio a 48\u00a0kHz en 259–275\u00a0ms (cuatro ejecuciones), en el PC de desarrollo. A 240\u00a0BPM, con el filtro contra el solapamiento de frecuencias, 35× en el peor caso.',
    phase: 7,
  },
  {
    name: 'Fotogramas por segundo',
    value: '144\u00a0fps',
    how: 'El 3D en el escritorio (RTX 3060), en los tres niveles de calidad: la frecuencia de la pantalla. Sin nada que mover, 0\u00a0fps.',
    phase: 7,
  },
  {
    name: 'Peso de la primera visita',
    value: '565\u00a0kB · 1,37\u00a0MB',
    how: 'Todo lo que se descarga para ver la portada, en bruto: sin el 3D y con él. El 3D se genera con código, sin modelos ni texturas que descargar.',
    phase: 8,
  },
];

export const SPEC_SHEET_CONTENT = {
  reviewed: true,
  title: 'Ficha técnica',
  intro:
    'Cifras medidas, no objetivos: cada una con cómo se midió y el informe donde está el detalle.',
  headers: { name: 'Qué', value: 'Medido', how: 'Cómo' },
  rows: ROWS,
  /** El enlace a cada informe, en el repositorio. */
  report: (phase: number) => `Informe de la fase ${phase}`,
} as const;
