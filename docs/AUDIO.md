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
| Cambios de contenido | Sonido en cola, reverso, toma, deshacer, rehacer, agarrar y soltar el disco: siempre un fundido cruzado entre voces (hasta 4 por capa). |
| Mezcla | Nivel, silencio y panorama de igual potencia, con suavizado de un polo de 10 ms; la llegada al objetivo se decide muestra a muestra. |
| Filtro | SVF con integradores trapezoidales (Simper), paso bajo de Butterworth: −3,01 dB en el corte. El brazo va de 18 kHz a 150 Hz en escala exponencial y el corte se recalcula cada 32 muestras. En el extremo exterior, *bypass* transparente al bit, con fundido de entrada y salida. |
| Limitador | Estéreo, con 1 ms de anticipación: mínimo deslizante de la ganancia necesaria, recuperación de 80 ms y media móvil. Garantiza el techo de −0,3 dBFS; por debajo del codo (−0,48 dBFS) es transparente al bit. Encima, saturación suave de seguridad. |
| Metrónomo | Clics sintetizados una vez en tablas, en la muestra exacta del pulso; solo en directo (nunca se graban ni se exportan). |
| Cola | En marcha, un cambio de sonido entra en la muestra exacta del siguiente límite de compás, con la fase común. En pausa, al momento. Pausar aplica la cola y deshacer la cancela. |
| Disco | Mantener congela la cabeza de la capa; arrastrar la mueve (1 vuelta = 1 compás) con un suavizado de 10 ms; soltar vuelve a la línea de tiempo con un fundido de 15 ms. Con el transporte parado, el disco también suena. |
| Deshacer | 3 estados por capa más el actual. El PCM confirmado no cambia nunca: moverse por el historial no copia nada. |

### Fundidos y criterio de clics
El salto máximo entre muestras de un fundido de coseno alzado de N muestras, para un cambio de amplitud Δ, es π/2 · Δ / N. A 48 kHz:

| Fundido | Duración | Muestras | Salto máximo con Δ = 1 |
|---|---|---|---|
| Cambio de contenido | 10 ms | 480 | 0,0033 |
| Reproducir, pausar y parar | 10 ms | 480 | 0,0033 |
| Soltar el disco | 15 ms | 720 | 0,0022 |
| Junta de una toma | 5 ms | 240 | 0,0065 |

Todos quedan por debajo del margen de 0,01 que da el criterio de §5 («salto ≤ el de la propia señal + 0,01»). Las tablas se muestrean en el centro de cada muestra: el cambio empieza en su muestra exacta y la última muestra del fundido ya es el valor final.

## 3. Grabación
- **Alineación.** La entrada que llega en la muestra `f` se oyó y se tocó en `f − latencia` de la línea de tiempo. Esa latencia es la de ida y vuelta (la que se le indique al núcleo) más la anticipación del limitador. La muestra `k` de la toma es la entrada que llega `latencia` muestras después de que el transporte pase por `inicio + k`.
- **Dónde se escribe.** Donde la cabeza de lectura de la capa hará sonar esa muestra, también en reverso: «lo que oíste más lo que tocaste».
  - Si la capa va a otro tempo que su tempo nativo (sobregrabar algo grabado a otra velocidad), la entrada se remuestrea en flujo con Hermite.
  - Si hay que comprimir, va antes por un antialias de 4 polos. El retraso del antialias se compensa al escribir.
- **Junta.** La toma entra con un fundido de 5 ms. Al cerrarse, se graban 5 ms más, que se funden hacia fuera:
  - si la toma da la vuelta completa al bucle, ese final se cruza con el principio, y la junta no hace clic aunque la señal no sea periódica;
  - si se cierra antes, el sonido se apaga sin cortarse.
- **Duración del bucle de la sesión:** la de la capa más larga con contenido (o en cola).
  - **Primera toma libre** (sesión vacía): se cierra al pulsar o a los 60 s y fija esa duración. Con la opción activa, el tempo se ajusta a un número entero de compases dentro de 40–240, y la toma empieza en el pulso 0. Una toma de menos de 0,25 s se descarta.
  - **Toma libre con otras capas:** sigue la duración del bucle. Empieza al momento, se escribe alineada con la línea de tiempo y se cierra sola al completar la vuelta (o antes, al pulsar).
  - **Toma fija** de 1, 2 o 4 compases: empieza en el siguiente límite de compás, o tras una cuenta previa de al menos 4 pulsos que acaba en un límite de compás. Si se cierra antes, el resto queda en silencio.
- **Sobregrabar** suma la toma a una copia de la capa. Si la toma es más larga, la capa se repite hasta su duración. Una capa de la biblioteca pasa a «grabación propia», y su sonido sigue en el deshacer.
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

## 5. El hilo de audio no reserva memoria
- **Por convención y con lint.** En `audio/core/` y `audio/worklet/`, los métodos `process*` y `render*` no pueden usar:
  - `new`, literales de objeto o de array, cierres, plantillas ni `...`;
  - métodos que copian (`slice`, `subarray`…);
  - `throw`, `await` ni `console`.
  
  Lo que reserva (los búferes de una toma, los contenidos de una sesión cargada) se hace en `handle()`. Los avisos van en objetos ya reservados.
- **En ejecución.** El perfil de muestreo del heap de V8 registra 0 bytes reservados bajo `LoopCore.process` en un minuto simulado con todo en marcha: 4 capas con filtro y *varispeed*, metrónomo, una sobregrabación que se confirma, un cambio en cola que entra en un compás y el disco moviéndose a saltos.
  - En V8, un número con decimales que cruza una llamada no integrada se empaqueta en el heap. Por eso los valores por tramo (pulso, objetivo del disco, ganancias) se pasan en campos y no en argumentos.

## 6. Cifras medidas (fase 1)
| Medida | Valor | Cómo |
|---|---|---|
| Rendimiento | 230–243× tiempo real (3 ejecuciones) | 4 capas con *varispeed*, filtro, panorama y limitador; 60 s a 48 kHz en bloques de 128; Node 24 en el PC de Iván (`npm run test:bench`) |
| Memoria reservada por `process()` | 0 KiB en 60 s simulados | Perfil de muestreo del heap de V8 (`loop-core.memory.spec.ts`) |
| Deriva | 0 (±1 muestra tras 10 min a 97 BPM y 44,1 kHz) | `loop-core.playback.spec.ts` |
| Cola exacta | En la muestra `ceil(compás × 60 × fs / bpm)` | 48 kHz/90 BPM y 44,1 kHz/97 BPM |
| *Varispeed* | Al doble de tempo, el bucle dura la mitad ±1 muestra | 3 combinaciones de frecuencia y tempo |
| Filtro | −3 dB exactamente en el corte (error < 0,01 % entre 150 Hz y 15 kHz; el criterio es ±10 %) | Bisección de la respuesta en régimen permanente, a 44,1 y 48 kHz |
| Limitador | Pico de −0,34 dBFS con 4 capas a tope en fase (techo −0,3) | `limiter.spec.ts` y `loop-core.playback.spec.ts` |
| Tamaño | `LoopCore` minificado: 32,7 kB (presupuesto del worklet: 40 kB) | esbuild con `--minify`, como el worklet |
