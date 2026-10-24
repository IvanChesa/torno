# Informe: Fase 1 (núcleo de audio en TS puro)

- **Rama:** `fase-1-nucleo-audio`
- **Fecha:** 2026-10-24
- **Estado:** listo para revisión

## 0. Plan de la fase

Bloque A = fases 1 y 2, en modo autónomo. Antes de empezar se ha aplicado la revisión del bloque 0 en `main` (Codex fuera de git, aviso del JS de la primera visita a 330 kB, remoto de GitHub conectado y `main` subido).

La fase 1 construye `LoopCore`: el instrumento entero **a nivel de muestras**, sin navegador, en `src/app/audio/core/`. Tres entregas con commits pequeños:

**1.a · Piezas del DSP y protocolo**
1. `constants.ts`: límites y valores de §4.4 (4 capas, 40–240 BPM, 90 inicial, tomas de 60 s, 3 deshacer, fundidos, techo del limitador, corte del filtro, eventos ≤ 30/s).
2. `dsp.ts`: interpolación cúbica de Hermite (4 puntos, 3.er orden), coeficiente de un polo, tablas de coseno alzado para los fundidos y rampas sin reservas.
3. `transport.ts`: contador entero de muestras y pulsos por tramos de tempo constante (`beatAtSegmentStart + (frame − segmentStartFrame) × bpm / 60 / sampleRate`), primera muestra de un pulso dado (exacta), reposicionar y cambiar de tempo sin acumular errores.
4. `svf.ts`: filtro de variables de estado TPT (Simper/Cytomic), paso bajo de Butterworth (−3 dB en el corte), corte exponencial 18 kHz → 150 Hz, *bypass* sin coste con fundido de entrada y salida.
5. `limiter.ts`: limitador estéreo con anticipación de 1 ms (mínimo deslizante + media móvil + recuperación de un polo) que garantiza el techo de −0,3 dBFS, transparente al bit por debajo del techo, y saturación suave de seguridad.
6. `metronome.ts`: clics sintetizados en tabla (acento en el primer pulso del compás), colocados en la muestra exacta del pulso.
7. `protocol.ts`: comandos y eventos del núcleo, tipados y versionados (versión 2), con validación de lo que llega por el puerto. La sonda de la fase 0 se mantiene hasta que la fase 2 la sustituya.

**1.b · Capas, voces, cola, disco y deshacer**
1. `layer.ts`: contenido de una capa (PCM, duración en pulsos, fase, origen) y voces de lectura (posición desde el transporte, *varispeed*, reverso en espejo exacto, Hermite con vuelta al inicio). Hasta 4 voces por capa: cada cambio (sonido en cola, reverso, toma, deshacer, soltar el disco) es un fundido cruzado entre voces, sin clics.
2. `history.ts`: deshacer y rehacer de 3 estados por capa, con copia en escritura (el PCM confirmado no se modifica nunca) y sin reservas al moverse.
3. `loop-core.ts`: transporte con fundidos al reproducir, pausar y parar (mantener = volver al pulso 0); nivel, silencio y panorama de igual potencia suavizados (~10 ms); filtro por capa; volumen general; cola de sonidos exacta a la muestra en el siguiente compás; disco (mantener, arrastrar con 1 vuelta = 1 compás, soltar con fundido de ~15 ms); estado y avisos agrupados con un contador de muestras (≤ 30/s); reposo.

