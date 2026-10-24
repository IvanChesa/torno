# Núcleo de audio (`LoopCore`)

Documento técnico del núcleo de audio (`src/app/audio/core/`, fase 1). Recoge cómo funciona y las cifras **medidas**. La especificación es `docs/PLAN.md` §4.3–§4.4; esto la concreta.

## 1. Un solo reloj
- **El transporte** es un contador entero de muestras. El pulso se calcula por tramos de tempo constante: `pulso(f) = pulsoInicial + (f − muestraInicial) × bpm / 60 / fs`. Cambiar de tempo, reposicionar o parar abren un tramo nuevo; nada se acumula.
- **Las voces** (una cabeza de lectura por capa, más las que se están apagando) avanzan muestra a muestra. Cada 128 muestras del transporte recalculan su posición exacta desde el pulso: deriva 0.
- **Los instantes programados** se guardan en muestras enteras y se recalculan si cambia el tempo: el siguiente límite de compás de la cola, el inicio de una toma y el próximo clic.
- **El proceso va por tramos** de ≤ 128 muestras, partidos justo en esos instantes. Por eso el resultado no depende del tamaño del bloque: en bloques de 1, de 77, de 128 o de una vez salen los mismos bytes, también grabando (test). La exportación suena igual que el directo.

## 2. Qué hace cada pieza
| Pieza | Cómo |
|---|---|
| Lectura | Hermite de 4 puntos y 3.er orden (forma «x»), con vuelta al inicio. *Varispeed*: la velocidad es `pulsos/muestra × muestras/pulso` de la capa. |
| Reverso | Se lee el espejo exacto de la posición: `N − 1 − p`. |
| Cambios de contenido | Sonido en cola, reverso, toma, deshacer, rehacer, agarrar y soltar el disco: siempre un fundido cruzado entre voces (hasta 8 por capa). Una voz que ya se está apagando sigue con su fundido, así que con un cambio en cada bloque de 128 muestras no suenan más de 6 a la vez. Si llegan más cambios en el mismo bloque, se reutiliza la voz más baja, que es una que aún no ha sonado: el corte no se oye. |
| Mezcla | Nivel, silencio y panorama de igual potencia, con suavizado de un polo de 10 ms; la llegada al objetivo se decide muestra a muestra. |
| Filtro | SVF con integradores trapezoidales (Simper), paso bajo de Butterworth: −3,01 dB en el corte. El brazo va de 18 kHz a 150 Hz en escala exponencial y el corte se recalcula cada 32 muestras. En el extremo exterior, *bypass* transparente al bit, con fundido de entrada y salida. |
| Limitador | Estéreo, con 1 ms de anticipación: mínimo deslizante de la ganancia necesaria, recuperación de 80 ms y media móvil. Garantiza el techo de −0,3 dBFS; por debajo del codo (−0,48 dBFS) es transparente al bit. Encima, saturación suave de seguridad. |
| Metrónomo | Clics sintetizados una vez en tablas, en la muestra exacta del pulso; solo en directo (nunca se graban ni se exportan). Se suman **después** del limitador, con su saturación de seguridad y la misma latencia que la música: un clic no hace «bombear» la mezcla. |
| Cola | En marcha, un cambio de sonido entra en la muestra exacta del siguiente límite de compás, con la fase común. En pausa, al momento. Pausar aplica la cola y deshacer la cancela. |
| Disco | Mantener congela la cabeza de la capa; arrastrar la mueve (1 vuelta = 1 compás, hasta ±10⁶ vueltas) con un suavizado de 10 ms; soltar vuelve a la línea de tiempo con un fundido de 15 ms. Con el transporte parado, el disco también suena. La voz del disco pasa por un filtro de continua de 10 Hz: un disco quieto no suena (la cabeza congelada daría una continua que haría trabajar al limitador). El reposo, cargar y la sesión nueva sueltan el disco y esperan a que su voz calle. |
| Deshacer | 3 estados por capa más el actual. El PCM confirmado no cambia nunca: moverse por el historial no copia nada. |

### Fundidos y criterio de clics
El salto máximo entre muestras de un fundido de coseno alzado de N muestras, para un cambio de amplitud Δ, es π/2 · Δ / N. A 48 kHz:

