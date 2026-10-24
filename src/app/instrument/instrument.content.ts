/**
 * Textos del instrumento: nombres accesibles, valores en voz (`aria-valuetext`), el menú y la
 * pantalla. Pendientes de revisión de Iván (fase 7). La pantalla va en mayúsculas, como un aparato.
 */
export const INSTRUMENT_CONTENT = {
  reviewed: false,

  controls: {
    play: {
      name: 'Reproducir y pausar',
      hint: 'Pulsa para reproducir o pausar; mantén para parar.',
    },
    record: {
      name: 'Grabar',
      hint: 'Pulsa para grabar en la capa elegida y otra vez para terminar; mantén para cancelar.',
    },
    undo: { name: 'Deshacer', hint: 'Pulsa para deshacer; mantén para rehacer.' },
    layer: (n: number) => ({
      name: `Capa ${n}`,
      hint: 'Gira para el nivel, pulsa para elegirla y mantén para silenciarla.',
    }),
    main: {
      name: 'Tempo y menú',
      hint: 'Gira para el tempo o para recorrer el menú; pulsa para entrar o confirmar; mantén para volver.',
    },
    disc: {
      name: 'Disco',
      hint: 'Mantén para congelar la capa elegida y arrastra (o usa las flechas) para mover su tiempo.',
    },
    arm: { name: 'Brazo de expresión', hint: 'Filtra la capa elegida: hacia dentro, más oscura.' },
    volume: { name: 'Volumen', hint: 'Volumen general.' },
    standby: { name: 'Reposo', hint: 'Para el audio y suelta el micrófono; las capas se quedan.' },
  },

  values: {
    percent: (value: number) => `${value} %`,
    level: (value: number, muted: boolean) => (muted ? `${value} %, en silencio` : `${value} %`),
    tempo: (bpm: string) => `${bpm} pulsos por minuto`,
    filterOff: 'Sin filtro',
    filter: (value: number) => `Filtro al ${value} %`,
    disc: (layer: number, beats: string) => `Capa ${layer}, ${beats} pulsos`,
    discEmpty: 'Sin capa',
    discHeld: (beat: string, beats: string) => `Congelado en el pulso ${beat} de ${beats}`,
    menu: (item: string) => `Menú: ${item}`,
  },

  menu: {
    sound: 'SONIDO',
    loop: 'BUCLE',
    input: 'ENTRADA',
    session: 'SESIÓN',
    help: 'AYUDA',
    categories: { drums: 'BATERÍA', bass: 'BAJO', chords: 'ACORDES', texture: 'TEXTURA' },
    off: 'APAGADO',
    takeLength: 'DURACIÓN',
    takeLengths: ['LIBRE', '1 COMPÁS', '2 COMPASES', '4 COMPASES'],
    countIn: 'CUENTA PREVIA',
    metronome: 'METRÓNOMO',
    reverse: 'REVERSO',
    pan: 'PANORAMA',
    fitTempo: 'AJUSTAR TEMPO',
    yes: 'SÍ',
    no: 'NO',
    gain: 'GANANCIA',
    latency: 'LATENCIA',
    latencyAuto: 'AUTOMÁTICA',
    latencyCalibrate: 'CALIBRAR',
    latencyManual: 'MANUAL',
    save: 'GUARDAR',
    open: 'CARGAR',
    exportMix: 'EXPORTAR MEZCLA',
    repeats: 'VUELTAS',
    fadeOut: 'FUNDIDO',
    exportNow: 'EXPORTAR',
    exportStems: 'EXPORTAR PISTAS',
    clearLayer: 'BORRAR CAPA',
    newSession: 'SESIÓN NUEVA',
    clearAutosave: 'BORRAR AUTOGUARDADO',
    cancel: 'CANCELAR',
    confirm: {
      clearLayer: (n: number) => ({ question: `¿BORRAR LA CAPA ${n}?`, action: 'BORRAR' }),
      newSession: { question: '¿EMPEZAR DE CERO?', action: 'EMPEZAR' },
      clearAutosave: { question: '¿BORRAR EL AUTOGUARDADO?', action: 'BORRAR' },
      replaceRecording: (n: number) => ({
        question: `¿SUSTITUIR LA GRABACIÓN DE LA CAPA ${n}?`,
        action: 'SUSTITUIR',
      }),
    },
    helpItems: {
      press: {
        title: 'PULSAR',
        lines: ['TOCA Y SUELTA', 'ANTES DE MEDIO SEGUNDO'],
      },
      turn: {
        title: 'GIRAR',
        lines: ['ARRASTRA ARRIBA O ABAJO', 'O USA LAS FLECHAS'],
      },
      hold: {
        title: 'MANTENER',
        lines: ['TOCA Y ESPERA', 'MEDIO SEGUNDO (MAYÚS + INTRO)'],
      },
    },
    hintList: 'GIRA · PULSA PARA ENTRAR · MANTÉN PARA VOLVER',
    hintEdit: 'GIRA PARA AJUSTAR · PULSA PARA DEJARLO',
    hintConfirm: 'GIRA PARA ELEGIR · PULSA PARA CONFIRMAR',
  },

  display: {
    bpm: (bpm: string) => `${bpm} BPM`,
    layer: (n: number) => `CAPA ${n}`,
    empty: 'VACÍA',
    recording: 'GRABACIÓN',
    muted: 'SILENCIO',
    queued: (n: number) => `EN COLA · CAPA ${n}`,
    countIn: (beats: number) => `CUENTA ${beats}`,
    recordingNow: (seconds: string) => `GRABANDO ${seconds} S`,
    micRequest: 'PIDIENDO EL MICRÓFONO',
    disc: 'DISCO',
    playing: 'EN MARCHA',
    paused: 'PAUSA',
    standby: 'REPOSO',
    /** Lo elegido (el sonido de la capa, el modo de latencia), en voz en lugar de «•». */
    inUse: 'EN USO',
    takeLengths: ['TOMA LIBRE', 'TOMA DE 1 COMPÁS', 'TOMA DE 2 COMPASES', 'TOMA DE 4 COMPASES'],
  },
} as const;
