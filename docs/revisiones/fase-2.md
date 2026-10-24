# Revisión: Fase 2
Veredicto: CAMBIOS NECESARIOS

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante | `src/app/state/session.store.ts:252-263` (`recover`), con `:196-202` (`start`) y `:449-452` (`#autosave`) | **«Recuperar la sesión anterior» con el motor aún no listo no recupera nada y acaba borrando esa sesión.** `recover()` vacía `#recovery` lo primero y, si el motor que devuelve `start()` no está en `ready`, sale sin aviso. Y `start()` devuelve al momento el motor que ya existe, aunque esté en `loading`, `standby`, `interrupted` o `error`. Sin `#recovery`, el siguiente autoguardado escribe la sesión actual o, si está vacía, borra el autoguardado. **Comprobado** en Chromium con dos escenarios. (a) Módulo del worklet retrasado 2,5 s: se gira un dial con el teclado (arranca el motor) y 0,4 s después se pulsa «Recuperar». El panel desaparece y la pantalla sigue en «CAPA 1 · VACÍA». Al cargar el módulo, la intención aplazada del dial programa el autoguardado de una sesión vacía, que borra el anterior: en otra página ya no se ofrece recuperar. (b) En reposo: «Recuperar» tampoco hace nada, y la primera edición tras salir del reposo borra el autoguardado. **Deducido:** pasa lo mismo con el error «El audio no ha cargado en 5 segundos», en el que el panel de recuperar sigue visible junto a «Reintentar». | No soltar `#recovery` hasta haber cargado la sesión. Hay que esperar a que el motor esté listo (salir del reposo o reintentar si hace falta). Si no se puede, dejar el panel y avisar. Tests e2e con el módulo retrasado y en reposo: la sesión recuperada tiene que ser la misma byte a byte. |
| 2 | Importante | `src/app/features/html-instrument/html-instrument.ts:45` y `:106-126`, con `src/app/instrument/keyboard.ts:96-104` | **Espacio sobre los botones de los avisos no los pulsa: reproduce.** Los atajos escuchan el `keydown` de todo `trn-html-instrument`, y eso incluye `trn-instrument-notices`: «Reintentar», «Recuperar la sesión anterior», «Empezar de cero», «Cerrar» de la chuleta y «Borrar autoguardado». Con el foco en uno de ellos, `focused` es `null`, `shortcutFor` devuelve `play` y el `preventDefault()` anula la pulsación nativa. **Comprobado:** Espacio sobre «Recuperar la sesión anterior» deja el panel y pone el transporte «EN MARCHA» con la capa vacía; con Intro sí recupera. Espacio sobre «Cerrar» no cierra la chuleta y también reproduce. **Deducido:** R sobre esos botones pediría el micrófono. Espacio es la tecla habitual para pulsar un botón, y la fase pide «todo con teclado». | Limitar los atajos al grupo de controles (`.instrument`), o ignorar el evento cuando venga de un elemento interactivo nativo que no sea un control (`button`, `a` o `input` sin `data-control`). Test e2e con Espacio en «Recuperar» y en «Cerrar». |
| 3 | Importante | `src/app/instrument/control-value.ts:53-66`, con `src/app/features/html-instrument/control.directive.ts:37-38` | **El valor en voz del disco cambia sin parar mientras suena.** `aria-valuenow` y `aria-valuetext` («Pulso 1,4 de 8», «Pulso 1,6 de 8»…) siguen la posición del transporte a 10 por segundo. **Comprobado:** con el foco en el disco y el transporte en marcha, `aria-valuetext` cambia 23 veces en 3 s sin tocar nada. **Deducido:** los lectores de pantalla leen los cambios de valor del control enfocado (NVDA, JAWS y VoiceOver lo hacen con los deslizadores). Quien llegue al disco con el tabulador mientras suena oirá una retahíla continua. La lista de la revisión pide «`aria-valuetext` y `aria-live` sin ruido», y en la fase 6 la capa de controles del 3D usará este mismo modelo. | Con el disco suelto, un valor estable: por ejemplo, la capa y su duración, o el pulso solo con el transporte parado. La posición, solo mientras se agarra, porque entonces los cambios los provoca el usuario. Test en Node de `controlValue` y un e2e que cuente los cambios con el transporte en marcha. |
| 4 | Importante | `src/app/audio/files/torno-format.ts:217-220` y `:250`, con `src/app/state/session.store.ts:431-436` | **Un `.torno` con claves de más en `settings` se acepta, y esas claves entran en el modelo del instrumento.** `isSettings` comprueba las cinco claves conocidas, pero `readTorno` devuelve el objeto tal como llega, y `#loaded()` lo extiende sobre `InstrumentSettings` (`{ ...state.settings, ...settings }`). **Comprobado** con un archivo válido al que se añade `"latency": null, "repeats": 999` en `settings`. Se carga («SESIÓN CARGADA») y EXPORTAR MEZCLA enseña VUELTAS 999, con las que la exportación fallaría por `RangeError`. Al entrar en ENTRADA → LATENCIA, la pantalla se queda congelada con 5 `TypeError: Cannot read properties of null (reading 'mode')` en la consola (`display.ts:176`; `instrument.ts:519` fallaría igual con `ms`). En el `source` de una capa de la biblioteca también pasan claves de más, y se guardan de vuelta. Contradice «se valida entero antes de devolver nada» (§4.8 y la mitigación de §8). | Que `checkHeader` devuelva un objeto nuevo solo con las claves validadas (también en `source`), y que `#loaded()` copie las cinco claves una a una. Añadir el caso a los tests del formato: las claves de más se descartan y no llegan al store. |
| 5 | Importante | `src/app/audio/engine/unlock.ts:33`, `:57` y `:64-67` | **Si el primer `resume()` de un gesto se queda pendiente, el desbloqueo no lo vuelve a intentar nunca.** `unlockAudio()` sale si hay un `resuming` en curso, y ese `resuming` solo se limpia cuando la promesa de `resume()` se resuelve o se rechaza. En WebKit, un `resume()` pedido fuera de un gesto que reconozca (o con la sesión de audio interrumpida) no se rechaza: queda pendiente hasta que el contexto arranca. Un toque da `pointerup` antes que `touchend` y `click`. Si iOS no tomara `pointerup` como gesto, el `touchend` y el `click` de ese toque, y todos los toques siguientes, saldrían por esa guarda, sin `resume()` ni búfer silencioso. El aviso «Toca el instrumento para activar el sonido» no se iría nunca. **Deducido** para iOS (aquí no hay iPhone) y **reproducido con una simulación** en Chromium: el contexto nace suspendido y un `resume()` pedido en `pointerup` queda pendiente. Resultado: solo hay dos llamadas, `new:pointerup` y `resume:pointerup`, y ninguna más tras otros dos toques y dos teclas. El contexto sigue `suspended` y el aviso no se va. Control: en la misma simulación, un `resume()` dentro de un `click` lo pone en `running`. Es el «reintento» que pide §0.1 («Arranque de audio robusto»), y iOS es el mayor riesgo del plan (§8). | En cada evento de desbloqueo, mientras el contexto no esté en `running`, llamar a `resume()` y reproducir el búfer silencioso sin guarda: las dos cosas se pueden repetir sin problema. Avisar a los oyentes cuando cambie el estado. Test e2e con esta simulación (contexto suspendido y `resume()` pendiente en `pointerup`): el `click` del mismo toque lo desbloquea. |
| 6 | Importante | `src/app/audio/worklet/processor.ts:38-51` (`copy-session` → `exportState()`) y `src/app/audio/core/loop-core.ts:252-268`; lo pide `src/app/audio/engine/engine.ts:713-737` tras cada edición | **La copia de la sesión se hace entera en el hilo de audio, y el autoguardado la pide tras cada edición, también mientras suena.** `exportState()` copia con `slice` el PCM de las cuatro capas dentro del manejador del puerto del worklet, que corre en el mismo hilo que `process()`: mientras copia, no se renderiza. **Medido en Node** en este PC (mediana de 7 copias): 0,95 ms con 4 capas de 2 compases (4,1 MB), 3,2 ms con 4 × 30 s (23 MB) y 6,9 ms (máximo 10,2 ms) con 4 × 60 s (46 MB). Un bloque dura 2,67 ms, y los búferes del sistema rondan los 3–10 ms en escritorio. **Deducido:** en un móvil de gama media la copia será varias veces más lenta. Con el autoguardado activado por defecto (D16), con capas largas, cualquier giro de un dial provoca 1,5 s después un hueco en el audio, y §5 pide 0 cortes en 5 min en el móvil. En Chromium sin interfaz no se puede medir, porque no hay dispositivo de salida. | Sacar la copia del manejador: hacerla por tramos dentro de `process()` (por ejemplo, 64 k muestras por bloque) sobre búferes que reserva el hilo principal y transfiere con la petición, y devolverla al terminar. Como el contenido confirmado no cambia (copia en escritura), la copia por tramos es coherente. Un banco que acote el tiempo máximo por bloque con 4 × 60 s. En la lista de pruebas de la fase 4, una de cortes con capas largas. |
| 7 | Menor | `src/app/features/html-instrument/control.directive.ts:42-50` | **El disco agarrado con el teclado se queda agarrado si el foco se va.** Solo lo suelta el `keyup` de Espacio o Intro sobre el propio disco: no hay `focusout` ni `blur`. **Comprobado:** con Espacio mantenido en el disco, Tab y soltar Espacio, el foco pasa al brazo, la pantalla sigue en «DISCO» y el disco dice «Congelado en el pulso 1,0 de 8». **Deducido:** pasa igual si la ventana pierde el foco (Alt+Tab) con Espacio pulsado. La pestaña oculta tampoco lo suelta: `#onHidden` cancela la toma y pausa, pero no manda `disc-release`. | Soltar el disco en el `focusout` del control y en el `blur` de la ventana, y que `#onHidden` mande `disc-release`. Test e2e. |
| 8 | Menor | `src/app/audio/engine/engine.ts:565-567`, `:607-615` y `:354`; `src/app/state/session.store.ts:234-244` | **Algunas operaciones del motor no hacen nada y no avisan.** `loadSession` sale si no hay contexto, pero `#loadTorno` devuelve los ajustes igual y la interfaz dice «SESIÓN CARGADA». **Comprobado** sin Web Audio (`AudioContext` quitado, como en el WebKit de Windows): cargar un `.torno` enseña «SESIÓN CARGADA» con la capa 1 vacía. **Deducido:** `record()` sale sin avisar si el motor está en `loading`. Si se pulsa reproducir y enseguida grabar, reproducir espera en la cola y grabar se pierde. Si `resampleSession` lanza una excepción, `openFile` del store termina en una promesa rechazada que nadie trata. | Que `loadSession` diga si ha cargado (o lance un `EngineError`) y que el store solo diga «cargada» entonces. En `record`, avisar o esperar a `ready`. En `openFile`, `try/catch` con aviso. |
| 9 | Menor | `src/app/audio/engine/engine.ts:451-462` | **Reposo durante la calibración: el error llega 10 s después.** `standby()` cancela la calibración en el núcleo, pero no rechaza la promesa de `#calibration`; `#onHidden` sí lo hace (`:486`). **Comprobado:** CALIBRAR y Reposo al momento; «No se han oído bien los clics…» aparece 10,1 s después, ya en reposo. | Rechazar `#calibration` en `standby()` y no enseñar el error cuando la calibración se ha cancelado a propósito. |
| 10 | Menor | `src/app/audio/engine/resample.ts:23-38` | **El remuestreo de una sesión de otra frecuencia es una interpolación lineal en Chromium.** `AudioBufferSourceNode` con un búfer de otra frecuencia interpola linealmente. **Medido** de 44,1 a 48 kHz con un tono de 15 kHz a −6 dBFS: el tono baja 3,4 dB y aparecen imágenes a 18,9 kHz (−15 dB) y a 11,1 kHz (−27,3 dB). Con `decodeAudioData` de un WAV float32 a 44,1 kHz en un `OfflineAudioContext` a 48 kHz (sigue siendo `OfflineAudioContext`, como pide §4.8), el tono queda a 0 dB y las imágenes a −87,8 y −105,4 dB. El e2e (441 Hz, cruces por cero y pico) no lo puede ver. La sesión remuestreada se queda así, también al guardarla. | Remuestrear con `decodeAudioData`, con las tres vueltas en un WAV float32, o con un remuestreador propio con filtro. Añadir al e2e un tono agudo con un límite para las imágenes (por ejemplo, < −60 dB). |
| 11 | Menor | `src/app/features/html-instrument/instrument-side.ts:51-66` | **El brazo y el volumen se tocan sobre una franja de 8 px.** El control es la ranura: 112 × 8 px el brazo y 8 × 88 px el volumen, porque el margen no recibe el puntero. Con el tirador, 28 px. Los demás controles miden de 64 a 224 px. **Medido** con Playwright a 412 × 915 y a 1440 × 900. Hasta la fase 6, este es el instrumento en el móvil, y §4.7 pide zonas de ≥ 44 px (allí, para la capa del 3D, con test). | Zona de toque de ≥ 44 px en el grosor, con un relleno transparente en lugar del margen o con un pseudoelemento, y un test de tamaños como el previsto para la fase 6. |
| 12 | Menor | `src/app/instrument/display.ts:104-120` (`model`), con `src/app/instrument/control-value.ts:37-45` y `src/app/state/session.store.ts:598-604` | **La región viva repite lo que ya dice el dial y lee símbolos.** Al recorrer el menú, el dial principal cambia su `aria-valuetext` («Menú: bucle»), y 0,7 s después la región viva lee «Menú. Bucle: ›. Toma libre.». **Comprobado** en el navegador. **Deducido:** un lector de pantalla lo dirá dos veces, y la segunda con «›» como símbolo. | No anunciar en la región viva lo que ya cuenta el control enfocado (al recorrer el menú) y quitar los glifos (`›`, `•`) del resumen. |
| 13 | Menor | `session.store.ts:185-193` (`stageTapped`), `src/app/audio/engine/microphone.ts:57` (`isOpen`), `engine.ts:173-183` (`status`, `sampleRate` y `mic`), `src/app/instrument/instrument.content.ts:103-105` (`hintList`, `hintEdit` y `hintConfirm`) y `src/app/features/html-instrument/html-instrument.content.ts:17` (`layerState`) | **Código muerto.** Ninguno se usa en `src/` (comprobado con búsquedas). `stageTapped` es, además, lo único que usa `isAudioUnlocked` en el store. | Borrarlos, o usarlos si estaban pensados para algo (los `hint*`, en la pantalla del menú). |
| 14 | Menor | `e2e/webkit.spec.ts`, `.github/workflows/ci.yml:40` | **Reproducir y pausar en WebKit (tarea 10) no se ha visto funcionar.** En Windows, WebKit no tiene Web Audio, y la prueba solo comprueba el menú y el aviso. La parte con audio corre en el CI de Linux, que no se ha ejecutado porque la rama no tiene PR. Al fusionar, el primer CI de `main` será el primero con WebKit y audio. | Tras el push de `main`, mirar ese CI antes de empezar la fase 3 y apuntar el resultado en el informe. Si falla, arreglarlo, o dejar la prueba marcada como pendiente con su motivo. |
| 15 | Menor | historial de la rama | **Varias piezas llegan sin su test en el mismo commit**, a pesar de lo acordado en la revisión de la fase 1 (#12). `AudioEngine` (`4c3ea41`, 938 líneas), `SessionStore` (`2dded89`, 690) y el instrumento HTML (`96184c4`, 1292) se prueban en commits posteriores (`37aeca3`, `56c4cf1` y `43a07dc`). | No hace falta reescribir el historial. En la fase 3, un commit por pieza con su test. |
| 16 | Sugerencia | `src/app/instrument/gestures.ts:80-86`, `src/app/instrument/constants.ts:25` | **Una pulsación que se mueve más de 6 px no pulsa la tecla.** **Comprobado:** con el ratón sobre «Reproducir» y 8 px de arrastre, no reproduce (el `click` se ignora durante 600 ms). En las teclas no hay ningún giro que proteger, y con el dedo 6 px es poco. | En los controles sin `turn`, no cancelar la pulsación por moverse, o usar un umbral de 10–16 px o cancelar solo si el puntero sale del control. |
| 17 | Sugerencia | `src/app/features/html-instrument/instrument-notices.ts:28-33` y `:90-92` | Las regiones vivas de los avisos (`role="status"` y `role="alert"`) se ocultan con `display: none` mientras están vacías (`.notice:empty`). **Deducido, sin probar con un lector:** una región que no está en el árbol de accesibilidad puede no anunciar su primer cambio. | Mantenerlas en el árbol mientras están vacías: ocultas visualmente o sin altura. |
| 18 | Sugerencia | `src/app/features/html-instrument/html-instrument.ts:137` | `matchMedia('(prefers-reduced-motion: reduce)')` se crea en cada fotograma mientras suena. | Guardar el `MediaQueryList` una vez (y escuchar su `change`). |
| 19 | Sugerencia | `docs/informes/img/fase-2/` | Faltan capturas de los estados de los avisos: cargando, error con «Reintentar», panel de recuperar y chuleta de atajos. La lista de la revisión pide los estados de carga y de error, e Iván aún no los ha visto. | Añadirlas a `scripts/capture.mjs`. |
| 20 | Sugerencia | `docs/DISENO.md` §7.1, `src/app/features/html-instrument/html-instrument.css:6-13` | La maqueta 2D pone el dial principal y el brazo arriba a la derecha, que es parte de la distribución del original según la fase 5.a del plan. Es provisional, pero seguirá siendo la alternativa sin WebGL. | En la fase 5.a, alinearla con la distribución aprobada del aparato. |
| 21 | Sugerencia | `src/app/state/session.store.ts:431-440` y `:449-452` | **Dos huecos del autoguardado.** Cargar un `.torno` no autoguarda: si se recarga justo después, se ofrece la sesión de antes de cargar. Y mientras el panel de recuperar sigue sin respuesta, no se autoguarda nada: una sesión larga tocada sin contestar al panel se pierde si se cierra la pestaña (es la decisión del §5 del informe, pero tiene ese coste). | Autoguardar tras cargar. Para lo segundo, valorar un segundo hueco en IndexedDB o que la primera edición descarte el panel tras preguntar; lo decide Iván (D16). |

## Qué se ha comprobado

No hay Bloqueantes, y los ocho criterios de aceptación se cumplen con evidencias reales que he reproducido. Lo que sale son fallos en caminos que los tests no recorren: recuperar con el motor a medio arrancar (#1), Espacio fuera de los controles (#2), el ruido del disco para los lectores (#3), ajustes de más en un `.torno` (#4), un desbloqueo que no reintenta (#5) y la copia de la sesión en el hilo de audio (#6). Con los seis Importantes corregidos y con sus tests, y con los Menores rápidos (#7, #8, #9, #12, #13 y #14), la fase se puede fusionar sin otra ronda de revisión.

**Lectura.**
- `CLAUDE.md`.
- `docs/PLAN.md`: §0–§5, §7 y la fase 2, con §4.3–§4.9.
- `docs/revisiones/README.md`, el informe de la fase 2, la revisión de la fase 1, `docs/AUDIO.md`, `docs/DISENO.md` §7.1 y `docs/PENDIENTES.md`.
- `git diff main...fase-2-motor-navegador` entero: 104 archivos, +9855/−992. He leído todo el código nuevo: `audio/engine/` completo, `audio/worklet/processor.ts`, `audio/files/` (formato, WAV, ZIP y exportación), `audio/core/calibration.ts` y los cambios de `loop-core.ts`, `offline.ts` y `protocol.ts`, los workers, `instrument/` completo, `state/`, `features/html-instrument/`, `pages/home/` y `main.ts`.
- Los e2e y sus utilidades, y los tests nuevos de Node y de Angular.

**`npm run check`: código 0, en 60 s.**
- Lint: typecheck de los 4 tsconfig, `ng lint` sin errores y Prettier sin cambios.
- `test:node`: 27 archivos y 393 tests. Cobertura del TS puro: 98,18 % de sentencias, 94,49 % de ramas, 100 % de funciones y 99,35 % de líneas.
- Banco en verde. `ng test`: 8 archivos y 36 tests.
- Build: inicial de 297,12 kB y 3 rutas prerenderizadas, sin avisos de presupuesto.
- `check-bundles`: idéntico al informe. 301,3 kB en `/`, desbloqueo de 1,7 kB, motor de 19,9 kB, worker de síntesis de 2,5 kB, worker de exportación de 38,8 kB, worklet de 36,5 kB y fuentes de 144,1 kB. El bundle inicial no lleva motor, síntesis, worklet ni 3D.

**`npm run e2e`: 62 de 62 en 45 s**, con los puertos 4317 y 4318 libres.
- dev, 25; estático, 36; WebKit, 1.
- Primer sonido tras pulsar: 16, 8, 14, 14 y 10 ms (dev) y 14, 7, 12, 8 y 14 ms (estático).
- Pico de la salida con el sonido de prueba: −9,0 y −10,6 dBFS.

**Capturas.** He mirado las 10 de `docs/informes/img/fase-2/`.
- Coherentes con «Barro»: cuerpo de barro oscuro (`--instrument-plate`), latón, teclas crema y pantalla de fósforo.
- Legibles y sin cortes. En el móvil, el instrumento se apila sin desbordarse, y el menú BUCLE marca bien la fila elegida.
- La paleta y la tipografía no recuerdan al original. La distribución, en parte (#20).
- Faltan los estados de los avisos (#19).

**Pruebas propias.** Están en `C:\Users\ivan\AppData\Local\Temp\claude\C--Users-ivan-Ivan-Chesa-AI-torno\revision-fase-2\`, junto con los registros de `check` y `e2e`.
- Las que necesitaban el repo para ejecutarse se copiaron a `e2e/tmp-revision/` o junto a su módulo, y ya están borradas.
- Las de Playwright usan una configuración propia (`pw.config.mjs`) que sirve el build estático en el puerto 4320.

Resultados:
- **Navegador (Chromium):**
  - #1: «Recuperar» con el módulo retrasado 2,5 s y en reposo. En los dos casos la pantalla sigue en «CAPA 1 · VACÍA» y, en otra página, ya no se ofrece recuperar.
  - #2: Espacio en «Recuperar» y en «Cerrar».
  - #3: 23 cambios de `aria-valuetext` del disco en 3 s.
  - #4: un `.torno` con `"latency": null, "repeats": 999` da VUELTAS 999 y 5 `TypeError`.
  - #5: la simulación de WebKit, con su control.
  - #7: disco, Tab y soltar fuera.
  - #8: sin Web Audio, «SESIÓN CARGADA» con la capa vacía.
  - #9: el error llega 10.127 ms después del reposo.
  - #10: remuestreo con `AudioBufferSourceNode` frente a `decodeAudioData`.
  - #11: tamaños de los 12 controles en el móvil y en el escritorio.
  - #12: `aria-valuetext` y región viva al recorrer el menú.
  - #16: pulsar con 8 px de movimiento.
- **Node:**
  - Coste de `exportState` y de `load-session` (#6). La carga, en cambio, no bloquea: 0,09–0,13 ms, porque usa el PCM transferido sin copiarlo.
  - **Fuzz propio del `.torno`**, distinto de los 1000 del test, que usan 20 familias de defectos: 20.000 mutaciones al azar de bytes de la cabecera y del PCM, y cortes. Ninguna lanza una excepción. De ellas, 3.669 se aceptan (mutaciones que dejan un archivo válido), y todas pasan `validateSessionState` con muestras y dan un render finito. El test se pasó del tiempo límite de 30 s de Vitest, pero el bucle terminó y escribió su resumen, así que no falló ninguna comprobación.
  - **Cabeceras retorcidas:**
    - `__proto__` en la raíz y en `settings` se acepta sin efecto en el prototipo (aunque deja pasar claves de más, #4).
    - `bpm` de `1e400` → `bpm`, y `offsetBeats` de `1e308` → `length`.
    - `offsetBeats` de 999.999.999 se acepta y suena bien, sin perder precisión.
    - 20.000 niveles de anidamiento → `header`, sin desbordar la pila.

**Criterios de aceptación de la fase.**
- *Salida no silenciosa:* sí. −9 a −10,6 dBFS con el sonido de prueba, y 0 antes de reproducir y tras pausar.
- *Toma alineada ±2 ms tras compensar:* sí, con la desviación 1.
  - El contenido se comprueba con el micrófono sintético de Chromium: ataques cada 500 ms ±2 ms.
  - La alineación, con un retorno determinista (un `DelayNode` de 20 ms en lugar del nodo del micrófono): −2 muestras en los cuatro pulsos.
  - Me parece razonable: con un archivo no se sabe cuándo «suena» cada ataque. La prueba valida la cadena calibración → compensación del núcleo, pero no el camino real `MediaStreamAudioSourceNode`.
  - El riesgo de que su latencia cambie en cada apertura (12–21 ms medidos por el implementador) está bien señalado: §10, propuesta 1, y `PENDIENTES.md`.
- *Pista `ended` tras terminar, cancelar, reposo y pestaña oculta:* sí. La pestaña oculta se simula con `visibilitychange`, porque Playwright no puede ocultarla de verdad.
- *Worklet retrasado 1,5 s:* sí. Las llamadas son `new:pointerup` y `resume:pointerup`, el contexto está en `running` antes de 1 s, con control negativo (`new:ninguno`), y suena al cargar.
- *Toque antes de la hidratación:* sí, en sus dos variantes (con el chunk de la portada retenido y con `main` retenido).
- *`.torno`:*
  - Ida y vuelta idéntica byte a byte, en Node y en el e2e.
  - Remuestreo correcto en duración y tono, pero con pérdida de agudos (#10).
  - 1000 malformados rechazados, y además mi fuzz.
  - El hueco de las claves de más (#4) queda fuera de esos casos.
- *WAV:* sí. La mezcla coincide con `renderOffline` (≤ 1 LSB), `decodeAudioData` la lee, y cada pista es su capa sola.
- *Autoguardado:* sí en el camino normal, con el resultado idéntico byte a byte. #1 enseña el camino en el que se pierde.
- *Instrumento HTML con teclado y axe:* sí. Los 12 controles en orden de tabulación, axe con 0 violaciones (también `best-practice`) y capturas. Fuera de lo que mira axe: #2, #3, #7 y #11.
- *Privacidad:* sí. Ninguna petición `http(s)` al grabar, guardar y exportar, y 0 cookies.

**Revisado a mano y correcto.**
- **Desbloqueo:** escucha nativa en captura registrada antes de `bootstrapApplication`; contexto creado y reanudado sin `await` previo; búfer de una muestra. Sigue escuchando, salvo en reposo. Ocupa 1,7 kB en el inicial.
- **Motor:**
  - Nunca crea el contexto. Carga el módulo con 5 s de espera y «Reintentar» (la carga fallida se olvida y se repite).
  - Los comandos de antes del nodo esperan en una cola.
  - `statechange` lleva a `interrupted` o a `needs-gesture`.
  - El reposo suspende el contexto tras el fundido, y `wake()` lo reanuda dentro del gesto.
  - Devuelve códigos de error, y los textos están en `session.content.ts`, con `reviewed: false`.
- **Micrófono:**
  - Restricciones sin procesar, con respaldo.
  - Petición pendiente anulada por número de petición, y `track.stop()` en todos los cierres.
  - `play-and-record` mientras graba, y `playback` al soltar.
  - Se suelta también cuando el núcleo rechaza `record`.
- **Latencia:**
  - Automática (`baseLatency + outputLatency` + la de la pista), calibrada (mediana con 6 de 8 coincidentes, ±1 ms) y manual.
  - `localStorage` con `try/catch`.
  - El núcleo suma la anticipación del limitador. En `#renderCalibration`, los clics caen en su muestra exacta y no se reserva nada.
- **Worklet:**
  - Estado con el mismo objeto como mucho 30 veces por segundo (test).
  - Copia de la sesión y calibración transferidas.
  - `process()` sin reservas.
- **Exportación:**
  - `OfflineRenderer` por tramos de 16.384 muestras directamente en el WAV.
  - Fundido de coseno alzado.
  - 24 bits con redondeo y recorte de ±1 y de `NaN`.
  - ZIP *stored* con CRC.
  - El worker se crea al arrancar el motor (desviación 3).
- **Autoguardado:**
  - IndexedDB en una sola transacción, con la fecha en su clave.
  - Cuota avisada y todo con `try/catch`.
  - No se autoguarda durante una toma, y una sesión vacía borra el autoguardado.
- **Modelo:**
  - Reductor puro.
  - Bloqueos durante una toma (selección, tempo, reverso, disco, deshacer y archivos), con niveles, silencio, filtro y volumen libres.
  - Confirmaciones con «Cancelar» primero, y recorrer el menú nunca cambia el audio.
  - Tiene tests de Node completos.
- **`SessionStore`:**
  - Signals a 10 por segundo como mucho, y `#syncControls` con 400 ms de gracia.
  - Medidores y disco fuera de los signals, con `requestAnimationFrame` solo con el transporte en marcha o el disco agarrado.
  - Con movimiento reducido, cada 250 ms y sin girar el disco.
- **Angular:**
  - `@defer` con esqueleto del mismo tamaño y `afterNextRender`.
  - `effect()` solo para el bucle de `requestAnimationFrame`.
  - `DestroyRef` cancela el bucle y el selector de archivos.
  - Sin `CommonModule`, `ngClass` ni decoradores de host.
- **Higiene:**
  - Capas de §4.2 respetadas: el lint lo vigila y `instrument-sync.spec.ts` comprueba que los límites duplicados no se separan.
  - Sin `console`, `TODO`, `any` ni `eslint-disable` en el código nuevo.
  - Sin dependencias nuevas.
  - Commits en español con prefijos válidos.

**Desviaciones (§4) y decisiones (§5).**
- **Las siete desviaciones son razonables y están bien explicadas.** Dos llevan una nota:
  - La de WebKit (2) deja sin demostrar reproducir y pausar con audio (#14).
  - La del worker de exportación al arrancar (3) descarga 38,8 kB aunque nunca se exporte. Una alternativa sería crearlo al abrir el menú SESIÓN.
- **Decisiones razonables:**
  - las intenciones;
  - que el motor nunca cree el contexto;
  - el micrófono por toma;
  - la calibración con 8 clics y mediana;
  - la cabecera en ASCII;
  - las pistas a la izquierda y en un ZIP;
  - el selector de archivos abierto en el gesto.
- **Decisiones con reparos:**
  - «no autoguardar con una sesión sin recuperar», que junto con #1 lleva a perderla y además tiene el coste de #21;
  - «el `click` tras un gesto se ignora 600 ms», que lleva a #16;
  - «el resumen en voz con antirrebote», que lleva a #12;
  - «medidores y disco fuera de los signals», porque los atributos ARIA del disco sí siguen la posición (#3).
- **Las tres propuestas del §10 son razonables.** La 1 la debería decidir Iván con las medidas de la fase 4.

**Lo que no he podido comprobar.**
- iOS y Safari reales (#5 es deducción más simulación).
- Un micrófono real.
- WebKit con audio: en Windows no tiene Web Audio.
- Lectores de pantalla: #3, #12 y #17 deducen su comportamiento.
- Cortes de audio en un dispositivo: #6 se apoya en cifras de Node.

**Estado del repo.** Solo he añadido este archivo. Las pruebas temporales están borradas. Solo se han regenerado o borrado carpetas que git ignora: `dist/`, `public/audio/`, `src/app/audio/engine/worklet-url.generated.ts`, `e2e/.generated/` y `test-results/`.
