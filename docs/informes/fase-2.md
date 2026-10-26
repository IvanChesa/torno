# Informe: Fase 2 (motor en el navegador, archivos e instrumento HTML)

- **Rama:** `fase-2-motor-navegador`
- **Fecha:** 2026-10-24
- **Estado:** terminada (revisión aplicada)

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

---

## 1. Resumen

Torno ya se toca en el navegador. El núcleo de la fase 1 corre en el AudioWorklet (36,5 kB) y el `AudioEngine` lo rodea:
- arranque en el gesto real con una escucha nativa (también antes de la hidratación);
- micrófono solo al grabar y suelto siempre;
- latencia automática, calibrada por clic o manual;
- `.torno` validado entero, WAV de 24 bits y pistas en ZIP con el mismo núcleo;
- autoguardado en IndexedDB.

El modelo del instrumento (`instrument/`, TS puro) traduce gestos y teclas en intenciones que `SessionStore` lleva al motor. El instrumento HTML, accesible y con teclado completo, sustituye a la prueba técnica en la portada, diferido con `@defer`.

Se demuestra con 393 tests en Node, 36 en Angular y 62 e2e con audio real: sonido, gesto, hidratación, micrófono, alineación, archivos, autoguardado, privacidad, errores, teclado, axe y WebKit. Tras aplicar la revisión: 398 en Node, 41 en Angular y 81 e2e (ver «Respuesta a la revisión»).

## 2. Criterios de aceptación

| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| e2e: reproducir → salida no silenciosa | ✅ | `instrument.spec.ts`: tras elegir un sonido con el teclado y pulsar reproducir, el `AnalyserNode` de la salida marca **−9,4 dBFS** (el bucle de prueba tiene su pico a −6 dBFS; centrado, −9). Antes de reproducir, 0; tras pausar, 0. |
| e2e: grabar con el micrófono sintético → la capa contiene la toma **alineada** (ataques ±2 ms tras compensar) | ✅ | `microphone.spec.ts`. **Contenido:** con el micrófono sintético de Chromium (`scripts/make-fake-mic.mjs`), la capa guardada tiene las ráfagas del archivo a **24.000 muestras exactas** entre ataques (500 ms). **Alineación:** con la latencia calibrada, los cuatro clics del metrónomo grabados caen en sus pulsos a **−2 muestras (0,04 ms)**. Para saber cuándo suena cada ataque, el micrófono de esta prueba es la salida retrasada 20 ms con un `DelayNode` (desviación 1, §4). |
| e2e: la pista del micrófono queda `ended` tras terminar, cancelar, reposo y pestaña oculta | ✅ | `microphone.spec.ts`: las 4 situaciones, con las pistas instrumentadas (`readyState === 'ended'`). Con la pestaña oculta, además, la toma se cancela y el transporte se pausa. |
| e2e: con la carga del worklet retrasada 1,5 s, el contexto se crea y se reanuda dentro del gesto (con control negativo) y suena al cargar | ✅ | `instrument.spec.ts`: el contexto está en `running` antes de 1 s tras el primer toque; las llamadas son `new:pointerup` y `resume:pointerup`. El sonido elegido y «reproducir», pulsados mientras carga, esperan en la cola y suenan al llegar el módulo (≥ 1,5 s). Control negativo: un contexto creado tras un `await` real se anota `new:ninguno`. |
| e2e: un toque antes de la hidratación termina con el audio desbloqueado o con el aviso «Toca para activar el sonido» | ✅ | `hydration.spec.ts`, contra el build. (a) Con el chunk de la portada retenido y el JS principal ya cargado, el toque desbloquea el audio en el gesto real (`new:pointerup`) y, tras hidratar, no hay aviso. (b) Con el JS principal retenido, el toque no puede desbloquear; Angular lo repite tras hidratar, el instrumento enseña «Toca el instrumento para activar el sonido.» y el siguiente toque lo desbloquea en su gesto. |
| `.torno`: ida y vuelta idéntica byte a byte (misma frecuencia) y correcta con remuestreo; 1000 archivos malformados rechazados sin cambiar el estado | ✅ | `torno-format.spec.ts` (Node): ida y vuelta byte a byte, también en blanco y con ids no ASCII, y **1000 archivos malformados** (20 tipos de defecto) rechazados con su código y sin excepciones. `files.spec.ts` (e2e): guardar, cargar en otra página y volver a guardar da los mismos bytes; una sesión de 44,1 kHz se remuestrea a 48 kHz (256.000 muestras exactas, los 4704 cruces por cero de los 441 Hz ±2 y el pico de 0,5); un archivo roto o que no es un `.torno` muestra el aviso y la sesión guardada después es idéntica byte a byte. Tras la revisión (#10), el remuestreo es el de `decodeAudioData`: un tono de 15 kHz de 44,1 a 48 kHz queda a 0,00 dB y sus imágenes a −87,8 y −105,4 dB. |
| WAV válidos (los lee el test y `decodeAudioData`); la mezcla exportada coincide con el render del núcleo | ✅ | `export.spec.ts` (Node) y `files.spec.ts` (e2e): la mezcla de 2 vueltas sin fundido coincide con `renderOffline` en Node con **≤ 1 LSB de 24 bits**, y `decodeAudioData` la lee (2 canales, la duración esperada). Las pistas: un ZIP con un WAV mono por capa, cada uno igual a la capa sola (≤ 1 LSB). |
| Autoguardado: recargar y recuperar devuelve la misma sesión | ✅ | `files.spec.ts`: tras recargar, «Recuperar la sesión anterior» devuelve una sesión que, guardada, es idéntica byte a byte a la de antes. «Empezar de cero» borra el autoguardado y ya no se ofrece. |
| Instrumento HTML: todo con teclado, axe sin violaciones graves y capturas | ✅ | `instrument.spec.ts`: los 12 controles en orden de tabulación, con nombre, descripción, rol y valor en voz; diales con flechas, Mayús ×10, Inicio y Fin; Intro y Mayús+Intro; disco con Espacio y flechas; atajos 1–4, Espacio, R, Z y `?`; menú con Esc. axe: **0 violaciones** (ninguna grave, crítica, moderada ni leve), también con el menú abierto. Puntero: arrastrar un dial, mantener una tecla y tocar. Capturas en `docs/informes/img/fase-2/` (§7). |
| e2e de privacidad: 0 peticiones de red al grabar, guardar y exportar | ✅ | `files.spec.ts`: grabar con el micrófono, guardar, exportar la mezcla y exportar las pistas no hacen **ninguna** petición `http(s)`; 0 cookies. |

Además:
- **Primer sonido tras pulsar** (§5: ≤ 100 ms con el motor cargado): **10–15 ms** en 20 medidas (de `pointerdown` a la primera muestra en el analizador de la salida; Chromium sin interfaz, sin la latencia del dispositivo).
- **Errores visibles** (`errors.spec.ts`): si el módulo no carga en 5 s, el aviso y «Reintentar» lo arreglan; con el micrófono denegado, se explica y no se graba nada.
- **WebKit de escritorio** (`webkit.spec.ts`): el menú funciona y, como el WebKit de Playwright para Windows no tiene Web Audio, el instrumento lo dice con un aviso visible. Reproducir y pausar con audio corren donde WebKit trae Web Audio: en el CI de Linux, en verde tras la fusión (desviación 2 y respuesta a la revisión, #14).

## 3. Tareas del plan

| Tarea | Estado | Notas |
|---|---|---|
| 2.1 Desbloqueo nativo y `AudioEngine` | hecha | `unlock.ts` (1,7 kB en el inicial), `engine.ts` (19,9 kB): adopta el contexto, 5 s y «Reintentar», estados y códigos, `audioSession`, interrupciones, pestaña oculta, reposo, precarga y cola de comandos. La sonda de la fase 0 ha desaparecido. |
| 2.2 Micrófono | hecha | `microphone.ts`: sin procesar (con respaldo), solo al grabar o calibrar, cancelación con la petición pendiente, liberación garantizada. |
| 2.3 Latencia | hecha | Automática, calibración por clic (núcleo + `measureLatency` en TS puro, 11 tests) y manual; en `localStorage`. |
| 2.4 Archivos | hecha | `torno-format.ts`, `wav.ts`, `zip.ts`, `export.ts` (TS puro) y `export.worker.ts`; guardar, cargar con remuestreo, mezcla y pistas. |
| 2.5 Autoguardado | hecha | `autosave.ts` (IndexedDB, fecha en su propia clave), recuperar o empezar de cero, borrar desde la web y desde el menú, cuota avisada. |
| 2.6 `instrument/` | hecha | Catálogo, gestos, teclado y atajos, menú, pantalla, valor en voz e intenciones; 58 tests en Node. SONIDO con un sonido de prueba por categoría. |
| 2.7 `SessionStore` | hecha | Signals ≤ 10/s, intenciones → motor, avisos → textos, controles con gracia de 400 ms, resumen en voz con antirrebote; 7 tests con un motor de mentira. |
| 2.8 Instrumento HTML | hecha | `features/html-instrument` (directiva de control, pantalla, lateral, avisos), en la portada con `@defer` y esqueleto prerenderizado del mismo tamaño. |
| 2.9 `make-fake-mic.mjs` | hecha | Ráfagas de 660 Hz cada 500 ms, en `e2e/.generated/` (fuera de git), antes de los e2e. |
| 2.10 Playwright | hecha | Chromium con micrófono sintético (dev y estático) y WebKit de escritorio; 62 e2e. |

## 4. Desviaciones del plan y motivo

1. **La prueba de ±2 ms usa un retorno determinista** (la salida retrasada 20 ms con un `DelayNode`, inyectada en lugar del nodo del micrófono), no el micrófono sintético de Chromium: con un archivo no se sabe cuándo suena cada ataque. Antes se probó un retorno por `MediaStream`, y su latencia **cambia en cada apertura de la pista**: 20,7, 20,7, 21,3 y 12,0 ms en cuatro calibraciones seguidas. Así no sirve de referencia, y además es un riesgo para el producto (§10, propuesta 1). El micrófono sintético se usa para comprobar el contenido de la toma.
2. **WebKit en Windows sin Web Audio.** El WebKit de Playwright para Windows no trae `AudioContext`. Allí la prueba comprueba el menú y el aviso «Este navegador no tiene Web Audio»; reproducir y pausar con audio quedan para el WebKit de Linux del CI, que lo instala desde esta fase (`ci.yml`). Tras la fusión, el CI de `main` lo demuestra (respuesta a la revisión, #14).
3. **El worker de exportación se crea al arrancar el motor** (38,8 kB) y se reutiliza, en lugar de crearlo al exportar: así exportar no hace ninguna petición de red (criterio de privacidad). Si nunca se exporta, se descarga igual.
4. **Un sonido de prueba por categoría** (4 bucles de 2 compases en Re menor, `audio/synth/test-loop.ts`), en lugar de uno solo, para que el menú SONIDO tenga su forma definitiva.
5. **`@defer` cuesta unos 10 kB en el `main`** (el código de Angular para los bloques diferidos): el JS de la primera visita a `/` pasa de 293,5 a 301,3 kB (aviso a 330). A cambio, los 58 kB del instrumento no entran en la primera visita.
6. **Token nuevo `--instrument-plate`** (`#864230`): el cuerpo del instrumento HTML es un barro más oscuro que el del 3D, porque sobre el terracota claro ni la tinta (4,5:1) ni el latón (3:1) llegaban al contraste AA. Documentado en `DISENO.md` §7.1 y comprobado en `contrast.spec.ts`.
7. **El dial principal en el menú:** al recorrer una lista, la flecha abajo va al elemento siguiente (como en cualquier lista), aunque el dial sea un `role="slider"`; al ajustar un valor, arriba sube.

## 5. Decisiones técnicas nuevas

| Decisión | Alternativas consideradas |
|---|---|
| **Intenciones**: el modelo del instrumento no conoce el protocolo del audio; produce «reproducir», «nivel de la capa 2 al 70 %», «guardar»… y `SessionStore` las traduce. El modelo lo usarán igual el 3D y la guía. | Que el modelo emitiera comandos del núcleo (acopla `instrument/` a `audio/core`, que esa capa no puede importar). |
| Los **valores en directo** (niveles, panoramas, filtros, tempo) son del modelo; el estado del audio los confirma cuando nadie los ha movido en 400 ms (al cargar una sesión, al ajustar el tempo a la primera toma). | Leerlos siempre del estado (30/s como mucho, y a 10/s en signals): con dos flechas seguidas se perdería un paso. |
| El **motor nunca crea un contexto**: solo el desbloqueo, siempre en un gesto. Si no hay, `needs-gesture`. | Crearlo al arrancar el motor (fuera del gesto: en iOS quedaría suspendido y el e2e lo vería como `new:ninguno`). |
| **Toques sin desbloquear**: la portada escucha los `click` (Angular repite los de antes de hidratar) y, si el audio no se pudo desbloquear, lo apunta en el desbloqueo; el instrumento, al cargarse, pide otro toque. | Un `(click)` en el escenario (el lint de accesibilidad lo rechaza en un elemento no enfocable, y no es un control). |
| **Reposo**: suspende el contexto y deja de reanudarlo con cualquier toque; solo «salir del reposo» lo reanuda, dentro de su gesto. | Que cualquier toque sobre el instrumento lo reanudara. |
| **Micrófono por toma**: se pide al pulsar grabar y se suelta al confirmarse o cancelarse la toma (o si el núcleo rechaza grabar). | Mantenerlo abierto mientras se graba varias veces (la regla de CLAUDE.md pide soltarlo al acabar cada toma; ver §10). |
| **Calibración**: clics después del volumen (suenan con la rueda a cero), 8 cada 0,5 s, mediana de los que coinciden ±1 ms (6 de 8). El ataque se fecha al 30 % del pico, igual que el clic de referencia. | Correlación cruzada (más cara y frágil con ecos); un umbral absoluto (depende del nivel del micrófono). |
| **Cabecera del `.torno` en ASCII** (lo demás, escapado `\uXXXX`) y relleno con ceros hasta el PCM. | UTF-8 (TS puro sin `TextEncoder` en su `lib`); relleno con espacios (`JSON.parse` aceptaría una longitud de cabecera cambiada). |
| **Pistas**: cada capa sola, a la izquierda del todo y sin silenciar: el canal izquierdo es la capa por su nivel, con el mismo núcleo. En un ZIP sin compresión. | Un modo de render nuevo en el núcleo; varias descargas sueltas (el navegador pide permiso). |
| **Autoguardado** con antirrebote de 1,5 s en el motor; no se autoguarda mientras haya una sesión anterior sin recuperar ni descartar (para no pisarla). | Autoguardar siempre (se perdería la sesión anterior al tocar antes de decidir). |
| **Resumen en voz** con antirrebote de 700 ms en el store (sin `effect()`), en frases a partir de las líneas de la pantalla. | Hacer viva la pantalla (ruido al girar un dial); un `effect` que copiara el resumen. |
| **Medidores y disco fuera de los signals**: `requestAnimationFrame` solo con el transporte en marcha o el disco agarrado; con movimiento reducido, medidores cada 250 ms y el disco quieto. | Signals por fotograma (más de 10/s). |
| **Botones**: pulsar es su `click` (vale para Intro, Espacio y el clic virtual de un lector de pantalla); mantener sale del puntero (500 ms) o de Mayús+Intro, y el `click` que sigue a un gesto ya atendido se ignora durante 600 ms. | Gestos solo por puntero (los lectores de pantalla mandan clics sin `pointerdown`). |
| **Selector de archivos** abierto dentro del gesto: el instrumento registra en el store una función que hace `click()` en un `input type="file"` oculto. | Abrirlo tras un `await` (los navegadores lo bloquean sin activación). |

## 6. Salida de los checks

Salida al entregar la fase para revisión. Las cifras tras las correcciones están al final, en «Respuesta a la revisión».

```
$ npm run check
> lint       typecheck (4 tsconfig) ✔ · All files pass linting · Prettier ✔
> test:node  Test Files 27 passed · Tests 393 passed
             Cobertura del TS puro: 98,18 % sentencias · 94,49 % ramas · 100 % funciones · 99,35 % líneas
> test:bench LoopCore: 240× tiempo real
> test:ng    Test Files 8 passed · Tests 36 passed
> build      Initial total 297,12 kB · Prerendered 3 static routes · sin avisos de presupuesto
> check-bundles
  ✔ JS inicial de /                     301.3 kB  (aviso > 330.0 kB · error > 400.0 kB)
  ✔ JS inicial de /404                  291.2 kB
  ✔ JS inicial de /sobre-el-proyecto    292.8 kB
  ✔ Desbloqueo de audio en el inicial     1.7 kB  (error > 2.0 kB)
  ✔ Motor de audio (engine.ts)           19.9 kB  (error > 60.0 kB)
  ✔ Motor de audio (autosave.ts)          0.1 kB
  ✔ Worker synth.worker.ts                2.5 kB  (error > 40.0 kB)
  ✔ Worker export.worker.ts              38.8 kB  (error > 40.0 kB)
  ✔ Worklet                              36.5 kB  (error > 40.0 kB)
  ✔ Fuentes                             144.1 kB  (error > 150.0 kB)
  ✔ Bundle inicial sin motor de audio, síntesis, worklet ni 3D.

$ npm run e2e
  62 passed (≈ 45 s): dev 25 · estático 36 · WebKit 1
```

Tests nuevos de la fase:
- **Node:** calibración 11, sonidos de prueba 6, worklet 5, `.torno` 5 (con los 1000 malformados), WAV, ZIP y exportación 10, modelo del instrumento 58 (gestos y teclado, reductor, menú, pantalla, valor en voz y bordes) y sincronía de límites 2.
- **Angular:** `SessionStore`, 7.
- **e2e:** instrumento 9, micrófono 3, archivos 6, hidratación 2, errores 2 y WebKit 1. El antiguo `audio.spec.ts` de la sonda ya no está.

Métricas de la fase (audio):

| Medida | Valor |
|---|---|
| Primer sonido tras pulsar (motor cargado) | 10–15 ms (Chromium, sin la latencia del dispositivo) |
| Alineación de una toma con latencia calibrada | −2 muestras (0,04 ms) en los cuatro pulsos |
| Latencia de un retorno por `MediaStream` en cuatro aperturas | 20,7 · 20,7 · 21,3 · 12,0 ms (riesgo, §10) |
| Pico de un sonido de prueba centrado | −9,4 dBFS medido (−9 esperado) |
| Mezcla exportada frente al render del núcleo | ≤ 1 LSB de 24 bits |
| Peticiones de red al grabar, guardar y exportar | 0 |

## 7. Capturas

`docs/informes/img/fase-2/` (con `?captura=1`, movimiento reducido):
- la portada, `/sobre-el-proyecto` y `/404`: `inicio-*.png`, `sobre-el-proyecto-*.png` y `404-*.png`;
- el instrumento de cerca, en reposo y con el menú BUCLE abierto: `instrumento-reposo-*.png` y `instrumento-menu-*.png`;
- tras la revisión (#19), los avisos: la chuleta de atajos (`instrumento-atajos-*.png`), el audio cargando (`instrumento-cargando-*.png`), el error con «Reintentar» (`instrumento-error-*.png`) y el panel de recuperar la sesión anterior, con la fecha fija (`instrumento-recuperar-*.png`);
- todo en escritorio (1440 × 900) y en móvil (Pixel 7).

## 8. Dependencias añadidas

Ninguna. El navegador WebKit de Playwright (parte de `@playwright/test`, ya en la lista) se instala en local y en el CI.

## 9. Pendientes y `TODO(ivan)`

En `docs/PENDIENTES.md`:
- **Fase 4, en móviles reales:**
  - comprobar la alineación de las tomas tras calibrar, sabiendo que en Chromium la latencia del camino del micrófono cambia en cada apertura (§10, propuesta 1);
  - una prueba de cortes con capas largas y el autoguardado activo (revisión, #6).
- **Decisión de Iván:** qué hacer con el autoguardado mientras el panel de recuperar sigue sin contestar (revisión, #21).

Para las fases siguientes:
- **Fase 3:**
  - los 12 bucles sustituyen a los sonidos de prueba (mismos ids por categoría en `instrument/sounds.ts` y `audio/synth`);
  - tempo por pulsaciones en BUCLE;
  - primera reproducción con la batería en la capa 1 y la capa 2 elegida;
  - el alias del *varispeed* (revisión de la fase 1, #14).
  - **Ojo al peso:** el worker de exportación lleva el núcleo entero y está a 38,8 kB de 40.
- **Fase 4:**
  - la CSP y el `.htaccess` tienen que permitir el worklet, los dos workers y `blob:` para las descargas;
  - el CI de `main` ya está en verde, con WebKit reproduciendo y pausando con audio en Linux (#14): la fase 4 parte de ahí;
  - en la lista de pruebas en móviles, una de 5 min con 4 capas largas (tomas de 30–60 s) y el autoguardado activo, girando diales: 0 cortes (revisión, #6).
- **Fase 5.a:** la maqueta 2D del instrumento HTML pone el dial principal y el brazo arriba a la derecha, como el original; se alinea con la distribución del aparato que apruebe Iván, porque seguirá siendo la alternativa sin WebGL (revisión, #20).

## 10. Propuestas de cambio al plan

1. **Latencia por apertura del micrófono.** Si en los móviles de la fase 4 las tomas se desplazan entre sí (como en el retorno por `MediaStream` de Chromium: hasta 9 ms), hay dos salidas:
   - **(a)** mantener abierto el micrófono durante una «sesión de grabación» y soltarlo tras unos segundos sin grabar, en reposo y con la pestaña oculta. Cambia la regla de CLAUDE.md, que pide soltarlo al terminar cada toma.
   - **(b)** recalibrar sola cada toma con los clics de la cuenta previa, cuando el micrófono los oiga (con altavoces; con auriculares se usaría la calibración guardada).
   Propongo decidirlo con las medidas de Iván.
2. **Fase 2, criterio de alineación:** escribir «ataques ±2 ms tras compensar, con un micrófono de retorno determinista en el e2e; en dispositivos reales, ±5 ms (§5)».
3. **§5, JS de la primera visita:** anotar que `@defer` añade ~10 kB fijos al `main` (el instrumento y el 3D irán siempre diferidos).
4. **§5, memoria de audio: el pico de una copia que coincide con una toma.** La copia de la sesión (guardar, autoguardar o exportar) es memoria transitoria del worklet: hasta 46,08 MB durante menos de 1 s con 4 capas de 60 s a 48 kHz (`AUDIO.md` §4). Durante una toma no se copia nada, pero una copia empezada justo antes de pulsar grabar coincide con la reserva de la toma: el pico sería 195,84 + 46,08 = 241,92 MB, por encima de los 220 MB de §5, durante menos de 1 s y solo en el peor caso (las 4 capas de 60 s con el historial lleno). Dos salidas:
   - **(a)** que el núcleo aplace el inicio de la toma hasta que termine la copia en curso (como mucho 1 s; en una toma fija, que empieza en el compás siguiente, casi nunca se notaría);
   - **(b)** que §5 hable del régimen permanente y admita ese pico transitorio, documentado.
   Propongo (b) para la v1 y (a) si las pruebas de la fase 4 o la 8 muestran problemas de memoria en el móvil.

## 11. Cómo probarlo

```
npm start                      # http://localhost:4200
```

En la portada, en «Tócalo»:
1. Gira el dial «Tempo y menú» (arrastra o usa las flechas) o púlsalo (Intro) para abrir el menú.
2. En SONIDO → una categoría → PRUEBA (Intro), y luego Reproducir (o Espacio con el foco en un dial).
3. Grabar (R) pide el micrófono; con auriculares, calibra antes en ENTRADA → LATENCIA → CALIBRAR.
4. SESIÓN guarda, carga y exporta (mezcla y pistas).
5. Recarga la página: el instrumento ofrece recuperar la sesión.

```
npm run e2e                    # 81 e2e: dev, estático y WebKit
npm run capturas -- --fase=2   # tras npm run build
```

---

## Respuesta a la revisión

Revisión: `docs/revisiones/fase-2.md` (CAMBIOS NECESARIOS: 0 Bloqueantes, 6 Importantes, 9 Menores y 6 Sugerencias). Se han corregido los seis Importantes, los ocho Menores de código y las seis Sugerencias (la #20, para la fase 5.a; la segunda parte de la #21, la decide Iván). Cada corrección de código lleva su test, y los e2e nuevos fallan sin el arreglo. Como no quedaba ningún Bloqueante, no hace falta otra ronda (CLAUDE.md, paso 5).

| # | Severidad | Qué se ha hecho | Evidencia | Commit |
|---|---|---|---|---|
| 1 | Importante | «Recuperar» ya no suelta la sesión guardada hasta haberla cargado, y mientras tanto el autoguardado no la pisa. Dentro del gesto, sale del reposo o, si el audio no cargó a tiempo, reintenta la carga; luego espera hasta 10 s a que el motor esté listo. Si el audio no arranca, avisa («AÚN NO SE PUEDE RECUPERAR») y el panel sigue. | `files.spec.ts`, tres casos con la sesión recuperada idéntica byte a byte a la guardada: el módulo retrasado 2,5 s (un dial arranca el motor y se pulsa «Recuperar» al momento), el reposo, y el módulo que no carga en 5 s (el primer toque avisa y deja el panel; el segundo reintenta y recupera). El último falla sin el reintento. Tests del store: tras un error, reintenta y suelta el panel solo al cargar; sin Web Audio, avisa al momento, sin esperar 10 s. | `d346a09`, `0b85a49` |
| 2 | Importante | Los atajos solo actúan con el foco dentro del grupo de controles (`.instrument`). En los botones de los avisos, Espacio e Intro los pulsan. | e2e: Espacio sobre «Cerrar» cierra la chuleta y no reproduce (Reproducir sigue con `aria-pressed="false"`); Espacio sobre «Recuperar la sesión anterior» la recupera. | `74e3241` |
| 3 | Importante | Suelto, el disco dice un valor estable: «Capa 1, 8 pulsos». La posición solo se dice mientras se agarra («Congelado en el pulso 1,5 de 8»), que es cuando la mueve quien toca. | Tests de `controlValue` en Node. e2e: con el foco en el disco y el transporte en marcha, 20 lecturas de `aria-valuetext` en 2 s dan un solo valor (antes, 23 cambios en 3 s). | `2b5d3e7` |
| 4 | Importante | `checkHeader` devuelve objetos nuevos: en los ajustes, solo las cinco claves validadas; en el origen, solo `kind` e `id`. `#loaded()` copia las cinco claves una a una. | Test del formato: un `.torno` con `"latency": null, "repeats": 999` en los ajustes, `"volumen": 11` en un origen y una clave de más en la raíz se lee con las cinco claves justas y el origen limpio. | `b987469` |
| 5 | Importante | El desbloqueo ya no tiene la guarda de «reanudando». Mientras el contexto no suene, cada `click`, `pointerup`, `touchend` o `keydown` sobre el instrumento vuelve a pedir `resume()` y el búfer silencioso. Los oyentes solo se avisan cuando el contexto suena de verdad. | e2e con la simulación de la revisión (el contexto nace suspendido y un `resume()` en `pointerup` queda pendiente para siempre): tras `new:pointerup` y `resume:pointerup`, el `resume:click` del mismo toque lo pone en `running`, y el aviso desaparece. | `f3ae9cd`, `273a3c5` |
| 6 | Importante | La copia de la sesión se hace por tramos en `process()`. El manejador toma la instantánea del núcleo (`LoopCore.snapshot()`) y reserva los búferes; cada bloque copia hasta 32.768 muestras. Los primeros tramos son más pequeños y el bucle de copia se calienta al crear el worklet. Documentado en `AUDIO.md` §7. | Banco con 4 capas de 60 s sonando, tres ejecuciones: de golpe, 7,4–7,8 ms; por tramos, 368 bloques con mediana de 0,04–0,05 ms y peor bloque de 0,09–0,26 ms, con el render incluido (el test exige < 2 ms; un bloque dura 2,67). `session-copy.spec.ts`: la copia es idéntica byte a byte a la de golpe aunque la sesión cambie mientras tanto. El worklet pasa a 37,7 kB (≤ 40). La prueba de cortes con capas largas va a la lista de la fase 4 (§9). | `a66a503` |
| 7 | Menor | El control suelta el disco en `focusout` y en el `blur` de la ventana. Con la pestaña oculta, el motor manda `disc-release`. | e2e: agarrado con Espacio, Tab lo suelta (la pantalla deja «DISCO» y el valor vuelve a «Capa 1, 8 pulsos»), y el `blur` de la ventana también. Con la pestaña oculta, el worklet recibe `disc-release` después de `disc-hold`. | `9ae8e17` |
| 8 | Menor | Sin contexto, o si no se puede remuestrear, `loadSession` lanza `load-failed`: el motor avisa («NO SE HA PODIDO CARGAR») y no devuelve ajustes. El store solo dice «cargada» si se ha cargado, y trata cualquier otro fallo de `openFile`. Grabar con el audio aún cargando espera a que esté listo; pulsar otra vez lo cancela. | e2e sin Web Audio: cargar un `.torno` avisa y la capa sigue vacía. e2e con el módulo retrasado 2 s: reproducir y grabar seguidos graban la toma (falla sin la espera). Test del store. | `c9380d4` |
| 9 | Menor | El reposo y la pestaña oculta cancelan la calibración a propósito, también mientras espera al transporte o al micrófono. `calibrate()` devuelve `null` y el store no lo avisa como error. | e2e: con la calibración sonando, el reposo suelta el micrófono, y en 11 s no aparece ningún aviso de error (antes llegaba a los 10,1 s). Test del store. | `3ccf0c6` |
| 10 | Menor | El remuestreo usa `decodeAudioData` de un `OfflineAudioContext` sobre un WAV en coma flotante con tres vueltas, que se escribe directamente (sin la copia triplicada). | e2e con un tono de 15 kHz, de 44,1 a 48 kHz: queda a 0,00 dB, con las imágenes a −87,8 y −105,4 dB (límites: ±0,5 dB y < −60 dB). Con el remuestreo anterior: −3,44 dB, imágenes a −15,0 y −27,3 dB, y el e2e falla. | `6c4c662` |
| 11 | Menor | La zona de toque es el control entero, y la ranura que se ve es su `::before`. | e2e: los 12 controles miden al menos 44 × 44 px, a 412 y a 1440 px de ancho. | `8b958d3` |
| 12 | Menor | Girar un dial, el brazo, la rueda o el disco no se anuncia en la región viva, porque ya lo lee el control (los avisos sí se anuncian). El resumen hablado no lleva la flecha de los submenús y cambia la marca de lo elegido por «en uso». | Tests del store: girar no cambia el anuncio; el menú se lee «Menú. Sonido. Toma libre.» y «Batería. Prueba: en uso. Toma libre.». | `9238e24` |
| 13 | Menor | Borrados `stageTapped` (y con él el uso de `isAudioUnlocked` fuera del desbloqueo), `Microphone.isOpen`, los getters `status`, `sampleRate` y `mic` del motor, los textos `hint*` del menú y `layerState`. | Ninguno aparece ya en `src/`; `npm run check` en verde. | `c42dfa4` |
| 14 | Menor | Comprobado en el CI de `main` tras la fusión. La prueba de WebKit se ha endurecido: sin `AudioContext`, pasaba por la rama del aviso sin probar el audio; ahora solo el WebKit de Windows puede venir sin Web Audio. Al vigilar el CI salieron dos fallos más, arreglados en `main`: (1) un test del DSP que con la cobertura tarda 19 s se pasó de 30 s en un runner lento, y el límite pasa a 120 s; (2) una carrera del e2e del autoguardado, que recargaba antes de que terminara el borrado asíncrono de IndexedDB: ahora el test espera al borrado. Los fallos de los e2e salen ya como anotaciones del commit (reporter `github`). | CI de `main` en verde (`40ae336`): lint, tests, build, presupuestos y 81 e2e en 2,4 min, sin reintentos, con WebKit de Linux reproduciendo y pausando con audio. La carrera, reproducida en local frenando la CPU de la página (4× y 10×): 6 de 6 fallos; con la espera, 6 de 6 bien (el borrado tarda 3–18 ms). No es un fallo del flujo: con el panel abierto no se autoguarda nada, y una persona no recarga tan rápido. | `d97d858`, `0ca8a0e`, `fad8a33`, `40ae336` |
| 15 | Menor | Sin reescribir el historial. Los arreglos de esta revisión ya van cada uno con su test; en la fase 3, un commit por pieza con su test. | — | — |
| 16 | Sugerencia | Los controles que no giran (las teclas) no pasan a «girar» al moverse: un temblor del dedo ya no cancela pulsar ni mantener. | Test de la máquina de gestos y e2e: un arrastre de 12 px sobre «Reproducir» reproduce (falla sin el cambio). | `e721ecc` |
| 17 | Sugerencia | Vacías, las regiones vivas de los avisos se ocultan a la vista (1 px recortado y fuera de la rejilla), no con `display: none`. | El e2e de axe comprueba que las dos regiones (`alert` y `status`) están en el árbol, vacías (falla sin el cambio). | `3145520` |
| 18 | Sugerencia | `matchMedia` se crea una vez, tras el primer render, y se lee su `matches`. | e2e: con movimiento reducido, el disco no gira solo; al quitar la preferencia, vuelve a girar sin recargar. | `3c8abec` |
| 19 | Sugerencia | `npm run capturas` también fotografía la chuleta de atajos, el audio cargando, el error con «Reintentar» y el panel de recuperar, con la fecha y la zona horaria fijas. | 8 capturas nuevas en `docs/informes/img/fase-2/` (§7). | `d9f110f` |
| 20 | Sugerencia | Para la fase 5.a: la maqueta 2D se alineará con la distribución del aparato que apruebe Iván. | Apuntado en §9. | — |
| 21 | Sugerencia | (a) Cargar un `.torno` lo autoguarda. (b) Autoguardar con el panel de recuperar sin contestar lo decide Iván: las opciones están en `PENDIENTES.md` y la propuesta es un segundo hueco en IndexedDB. | (a) Test del store: tras cargar, se pide el autoguardado con los ajustes cargados. | `54f6ef4`, `54d728b` |

**Cifras tras las correcciones.**
- **`npm run check`, en verde:**
  - 398 tests en Node (28 archivos) y 41 en Angular (8 archivos);
  - cobertura del TS puro: 98,23 % de sentencias, 94,65 % de ramas, 100 % de funciones y 99,37 % de líneas;
  - build sin avisos de presupuesto.
- **Presupuestos:**

  | Pieza | Tamaño | Límite |
  |---|---|---|
  | JS inicial de `/` | 301,4 kB | aviso a 330 |
  | Desbloqueo de audio | 1,8 kB | < 2 |
  | Motor (`engine.ts`) | 20,7 kB | ≤ 60 |
  | Worklet | 37,7 kB | ≤ 40 |
  | Worker de exportación | 38,6 kB | ≤ 40 |
  | Worker de síntesis | 2,5 kB | ≤ 40 |
  | Fuentes | 144,1 kB | ≤ 150 |
- **`npm run e2e`:** 81 de 81 en 57 s (dev 34, estático 46 y WebKit 1).
  - Primer sonido tras pulsar: 14, 14, 11, 9 y 9 ms (dev); 8, 9, 13, 7 y 11 ms (estático).
  - Pico de la salida con el sonido de prueba: −9,6 y −9,0 dBFS.
  - En una ejecución anterior, con el PC muy cargado por otras aplicaciones (CPU al 83 %), falló una vez «una toma con el micrófono sintético… cada 500 ms»: un hueco entre ataques se desvió de los 500 ms en 480 muestras justas (10 ms). Es el bloque de captura del micrófono sintético de Chromium; el worklet trabaja en bloques de 128. Repetido 8 veces seguidas, 8 en verde. El CI tiene un reintento.
- **CI de `main`** (GitHub Actions, tras la fusión y los arreglos del #14): en verde, con 81 e2e en 2,4 min.
- **Banco** (`npm run test:bench`): `LoopCore` a 233×, 221× y 204× tiempo real en tres ejecuciones. Con el PC muy cargado bajó a 27–50× y no llegó a los 100× del test. Es la máquina, no el código: los arreglos de la revisión no tocan `LoopCore.process()`.

**Propuesta nueva** (§10, 4): el pico de memoria de una copia de la sesión que coincide con el principio de una toma.
