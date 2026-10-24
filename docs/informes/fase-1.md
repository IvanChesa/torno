# Informe: Fase 1 (núcleo de audio en TS puro)

- **Rama:** `fase-1-nucleo-audio`
- **Fecha:** 2026-10-24
- **Estado:** en curso

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

_(al terminar)_