**1.c · Grabación, memoria y render sin conexión**
1. `recorder.ts`: cuenta previa, tomas libres (la primera fija la duración del bucle y, si no hay otras capas y la opción está activa, ajusta el tempo a un número entero de compases dentro de 40–240) y fijas de 1, 2 o 4 compases (empiezan en el siguiente compás y se cierran solas; si se cierran antes, el resto queda en silencio), sobregrabación (suma) y desplazamiento por la latencia de ida y vuelta. La toma se escribe en la posición en que suena la cabeza de lectura: si la capa tiene otro tempo nativo, con un remuestreador de Hermite en flujo. La junta de la toma se cierra con un fundido cruzado con lo que se grabó justo después (sin clic aunque la señal no sea periódica).
2. Bloqueos durante una toma (tempo, reverso, disco, archivos, cambios de sonido y deshacer); niveles, silencio, filtro y volumen siguen libres.
3. `memory.ts`: contabilidad de memoria (bytes en uso, sin duplicar búferes compartidos), presupuesto que recorta el deshacer más antiguo y peor caso calculado; `docs/AUDIO.md` con el documento corto del peor caso.
4. `offline.ts`: `renderOffline(state, frames)` con el mismo `LoopCore` (sin metrónomo y con la anticipación del limitador compensada).
5. Tests a nivel de PCM con señales sintéticas (lista de la fase en el plan) y banco de rendimiento.
6. Lint de la «ruta caliente»: en `audio/core/` y `audio/worklet/`, ESLint prohíbe `new`, literales de objeto y de array, funciones, plantillas, `throw`, `await` y métodos que copian (`slice`, `subarray`, `map`…) dentro de las funciones y métodos `process*` y `render*`. Junto con un test de *heap* estable durante 60 s simulados, es la demostración de que `process()` no reserva memoria.

**Decisiones de diseño que tomo ahora** (se justifican en §5):
- Las tomas, la cola, el deshacer y el disco cambian de voz con un fundido cruzado; el PCM confirmado es inmutable, así que deshacer no copia nada.
- La duración del bucle de la sesión es la de la capa más larga con contenido. Una toma libre con la sesión vacía es «la primera»: se cierra al pulsar y fija esa duración. Con otras capas, la toma libre sigue la duración existente: empieza al momento, se escribe alineada con la línea de tiempo y se cierra sola al completar una vuelta.
- Los parámetros que el usuario mueve en directo (nivel, silencio, panorama, filtro, volumen y ganancia de entrada) se suavizan. El tempo no se suaviza: la posición de lectura sigue siendo continua, así que el cambio de velocidad no produce saltos de amplitud.
- Lo que se ejecuta en el hilo de audio no reserva memoria: los búferes de una toma se reservan al empezarla (en el manejador del comando) y los avisos van en objetos ya reservados.
- El resultado no depende del tamaño de bloque: con los mismos comandos en las mismas muestras, procesar en bloques de 1, de 128 o de una vez da los mismos bytes (la exportación suena igual que en directo).

**Riesgos:** rendimiento de ≥ 100× tiempo real en JS (4 capas con Hermite, filtro y limitador): se mide pronto y se optimiza el bucle interno; exactitud a la muestra con tempos que no dan un número entero de muestras por pulso; criterio de clics con señales extremas (el salto máximo de un fundido de coseno alzado de N muestras es π/2 · Δ / N); detectar reservas de memoria en Node de forma fiable.

**Skills consultadas:** ninguna (no hay skill de audio; manda §4.3–§4.4 del plan).

---

## 1. Resumen

`LoopCore` (`src/app/audio/core/`) es el instrumento entero a nivel de muestras, en TS puro. Funciona igual en Node y en el worklet, e incluye:
- transporte de reloj único con *varispeed*;
- 4 capas con lectura de Hermite, reverso en espejo exacto y voces que se cruzan en cada cambio;
- cola de sonidos exacta a la muestra en el siguiente compás;
- disco;
- filtro SVF;
- limitador con anticipación;
- metrónomo y cuenta previa;
- tomas libres y fijas, sobregrabación (también a otro tempo y en reverso, con remuestreo), latencia, bloqueos y deshacer de 3 estados;
- render sin conexión con el mismo núcleo y contabilidad de memoria con presupuesto.

Se demuestra con 201 tests en Node del núcleo y de la síntesis. Rinde 230–243× tiempo real, no depende del tamaño de bloque (mismos bytes con bloques de 1, 77, 128 o de una vez) y no reserva memoria en `process()`: lo vigila el lint y lo mide el perfil del heap de V8 (0 KiB en 60 s simulados).

## 2. Criterios de aceptación

| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| Todos los tests de la fase en verde, con las cifras en el informe | ✅ | 292 tests en Node, todos en verde, de los que 201 son del núcleo y la síntesis; 31 en Angular. Cobertura del TS puro: 97,97 % en sentencias, 93,72 % en ramas, 99,49 % en funciones y 99,63 % en líneas. Los tests, uno a uno, en la tabla de abajo. |
| Rendimiento ≥ 100× tiempo real (§5) | ✅ | **230×, 241× y 243×** en tres ejecuciones de `npm run test:bench`: 60 s a 48 kHz en bloques de 128, con 4 capas sonando con *varispeed* (97 BPM sobre bucles de 90), filtro, panorama y limitador. PC de Iván, Node 24. El test exige ≥ 100× y va aparte de la cobertura (la instrumentación lo frena). |
| Peor caso de memoria documentado y dentro de §5 | ✅ | `docs/AUDIO.md` §4 y `worstCaseMemory()` con su test: 4 capas de 60 s con 3 estados de deshacer y una toma de 60 s. **179,93 MB a 44,1 kHz y 195,84 MB a 48 kHz**, ≤ 220 MB. A 96 kHz serían 391,68 MB: el presupuesto de 220 MB suelta el deshacer más antiguo (test). Sesión típica (4 capas de 2 compases): **16,4 MB** con el historial lleno (≤ 64 MB). |
| `audio/core/` sin dependencias de navegador (lo demuestra el lint) | ✅ | Demostración más abajo: ESLint rechaza Angular, el motor, `AudioContext`, `setTimeout`, `window`, `Math.random` y una reserva en `process()`; `tsc -p tsconfig.pure.json` (sin DOM) rechaza también `AudioContext`, `setTimeout` y `window`. Y los 201 tests corren en el entorno `node` de Vitest, sin jsdom. |

Tests de la fase (PLAN, fase 1, tarea 5) y su evidencia:

| Test del plan | Dónde | Cifra |
|---|---|---|
| Límites de compás y cola exactos a la muestra | `loop-core.playback.spec.ts` («cola de sonidos») | El cambio entra en la muestra `ceil(8 · 60 · fs / bpm)` (256.000 a 48 kHz y 90 BPM; 218.227 a 44,1 kHz y 97 BPM). La muestra anterior aún es el sonido viejo y esa ya cambia. |
| *Varispeed*: a doble tempo, el bucle dura la mitad ±1 muestra | ídem («varispeed y reverso») | ±1 muestra en 44,1 kHz/97 BPM, 48 kHz/61 BPM y 48 kHz/133 BPM, y su doble |
| Reverso: espejo exacto | ídem | Diferencia máxima < 1·10⁻⁶ con ruido. Sin excepción en la junta: la junta va horneada en la toma (§5). |
| Sin clics en juntas, cambios, fundidos y al soltar el disco | `loop-core.playback`, `.disc` y `.recording` | Salto ≤ el de la propia señal + 0,01 en reproducir, pausar, cola (salto máximo 0,00231 de +0,354 a −0,354), APAGADO, reverso, deshacer, nivel, silencio, panorama, brazo, volumen, agarrar y soltar el disco, y junta de una toma de vuelta completa |
| Filtro: −3 dB en el corte ±10 % y *bypass* transparente | `svf.spec.ts`, `loop-core.playback.spec.ts` | Error < 0,01 % de 150 Hz a 15 kHz, a 44,1 y 48 kHz. *Bypass* idéntico al bit, también al retirar el filtro. |
| Limitador: nunca supera −0,3 dBFS con 4 capas a tope | `limiter.spec.ts`, `loop-core.playback.spec.ts` | Pico de **−0,342 dBFS** con 4 senos a tope en fase; ruido a +12 dB, también por debajo. Transparente al bit bajo el codo. |
| Tomas libres, fijas, relleno, cuenta previa y desplazamiento por latencia de N muestras | `loop-core.recording.spec.ts` | Muestra a muestra contra la entrada: la toma empieza en el compás exacto, cierra sola y queda alineada con `latencia + 48` muestras (1000 + 48 en el test de N). El cierre anticipado deja silencio y la cuenta previa dura ≥ 4 pulsos (con el transporte parado o en marcha). Primera toma libre de 3,125 pulsos → 1 compás a 115,2 BPM; a los 60 s se cierra sola; una de 0,1 s se descarta. |
| Sobregrabación (suma), deshacer/rehacer y su invalidación | `loop-core.recording.spec.ts`, `history.spec.ts` | Suma exacta en float32; con la toma más larga, la capa se repite. A otro tempo (120 y 60 BPM sobre 90) y en reverso, la vuelta siguiente reproduce la entrada con un error < 0,002 (< 0,01 al comprimir). |
| Bloqueos durante una toma | `loop-core.recording.spec.ts` | 10 comandos bloqueados (tempo, reverso, disco, deshacer, rehacer, sonido, borrar capa, cargar, sesión nueva, grabar otra capa) y 5 libres (nivel, silencio, panorama, filtro, volumen) |
| Deriva 0 en 10 minutos simulados | `transport.spec.ts`, `loop-core.playback.spec.ts` | Pulso exacto (error < 10⁻⁹) a 3 frecuencias × 5 tempos; tras 10 min a 97 BPM y 44,1 kHz, el bucle sigue cayendo en su muestra (±1) |
| Determinismo (misma entrada → mismos bytes) | `loop-core.playback.spec.ts` | Mismos bytes con bloques de 1, 77, 128 y de una vez, también grabando a otro tempo con latencia |

