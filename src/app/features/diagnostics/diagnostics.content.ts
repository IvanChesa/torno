/**
 * Textos del panel de diagnóstico (`?diagnostico=1`, PLAN fase 4, tarea 7). Es una herramienta para
 * las pruebas en los móviles, no parte de la web. Pendientes de revisión de Iván (fase 7).
 */
export const DIAGNOSTICS_CONTENT = {
  reviewed: false,

  title: 'Diagnóstico del audio',
  intro:
    'Para las pruebas en el móvil (docs/PRUEBAS-MOVIL.md). Todo se lee en este navegador y nada sale de él.',

  rows: {
    firstSound: 'Del toque al primer sonido',
    context: 'Estado del audio',
    sampleRate: 'Frecuencia de muestreo',
    baseLatency: 'Latencia base',
    outputLatency: 'Latencia de salida',
    inputLatency: 'Latencia de entrada (micrófono)',
    autoLatency: 'Latencia automática (ida y vuelta)',
    latency: 'Latencia de las tomas',
    audioSession: 'Sesión de audio',
    memory: 'Memoria del audio',
    playback: 'Estadísticas del navegador',
    browser: 'Navegador',
  },

  values: {
    none: '—',
    notStarted: 'Sin arrancar: toca el instrumento',
    notGiven: 'El navegador no las da',
    firstSoundEmpty: 'Pulsa REPRODUCIR para medirlo',
    cold: 'en frío',
    silent: 'no ha sonado en 5 s',
    /** Con `?captura=1`, en lugar del agente de usuario, que cambia con cada versión. */
    browserInCapture: 'Oculto en las capturas',
    latencyModes: { auto: 'automática', calibrated: 'calibrada', manual: 'manual' },
  },

  note: 'El primer sonido se mide hasta que sale por el altavoz, con la latencia de salida que informa el navegador (con auriculares Bluetooth, la real suele ser mayor).',
  copy: 'Copiar el informe',
  copied: 'Informe copiado.',
  copyFailed: 'No se ha podido copiar: selecciona el texto del panel.',
} as const;
