# Revisión: Fase 3
Veredicto: CAMBIOS NECESARIOS (sin Bloqueantes: un Importante del filtro contra el *aliasing* y varios Menores)

La fase está muy bien resuelta:
- la colección es determinista, sin junta y con los niveles por papel exactos (RMS clavado en su objetivo a 8, 22,05, 44,1, 48 y 96 kHz, sin NaN);
- el diseño del Chebyshev II es correcto: prototipo, predeformación, SVF TPT con salida de muesca y retardo de grupo en continua (he rehecho las cuentas de la bilineal);
- el anillo de lo filtrado da bien la vuelta al bucle y al resincronizar, también en reverso;
- `process()` no reserva memoria;
- la primera reproducción y el tempo por pulsaciones están bien cubiertos por tests unitarios y e2e.

El problema real está en un caso que no prueba ningún test: **un salto de tempo grande con el filtro encendido hace un clic**.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante | `src/app/audio/core/voice.ts:155` y `:280`; `antialias.ts:86-118` | **Clic al cambiar el tempo de golpe con el filtro encendido.** Cuando el tempo salta y la nueva velocidad sigue por encima del umbral, `#updateAntialias` rediseña el filtro de una vez. Eso provoca dos cosas en la misma muestra: (a) el retardo de grupo que se adelanta (`filter.delay`) salta varias muestras, de modo que la lectura filtrada da un salto de fase; (b) los 10 polos cambian de golpe y el TPT, aunque no explota, deja un transitorio que oscila cerca del nuevo corte (en la salida se ve un serrucho: −0,341, −0,282, −0,307, −0,272…). Medido con `Harness`, el seno de `toneLoop`, 1 s de asentamiento y el criterio de §5 (`maxJump` ≤ salto propio + 0,01): **44,1 kHz, bucle de 90 BPM, 240 → 110: 0,174 frente a 0,144 (falla)**; 240 → 106: 0,190; 200 → 120 y 150 → 100 con 1 kHz: ×1,23 sobre el límite. **48 kHz**: 160 → 110 con 1 kHz, ×1,28; 180 → 120 con 2 kHz, ×1,17; grabación de 40 BPM 240 → 52: 0,347 frente a 0,288, también en reverso. A 96 kHz no falla ningún caso. Sin el filtro, un cambio de velocidad no rompe la forma de onda: el clic es nuevo de esta fase. Los saltos de ≥ 40 BPM son lo normal con MARCAR TEMPO (de 200 a 120 en dos pulsaciones), con Inicio/Fin en un dial que se quede por encima del umbral o al arrastrar deprisa. El test «sin clics al pasar el umbral» va de 1 en 1 BPM y no lo ve. (He descartado que el anillo de 8 muestras se desborde: con un anillo de 32, las cifras son idénticas.) | Que el rediseño no sea instantáneo. Opciones: (1) un fundido de 10 ms entre la lectura con el filtro viejo y otra con el filtro nuevo (una segunda instancia de `AntialiasFilter` reservada de antemano, arrancada con su *preroll*), igual que el encendido; (2) suavizar la velocidad del diseño por bloques (≤ ~2 % por bloque) e interpolar `delay` dentro del bloque, para que nunca salte más de una fracción de muestra. Añadir a `loop-core.antialias.spec.ts` los saltos de arriba (44,1 kHz 240 → 110; 48 kHz 160 → 110 y 180 → 120; 40 BPM 240 → 52, también en reverso) con el criterio de §5, y comprobar que fallan antes del arreglo. |
| 2 | Menor | `docs/informes/fase-3.md` §5 («2–6 muestras») | El retardo de grupo en continua no va de 2 a 6 muestras. Medido con `design()`: a 48 kHz, 0,10 (en el encendido) · 1,12 (1,5×) · 3,74 (2,67×) · 9,72 (6×); a 44,1 kHz, de 0,10 a 10,35; a 96 kHz, de 0,10 a 6,97. Es justo la magnitud del salto del #1. | Corregir la cifra en el informe (y en el comentario de `AntialiasFilter.delay` si se cita). |
| 3 | Menor | `scripts/bench-synth.mjs:33-41` | **El banco mide un caso más favorable que el real.** El criterio es la mejor de 3 pasadas en caliente, pero el worker renderiza cada sonido una sola vez (hay caché), es decir, en frío. En mi pasada (PC de Iván, sin otra carga aparente): en frío, ALFAR 61,2 ms, HORNO 50,7 y OLIVO 50,2 (> 50); en caliente, todos ≤ 33,5. Fuera del banco, con un render seguido de cada bucle, BRASA dio 48,2 ms. Y a 96 kHz (D22: la frecuencia del dispositivo) el peor es de 78 ms. ALFAR, además, es el primer render de un worker recién creado: el que espera la primera reproducción. | Medir también el caso real (cada bucle una vez, en el orden del menú y en un proceso nuevo) e informar de las dos cifras. Si el criterio se mide en caliente, decirlo en el informe (§2) y proponerlo en §10. Anotar la cifra a 96 kHz. |
| 4 | Menor | `src/app/state/session.store.ts:463-465`, `src/app/instrument/instrument.ts:319-330` | **Carrera en la primera reproducción con doble toque.** En la primera visita, el primer toque de REPRODUCIR carga el motor, crea el worker y renderiza ALFAR en frío (cientos de ms en un móvil). Mientras tanto, `status.transport` sigue en `stopped` y `firstPlay` ya es `false`, así que un segundo toque (el típico «no ha funcionado») emite un `play` normal. Ese `play` va por delante, porque el `setSound` de ALFAR espera al render. El transporte arranca vacío y ALFAR llega en marcha: **entra en cola en el compás siguiente, y suenan 2,7 s de silencio**, justo lo que la tarea quería evitar. Con tres toques (reproducir, reproducir, pausa) dentro de ese tiempo, el `.then(() => play)` vuelve a poner el transporte en marcha después de que el usuario lo haya pausado. | En el store, una marca de «arrancando con sonido» hasta que se resuelva `setSound`: mientras esté puesta, un `play` se absorbe y una `pause` cancela el `play` pendiente. Un test del store con el `setSound` retenido. |
| 5 | Menor | `src/app/audio/synth/library.spec.ts:153-162` | **El test «sin junta» es débil justo donde más importa.** Compara la segunda diferencia de la junta con 1,5 × la mayor de los 5 ms de alrededor. En las baterías, el bombo cae en el pulso 0 (con el *humanize*, a veces unas muestras antes, ya al final del bucle), así que «lo de alrededor» incluye el ataque del bombo y el umbral queda enorme. Una cola de eco o de reverberación cortada a −30 dB pasaría. El control negativo (un seno cortado a 0,5 de amplitud) solo prueba el caso grosero. | Un test más directo de la propiedad: renderizar la receta en un búfer lineal de 3 vueltas, sin envolver, y comprobar que la vuelta central coincide con el bucle envuelto (o que la diferencia es < −80 dB en las colas). O al menos un control negativo con un eco truncado sobre una batería. |
| 6 | Menor | `docs/informes/img/fase-3/instrumento-recuperar-confirmar-movil.png` (pantalla) | En el móvil, «CAPA 1 · BATERÍA · ALFAR» parte la línea delante del separador: la segunda línea empieza por «· ALFAR». Con nombres más largos (ALMENDRO, ACEQUIA) pasará siempre. | Espacio sin ruptura delante del «·» (o romper detrás del separador) en las líneas de la pantalla. |
| 7 | Menor | `e2e/sounds.spec.ts:43` | El e2e de la cola comprueba que entra en un límite de compás, pero no que sea el **siguiente**: si entrara un compás tarde, el test pasaría igual. | Guardar la muestra del transporte al confirmar y exigir `applied.value === (floor(confirmada / bar) + 1) × bar`. |
| 8 | Sugerencia | `src/app/audio/synth/library.spec.ts:41-54` | El hash `GOLDEN` fija los bytes en V8. `Math.sin`, `Math.exp` y `**` no están obligados a redondear igual en JavaScriptCore o SpiderMonkey, así que en Safari los bytes pueden variar en el último bit. No afecta a nada (el `.torno` lleva el PCM), pero el informe dice «determinista» a secas. | Precisar «determinista en el mismo motor de JS» en `docs/AUDIO.md` o en el informe. |
| 9 | Sugerencia | `src/app/state/session.store.ts` (`preload`) | El primer sonido de la primera reproducción incluye crear el worker de síntesis y renderizar ALFAR en frío, y no se mide (los 7–20 ms del informe son con el sonido ya cargado). | Al precargar el motor (puntero o foco cerca del instrumento), pedir ya el render de ALFAR a la caché, y medir en el e2e el tiempo del toque al primer sonido en la primera reproducción. |

