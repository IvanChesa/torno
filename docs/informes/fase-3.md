# Informe: Fase 3 (biblioteca de sonidos y menú completo)

- **Rama:** `fase-3-sonidos`
- **Fecha:** 2026-10-26
- **Estado:** revisado; correcciones aplicadas

## 0. Plan de la fase

Antes de empezar se aplicó la revisión del bloque A en `main` (`docs/revisiones/bloque-A.md`, «Respuesta a la revisión»): banco fuera de `check`, worklet y workers a 60 kB, CI en `ubuntu-24.04` y autoguardado con dos huecos.

**Punto de partida.** El menú SONIDO de la fase 2 ya recorre sin cambiar el audio, confirma, pone EN COLA con la capa destino, apaga, pide confirmación al sustituir una grabación («Cancelar» primero) y el núcleo cancela la cola al deshacer. Falta la colección, la primera reproducción, el tempo por pulsaciones, el *aliasing* del *varispeed* y la escucha.

**Entregas:**

- **3.a · Síntesis y colección** (`audio/synth/`, TS puro y determinista):
  - piezas: azar con semilla (mulberry32), osciladores PolyBLEP (sierra, pulso, triángulo y seno), envolventes ADSR, filtro SVF con corte modulable, FM de dos operadores, batería sintética (bombo con barrido, caja, charles de 6 osciladores, palmas, aro, tom, maraca), eco y saturación suave;
  - un **búfer circular** del tamaño del bucle: las colas de las notas y de los efectos que pasan del final entran por el principio, y los efectos con memoria (eco, filtros continuos) se calculan con una vuelta previa. Así los 12 bucles **no tienen junta**;
  - **12 bucles** en Re menor, 90 BPM y 2 compases, con una progresión propia (Rem9 · Si♭maj9 · Solm9 · La7sus4→La7, dos pulsos cada acorde) y nombres propios en español (tierra, alfarería y Bajo Cinca): BATERÍA ALFAR, HORNO y ADOBE; BAJO RAÍZ, CINCA y SURCO; ACORDES OLIVO, VEGA y ALMENDRO; TEXTURA CIERZO, ACEQUIA y BRASA;
  - **equilibrio por papel**: RMS objetivo por categoría y pico ≤ −1 dBFS, sin continua (se resta la media de un bucle periódico), documentado en `docs/AUDIO.md`;
  - el worker de síntesis renderiza la colección (la caché en memoria ya está en el motor) y el catálogo del menú (`instrument/sounds.ts`) la lista; un test comprueba que coinciden;
  - tests: determinismo (hash del PCM a 44,1 y 48 kHz), duración exacta, picos y RMS en rango, sin continua, sin junta, fundamentales de los bajos en la tonalidad (FFT) y tiempo de render ≤ 50 ms (en el banco, fuera de `check`);
  - `npm run demo:sounds`: los 12 bucles y 3 combinaciones (mezcla del propio núcleo) en WAV en `demo-sounds/` (ignorada).
- **3.b · Sin *aliasing* al acelerar** (`audio/core/voice.ts`):
  - cuando el *varispeed* lee más deprisa que el tempo nativo y las imágenes pueden caer en la banda audible (por encima de `2 − 40000/sr`, 1,17× a 48 kHz), la voz pasa la señal por un **paso bajo de Chebyshev II de orden 10 a la frecuencia del propio PCM, antes de interpolar**. El corte sigue a la velocidad (lo que plegaría por debajo de 20 kHz queda ≥ 60 dB abajo);
  - el paso entre leer con y sin filtro es un fundido de 10 ms dentro de la voz (sin clics); con el disco no se filtra;
  - sin reservas en `process()`: coeficientes recalculados en arrays ya reservados solo cuando cambia la velocidad;
  - tests: tono alto a 240 BPM sin imágenes por encima de −60 dB, tono bajo intacto, sin clics al cruzar el umbral y CPU con el filtro activo (banco).