Tarea 6, banco de pruebas y memoria de `process()`:
- **Banco:** el de la tabla de criterios (`loop-core.bench.spec.ts`).
- **`process()` no reserva memoria:**
  - *Revisión del código.* La regla nueva de ESLint de la ruta caliente (§5) y un repaso a mano de lo que llama `process()`. El repaso encontró un caso: cargar una sesión con el transporte en marcha creaba objetos al terminar el fundido. Corregido: se preparan en el manejador del comando.
  - *Prueba en ejecución.* El plan pedía un «heap estable durante 60 s simulados». Medir `heapUsed` no sirve: en V8, las recolecciones las disparan otras cosas, como forzar `gc()` o la memoria externa de los búferes. Por eso el test usa el **perfil de muestreo del heap de V8** (`node:inspector`, una muestra cada 64 bytes) y cuenta lo reservado con `LoopCore.process` en la pila.
  - *Resultado.* **0 KiB en un minuto simulado** con todo en marcha: 4 capas con filtro y *varispeed*, metrónomo, una sobregrabación que se confirma, un cambio en cola que entra en un compás y el disco moviéndose a saltos. El test exige < 16 KiB.

Demostración del lint (archivo temporal `src/app/audio/core/demo-prohibido.ts`, borrado después):

```
$ npx eslint src/app/audio/core/demo-prohibido.ts
   1:24  error  La capa «audio/core» no puede importar el paquete «@angular/core» (PLAN §4.2)
   2:29  error  La capa «audio/core» no puede importar de «audio/engine» (PLAN §4.2)
   5:22  error  Unexpected use of 'AudioContext'. Solo src/app/audio/engine/ toca Web Audio…
   6:18  error  Unexpected use of 'setTimeout'. Las capas de TS puro no usan el navegador ni Node…
   7:18  error  'Math.random' is restricted from being used. El audio es determinista (PLAN D8)…
   7:34  error  Unexpected use of 'window'. Las capas de TS puro no usan el navegador ni Node…
  10:12  error  En la ruta caliente del audio (process*/render*) no se reserva memoria ni se lanza nada…
✖ 7 problems (7 errors, 0 warnings)

$ npx tsc -p tsconfig.pure.json
demo-prohibido.ts(5,22): error TS2304: Cannot find name 'AudioContext'.
demo-prohibido.ts(6,18): error TS2304: Cannot find name 'setTimeout'.
demo-prohibido.ts(7,34): error TS2304: Cannot find name 'window'.
```

## 3. Tareas del plan

