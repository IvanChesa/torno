# Revisión: Fase 1
Veredicto: CAMBIOS NECESARIOS

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante | `src/app/audio/core/loop-core.ts:655-673` (`#planTake`), con `:717-729` (`#beginTake`) | **Una sobregrabación más larga que la capa, cuando la duración de la capa no la divide, desplaza el material original.** `#planTake` extiende la capa repitiéndola desde su muestra 0, con la misma fase (`offsetBeats: content.offsetBeats`). Pero lo que suena durante la toma es el bucle antiguo, que da vueltas con su propia duración. Escenario: capa 0 con un diente de sierra de 3 compases (12 pulsos), en marcha, y en el pulso 13 se pide una toma fija de 4 compases con la entrada en silencio. La toma empieza en el pulso 16, y 16 mod 12 = 4. En los pulsos +1, +4, +7,5, +10 y +13 de la toma suenan las posiciones 5, 8, 11,5, 2 y 5 del original. En esos mismos pulsos de la vuelta siguiente, ya confirmada, suenan 1, 4, 7,5, 10 y 1. La diferencia máxima es de 0,47, y eso sin tocar nada. Lo que se toca se suma sobre otra parte de la capa: «lo que oíste más lo que tocaste» no se cumple. Pasa también con una toma libre que sigue un bucle más largo. Por ejemplo, con una primera toma ajustada a 3 compases y un sonido de la biblioteca de 2 compases en otra capa, al sobregrabar esa capa con una toma libre se extiende a 12 pulsos y la progresión queda desplazada 4 pulsos (comprobado: diferencia de 0,50 con la entrada en silencio). El test «si la toma es más larga que la capa, la capa se repite» usa una constante y no lo puede ver. | Construir el destino para que reproduzca lo que suena durante la toma: la fase del destino sale del pulso en que empieza la toma, y `data[i]` es el contenido antiguo leído desde su cabeza en ese instante (también en reverso). El pulso de inicio ya se conoce en `#planTake`: es el compás siguiente o el que sigue a la cuenta previa, y el tempo está bloqueado. Añadir el test: diente de sierra de 3 compases, toma de 4 compases y entrada en silencio. La capa tiene que sonar igual antes y después. |
| 2 | Importante | `src/app/audio/core/loop-core.ts:391-394` (reposo) y `:837-846` (`#applyLoad`); `src/app/audio/core/channel.ts:209-213` y `:283-286` | **Las voces del disco no pasan por la ganancia del transporte, y ni el reposo ni la carga lo tienen en cuenta.** (a) Disco agarrado + `standby`: el transporte queda en `stopped`, pero `discHeld` sigue en `true` y la capa sigue sonando. Un segundo después, la salida sigue en −0,349, el valor de la capa congelada. «Reposo: para el audio» (§4.4) no se cumple. Si la pestaña se oculta mientras se agarra el disco, seguiría sonando de fondo, o haría clic cuando el motor suspenda el contexto. (b) Disco agarrado + `reset` o `load-session`, en marcha o parado: `#applyLoad` llama a `#releaseDisc()`, que empieza un fundido de 15 ms, y justo después a `channel.silence()`, que corta la voz en seco. Con una capa constante de 0,8 a la izquierda, el salto es de 0,80: un clic a escala completa en los dos casos. | En `standby` y en `#load`, soltar el disco. Aplicar la carga solo cuando las voces del disco también se hayan apagado: por ejemplo, que el fundido del transporte afecte también a las voces del disco cuando hay una carga o un reposo pendientes, o esperar a que el canal no tenga voces sonando. Tests: reposo con el disco agarrado da silencio tras el fundido y `discHeld: false`; sesión nueva y carga con el disco agarrado, en marcha y parado, dan un salto dentro del criterio de §5. |
| 3 | Menor | `src/app/audio/core/channel.ts:392-405` (`#acquire`) | **Con 4 cambios o más en la misma capa en unos 10 ms, la voz robada se corta en seco.** Reverso alternado en cada bloque de 128 muestras, con un seno de 41 Hz a 0,9: los tres primeros cambios dan saltos de 0,004–0,005; el cuarto, de 0,051, y el peor, de 0,101 (el límite de §5 es 0,0149). Deshacer y rehacer alternados en cada bloque, con ±0,9: 0,103. A ritmo humano no se llega (la repetición del teclado va a unos 30 por segundo), pero el informe y `AUDIO.md` dicen que todo cambio es un fundido cruzado sin clics. | No cortar al robar. Una opción es reutilizar la voz que acaba de entrar si aún está en su fundido, cambiándole el contenido de destino. Otra es una voz de reserva que se apague en 1–2 ms. Si se deja así, documentar el límite. Añadir un test con 8 cambios seguidos. |
| 4 | Menor | `src/app/audio/core/constants.ts:36`, `src/app/audio/core/recorder.ts:205-208` | **La junta de 5 ms incumple el criterio de §5 en el peor caso.** El salto de un fundido de N muestras es π/2 · Δ / N. En la junta, Δ es la diferencia entre lo grabado al final y al principio de la toma, que puede llegar a 2, o a más con la ganancia de entrada al 200 %. Medido con un tono de 0,94 Hz a ±0,9, en polaridad opuesta en la junta y con la capa a la izquierda: 0,01279 frente a un límite de 0,01012 a 44,1 kHz, y 0,01178 frente a 0,01011 a 48 kHz. Es el mismo argumento con el que la desviación 2 alarga a 10 ms los demás fundidos. En la práctica solo afecta a señales muy graves (por debajo de ~25 Hz) cerca del fondo de escala. El test de la junta usa 97 Hz a 0,5, con mucho margen. | Pasar la junta a 10 ms, y proponerlo en el §10 junto con el cambio de §4.4 que ya se propone. Si no, documentar en `AUDIO.md` que la junta cumple el criterio solo con \|Δ\| ≤ 1,4 a 44,1 kHz. En los dos casos, añadir al test el caso de polaridad opuesta. |
| 5 | Menor | `src/app/audio/core/voice.ts:147-188` (`renderDiscAdd`), `src/app/audio/core/channel.ts:188-194` | **Con el disco agarrado y quieto, la capa da una continua sostenida**, el valor de la muestra en que se paró. El test «mantener congela la capa» lo exige así. Escenario: una capa congelada en 0,9 (0,64 por canal) y otra con un seno de 0,9. El limitador baja la ganancia de 1,0 a 0,759 (−2,4 dB), así que la capa que sigue sonando pierde volumen mientras se agarra el disco, y la salida lleva una continua de ~0,48. Al agarrar y al soltar, esa continua entra y sale en 10–15 ms, como un golpe de graves. Un disco quieto no suena. | Decidirlo y documentarlo en el §5 del informe. Por ejemplo, que la ganancia de la voz del disco siga a la velocidad de la cabeza, suavizada, y quede en silencio con el disco quieto; o un filtro de continua en esa voz. Si se mantiene la continua, explicar el efecto sobre el limitador. |
| 6 | Menor | `src/app/audio/core/loop-core.ts:605-616` y `:970-974` | **La cuenta previa desde una pausa a mitad de compás rompe el ritmo.** Con el transporte pausado en el pulso 5,3 y una toma fija de 1 compás con cuenta previa, hay clics en los pulsos 0, 1, 2 y 3 (reloj propio). Después el transporte arranca en el 5,3 y suenan clics en 4,687 y 5,687 (sus pulsos 6 y 7). La toma empieza en el pulso 8. Son 6 clics, con un hueco de 1,685 pulsos entre el cuarto y el quinto, y las capas vuelven a sonar a mitad de compás en plena cuenta. El test de la cuenta previa con el transporte parado solo parte del pulso 0. | Que, con el transporte parado fuera de un límite de compás, la cuenta termine justo donde empieza la toma. Por ejemplo, recolocar el transporte en un compás antes de contar, o alargar el reloj de la cuenta hasta el compás. Testarlo desde una pausa a mitad de compás. |
| 7 | Menor | `src/app/audio/core/loop-core.ts:625` (`#planTake`) | **Grabar en una capa con un sonido en cola aplica la cola al momento, a mitad de compás.** Con la cola pedida en la muestra 50.000 y grabar 1280 muestras después, `sound-applied` llega en la muestra 51.280 y no en la 128.000. Rompe «la cola entra exacta en el siguiente compás», y la decisión no está en el §5 del informe ni en `AUDIO.md`. | Documentarlo como decisión. También se puede dejar que la cola entre en su compás y que la toma, si es fija, parta del contenido en cola. |
| 8 | Menor | `src/app/audio/core/loop-core.ts:347-351`, `src/app/audio/core/channel.ts:197-199` | **`disc-move` solo comprueba que `turns` sea finito.** Con `turns: 1e308`, `turns × 4` desborda a `Infinity`, la cabeza pasa a `Infinity` y la posición a `NaN`. Mientras se agarra el disco, el limitador convierte cada muestra en 0 y **calla todas las capas**: RMS de 0,000, cuando la capa 1 sola da 0,212. El estado publica `positionBeats: NaN`, y no hay ningún `rejected`. Por encima de ~10¹² vueltas también se pierde la precisión de la posición. Según el propio `handle()`, lo que llega por el puerto no es de fiar. | Limitar `\|turns\|` (por ejemplo, a 10⁶) o reducir el objetivo módulo la duración de la capa, y rechazar el resto con `rejected`. Añadir el caso al test de validación y al *fuzz*, que solo prueba 0,1, −0,5, 2 y `NaN`. |
| 9 | Menor | `src/app/audio/core/memory.ts:55-68`, `docs/AUDIO.md` §4, `src/app/audio/core/loop-core.ts:806-835` y `:921-934` | **El peor caso documentado no cuenta la carga de una sesión.** El documentado es de 195,84 MB a 48 kHz, pero `#load` no pasa por `#ensureMemory` y `#updateMemory` no cuenta `#pendingLoad`. Con el historial lleno (16 búferes de 60 s) y una sesión de 4 × 60 s que llega por el puerto, conviven 20 búferes: 230,4 MB, por encima de los 220 de §5. Medido en Node: el núcleo cuenta 184,4 MB mientras hay 238,2 MB de `ArrayBuffer` vivos, con la copia de `exportState`. Al aplicar la carga, cuenta 46,1 MB. | Al recibir `load-session`, soltar ya el deshacer y el rehacer de todas las capas, porque el fundido solo necesita el estado actual. Contar `#pendingLoad` en la contabilidad y documentar el pico en `AUDIO.md` §4. |
| 10 | Menor | `src/app/audio/core/loop-core.recording.spec.ts:408-425` | **El título del test promete «o demasiado largas», pero ningún test provoca `record: too-long`.** Este solo comprueba que 4 compases a 40 BPM caben. Lo he comprobado aparte: una toma libre que sigue un bucle de 90 pulsos a 60 BPM (90 s) se rechaza bien. | Añadir ese caso (primera toma de 60 s, tempo a 60 y toma libre en otra capa: `record: too-long`) y uno de sobregrabación que pasaría de 60 s. |
| 11 | Menor | `src/app/audio/core/protocol.ts:100-105`, `src/app/audio/core/loop-core.ts:413-415` | **`Notice.reason` es un `string` libre**, y en los rechazos se compone con una plantilla (`'record: no-memory'`, `'set-tempo: range'`). En la fase 2, la interfaz tiene que traducir estos códigos a textos de los archivos de contenido. Con un texto compuesto y sin tipo, tendrá que trocearlo, y TypeScript no avisará si falta un caso. | Tipar los motivos como uniones: `RejectReason`, `CancelReason` y `CoreCommandType` para los bloqueos. Separar el comando del motivo en dos campos. |
| 12 | Menor | commit `61ce840` | **3239 líneas en 16 archivos en un solo commit.** Junta la entrega 1.b y casi toda la 1.c (`recorder.ts`, `session.ts`, `memory.ts` y `offline.ts`), sin sus tests, que llegan en `eba4ddb`. CLAUDE.md pide commits pequeños, y el §0 del informe anunciaba tres entregas. Además, el §0 cita un `layer.ts` que no existe: la pieza son `content.ts`, `voice.ts` y `channel.ts`. | No hace falta reescribir el historial. En adelante, un commit por pieza, con su test. Corregir la mención del §0. |
| 13 | Sugerencia | `eslint.config.mjs:269-285` | **La regla de la ruta caliente solo mira el cuerpo de `process*` y `render*`**, no lo que llaman: `#commitTake`, `#applyLoad`, `#applyPending`, `#updateStatus`, `show`, `begin`, `history.push`… Un `return [1]` en un método auxiliar llamado desde `process()` pasa el lint (comprobado con `eslint --stdin`). Y el «0 KiB» vale para el escenario medido. Con los caminos raros dentro de la ventana (primera toma con ajuste de tempo, cola aplicada al pausar, carga sonando, parar, cierre a los 60 s, toma demasiado corta y reposo), el perfil da entre 0,9 y 20,9 KiB por pasada: en `#commitTake` y, tras alguna desoptimización, en `process`. Para el audio es irrelevante. | Matizar la frase en el informe y en `AUDIO.md`: 0 KiB en régimen permanente y unos KiB en los cambios raros. Valorar ampliar el selector a los métodos que se llaman desde `process()`, con una lista o un prefijo común. |
| 14 | Sugerencia | `src/app/audio/core/voice.ts:100-140` | ***Varispeed* hacia arriba sin antialias**: Hermite no limita la banda. Un tono de 15 kHz en un bucle nativo de 90 BPM, leído a 240 BPM (×2,67), tendría que ir a 40 kHz. En su lugar sale un alias de 8 kHz con un RMS de 0,262, frente a 0,354 de la entrada. Con los bucles de la biblioteca a 90 BPM, a 240 BPM se doblará todo lo que pase de unos 9 kHz (charles y platos). El plan solo pide Hermite. | En la fase 3, medirlo con los bucles reales a 240 BPM. Si se oye, prefiltrar: una copia filtrada de la capa para velocidades > 1, o un interpolador con el corte proporcional a 1/velocidad. |
| 15 | Sugerencia | `src/app/audio/core/loop-core.ts:1065-1067` | **El metrónomo entra antes del limitador.** Con la música a 0,85, por debajo del codo y sin limitar, cada clic baja la ganancia del limitador a 0,863 (−1,3 dB): la música «bombea» al ritmo del metrónomo. Solo pasa en directo; la exportación no lleva clics. | Sumar los clics después del limitador, con su propia saturación de seguridad, o documentarlo. |
| 16 | Sugerencia | `playwright.config.ts:37-45` (fase 0) | **Con `reuseExistingServer: !CI` y puertos fijos, Playwright reutiliza en local cualquier servidor que ya escuche en el puerto.** Hoy el 4300 lo ocupa un `ng serve` de tierra-luna-sol, y fallan 14 de los 20 tests de «estatico» (el worklet llega como `text/html`). Sirviendo el build en el 4310, con una configuración temporal fuera del repo, pasan los 20. Comprobar la `url` no basta, porque un servidor con *fallback* de SPA responde 200 a todo. | `reuseExistingServer: false`, que falla de forma visible si el puerto está ocupado, o puertos menos comunes. |