- **3.c · Menú e interacción:**
  - **primera reproducción**: si la sesión está vacía, la primera vez que se pulsa reproducir la capa 1 arranca con la batería ALFAR (sin compás vacío: reproducir espera a que el sonido esté en la capa) y queda elegida la capa 2;
  - **tempo por pulsaciones** en BUCLE: pulsar el dial sobre «TEMPO A PULSOS» marca pulsos; con dos o más, el tempo es la media de los últimos intervalos (se reinicia tras 2 s sin pulsar);
  - e2e: la cola entra exactamente en el compás siguiente (aviso del núcleo con la muestra del transporte, múltiplo exacto de un compás) y deshacer la cancela; primera reproducción; tempo por pulsaciones;
  - capturas del menú SONIDO con la colección (escritorio y móvil).

**Riesgos:** que los bucles no gusten (son datos: se ajustan tras la escucha de Iván); el coste del filtro a tempos muy altos con grabaciones lentas (40 → 240 BPM, 6×: se mide y se documenta); el desbloqueo inicial está a 1,9 kB de 2 (no se toca el bundle inicial).

**Skills consultadas:** ninguna (no hay skill de audio; manda PLAN §4.3–§4.4).

## 1. Resumen
Torno ya tiene su colección: 12 bucles propios sintetizados en TS puro, deterministas y sin junta, en Re menor a 90 BPM, con nombres de la tierra (ALFAR, HORNO, ADOBE · RAÍZ, CINCA, SURCO · OLIVO, VEGA, ALMENDRO · CIERZO, ACEQUIA, BRASA). El *varispeed* ya no pliega frecuencias al acelerar: por encima del umbral, la voz filtra el PCM antes de interpolar con un Chebyshev II que sigue a la velocidad, sin desalinear la capa ni hacer clics. La primera reproducción arranca con ALFAR y deja elegida la capa 2, y el tempo se puede marcar con pulsaciones. `npm run demo:sounds` deja los WAV para que Iván los escuche.

## 2. Criterios de aceptación

| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| Tests: determinismo (hash del PCM) | ✅ | `library.spec.ts`: dos renders iguales byte a byte a 48 kHz y hash FNV-1a fijado por bucle (`GOLDEN`). |
| Duración exacta (2 compases a 90 BPM) | ✅ | 256 000 muestras a 48 kHz y 235 200 a 44,1 kHz en los 12 bucles. |
| Picos y RMS en rango | ✅ | Picos de −1,1 (ADOBE) a −14,1 dBFS (BRASA), todos ≤ −1 dBFS. RMS en su objetivo (batería −16, bajo −17, acordes −19, textura −23); ADOBE −17,3 (manda el pico; dentro del margen de −3 dB). A 44,1 y 48 kHz. |
| Sin continua (DC) | ✅ | Media < −100 dBFS en todos. |
| Fundamentales de los bajos en la tonalidad (FFT) | ✅ | FFT nota a nota de las 51 notas de las tres líneas: el pico más fuerte es la nota escrita, con la mayor desviación en 0,1 (RAÍZ), 2,2 (CINCA) y 15,2 cents (SURCO, por el portamento); todas en Re menor (más Do♯). El test encontró un error real: en CINCA, el seno de refuerzo iba en contrafase con la fundamental de la sierra y la anulaba. |
| Render ≤ 50 ms por bucle en escritorio | ✅ (en caliente) | `node scripts/bench-synth.mjs` (código empaquetado como el worker; en `npm run test:bench`), a 48 kHz: en caliente, 5,2–32,2 ms; en frío (lo que hace el worker, que renderiza cada sonido una vez), 7–43 ms en esta pasada, y hasta 61 ms en la de la revisión. A 96 kHz, el doble de muestras: hasta 93 ms en caliente. Se renderiza una vez por sonido, en el worker, sin bloquear la interfaz ni el audio. Ver §10, propuesta 3. |
| e2e: la cola entra exactamente en el compás siguiente y deshacer la cancela | ✅ | `e2e/sounds.spec.ts` (Chromium dev y estático): el aviso `sound-applied` llega con la muestra 128 000 del transporte (1 compás exacto a 48 kHz); un segundo cambio en cola se cancela con DESHACER y, pasado más de un compás, no entra nada. |
| Iván ha escuchado los sonidos | ⏳ | Apuntado en `PENDIENTES.md` (al final del bloque; no bloquea). |
| Tarea 7: a 240 BPM con un tono alto, sin imágenes por encima de −60 dB; los 12 bucles, sin junta | ✅ | `loop-core.antialias.spec.ts`: tono de 12 kHz a 240 BPM, lo más alto a −68,7 dB (48 kHz) y −72,9 dB (44,1 kHz). Control: con la lectura de Hermite directa, la imagen supera −20 dB. Sin junta: la segunda diferencia que cruza la junta frente a la de los 5 ms de alrededor, con control negativo (un seno cortado a media vuelta falla). |