| Fundido | Duración | Muestras | Salto máximo con Δ = 1 |
|---|---|---|---|
| Cambio de contenido | 10 ms | 480 | 0,0033 |
| Reproducir, pausar y parar | 10 ms | 480 | 0,0033 |
| Soltar el disco | 15 ms | 720 | 0,0022 |
| Junta de una toma | 10 ms | 480 | 0,0033 (0,0065 con Δ = 2, polaridad opuesta a fondo de escala) |

Todos quedan por debajo del margen de 0,01 que da el criterio de §5 («salto ≤ el de la propia señal + 0,01»). Las tablas se muestrean en el centro de cada muestra: el cambio empieza en su muestra exacta y la última muestra del fundido ya es el valor final.

## 3. Grabación
- **Alineación.** La entrada que llega en la muestra `f` se oyó y se tocó en `f − latencia` de la línea de tiempo. Esa latencia es la de ida y vuelta (la que se le indique al núcleo) más la anticipación del limitador. La muestra `k` de la toma es la entrada que llega `latencia` muestras después de que el transporte pase por `inicio + k`.
- **Dónde se escribe.** Donde la cabeza de lectura de la capa hará sonar esa muestra, también en reverso: «lo que oíste más lo que tocaste».
  - Si la capa va a otro tempo que su tempo nativo (sobregrabar algo grabado a otra velocidad), la entrada se remuestrea en flujo con Hermite.
  - Si hay que comprimir, va antes por un antialias de 4 polos. El retraso del antialias se compensa al escribir.
- **Junta.** La toma entra con un fundido de 10 ms. Al cerrarse, se graban 10 ms más, que se funden hacia fuera:
  - si la toma da la vuelta completa al bucle, ese final se cruza con el principio, y la junta no hace clic aunque la señal no sea periódica;
  - si se cierra antes, el sonido se apaga sin cortarse.
- **Duración del bucle de la sesión:** la de la capa más larga con contenido (o en cola).
  - **Primera toma libre** (sesión vacía): se cierra al pulsar o a los 60 s y fija esa duración. Con la opción activa, el tempo se ajusta a un número entero de compases dentro de 40–240, y la toma empieza en el pulso 0. Una toma de menos de 0,25 s se descarta.
  - **Toma libre con otras capas:** sigue la duración del bucle. Empieza al momento, se escribe alineada con la línea de tiempo y se cierra sola al completar la vuelta (o antes, al pulsar).
  - **Toma fija** de 1, 2 o 4 compases: empieza en el siguiente límite de compás, o tras una cuenta previa de al menos 4 pulsos que acaba en un límite de compás. Si se cierra antes, el resto queda en silencio.
  - **Cuenta previa con el transporte parado:** si estaba en pausa a mitad de compás, el transporte se coloca antes en el compás siguiente. Los 4 clics siguen el ritmo de la toma, que empieza un pulso después del último, y las capas vuelven a sonar en ese compás.
- **Sobregrabar** suma la toma a una copia de la capa. Si la toma es más larga, la capa crece hasta la duración de la toma con **lo que sonó durante la toma**: la capa leída desde su cabeza en el pulso en que empieza (también en reverso). Así la vuelta siguiente repite lo que se oyó, aunque la duración de la capa no divida la de la toma. Una capa de la biblioteca pasa a «grabación propia», y su sonido sigue en el deshacer.
- **Sonido en cola y toma en la misma capa.** Si la cola entra (en su compás) antes de que empiece la toma, sigue en cola y la toma se graba sobre ese sonido. Si la toma empieza antes (una toma libre empieza al momento), el sonido entra al empezar la toma.
- **Una toma en una capa vacía** suena tal como se ha tocado: la capa pierde el reverso.

## 4. Memoria
El núcleo cuenta los bytes de los búferes de PCM vivos sin contar dos veces el mismo: estados de deshacer y rehacer, cambios en cola y la toma en curso, más una parte fija (≈ 50 kB a 48 kHz). Si una edición no cabe en el presupuesto de §5 (220 MB), se olvida el deshacer más antiguo de la capa con más estados. Si ni así cabe, la toma se rechaza.

**Peor caso:** 4 capas de 60 s, cada una con el estado actual y 3 de deshacer, más una toma de 60 s en curso.

| Frecuencia | Una capa de 60 s | Historial (4 × 4) | Toma | **Total** | ¿Cabe en 220 MB? |
|---|---|---|---|---|---|
| 44,1 kHz | 10,58 MB | 169,34 MB | 10,58 MB | **179,93 MB** | Sí |
| 48 kHz | 11,52 MB | 184,32 MB | 11,52 MB | **195,84 MB** | Sí |
| 96 kHz | 23,04 MB | 368,64 MB | 23,04 MB | 391,68 MB | No: el presupuesto deja unos 4 estados de deshacer en total |

