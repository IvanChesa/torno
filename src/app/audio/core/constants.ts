/**
 * Límites y valores del núcleo de audio (PLAN §4.4 y §5). Todo lo que el núcleo mide en muestras
 * se calcula a partir de estos segundos y de la frecuencia de muestreo del contexto.
 */

/** Capas del instrumento. */
export const LAYER_COUNT = 4;
/** Compás de 4/4. */
export const BEATS_PER_BAR = 4;

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 90;

/** Duración de una toma: 0 = libre; si no, compases. */
export const TAKE_BARS = [0, 1, 2, 4] as const;
export type TakeBars = (typeof TAKE_BARS)[number];

/** La toma libre se cierra sola a los 60 s. */
export const MAX_TAKE_SECONDS = 60;
/** Una capa no pasa de 60 s a su tempo nativo (la memoria del peor caso cuenta con ello). */
export const MAX_LAYER_SECONDS = 60;
/** Una toma libre más corta se descarta: casi siempre es una doble pulsación. */
export const MIN_FREE_TAKE_SECONDS = 0.25;
/** La cuenta previa dura al menos 4 pulsos y acaba en un límite de compás. */
export const COUNT_IN_BEATS = 4;

/** Estados que se pueden deshacer por capa (más el actual). */
export const UNDO_DEPTH = 3;

/** Suavizado de un polo de los parámetros que se mueven en directo. */
export const SMOOTHING_SECONDS = 0.01;
/** Fundido cruzado de los cambios de contenido: sonido en cola, reverso, toma y deshacer. */
export const CHANGE_FADE_SECONDS = 0.01;
/**
 * Fundido cruzado de la junta de una toma con lo que se grabó justo después. Con 10 ms, el salto de
 * un cruce de Δ = 2 (polaridad opuesta a fondo de escala) es de 0,0071 a 44,1 kHz: dentro de §5.
 */
export const JUNCTION_FADE_SECONDS = 0.01;
/** Fundido al soltar el disco y volver a la línea de tiempo. */
export const DISC_RELEASE_FADE_SECONDS = 0.015;
/** Fundido de la salida al reproducir, pausar y parar. */
export const TRANSPORT_FADE_SECONDS = 0.01;
/** La cabeza del disco sigue al ángulo con esta constante de tiempo (sin escalones). */
export const DISC_FOLLOW_SECONDS = 0.01;
/** Una vuelta del disco = un compás. */
export const DISC_BEATS_PER_TURN = BEATS_PER_BAR;
/** Vueltas del disco que se aceptan en `disc-move` (más allá se pierde la precisión). */
export const MAX_DISC_TURNS = 1e6;
/**
 * La voz del disco pasa por un filtro de continua de un polo: un disco quieto no suena (la cabeza
 * congelada daría una continua) y el sonido al arrastrarlo no cambia por encima de unos 30 Hz.
 */
export const DISC_DC_BLOCK_HZ = 10;

/** Techo del limitador: −0,3 dBFS. */
export const LIMITER_CEILING = 10 ** (-0.3 / 20);
/** Anticipación del limitador (también es su latencia). */
export const LIMITER_LOOKAHEAD_SECONDS = 0.001;
/** Recuperación del limitador. */
export const LIMITER_RELEASE_SECONDS = 0.08;

/** Corte del filtro con el brazo casi en el extremo exterior y en el interior. */
export const FILTER_OPEN_HZ = 18_000;
export const FILTER_CLOSED_HZ = 150;
/** El corte nunca pasa de esta fracción de la frecuencia de muestreo. */
export const FILTER_MAX_FRACTION = 0.45;

/** Ganancia de entrada del micrófono: 0–200 %. */
export const MAX_INPUT_GAIN = 2;
/** Latencia de ida y vuelta máxima que se compensa. */
export const MAX_LATENCY_SECONDS = 1;

/** Eventos hacia el hilo principal: como mucho 30 por segundo. */
export const STATUS_RATE_HZ = 30;
/** Avisos que caben entre dos eventos (el resto se descarta y se cuenta). */
export const NOTICE_CAPACITY = 16;