| Tarea | Estado | Notas |
|---|---|---|
| 1.1 `LoopCore` según §4.4 | hecha | Todo lo de la lista: transporte, capas, Hermite, reverso, *varispeed*, juntas, suavizado, panorama, SVF, limitador, metrónomo, cuenta previa, tomas libres y fijas, ajuste de tempo, relleno, sobregrabación, deshacer/rehacer, cola, disco, bloqueos, reposo y latencia. Archivos: `loop-core.ts`, `channel.ts`, `voice.ts`, `recorder.ts`, `history.ts`, `transport.ts`, `svf.ts`, `limiter.ts`, `metronome.ts`, `dsp.ts`, `content.ts`, `constants.ts`. |
| 1.2 `protocol.ts` | hecha | Versión 2. `CoreCommand` (25 tipos), `CoreStatus` con `LayerStatus` y avisos (`Notice`). Los campos se validan en `handle()`: lo que llega por el puerto no es de fiar (test con todos los rechazos y *fuzz* de 3000 comandos). La sonda de la fase 0 sigue hasta la fase 2. |
| 1.3 Render sin conexión | hecha | `renderOffline(state, frames)` (`offline.ts`): mismo núcleo, sin metrónomo, desde el pulso 0, sin fundido y con la anticipación del limitador compensada. Da los mismos bytes que el núcleo en directo con la misma sesión. |
| 1.4 Contabilidad de memoria y peor caso | hecha | `memory.ts`, el estado (`memoryBytes`) y el presupuesto de 220 MB; `docs/AUDIO.md` §4. |
| 1.5 Tests a nivel de PCM | hecha | Ver §2. |
| 1.6 Banco y memoria de `process()` | hecha | Ver §2. Más la regla de lint de la ruta caliente (§5). |

## 4. Desviaciones del plan y motivo

1. **Juntas del bucle.** El plan pide «fundido cruzado de ~5 ms en el punto de unión». Un bucle ya grabado no tiene material más allá de su final, así que un fundido al leer solo podría bajar el volumen en la junta. Por eso la junta se cruza **al grabar**: tras cerrar la toma se graban 5 ms más, que se cruzan con su principio. Así la junta es continua aunque la señal no sea periódica, y el reverso sale como espejo exacto, sin la excepción que preveía el plan. Los bucles de la biblioteca (fase 3) se sintetizan sin junta (lo comprobarán sus tests).
2. **Fundidos de 10 ms** en los cambios de contenido, el transporte y el reverso, en lugar de «corto». Con 10 ms, un cambio de Δ = 1 da un salto de 0,0033 por muestra, dentro del margen de 0,01 de §5; con 5 ms y Δ = 2 no se cumpliría a 44,1 kHz. La junta sigue en 5 ms y el disco en 15 ms, como pide el plan.
3. **Prueba de «heap estable».** Con el perfil de muestreo de V8, no con `heapUsed`: §2 explica por qué.
4. **Campos privados de JavaScript** (`#campo`) en lugar de `private` de TypeScript en las clases del núcleo. esbuild solo acorta los primeros: `LoopCore` minificado pasa de 38,8 a 32,7 kB. El worklet tiene 40 kB de presupuesto (§5) y en la fase 2 llevará el núcleo entero. El rendimiento no cambia.
5. **Banco de rendimiento aparte** (`npm run test:bench`, dentro de `npm test` y de `check`). La cobertura instrumenta el código y lo hace unas 3 veces más lento.

## 5. Decisiones técnicas nuevas