**Sesión típica** (4 capas de 2 compases a 90 BPM y 48 kHz): 1,02 MB por estado. Con el historial lleno, 16,4 MB, dentro de los 64 MB de §5.

**Nota.** La primera toma libre reserva sus 60 s al empezar (en el manejador del comando, no en el hilo de audio) y conserva esa capacidad mientras siga en el historial. El peor caso ya la cuenta.

**Cargar una sesión** (o empezar de cero). El deshacer y el rehacer de todas las capas se sueltan al recibir el comando. Si la salida estaba sonando, la sesión que llega espera al fundido y se cuenta en la memoria. El pico es el estado actual más la sesión nueva: con 8 capas de 60 s, 92,16 MB a 48 kHz, por debajo del peor caso (una carga no puede coincidir con una toma: está bloqueada). La copia que hace el hilo principal para leer el archivo es memoria suya, no del núcleo.

**Copias de la sesión** (guardar, autoguardar y exportar). El worklet reserva la copia al pedirla, en el manejador del mensaje; la llena por tramos en `process()` y la transfiere al hilo principal al terminar (§7). Es memoria transitoria y no cuenta en el presupuesto del núcleo: si contara, guardar con 4 capas de 60 s y el historial lleno a 48 kHz olvidaría un deshacer. Ocupa lo que el estado actual de la sesión (46,08 MB en el peor caso a 48 kHz) durante menos de un segundo. Durante una toma no se puede guardar ni exportar y el autoguardado espera, pero una copia empezada justo antes de grabar coincide con la reserva de la toma: el pico transitorio sería 195,84 + 46,08 = 241,92 MB, por encima de los 220 MB de §5 durante menos de un segundo. Queda como propuesta en el informe de la fase 2.

## 5. El hilo de audio no reserva memoria
- **Por convención y con lint.** En `audio/core/` y `audio/worklet/`, ningún método puede usar lo siguiente (todos pueden acabar llamados desde `process()`); solo se libran los constructores, los métodos del manejador que preparan memoria (`handle`, `snapshot`, `planTake`, `load`, `setSound`, `emptySession`), el calentamiento de la copia de la sesión al crear el worklet (`warmUp`) y, entre las funciones sueltas, las que no son `process*` ni `render*`:
  - `new`, literales de objeto o de array, cierres, plantillas ni `...`;
  - métodos que copian (`slice`, `subarray`…);
  - `throw`, `await` ni `console`.
  
  Lo que reserva (los búferes de una toma, los contenidos de una sesión cargada) se hace en `handle()`. Los avisos van en objetos ya reservados.
- **En ejecución.** El perfil de muestreo del heap de V8 registra 0 bytes reservados bajo `LoopCore.process` y `SessionCopy.pump` en un minuto simulado con todo en marcha: 4 capas con filtro y *varispeed*, metrónomo, una sobregrabación que se confirma, un cambio en cola que entra en un compás, el disco moviéndose a saltos y una copia de la sesión por tramos. Es la cifra del **régimen permanente**. En los caminos raros (primera toma con ajuste de tempo, cola aplicada al pausar, carga sonando, parar, cierre a los 60 s, toma demasiado corta, reposo) el perfil da unos KiB por pasada, por números empaquetados en `#commitTake` o tras alguna desoptimización: irrelevante para el audio.
  - En V8, un número con decimales que cruza una llamada no integrada se empaqueta en el heap. Por eso los valores por tramo (pulso, objetivo del disco, ganancias) se pasan en campos y no en argumentos.

