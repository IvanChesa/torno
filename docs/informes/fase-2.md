# Informe: Fase 2 (motor en el navegador, archivos e instrumento HTML)

- **Rama:** `fase-2-motor-navegador`
- **Fecha:** 2026-10-24
- **Estado:** en curso

## 0. Plan de la fase

Objetivo: tocar el instrumento completo en el navegador con controles HTML accesibles, sobre el `LoopCore` de la fase 1, antes de que exista el 3D. Cinco entregas, con un commit por pieza y su test (revisión de la fase 1, #12).

**2.a · Arranque del audio y motor**
1. **Desbloqueo** (`audio/engine/unlock.ts`, en el bundle inicial, < 2 kB). Es una escucha nativa en fase de captura sobre `document`, registrada en `main.ts` antes de arrancar Angular. Actúa en `click`, `pointerup`, `touchend` y en `keydown` (salvo Tab, Esc y las teclas modificadoras) sobre `[data-audio-unlock]`. En el propio gesto: `navigator.audioSession.type = 'playback'` si existe, crea y reanuda el `AudioContext` y reproduce un búfer silencioso de una muestra. Sigue escuchando: reanuda el contexto tras una interrupción en el siguiente gesto.
2. **Worklet** (`audio/worklet/processor.ts`): adaptador de `LoopCore`.
   - Valida cada mensaje, pasa la entrada del micrófono y la salida estéreo, y envía el estado (≤ 30/s, el mismo objeto).
   - Responde a la petición de copia de la sesión con el PCM transferido (`Transferable`) y entrega el resultado de la calibración.
   - Presupuesto: ≤ 40 kB (hoy `LoopCore` minificado ocupa 34,1 kB).
3. **`AudioEngine`** (`audio/engine/engine.ts`, cargado con `import()`):
   - adopta el contexto del desbloqueo y carga el módulo, con 5 s de espera y «Reintentar»;
   - estados y **códigos de error** (los textos los pone la interfaz desde un archivo de contenido con `reviewed: false`);
   - `navigator.audioSession` (`playback` / `play-and-record`);
   - interrupciones (`statechange`): si el contexto se suspende o se interrumpe, «Toca para reanudar»;
   - `visibilitychange`: con la pestaña oculta, toma cancelada, pausa y micrófono liberado;
   - reposo: pausa, toma cancelada, micrófono liberado y contexto suspendido tras el aviso `stopped`;
   - precarga del motor cuando el puntero o el foco se acercan al instrumento.
4. La sonda de la fase 0 desaparece: `features/audio-probe`, `engine/probe.ts`, `BeepGenerator` y sus mensajes del protocolo. El worker de síntesis se queda, con un **sonido de prueba** (un bucle de 2 compases a 90 BPM en Re) para el menú SONIDO hasta la fase 3.

**2.b · Micrófono y latencia**
1. `audio/engine/microphone.ts`:
   - `getUserMedia` mono, sin cancelación de eco, supresión de ruido ni control de ganancia automáticos (con respaldo si el navegador no lo permite), y solo tras la acción de grabar;
   - si se cancela con la petición pendiente, la pista se para en cuanto llega;
   - `MediaStreamAudioSourceNode` → entrada del worklet;
   - liberación garantizada (`track.stop()`) al terminar o cancelar la toma, en reposo y con la pestaña oculta.
2. **Latencia:**
   - automática: `baseLatency + outputLatency` + la latencia de entrada de la pista;
   - **calibración por clic**: el núcleo hace sonar 8 clics (con el transporte parado) y graba la entrada sin tocar; los ataques se detectan en el hilo principal (`audio/core/calibration.ts`, TS puro con tests en Node) y la mediana del desfase es la latencia, si al menos 6 de 8 coinciden (±1 ms);
   - ajuste manual en ms;
   - el valor y el modo se guardan en `localStorage` con `try/catch`.
3. `scripts/make-fake-mic.mjs`: WAV propio con ráfagas de tono de ataques conocidos (cada 500 ms), para el micrófono sintético de Chromium (`--use-file-for-fake-audio-capture`). Se genera antes de los e2e, fuera de git.
4. e2e:
   - grabar con el micrófono sintético de Chromium → la capa contiene la toma (energía y ataques separados 500 ms ±2 ms);
   - **alineación ±2 ms:** el micrófono de la prueba es un «bucle de retorno» (la salida del propio contexto por un `MediaStreamAudioDestinationNode`), así se sabe cuándo suena cada ataque. Se calibra y se graba el metrónomo: los clics grabados caen en los pulsos de la capa ±2 ms;
   - la pista queda `ended` tras terminar, cancelar, reposo y pestaña oculta.

**2.c · Archivos y autoguardado**
1. `audio/files/torno-format.ts`:
   - `.torno` = firma, versión, cabecera JSON (tempo, frecuencia, ajustes y, por capa, duración, fase, origen y mezcla) y PCM float32 LE por capa;
   - se valida entero antes de cambiar nada: tamaños, límites, `NaN`/`Infinity` y versión;
   - tests: ida y vuelta byte a byte y **1000 archivos malformados** rechazados con un código de error.
2. `audio/files/wav.ts`: WAV PCM de 24 bits, estéreo (mezcla) y mono (pistas), con su lector para los tests.
3. `audio/files/export.ts` + `audio/workers/export.worker.ts`:
   - mezcla con N repeticiones (1–8) y fundido final opcional, con el mismo núcleo (`renderOffline` por tramos, sin reservar el render entero);
   - pistas por separado: cada capa sola, sin metrónomo.
4. Motor:
   - guardar y cargar, con el remuestreo por `OfflineAudioContext` si la frecuencia difiere;
   - el núcleo no cambia si el archivo no vale;
   - e2e: el WAV se lee con `decodeAudioData` y la mezcla coincide con el render del núcleo en Node.
5. **Autoguardado** (`audio/engine/autosave.ts`, IndexedDB):
   - tras cada edición confirmada (no durante una toma), con antirrebote;
   - «Recuperar la sesión anterior» o «Empezar de cero»;
   - borrable desde la web y desde el menú;
   - errores de cuota controlados;
   - e2e: recargar y recuperar devuelve la misma sesión.

**2.d · Modelo del instrumento (`instrument/`, TS puro)**
1. Catálogo de controles: id, nombre accesible, tipo, rango, paso, paso grande (×10), valor por defecto, gestos y `aria-valuetext` en español (los textos, en un archivo de contenido con `reviewed: false`).
2. Gestos: máquina de estados pura e igual para puntero, táctil y teclado, con el tiempo inyectado.
   - Pulsar: soltar antes de 500 ms sin moverse.
   - Mantener: 500 ms sin moverse.
   - Girar: moverse más allá de un umbral, lo que cancela la pulsación.
   - El disco se agarra al tocarlo (sin esperar 500 ms).
3. Menú del dial principal (máquina de estados): SONIDO, BUCLE, ENTRADA, SESIÓN y AYUDA, con confirmaciones que dejan «Cancelar» seleccionado primero. Recorrer nunca cambia el audio. El tempo por pulsaciones es de la fase 3.
4. Pantalla (modelo de texto) y resumen para `aria-live` con antirrebote.
5. Atajos con el foco dentro del instrumento (WCAG 2.1.4): Espacio, R, Z, 1–4 y `?`; si el control enfocado usa la tecla, manda el control.
6. El modelo no conoce el protocolo del audio: produce **intenciones** («reproducir», «nivel de la capa 2 al 70 %»…) que `SessionStore` traduce a comandos del motor. Todo con tests en Node.

**2.e · `SessionStore` e instrumento HTML**
1. `state/session.store.ts`: signals (≤ 10/s) como puente entre el modelo y el motor. Los medidores se pintan fuera de los signals (`requestAnimationFrame` que lee el último estado).
2. `features/html-instrument`, también con `?sin3d=1`:
   - todos los controles como elementos HTML enfocables (`button` o `role="slider"`), con la pantalla, el menú y el teclado de §4.7;
   - estilos con los tokens de `DISENO.md`;
   - el atributo `data-audio-unlock` en el instrumento y en el botón «Tocar».
3. Portada: el instrumento HTML sustituye a la prueba técnica, en un `@defer` con un esqueleto prerenderizado del mismo tamaño (el JS del instrumento no entra en el inicial); el muestrario sigue hasta la fase 7.
4. e2e:
   - reproducir → salida no silenciosa (medida con un `AnalyserNode` instrumentado);
   - con el módulo retrasado 1,5 s (instrumentando `addModule`), el contexto se crea y se reanuda dentro del gesto (`window.event` anotado, con control negativo) y suena al cargar;
   - un toque antes de la hidratación (retrasando el chunk de la portada o el propio `main`) acaba con el audio desbloqueado en el gesto real o con el aviso «Toca para activar el sonido»;
   - todo con teclado; axe sin violaciones graves;
   - WebKit de escritorio (reproducir, pausar y menú);
   - privacidad: 0 peticiones de red al grabar, guardar y exportar;
   - capturas `?captura=1` de escritorio y móvil.

**Riesgos:**
- Peso del worklet y del worker de exportación frente a los 40 kB (los dos llevan `LoopCore`, 34,1 kB).
- Alinear la toma en el navegador: el micrófono sintético de Chromium es un archivo y no se sabe cuándo suena cada ataque. Por eso, el micrófono de bucle de retorno para la prueba de ±2 ms. La latencia de ese bucle tiene que ser estable entre la calibración y la toma.
- WebKit en Windows con Playwright (AudioWorklet).
- Que el JS inicial crezca: el instrumento va en `@defer` y el motor con `import()`.
- El tamaño de la fase: si se alarga, se entrega por partes con el informe al día.

**Skills consultadas:** `webapp-testing` (Playwright), `web-design-guidelines` y `accessible-animation` para el instrumento HTML.