## Qué se ha comprobado

No hay Bloqueantes, y los cuatro criterios de aceptación se cumplen y están demostrados con cifras que he reproducido. Los dos Importantes son fallos de comportamiento en casos que los tests no cubren. Con ellos corregidos y con sus tests, y con los Menores rápidos (#7, #8, #10, #11 y la parte documental de #4, #5, #9 y #12), la fase se puede fusionar sin otra ronda de revisión.

**Lectura.** `CLAUDE.md`, `docs/PLAN.md` (§0–§5, §7 y la fase 1), `docs/revisiones/README.md`, el informe, `docs/AUDIO.md` y `git diff main...fase-1-nucleo-audio` entero: 38 archivos, +5992/−11. El código del núcleo lo he leído línea a línea.

**`npm run check`: código 0, en 75 s.**
- Lint: typecheck de los 4 tsconfig, `ng lint` sin errores y Prettier sin cambios.
- `test:node`: 19 archivos y 291 tests. Cobertura: 97,97 % de sentencias, 93,72 % de ramas, 99,49 % de funciones y 99,63 % de líneas.
- `test:bench`: en verde. `ng test`: 8 archivos y 31 tests.
- Build: inicial de 286,00 kB y 3 rutas prerenderizadas.
- `check-bundles`: idéntico a la tabla del informe (293,5 kB en `/`, worklet de 1,9 kB, fuentes de 144,1 kB, sin avisos).
- El recuento del informe cuadra: 201 tests del núcleo y la síntesis más 91 de los scripts suman 292.

**`npm run e2e`.**
- «dev»: 11/11.
- «estatico»: 14 fallos por el servidor ajeno del puerto 4300 (#16). Con el mismo build servido en el 4310: 20/20. No he tocado ese proceso.

**Pruebas propias.** Seis archivos `tmp-revision-*.spec.ts`, ejecutados con la configuración del repo y ya borrados. Hay copia en `C:\Users\ivan\AppData\Local\Temp\claude\C--Users-ivan-Ivan-Chesa-AI-torno\2842eca1-88f9-4adf-92da-46aff444d843\scratchpad\pruebas-revision\`, por si sirven para los tests de las correcciones.

- **Exactitud: todo correcto.**
  - Cola con un cambio de tempo mientras espera (44,1 kHz, de 133,3 a 211,7 BPM): entra en la muestra 68.957, la misma que calculo aparte con la fórmula por tramos.
  - Toma fija con cuenta previa a 239,7 BPM y 44,1 kHz: empieza en la muestra 88.311, la exacta.
  - *Varispeed* a 40 y a 240 BPM sobre un bucle de 90: periodos de 576.000 y 96.000 muestras exactas, en todas las vueltas.
  - Deriva a 240 BPM en 10 minutos: 0 muestras.
  - Filtro: el −3 dB cae en el corte con un error de 0,0000 % (el informe dice < 0,01 %).
- **Determinismo.** Guion de 19 comandos repartidos al azar: cuenta previa, metrónomo, latencia de 517, cambio de tempo, filtro, primera toma libre, sobregrabación, disco, reverso, deshacer, rehacer, pausa, parar y APAGADO. En bloques de 1, 96, 128 y 384 muestras salen los mismos bytes, en la salida y en las capas.
- **Sobregrabación a tempos extremos**, a 40 y a 240 BPM sobre una capa nativa de 90, con un tono de 0,3: la vuelta siguiente reproduce la entrada con un error de 0,0042 y de < 10⁻⁵. El remuestreador reparte bien las muestras enteras en los dos sentidos.
- **Estados límite que funcionan:**
  - una toma de 60 s a 40 BPM con ajuste da 40 pulsos a 40 BPM, y la toma libre que la sigue en otra capa se acepta;
  - el reposo en la cuenta previa con el transporte parado cancela la toma y deja silencio;
  - una primera toma parada con latencia de 4000 muestras (la rama `setTempo`, sin cobertura en la suite) da una capa de 4 pulsos a 115,2 BPM, que reproduce sin clics;
  - `record: too-long` se rechaza bien.
- **Rendimiento.**
  - Banco del informe, sin cobertura: 237×, 240× y 240×.
  - Peor caso: 4 capas con reverso alternado cada 5 ms en dos de ellas (voces siempre cruzándose), filtros, metrónomo, una sobregrabación de 4 compases y el disco moviéndose. Da 150× a 44,1 kHz y 149× a 48 kHz, por encima de los 100× de §5.
- **Tamaño.** `esbuild --minify` de `loop-core.ts` da 32.702 B (10,8 kB con gzip), como dice el informe. Quedan 7,3 kB para el adaptador del worklet en la fase 2.
- **Memoria.**
  - El test del informe da 0,0 KiB en 6 de 6 ejecuciones.
  - Los caminos raros dan unos KiB (#13).
  - Peor caso real: el núcleo cuenta 195,89 MB, frente a ~192 MB de `ArrayBuffer` vivos. La contabilidad es fiel, salvo la carga (#9).
  - Estados: 299 o 300 en 10 s a 44,1, 48 y 96 kHz (≤ 30 por segundo).

**Revisado a mano y correcto.**
- Hermite y su espejo en reverso, también en la vuelta. La forma de 4 puntos es simétrica, así que el reverso es exacto.
- El limitador: con ventana D + 1, cada término de la media es ≤ la ganancia necesaria de la muestra que sale, así que |y| ≤ techo, y la saturación de seguridad recoge el redondeo.
- El SVF TPT con *prewarping*.
- `frameAtBeat`, que es exacto con la misma fórmula que `beatAt`.
- El reparto de posiciones enteras del remuestreador (intervalos semiabiertos que no se solapan).
- La alineación por latencia: ida y vuelta más la anticipación del limitador.
- La validación campo a campo de `handle()`.
- `exportState` y `renderOffline`, que da los mismos bytes que el directo (test).
- Sobre una sesión con `NaN`: el núcleo no mira las muestras, por diseño, y un `NaN` en una capa pone a 0 todo el bus en esa muestra (960 muestras en 0,5 s con un `NaN` cada 100). La validación de la fase 2, que ya está anotada en los pendientes, es imprescindible.

**Arquitectura.**
- `audio/core` no importa nada de fuera, y `tsconfig.pure.json` no lleva DOM.
- `eslint --stdin` sobre `src/app/audio/core/x.ts` rechaza Angular, `audio/engine`, `AudioContext`, `window`, `Math.random`, `new globalThis.AudioContext()` y las reservas en `process*`/`render*`, con el límite que cuenta el #13.
- El protocolo va en la versión 2, sin `any`, y los comandos se validan en el núcleo.
- `LoopCore` es el mismo en el directo, en `renderOffline` y en los tests.

**Higiene.**
- 9 commits en español, con prefijos de la lista; el único grande es el del #12.
- Sin dependencias nuevas: `package.json` solo cambia scripts.
- No hay `console` en el código, salvo el banco, que una regla permite, ni `TODO`.
- `test-harness.ts` vive en `audio/core` y cuenta en la cobertura; es aceptable.

**Desviaciones (§4) y decisiones (§5).**
- Razonables:
  - cruzar la junta al grabar, que además deja el reverso como espejo exacto;
  - los fundidos de 10 ms;
  - el perfil de muestreo en lugar de `heapUsed`;
  - los campos `#privados` para el tamaño;
  - el banco aparte;
  - la duración del bucle igual a la de la capa más larga, y la toma libre que sigue;
  - escribir donde suena la cabeza;
  - quitar el reverso a una toma en una capa vacía;
  - descartar las tomas de menos de 0,25 s;
  - que pausar cierre la toma y que el reposo la cancele;
  - deshacer solo el contenido;
  - el volumen después del limitador;
  - el tempo sin suavizar: la posición es continua, no hay saltos de amplitud y cumple las mediciones;
  - los avisos en objetos reservados;
  - validar las muestras fuera del hilo de audio.
- Con reparos:
  - «repetir la capa si la toma es más larga» (#1);
  - la cola que se adelanta al grabar, sin documentar (#7);
  - la continua del disco (#5);
  - el metrónomo antes del limitador (#15).
- Las tres propuestas del §10 son razonables. La 1 debería incluir lo que se decida en el #4.

**Estado del repo.** `git status` queda limpio, salvo este archivo. Solo se han regenerado archivos ignorados: `dist/`, `public/audio/`, `worklet-url.generated.ts` y `test-results/`.