## Qué he comprobado
- **`npm run check`** en `fase-3-sonidos`: **verde** (salida 0).
  - lint;
  - 423 tests de Node y 48 de Angular;
  - build;
  - presupuestos: `/` 301,5 kB · desbloqueo 1,9 kB · motor 21,0 kB · worker de síntesis 17,4 kB · worker de exportación 41,6 kB · worklet 40,6 kB · fuentes 144,1 kB, sin avisos.
- **`npm run test:bench`:**
  - LoopCore 236× (97 BPM) · 65× a 240 BPM sobre bucles de 90 · 35× en el peor caso (40 → 240);
  - copia por tramos: peor bloque 0,255 ms;
  - síntesis en caliente ≤ 33,5 ms; en frío, hasta 61,2 ms (#3).
- **`npx playwright test e2e/sounds.spec.ts --project=dev`:** 3/3.
  - La cola entró en la muestra 128 000 (1 compás exacto).
  - El tempo marcado con 4 pulsaciones cada 500 ms dio 113 BPM (dentro del rango del test, 100–122).
- **Experimentos propios** (scripts en el *scratchpad*, empaquetados con el `esbuild` del proyecto; ningún archivo del repo tocado):
  - el retardo de grupo según la velocidad y la frecuencia de muestreo (#2);
  - 27 saltos de tempo a 44,1, 48 y 96 kHz, con bucles de 90, 60 y 40 BPM y en reverso (#1). Repetidos con el anillo a 32 muestras: mismas cifras, así que el clic no es un desbordamiento del anillo;
  - los 12 bucles a 8 000, 22 050, 44 100, 48 000 y 96 000 Hz: sin NaN ni Infinity, RMS en su objetivo, picos ≤ −1,1 dBFS (CIERZO cambia de pico según la frecuencia: −2,2 a 48 kHz y −5 a −6 en las demás, por el ruido; siempre dentro del techo).
- **Código leído:**
  - `antialias.ts`: prototipo, bilineal, SVF TPT y fórmula del retardo, comprobados a mano;
  - `voice.ts`: anillo, `#fed` al dar la vuelta y en `sync()`, reverso, histéresis, fundido entre lecturas y *preroll*;
  - `channel.ts` y `loop-core.ts`: `syncTimeline` cada 128 muestras o al mover la línea de tiempo; el tempo cambia de golpe en `transport.setTempo`;
  - `audio/synth/*`: búfer circular, eco en dos vueltas (con realimentación ≤ 0,38 y ~10 repeticiones por bucle, el residuo queda < −80 dB), `removeDc` y `levelLoop`;
  - `instrument.ts`, `sounds.ts`, `menu.ts`, `display.ts`, `session.store.ts` y los tests `first-play-tap.spec.ts`, `library.spec.ts` y `loop-core.antialias.spec.ts`.
- **`process()`:** las rutas nuevas no crean arrays ni cierres. `design()` escribe en arrays reservados y el *mix* usa `#mixGains`, reservado en el constructor. El test de memoria cubre 10 s a 200–240 BPM con el filtro encendiéndose y apagándose: 0,0 KiB.
- **Capturas:**
  - `instrumento-sonido-*` (ALFAR, HORNO, ADOBE, APAGADO), `marcar-tempo-*` («MARCAR TEMPO 90 BPM»), `en-cola-*`, `recuperar-dos-*` y `recuperar-confirmar-*`: legibles, coherentes con «Barro» y con los textos esperados;
  - solo el corte de línea del #6.
- **Higiene:**
  - textos nuevos en `instrument.content.ts`, que lleva `reviewed: false`;
  - no quedan `prueba-*`, `test-loop` ni `tone` en `src`, `e2e` ni `scripts`;
  - ninguna mención al original;
  - sin dependencias nuevas (`package.json` solo añade `demo:sounds` y el banco de la síntesis).
- **Criterios de aceptación:** todos demostrados en el informe con cifras, salvo la escucha de Iván (⏳, apuntada en `PENDIENTES.md`, como dice el plan). Matices:
  - el render ≤ 50 ms se cumple en caliente, no en frío (#3);
  - el «sin clics» del filtro solo se ha demostrado con pasos de 1 BPM (#1).
