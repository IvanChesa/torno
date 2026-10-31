/**
 * Textos de los avisos del instrumento: el corto (pantalla, en mayúsculas) y la frase para leer.
 * El motor y el núcleo devuelven códigos; aquí se convierten en texto. Pendientes de revisión de
 * Iván (fase 7).
 */
export interface MessageText {
  /** Para la pantalla del aparato. */
  readonly screen: string;
  /** Para leer (y para el aviso visible cuando es un error). */
  readonly text: string;
}

const message = (screen: string, text: string): MessageText => ({ screen, text });

export const SESSION_CONTENT = {
  reviewed: false,

  messages: {
    locked: message('BLOQUEADO EN LA TOMA', 'Eso no se puede cambiar mientras grabas.'),
    tooLong: message('TOMA DEMASIADO LARGA', 'Esa toma pasaría de 60 segundos.'),
    noMemory: message('SIN MEMORIA', 'No queda memoria para otra toma. Borra alguna capa.'),
    releaseDisc: message('SUELTA EL DISCO', 'Suelta el disco para grabar.'),
    nothingToUndo: message('NADA QUE DESHACER', 'No hay nada que deshacer en esta capa.'),
    nothingToRedo: message('NADA QUE REHACER', 'No hay nada que rehacer en esta capa.'),
    tooShort: message('TOMA DEMASIADO CORTA', 'La toma era demasiado corta y se ha descartado.'),
    stopFirst: message('PARA ANTES', 'Para la reproducción antes de calibrar.'),
    tempoFitted: (bpm: string) =>
      message(`TEMPO A ${bpm} BPM`, `El tempo se ha ajustado a la toma: ${bpm} pulsos por minuto.`),
    saved: message('GUARDADO', 'Sesión guardada en un archivo .torno.'),
    loaded: message('SESIÓN CARGADA', 'Sesión cargada.'),
    recovered: message('SESIÓN RECUPERADA', 'Se ha recuperado la sesión anterior.'),
    recoverLater: message(
      'AÚN NO SE PUEDE RECUPERAR',
      'El audio aún no está listo: la sesión anterior sigue guardada. Prueba otra vez en un momento.',
    ),
    exported: message('EXPORTADO', 'Exportación lista.'),
    autosaveCleared: message('AUTOGUARDADO BORRADO', 'Autoguardado borrado de este navegador.'),
    calibrated: (ms: string) =>
      message(`LATENCIA ${ms} MS`, `Latencia calibrada: ${ms} milisegundos.`),
    calibrating: message('CALIBRANDO', 'Calibrando: no toques nada mientras suenan los clics.'),
    exporting: message('EXPORTANDO', 'Exportando…'),
  },

  /** Problemas del motor (el audio sigue funcionando). */
  problems: {
    'mic-denied': message(
      'SIN PERMISO DEL MICRÓFONO',
      'El navegador no deja usar el micrófono. Dale permiso en los ajustes del sitio y vuelve a grabar.',
    ),
    'mic-not-found': message('NO HAY MICRÓFONO', 'No se encuentra ningún micrófono.'),
    'mic-busy': message('MICRÓFONO OCUPADO', 'Otra aplicación está usando el micrófono.'),
    'mic-insecure': message(
      'MICRÓFONO NO DISPONIBLE',
      'El micrófono solo funciona en una conexión segura (HTTPS).',
    ),
    'mic-failed': message('ERROR DEL MICRÓFONO', 'No se ha podido abrir el micrófono.'),
    'calibration-failed': message(
      'NO SE HA PODIDO CALIBRAR',
      'No se han oído bien los clics. Sube el volumen, acerca el micrófono y prueba otra vez, o ajusta la latencia a mano.',
    ),
    'sound-failed': message('SONIDO NO DISPONIBLE', 'No se ha podido preparar ese sonido.'),
    'file-invalid': message(
      'ARCHIVO NO VÁLIDO',
      'Ese archivo no es una sesión de Torno o está dañado. No se ha cambiado nada.',
    ),
    'file-version': message(
      'ARCHIVO DE OTRA VERSIÓN',
      'Esa sesión es de una versión más nueva de Torno. No se ha cambiado nada.',
    ),
    'file-too-large': message('ARCHIVO DEMASIADO GRANDE', 'Ese archivo es demasiado grande.'),
    'file-read': message('NO SE PUEDE LEER', 'No se ha podido leer el archivo.'),
    'load-failed': message(
      'NO SE HA PODIDO CARGAR',
      'No se ha podido cargar la sesión. No se ha cambiado nada.',
    ),
    'save-failed': message('NO SE HA PODIDO GUARDAR', 'No se ha podido guardar la sesión.'),
    'export-failed': message('NO SE HA PODIDO EXPORTAR', 'No se ha podido exportar.'),
    'export-empty': message('NADA QUE EXPORTAR', 'No hay ninguna capa con sonido.'),
    'autosave-quota': message(
      'AUTOGUARDADO LLENO',
      'El navegador no deja más espacio para el autoguardado. Guarda la sesión en un archivo.',
    ),
    'no-web-audio': message(
      'SIN AUDIO',
      'Este navegador no tiene Web Audio: el instrumento no puede sonar.',
    ),
    'worklet-timeout': message('EL AUDIO NO CARGA', 'El audio no ha cargado en 5 segundos.'),
    'worklet-failed': message('EL AUDIO NO CARGA', 'No se ha podido cargar el audio.'),
  },

  /** Estado del audio, en el aviso del instrumento. */
  engine: {
    loading: 'Preparando el audio…',
    needsGesture: 'Toca el instrumento para activar el sonido.',
    interrupted: 'El sistema ha pausado el audio. Toca el instrumento para reanudarlo.',
    standby: 'En reposo: pulsa «Reposo» para volver.',
    retry: 'Reintentar',
  },

  recovery: {
    question: (date: string) => `Hay una sesión autoguardada en este navegador (${date}).`,
    pendingQuestion: (date: string) =>
      `También se guardó lo que tocaste después sin contestar a esto (${date}).`,
    /** Con los dos huecos ofrecidos, lo nuevo no se autoguarda hasta contestar. */
    waitNote: 'Lo que toques ahora no se guardará hasta que elijas una de las dos.',
    recover: 'Recuperar la sesión anterior',
    recoverPending: 'Recuperar lo que tocaste después',
    discard: 'Empezar de cero',
    confirm:
      'Lo que has tocado desde que abriste la página se perderá. ¿Recuperar la sesión guardada?',
    cancel: 'Cancelar',
    confirmRecover: 'Recuperar',
  },
} as const;