## 6. Cifras medidas (fase 1)
| Medida | Valor | Cómo |
|---|---|---|
| Rendimiento | 230–243× tiempo real (3 ejecuciones) | 4 capas con *varispeed*, filtro, panorama y limitador; 60 s a 48 kHz en bloques de 128; Node 24 en el PC de Iván (`npm run test:bench`) |
| Memoria reservada por `process()` | 0 KiB en 60 s simulados (régimen permanente); unos KiB en los cambios raros | Perfil de muestreo del heap de V8 (`loop-core.memory.spec.ts`) |
| Deriva | 0 (±1 muestra tras 10 min a 97 BPM y 44,1 kHz) | `loop-core.playback.spec.ts` |
| Cola exacta | En la muestra `ceil(compás × 60 × fs / bpm)` | 48 kHz/90 BPM y 44,1 kHz/97 BPM |
| *Varispeed* | Al doble de tempo, el bucle dura la mitad ±1 muestra | 3 combinaciones de frecuencia y tempo |
| Filtro | −3 dB exactamente en el corte (error < 0,01 % entre 150 Hz y 15 kHz; el criterio es ±10 %) | Bisección de la respuesta en régimen permanente, a 44,1 y 48 kHz |
| Limitador | Pico de −0,34 dBFS con 4 capas a tope en fase (techo −0,3) | `limiter.spec.ts` y `loop-core.playback.spec.ts` |
| Tamaño | `LoopCore` minificado: 32,7 kB (presupuesto del worklet: 40 kB) | esbuild con `--minify`, como el worklet |

## 7. En el navegador (fase 2)

El núcleo corre en el AudioWorklet; alrededor, el motor del hilo principal (`audio/engine/`), que es el único que toca el `AudioContext`, el micrófono y los archivos.

### Arranque
- **Desbloqueo** (`unlock.ts`, en el bundle inicial: 1,8 kB). Una escucha nativa en fase de captura sobre el documento, registrada en `main.ts` antes de arrancar Angular. Con cada `click`, `pointerup`, `touchend` o `keydown` sobre `[data-audio-unlock]` (el instrumento y «Tocar») mientras el contexto no suena, y antes de cualquier `await`: `navigator.audioSession.type`, crear o reanudar el contexto y un búfer silencioso de una muestra. Repetirlo en cada evento del toque cubre los navegadores que no toman alguno como gesto (iOS con `pointerup`, por ejemplo): el audio cuenta como desbloqueado cuando el contexto suena de verdad, no al pedirlo. Sigue escuchando para reanudar tras una interrupción, salvo en reposo.
- **Motor** (`engine.ts`, 20,1 kB, con `import()`). Nunca crea el contexto: adopta el del desbloqueo. Carga el módulo con 5 s de espera («Reintentar» si no llega) y conecta el nodo: entrada mono (el micrófono, solo mientras graba o calibra) y salida estéreo. Los comandos de antes de que exista el nodo esperan en una cola.
- **Estados:** `idle`, `loading`, `ready`, `needs-gesture` («Toca el instrumento para activar el sonido»), `interrupted` («Toca para reanudar»), `standby` y `error` (con su código; los textos los pone la interfaz).
- **Un toque antes de la hidratación.** Si el JS principal ya estaba, el desbloqueo actúa en el gesto real. Si el toque llegó antes que el JS, Angular lo repite tras hidratar, ya fuera del gesto: el motor no crea un contexto sin gesto y la interfaz pide otro toque.

### Worklet
`processor.ts` (37,7 kB con el núcleo; presupuesto, 40 kB) valida cada mensaje, pasa la entrada y la salida a `LoopCore` y envía el estado como mucho 30 veces por segundo (el mismo objeto). La grabación de la calibración sale con su PCM transferido.

**Copia de la sesión por tramos** (`audio/core/session-copy.ts`). Guardar, autoguardar y exportar piden una copia de lo que suena. Hecha de golpe en el manejador del mensaje, paraba el hilo de audio entre 7 y 10 ms con 4 capas de 60 s a 48 kHz (en Node; más de tres bloques de 128 muestras, que duran 2,67 ms). Ahora el manejador toma la instantánea del núcleo (`LoopCore.snapshot()`: el contenido de cada capa, que no cambia nunca, y la mezcla de ese momento) y reserva los búferes; después, cada `process()` copia un tramo de hasta 32.768 muestras (256 por muestra del bloque) y, al terminar, la sesión sale con su PCM transferido. Las copias pedidas se hacen de una en una y en orden.
- Los tramos empiezan en 1024 muestras y crecen de 1024 en 1024, y el bucle de copia se calienta al crear el worklet: sin eso, en V8 los primeros tramos completos tardaban 1–2 ms, antes de que el JIT optimizara el bucle.
- El resultado es idéntico byte a byte a la copia de golpe en el momento de pedirla, aunque la sesión cambie mientras tanto (`session-copy.spec.ts`).
- La copia vive en el worklet y no en el núcleo: así no pesa en el worker de exportación, que también lleva `LoopCore`.

