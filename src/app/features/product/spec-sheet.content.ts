/**
 * La ficha técnica (PLAN fase 7): solo cifras **medidas**, cada una con cómo se midió y el informe
 * donde está el detalle (docs/ESTILO.md §5). Lo que falta por medir en el móvil se dice. Pendiente
 * de revisión de Iván.
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
    value: '48 kHz',
    how: 'La del dispositivo, sin forzarla: el audio se procesa a la de la tarjeta de sonido, sin remuestrear. Medida con Chromium en el PC de desarrollo.',
    phase: 7,
  },
  {
    name: 'Capas',
    value: '4 · 3 deshacer',
    how: 'Cuatro capas de hasta 60 s con tres estados de deshacer cada una. En el peor caso, 195,8 MB de memoria a 48 kHz, contados por el propio núcleo.',
    phase: 1,
  },
  {
    name: 'Del gesto al audio',
    value: '0,4–4,3 ms',
    how: 'Del evento del navegador al mensaje que llega al hilo de audio, con el 3D pintando: mediana de 0,4 ms con una tecla y de 3,9 ms arrastrando un dial.',
    phase: 6,
  },
  {
    name: 'Primer sonido',
    value: '10–15 ms',
    how: 'De pulsar a la primera muestra en la salida, con el motor cargado, en 20 medidas con Chromium sin interfaz. Sin contar la latencia del dispositivo, que va aparte.',
    phase: 2,
  },
  {
    name: 'Latencia de salida',
    value: '50 ms',
    how: 'Lo que añaden el navegador y el sistema hasta los altavoces (10 + 40 ms), en el PC de desarrollo. En el móvil, pendiente de medir.',
    phase: 7,
  },
  {
    name: 'Toma alineada',
    value: '0,04 ms',
    how: 'Tras calibrar con clics, una toma grabada de la propia salida, retrasada 20 ms, cae a 2 muestras de su sitio.',
    phase: 2,
  },
  {
    name: 'CPU del audio',
    value: '218–232×',
    how: 'El núcleo con 4 capas, filtros y limitador, frente al tiempo real: 60 s de audio a 48 kHz en 259–275 ms (cuatro ejecuciones), en el PC de desarrollo. A 240 BPM con el filtro contra el aliasing, 35× en el peor caso.',
    phase: 7,
  },
  {
    name: 'Fotogramas por segundo',
    value: '144 fps',
    how: 'El 3D en el escritorio (RTX 3060), en los tres niveles de calidad: la frecuencia de la pantalla. Sin nada que mover, 0 fps. En el móvil, pendiente de medir.',
    phase: 7,
  },
  {
    name: 'Peso de la primera visita',
    value: '625 kB · 1,36 MB',
    how: 'Todo lo que se descarga para ver la portada, en bruto: sin el 3D y con él. El 3D se genera con código, sin modelos ni texturas que descargar.',
    phase: 7,
  },
];

export const SPEC_SHEET_CONTENT = {
  reviewed: false,
  title: 'Ficha técnica',
  intro:
    'Cifras medidas, no objetivos: cada una con cómo se midió y el informe donde está el detalle.',
  headers: { name: 'Qué', value: 'Medido', how: 'Cómo' },
  rows: ROWS,
  /** El enlace a cada informe, en el repositorio. */
  report: (phase: number) => `Informe de la fase ${phase}`,
} as const;