| Decisión | Alternativas consideradas |
|---|---|
| **Duración del bucle de la sesión = la de la capa más larga con contenido (o en cola).** «Primera toma libre» es la que se graba con la sesión vacía; con otras capas, la toma libre sigue esa duración. Así, con la batería sonando, una toma libre queda alineada con ella. | Una duración aparte, fijada por la primera toma libre aunque ya haya capas: la toma podría quedar desfasada de la batería, porque no tiene un número entero de pulsos. |
| La toma libre «que sigue la duración» empieza al momento, se escribe alineada con la línea de tiempo y se cierra sola al dar la vuelta completa (o al pulsar) | Grabar sin fin dando vueltas (más propio de un pedal de bucles; aquí una toma es una pasada) |
| **La toma se escribe donde suena la cabeza de lectura** («lo que oíste más lo que tocaste»): en reverso, hacia atrás; si la capa va a otro tempo que su nativo, con un remuestreador de Hermite en flujo, antialias de 4 polos al comprimir y compensación de su retraso | Convertir la capa al tempo actual (trabajo pesado en el hilo de audio); prohibir sobregrabar a otro tempo |
| Sobregrabar con una toma más larga que la capa repite la capa hasta la nueva duración; con una más corta, la capa conserva su duración | Recortar la capa a la toma (se pierde lo que no sonó) |
| Una toma en una **capa vacía quita el reverso**, para que suene tal como se tocó | Escribirla en espejo (en la primera toma libre no se puede: aún no se sabe su duración) |
| Ajuste de tempo de la primera toma libre: el número de compases más cercano al tempo actual que quede en 40–240. La línea de tiempo se redefine para que la toma empiece en el pulso 0. Sin otras capas no se mueve nada que suene. | Cambiar solo el tempo (el bucle no empezaría en un compás); redondear siempre hacia arriba |
| Toma libre de menos de 0,25 s: se descarta (aviso `take-cancelled: too-short`) | Aceptarla (casi siempre es una doble pulsación) |
| Pausar o parar durante una toma la cierra (guarda lo grabado). En la cuenta previa, la cancela. El reposo la cancela. | Cancelar siempre (se perdería una toma buena al pausar) |
| Con el transporte parado, la cuenta previa va antes de arrancarlo (4 pulsos con su propio reloj de muestras). Con el transporte en marcha, termina en el primer límite de compás a ≥ 4 pulsos. | Arrancar el transporte con la cuenta previa (sonarían las capas durante la cuenta) |
| **Metrónomo:** clic en cada pulso mientras suena el transporte, si está activado; la cuenta previa suena siempre | Solo durante las tomas |
| **Deshacer** cubre los cambios de contenido: tomas, sonidos y borrar capa. Nivel, silencio, panorama, reverso y filtro son controles en directo y no entran. | Deshacer también los controles (confunde: girar un dial no es una edición) |
| Deshacer y rehacer suenan al momento (con fundido), no esperan al compás | Encolarlos como un cambio de sonido |
| El disco agarrado con el transporte parado hace sonar la capa (se puede arrastrar un disco parado) | Silencio hasta reproducir |
| Grabar con el disco agarrado se rechaza (`record: disc`); agarrar el disco durante una toma, se bloquea | Soltar el disco al grabar |
| Volumen general **después** del limitador (no cambia la exportación); el metrónomo entra **antes** del limitador | Volumen antes del limitador (subir el volumen limitaría más) |
| Tempo sin suavizar: la posición de lectura es continua, así que no hay saltos de amplitud | Suavizar el tempo (rompe la fórmula por tramos) |
| Avisos discretos en un anillo reservado (16 entre dos estados) que viajan con el estado; los que no caben se cuentan | Un mensaje por aviso (más de 30 mensajes por segundo en ráfagas) |
| `exportState()` copia el PCM (con `slice`) para guardar, autoguardar y exportar; `load-session` valida la estructura en el núcleo, y la validación de cada muestra queda en el hilo principal o en un worker (fase 2) | Validar cada muestra en el hilo de audio (varios ms con 4 capas de 60 s) |
| Regla de lint de la **ruta caliente**: en `process*`/`render*` de `audio/core/` y `audio/worklet/`, ni `new`, ni literales, ni cierres, ni plantillas, ni copias, ni `throw`/`await`/`console` | Solo revisión a mano |

## 6. Salida de los checks

```
$ npm run check
> npm run lint     typecheck (4 tsconfig) ✔ · All files pass linting · Prettier ✔
> npm test
  test:node   Test Files 19 passed · Tests 291 passed
              Coverage: Statements 97,97 % · Branches 93,72 % · Functions 99,49 % · Lines 99,63 %
  test:bench  1 passed (LoopCore: 230–243× tiempo real)
  test:ng     Test Files 8 passed · Tests 31 passed
> npm run build
  Initial total 286.00 kB · Prerendered 3 static routes
> node scripts/check-bundles.mjs
  ✔ JS inicial de /                     293.5 kB  (aviso > 330.0 kB · error > 400.0 kB)
  ✔ JS inicial de /404                  280.1 kB
  ✔ JS inicial de /sobre-el-proyecto    281.7 kB
  ✔ Desbloqueo de audio en el inicial     0.7 kB  (error > 2.0 kB)
  ✔ Motor de audio (probe.ts)             3.0 kB  (error > 60.0 kB)
  ✔ Worker synth.worker.ts                1.3 kB  (error > 40.0 kB)
  ✔ Worklet                               1.9 kB  (error > 40.0 kB)
  ✔ Fuentes                             144.1 kB  (error > 150.0 kB)
  ✔ Bundle inicial sin motor de audio, síntesis, worklet ni 3D.
```

