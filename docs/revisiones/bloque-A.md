# Revisión: Bloque A
Veredicto: APROBADO, con cuatro ajustes al empezar el bloque B (hallazgos 1–4)

Las fases 1 y 2 están a un nivel muy alto:
- un núcleo de audio exacto a la muestra, a 204–242× tiempo real y sin reservas en `process()`;
- un motor que arranca en el gesto real (con escucha nativa, `audioSession` y aviso si el toque llega antes del JS);
- la toma alineada a 0,04 ms tras calibrar, con la mezcla exportada idéntica al render del núcleo (≤ 1 LSB);
- 1000 archivos malformados rechazados;
- el CI de GitHub en verde con audio en WebKit de Linux.

Las dos revisiones de los subagentes encontraron errores reales (sobregrabación desplazada, copia de la sesión en el hilo de audio, clics) y están corregidos con tests que fallan sin el arreglo. Lo que sigue son ajustes de proceso y de presupuestos para que los bloques siguientes no tropiecen.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante | `package.json` (`test` incluye `test:bench`) | **Un banco de rendimiento decide si `npm run check` pasa.** Pide ≥ 100× y con el PC cargado dio 27–50×. Iván suele tener otros proyectos en marcha a la vez, y un `check` que falla por la carga del equipo hace perder tiempo al ciclo autónomo o, peor, enseña a ignorar los fallos. Lo mismo vale, en menor medida, para los tests que miden tiempo de pared (copia por tramos < 2 ms y esperas de los e2e). | Sacar `test:bench` de `npm test` (sigue existiendo como `npm run test:bench`). En el CI, un paso propio con suelo de regresión ≥ 50× que imprime la cifra. Los informes miden el ≥ 100× en un PC sin carga (PLAN §5, ya actualizado). En los tests de tiempo de pared, cotas con margen (×3 en el CI) o contar bloques en lugar de milisegundos. |
| 2 | Importante | `scripts/check-bundles.mjs:20-21` | **El worklet (37,7 kB) y el worker de exportación (38,6 kB) están a 2 kB del límite de error de 40 kB.** Los dos llevan el núcleo entero, y la fase 3 añade código (el filtro contra el *aliasing*). El límite de 40 kB era arbitrario: 60 kB en bruto siguen siendo ~15 kB comprimidos y se cargan después del primer gesto. | Subir el límite de error del worklet y de los workers a 60 kB (PLAN §5, ya actualizado) y su test. |
| 3 | Importante (decisión de Iván) | `src/app/state/session.store.ts:431-452`, `src/app/audio/engine/autosave.ts` | **Autoguardado con el panel de recuperar sin contestar** (revisión de la fase 2, #21). **Decisión de Iván (26-10): segundo hueco.** | Implementarlo como dice PLAN §4.8 (ya actualizado): lo nuevo, en un segundo hueco; la sesión anterior, intacta hasta contestar; «Recuperar» pide confirmación si ya se ha tocado algo. Con un test del store y un e2e (recargar → tocar sin contestar → recargar → siguen las dos). |
| 4 | Menor | `.github/workflows/ci.yml` (`runs-on: ubuntu-latest`) | GitHub avisa en cada ejecución de que `ubuntu-latest` pasa a Ubuntu 26. El audio de WebKit en Linux depende de paquetes del sistema (`playwright install --with-deps`): el cambio de imagen puede romper el CI sin haber tocado nada. | Fijar `runs-on: ubuntu-24.04` y cambiarlo a propósito más adelante, con su propio commit. |
| 5 | Menor | PLAN §5 | Pico de memoria de 241,92 MB durante menos de 1 s, en el peor caso: una copia de la sesión que coincide con el inicio de una toma. | Aceptada la propuesta 4 (b) de la fase 2: ≤ 220 MB en régimen permanente y un pico transitorio documentado ≤ 250 MB (PLAN §5, ya actualizado). Si las pruebas de la fase 4 o la 8 muestran problemas de memoria en el móvil, se aplica la (a). |
| 6 | Sugerencia | `src/app/features/html-instrument/html-instrument.css:6-13` | La maqueta 2D pone el dial principal y el brazo arriba a la derecha, como el original (revisión de la fase 2, #20). | La fase 5.a propone cómo queda el instrumento HTML con la distribución nueva (PLAN, fase 5.a, tarea 4, ya añadida). |

## Propuestas de los informes
**Fase 1** (informe, §10):
1. Junta de 10 ms al grabar: **aceptada** (PLAN §4.4).
2. Regla de la toma libre: **aceptada** (PLAN §4.4).
3. «Heap estable» con el perfil de muestreo de V8: **aceptada**.

**Fase 2** (informe, §10):
1. Micrófono entre tomas: se decide con las medidas de la fase 4, y sigue en `PENDIENTES.md`.
2. Criterio de alineación: **aceptada**. ±2 ms con un retorno determinista en el e2e y ±5 ms en dispositivos reales (§5).
3. Coste de `@defer`: **aceptada** (PLAN §5).
4. Pico de memoria: **aceptada la (b)** (hallazgo 5).

## Para la fase 3, además de su sección del plan
- El *aliasing* del *varispeed* hacia arriba (revisión de la fase 1, #14) está ahora en PLAN, fase 3, tarea 7, con un criterio numérico.
- Los 12 bucles sustituyen a los sonidos de prueba con los mismos ids por categoría y se sintetizan sin junta.
- Después de la fase 3, el JS de la primera visita a `/` no puede pasar del aviso de 330 kB (hoy, 301,4).

## Cambios ya hechos en los documentos (sin commit)
`docs/PLAN.md`:
- §4.4: juntas y toma libre;
- §4.8: dos huecos del autoguardado;
- §5: worklet y workers, `@defer`, banco y memoria;
- fase 3 (tareas 7 y 8), fase 4 (CSP) y fase 5.a (tarea 4).

Haz commit con `docs: plan tras la revisión del bloque A`, junto con esta revisión.

## Qué he comprobado
- **Estado:** `main` = `origin/main` (`533a471`), sin cambios pendientes; el bloque se cerró a las 13:19. CI de GitHub en verde en los tres últimos commits de `main`. Los tres anteriores fallaron mientras se ajustaba la prueba de WebKit y una carrera del e2e del autoguardado, como explica `DIARIO.md`.
- **Checks propios en `main`** (PC de Iván):
  - `npm run check`: **0 errores** en 94 s, con el banco incluido, que esta vez pasó.
  - `check-bundles`, sin avisos: `/` 301,4 kB (aviso 330), desbloqueo 1,8 kB (error 2), motor 20,7 kB, worklet 37,7 kB, worker de exportación 38,6 kB, worker de síntesis 2,5 kB y fuentes 144,1 kB.
  - `npm run e2e`: **81/81** en 69 s.
- **Código leído:**
  - `unlock.ts`: escucha nativa en captura sobre `[data-audio-unlock]`; `audioSession` en el gesto; el `resume()` se repite en cada gesto mientras no suena (bien pensado para iOS); estado «toque perdido» para el aviso.
  - `microphone.ts`: restricciones sin procesar con respaldo; las peticiones viejas se descartan; las pistas siempre se paran.
  - `autosave.ts`: IndexedDB con `try/catch`, cuota detectada y fecha aparte.
- **Tamaño del código:** el núcleo tiene ~4100 líneas en TS puro y el modelo del instrumento ~1700, con 398 tests en Node (98 % de sentencias). Sin dependencias fuera de la lista: el ZIP de las pistas es propio.
- **Capturas** del instrumento HTML (reposo y menú, escritorio y móvil): legibles, coherentes con «Barro» y con la pantalla de fósforo bien resuelta. La distribución, como dice el hallazgo 6.
- **Pendientes de Iván para la fase 4:** GitHub CLI, el staging, el iPhone y los auriculares siguen sin hacer. Sin ellos, el bloque B aplaza la fase 4, y el bloque C no puede empezar sin sus resultados.

## Respuesta a la revisión (Claude Code, 26-10)
`npm run check` en verde (74 s, sin el banco) y `npm run e2e` 83/83 en 1,0 min.

| # | Acción | Commit |
|---|---|---|
| 1 | `npm test` ya no ejecuta `test:bench` (sigue como `npm run test:bench`). En el CI, paso propio con `BENCH_MIN_FACTOR=50`, que imprime la cifra. Con `CI`, la cota de la copia por tramos pasa de 2 a 6 ms y la del primer sonido del e2e, de 100 a 300 ms. Las demás esperas de los e2e ya eran sondeos con plazo (`expect.poll`), no medidas. | `4379155` |
| 2 | Límite de error del worklet y de los workers a 60 kB, con su test. | `4379155` |
| 3 | Segundo hueco (`sesion-nueva` / `fecha-nueva`) en IndexedDB: mientras el panel sigue sin contestar, el autoguardado va ahí y la sesión anterior no se toca; tras recargar, el panel ofrece las dos («Recuperar lo que tocaste después»). «Recuperar» pide confirmación, con «Cancelar» enfocado primero, si la sesión actual tiene alguna capa con sonido (cambiar un nivel en una sesión vacía no pierde nada y no pregunta). Al contestar queda un solo hueco: recuperar la anterior borra el nuevo; recuperar el nuevo lo pasa al principal en una transacción; «Empezar de cero» deja la sesión actual como la única (si tiene sonido) o borra los dos. Un autoguardado que ya estaba copiando la sesión no escribe tras contestar (contador de generación). 6 tests del store y un e2e (recargar → tocar sin contestar → recargar → siguen las dos → confirmar y recuperar la nueva, idéntica byte a byte). | `968e22b` |
| 4 | `runs-on: ubuntu-24.04`. | `4379155` |
| 5 | Aceptado en el plan; nada que cambiar en el código. | — |
| 6 | Para la fase 5.a (tarea 4). | — |

Coste: el desbloqueo del bundle inicial pasa de 1,8 a 1,9 kB (la API del autoguardado tiene una función más; límite 2 kB).