### Micrófono y latencia
- **Micrófono:** `getUserMedia` mono y sin procesar (sin cancelación de eco, supresión de ruido ni control de ganancia automáticos; si el navegador no acepta las restricciones, se pide sin ellas), solo al grabar o calibrar, con `play-and-record` en la sesión de audio. Se suelta al terminar o cancelar la toma, en reposo y con la pestaña oculta (que además cancela la toma y pausa). Si se cancela con la petición pendiente, la pista se para en cuanto llega.
- **Latencia automática:** `baseLatency + outputLatency` del contexto y la latencia de entrada de la pista.
- **Calibración:** con el transporte parado, el núcleo hace sonar 8 clics cada 0,5 s (después del volumen: suenan aunque la rueda esté a cero) y graba la entrada sin tocar. El hilo principal fecha cada ataque donde llega al 30 % del pico de su ventana, igual que el clic de referencia, y da la mediana si al menos 6 de los 8 coinciden (±1 ms). En los tests en Node la mide sin error con 0, 1, 480, 7000 y 23.000 muestras, con ruido (±1 muestra) y con dos clics perdidos. La latencia máxima medible es el intervalo entre clics (0,5 s).
- **Ajuste manual** de 0 a 500 ms. El modo y el valor se guardan en `localStorage`.
- **Medido en Chromium:** con un micrófono de retorno determinista (la salida retrasada 20 ms con un `DelayNode`), la toma queda alineada con los pulsos a 2 muestras (0,04 ms). **Riesgo:** con un retorno por `MediaStream` (como un micrófono de verdad), la latencia cambia en cada apertura de la pista: 20,7, 20,7, 21,3 y 12,0 ms en cuatro calibraciones seguidas. Como el micrófono se suelta tras cada toma, una toma puede quedar desplazada unos 9 ms respecto a la calibración. Se medirá en móviles reales (fase 4; §5 pide ±5 ms) y hay dos salidas propuestas en el informe de la fase 2.

### Archivos
- **`.torno`** (`audio/files/torno-format.ts`): firma `\x89TORNO\r\n`, versión (1), cabecera JSON en ASCII y PCM float32 LE. Se valida entero antes de devolver nada, también cada muestra (finitas y en ±16). Ida y vuelta idéntica byte a byte; 1000 archivos malformados rechazados con su código.
- **Remuestreo** al cargar una sesión de otra frecuencia: `OfflineAudioContext` sobre tres vueltas seguidas, quedándose con la del medio (sin junta).
- **WAV** de 24 bits (mezcla estéreo y pistas mono), escrito por tramos directamente en el archivo. La mezcla sale del mismo núcleo (`OfflineRenderer`) con 1–8 vueltas y fundido final opcional de 2 s; las pistas, cada capa sola, sin panorama y sin silenciar, en un ZIP sin compresión.
- **Worker de exportación** (38,6 kB): se crea al arrancar el motor y se reutiliza, así exportar no hace ninguna petición de red.
- **Autoguardado** (IndexedDB): un `.torno` 1,5 s después de la última edición, nunca durante una toma; una sesión vacía lo borra. Al volver: «Recuperar la sesión anterior» o «Empezar de cero». La cuota llena se avisa.

### Cifras (fase 2)
| Medida | Valor | Cómo |
|---|---|---|
| Desbloqueo en el bundle inicial | 1,8 kB (límite 2 kB) | `scripts/check-bundles.mjs` |
| Worklet · motor · worker de exportación · worker de síntesis | 37,7 · 20,1 · 38,6 · 2,5 kB (límite 40 kB) | ídem |
| Copia de la sesión, 4 capas de 60 s a 48 kHz | De golpe, 7,4–9,7 ms en el manejador. Por tramos, 368 bloques (0,98 s): mediana 0,04–0,05 ms y peor bloque 0,09–0,32 ms, con el render de las 4 capas incluido | `npm run test:bench`, 3 ejecuciones en el PC de Iván (Node 24) |
| Alineación de una toma con latencia calibrada | 2 muestras (0,04 ms) en los cuatro pulsos | e2e `microphone.spec.ts`, retorno de 20 ms |
| Latencia del retorno por `MediaStream` en cuatro aperturas | 20,7 · 20,7 · 21,3 · 12,0 ms | calibración repetida en Chromium (fase 2) |
| Peticiones de red al grabar, guardar y exportar | 0 | e2e `files.spec.ts` |
| La mezcla exportada frente al render del núcleo | ≤ 1 LSB de 24 bits | e2e `files.spec.ts` |