## 3. Tareas del plan
| Tarea | Estado | Notas |
|---|---|---|
| 3.1 Piezas de síntesis | hecha | `random`, `oscillators` (PolyBLEP: 21–27 dB menos de plegado que la sierra ingenua), `envelope`, `filter`, `voices` (FM), `drums`, `effects`, `loop-buffer`. |
| 3.2 Colección propia | hecha | `library.ts`; progresión en `music.ts`. |
| 3.3 Equilibrio por papel | hecha | `LEVELS` y techo de −1,05 dBFS; documentado en `docs/AUDIO.md` §8. |
| 3.4 Render en `synth.worker` con caché | hecha | El worker renderiza la colección; la caché en memoria ya estaba en el motor (fase 2). |
| 3.5 Menú SONIDO completo | hecha | Casi todo venía de la fase 2; ahora con los 12 nombres y la primera reproducción. |
| 3.6 Tempo por pulsaciones | hecha | BUCLE → MARCAR TEMPO. |
| 3.7 Sin aliasing al acelerar | hecha | `antialias.ts` y `voice.ts`. |
| 3.8 `npm run demo:sounds` | hecha | 12 WAV y 3 combinaciones en `demo-sounds/` (ignorada). |

## 4. Desviaciones del plan y motivo
- **Ids de la colección:** la revisión del bloque A decía «los mismos ids por categoría». Lo he interpretado como la misma estructura (tres por categoría; el primero de cada una es el que eligen los e2e), con ids nuevos (`alfar`, `raiz`…). Un `.torno` antiguo con `prueba-*` se sigue cargando (lleva el PCM); la pantalla enseña el id.
- **Nombre en el menú:** «MARCAR TEMPO» en lugar de «TEMPO A PULSOS» (§0 de este informe): más corto y claro.
- **El momento de cada pulsación** lo pone el store (`performance.now()`) al recibir la entrada: con puntero es el de soltar; con teclado, el de pulsar.
- **Banco de la síntesis como script** (`scripts/bench-synth.mjs`, dentro de `test:bench`): en Vitest cada importación pasa por un objeto y los bucles calientes van hasta 2,5 veces más lentos que en el worker real.
- **Saturación:** aproximación de Padé de tanh (≤ 2,5 % de diferencia), varias veces más rápida.
- **`audio/core/analysis.ts`:** FFT y picos para los tests del núcleo y de la síntesis. No entra en ningún bundle (ni el worklet ni los workers lo importan).

