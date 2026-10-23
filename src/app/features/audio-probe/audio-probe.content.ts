/** Textos de la prueba técnica del audio (temporal, fase 0). Pendientes de revisión de Iván. */
export const AUDIO_PROBE_CONTENT = {
  reviewed: false,
  worklet: {
    title: 'Hilo de audio',
    description:
      'Un pitido de medio segundo (La, 440 Hz) calculado muestra a muestra en el AudioWorklet, el hilo de audio del navegador.',
    action: 'Probar el pitido',
  },
  synth: {
    title: 'Síntesis en segundo plano',
    description:
      'Una nota Re de un segundo sintetizada en un Web Worker, sin bloquear la página, y reproducida después.',
    action: 'Probar el sintetizador',
  },
  idle: 'Aún sin probar.',
  running: 'Cargando y sonando…',
  errorPrefix: 'No ha sonado.',
} as const;