Tests en Node por archivo:
- **Núcleo y síntesis** (201): `loop-core.commands` 27, `session` 27, `loop-core.playback` 24, `loop-core.recording` 23, `beep` 22, `dsp` 14, `transport` 10, `protocol` 8, `svf` 8, `tone` 8, `loop-core.disc` 7, `history` 5, `limiter` 5, `loop-core.memory` 5, `metronome` 4, `offline` 3 y el banco, 1.
- **Scripts** (91): `eslint-layers` 52, `contrast` 23 y `check-bundles` 16.

Métricas de la fase (audio):

| Medida | Valor |
|---|---|
| × tiempo real del núcleo | 230–243× (4 capas, filtro, *varispeed*, limitador; 48 kHz) |
| Memoria reservada por `process()` | 0 KiB en 60 s simulados (perfil de V8) |
| Memoria de audio | Peor caso: 195,84 MB a 48 kHz y 179,93 MB a 44,1 kHz. Sesión típica: 16,4 MB. |
| Exactitud | Cola y tomas fijas en su muestra exacta; *varispeed* ±1 muestra; deriva 0 en 10 min (±1 muestra) |
| Saltos máximos | Cola: 0,00231 (Δ = 0,707 en 10 ms); en el resto, ≤ el de la señal + 0,01 |
| Limitador | Pico de −0,342 dBFS con 4 capas a tope |
| Tamaño | `LoopCore` minificado: 32,7 kB (el worklet de la fase 2 tiene 40 kB) |
| Latencia del núcleo | 1 ms (la anticipación del limitador, 48 muestras a 48 kHz), compensada en las tomas y en la exportación |

## 7. Capturas

Sin cambios visuales en esta fase (todo es TS puro y tests).

## 8. Dependencias añadidas

Ninguna. El perfil del heap usa `node:inspector`, que viene con Node.

## 9. Pendientes y `TODO(ivan)`

Nada para Iván en esta fase.

Para las fases siguientes:
- **Fase 2:**
  - el worklet adapta `LoopCore` (el adaptador debe dejarlo por debajo de 40 kB; hoy son 32,7) y desaparece la sonda;
  - el motor tiene que validar las muestras de un `.torno` fuera del hilo de audio (`validateSessionState` con `checkSamples`) antes de `load-session`;
  - la latencia de ida y vuelta se mide en el motor y llega con `set-latency`, en muestras.
- **Fase 3:** los bucles de la biblioteca tienen que sintetizarse sin junta (`x[N−1] → x[0]` continuo), con un test, porque el núcleo no funde las juntas al leer (§4.1).

## 10. Propuestas de cambio al plan

1. §4.4, «Juntas del bucle»: escribir «fundido cruzado de ~5 ms en la junta de cada toma, con lo que se grabó justo después; los bucles de la biblioteca se sintetizan sin junta». Así se recoge lo que hace el núcleo (§4.1 de este informe).
2. §4.4, «Toma libre»: dejar escrita la regla de §5: la duración del bucle es la de la capa más larga, la «primera» toma libre es la de la sesión vacía, y con otras capas la toma sigue esa duración y se cierra sola.
3. Fase 1, tarea 6: aceptar como prueba del «heap estable» el perfil de muestreo del heap de V8 con una cota en bytes (hoy, < 16 KiB por minuto simulado).

## 11. Cómo probarlo

```
npm run test:node        # tests del núcleo con cobertura (≈ 40 s)
npm run test:bench       # rendimiento: imprime «LoopCore: N× tiempo real»
npx vitest run --config vitest.node.config.mts loop-core.memory --reporter=verbose --silent=false
                         # imprime los KiB que reserva process() en 60 s simulados
npm run check            # todo
```

Esta fase no suena todavía en el navegador: el núcleo entra en el worklet en la fase 2.