## 5. Decisiones técnicas nuevas
- **Filtro antialias IIR (Chebyshev II de orden 10) frente a una interpolación de sinc de banda limitada:** el IIR cuesta 5 secciones por muestra del PCM y se rediseña en microsegundos; la sinc tendría fase lineal, pero pediría ~140 coeficientes por muestra a 6×. La fase no lineal se compensa en los graves leyendo adelantado el retardo de grupo en continua (de 0,1 muestras al encenderse a 10,4 a 6×, según la velocidad y la frecuencia de muestreo).
- **Secciones TPT** (SVF con salida de muesca) en lugar de formas directas: cambiar el corte con el filtro sonando no deja transitorios (medido al girar el tempo cerca del umbral: de 2,07× a 1,02× el salto de la propia señal).
- **Umbral físico, no el tempo nativo:** el filtro solo se enciende cuando las imágenes podrían caer por debajo de 20 kHz (`(sr − 20 kHz)/(sr/2)`), con 2 % de histéresis y fundido de 10 ms. A 97 BPM (el banco de §5) no se filtra.
- **El diseño sigue a la velocidad a pasos** (≤ 2 % por bloque, con el retardo interpolado dentro del bloque): un salto de tempo grande rediseñado de golpe dejaba un transitorio (revisión, #1). De 240 a 110 BPM tarda ≈ 0,1 s; si se sube de golpe, durante ese tiempo el corte va algo por encima de lo necesario.
- **Primera reproducción consumible:** elegir un sonido, grabar o cargar una sesión también la consumen, para que no pise lo que el usuario acaba de hacer aunque el estado del audio llegue con retraso.
- **Pad de VEGA:** las notas de un acorde comparten envolvente, así que se filtra la suma una sola vez.

## 6. Salida de los checks
```
npm run check  (72 s, PC de Iván)
lint: All files pass linting.
test:node: 423 passed · sentencias 98,4 % · ramas 94,98 %
test:ng: 48 passed
check-bundles:
✔ JS inicial de /                     301.5 kB  (aviso > 330 kB)
✔ Desbloqueo de audio en el inicial     1.9 kB  (error > 2 kB)
✔ Motor de audio (engine.ts)           21.0 kB
✔ Worker synth.worker.ts               17.4 kB  (antes 2,5)
✔ Worker export.worker.ts              41.6 kB  (antes 38,6)
✔ Worklet                              40.6 kB  (antes 37,7)
✔ Fuentes                             144.1 kB
npm run e2e: 89 passed (1,0 min)
npm run test:bench: LoopCore 237× (97 BPM) · 65× a 240 BPM · 36× en el peor caso (6×) ·
  copia por tramos, peor bloque 0,23 ms · síntesis ≤ 33 ms en caliente
```
**Audio:** primer sonido tras pulsar 7–20 ms; imagen de un tono de 12 kHz a 240 BPM a −68,7 dB; error de fase a 240 BPM < 0,002 (sobre 0,35 de amplitud); `process()` reserva 0,0 KiB en 60 s simulados, con 10 s a 200–240 BPM.

## 7. Capturas
`docs/informes/img/fase-3/`, escritorio y móvil. Nuevas en esta fase:
- `instrumento-sonido-*`: SONIDO → BATERÍA, con ALFAR, HORNO, ADOBE y APAGADO.
- `instrumento-marcar-tempo-*`: BUCLE → MARCAR TEMPO, «90 BPM».
- `instrumento-en-cola-*`: ALFAR sonando y el bajo de la capa 2 EN COLA.
- `instrumento-recuperar-dos-*` y `instrumento-recuperar-confirmar-*`: el panel con los dos huecos y la confirmación (revisión del bloque A, #3).

Y las de siempre (portada, páginas, reposo, menú, atajos, cargando, error, recuperar).

## 8. Dependencias añadidas
Ninguna. (Un `npx esbuild` lanzado por error desde la carpeta temporal bajó la misma versión permitida a la caché de npx; no toca el proyecto.)

## 9. Pendientes y `TODO(ivan)`
- Escuchar los 12 bucles y las 3 combinaciones (`npm run demo:sounds`), ya en `PENDIENTES.md`.
- El filtro en el peor caso (grabaciones de 40 BPM leídas a 240, 4 capas) cuesta 36× tiempo real en el PC: en un móvil de gama media puede ser bastante CPU. Entra en la prueba de 5 min de la fase 4.

## 10. Propuestas de cambio al plan
1. PLAN §5, «CPU del audio»: anotar la cifra a 240 BPM con el filtro (65×; peor caso 36×) como referencia, sin criterio nuevo.
2. Fase 3, tarea 7: el criterio de −60 dB se mide sobre las imágenes del plegado. Las de la propia interpolación de Hermite (presentes a cualquier tempo fraccionario) siguen como en la fase 1.
3. Fase 3, criterio de render: medirlo en caliente y a 48 kHz (es lo que mide el banco). En frío, el primer bucle de un worker nuevo carga además la compilación del código común; a 96 kHz hay el doble de muestras. Es una vez por sonido y en el worker.

## 11. Cómo probarlo
- `npm start` → «Tócalo»: pulsa REPRODUCIR con la sesión vacía (ALFAR en la capa 1 y la capa 2 elegida); SONIDO → cualquier categoría; BUCLE → MARCAR TEMPO y pulsa el dial al ritmo.
- `npm run demo:sounds` y escucha `demo-sounds/` (12 bucles y 3 combinaciones, 4 vueltas cada uno).
- Sube el tempo a 240 con ALMENDRO o CIERZO: sin silbidos que bajen al acelerar.

---

## Respuesta a la revisión
Revisión: `docs/revisiones/fase-3.md` (CAMBIOS NECESARIOS: 0 Bloqueantes, 1 Importante, 6 Menores, 2 Sugerencias).

| Hallazgo | Acción | Commit |
|---|---|---|
| #1 Importante: clic con un salto de tempo grande y el filtro encendido | El diseño sigue a la velocidad como mucho un 2 % por bloque y el retardo se interpola dentro del bloque (`voice.ts`, `DESIGN_GLIDE`). 7 tests nuevos con los saltos de la revisión (44,1 kHz 240 → 110 con 441 Hz y 1 kHz; 48 kHz 160 → 110, 180 → 120 con 2 kHz, 110 → 240; 40 BPM 240 → 52, también en reverso), con el criterio de §5. Sin el arreglo fallan 4 (por ejemplo, 0,191 frente a 0,144); con él pasan todos. | `00c160e` |
| #2 Retardo de grupo «2–6 muestras» | Corregido en §5 y en `docs/AUDIO.md`: de 0,1 a 10,4 muestras. | `00c160e` |
| #3 El banco mide en caliente | El criterio se queda en caliente, con las cifras en frío y a 96 kHz en §2, y la propuesta 3 de §10. El banco admite `--rate`. | `00c160e` |
| #4 Doble toque en la primera reproducción | El store absorbe un «reproducir» mientras el sonido de la primera reproducción llega a la capa; parar o pausar cancelan ese arranque. 2 tests del store con el render retenido. | `00c160e` |
| #5 El test «sin junta», débil en baterías | Ventana de 1 ms y un segundo control negativo: OLIVO con una cola de eco a −30 dB cortada al final, que el test detecta. En baterías y texturas, el ataque o el ruido de alrededor tapan una cola así; ahí la falta de junta la da la construcción (búfer circular, `processLooped`, eco en bucle, ruido de un bucle entero y ciclos de vueltas enteras), con sus tests en `synth.spec.ts`. Lo dejo dicho en el test. | `00c160e` |
| #6 La línea de la pantalla parte delante del «·» | Espacio sin ruptura delante de cada «·» en las líneas y el estado de la pantalla HTML. | `00c160e` |
| #7 El e2e de la cola no comprueba el compás *siguiente* | El arnés guarda la muestra del transporte al enviar `set-sound`; el e2e exige que entre en el compás siguiente (o en el de después si la orden cayó en los últimos 40 ms, por el retraso del estado). Pedida hacia la muestra 16 256: entró en la 128 000. | `00c160e` |
| #8 Determinismo por motor | Precisado en `docs/AUDIO.md`: los bytes son fijos en V8; otro motor puede variar en el último bit (el `.torno` guarda el PCM). | `00c160e` |
| #9 Precargar ALFAR | No aplicado: el primer gesto suele ser el propio REPRODUCIR, así que precargar en ese gesto no adelanta nada, y pedir un render antes de un gesto contradice «nada antes de una acción del usuario». Queda medir la primera reproducción en frío en la fase 4, con el móvil. | — |

