# Revisión: Bloque B
Veredicto: APROBADO (la fase 3). La fase 4 se divide en dos entregas (hallazgo 1)

La fase 3 está muy bien resuelta:
- 12 bucles propios, deterministas, sin junta y con los niveles exactos por papel;
- un Chebyshev II en secciones TPT contra el *aliasing* al acelerar, con las cuentas comprobadas por el subagente;
- la primera reproducción con ALFAR en la capa 1 y MARCAR TEMPO.

**Iván ha escuchado la colección y «suenan bien»**: no se cambia nada. El subagente encontró el único fallo de verdad: un clic al saltar de tempo con el filtro encendido. Está arreglado (el diseño sigue a la velocidad ≤ 2 % por bloque y el retardo se interpola), con 7 tests nuevos que fallan sin el arreglo. Los ajustes de la revisión del bloque A también están aplicados (banco fuera de `check`, 60 kB, `ubuntu-24.04` y autoguardado con dos huecos).

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante (proceso) | PLAN, fase 4 | **La fase 4 está aplazada entera, pero la mitad no necesita credenciales.** El `.htaccess`, la CSP con su e2e, el flujo de despliegue escrito, Dependabot y la lista de pruebas en el móvil se pueden hacer ya. Así, cuando Iván tenga el staging, solo queda desplegar, comprobar y probar. Además, el bloque C depende de las pruebas en el móvil: cuanto antes esté todo listo, antes se desbloquea. | PLAN, fase 4, ya dividida: **4.a sin credenciales** (ahora) y **4.b con el staging** (cuando Iván lo tenga). Prompts en `docs/prompts/PROMPTS.md`. |
| 2 | Menor | `docs/informes/fase-3.md` («Respuesta», #9); `src/app/state/session.store.ts` (`preload`) | El #9 se descartó porque «pedir un render antes de un gesto contradice "nada antes de una acción del usuario"». La regla habla de **sonar** y de pedir el micrófono; preparar en silencio no la incumple. Y la primera reproducción en frío (crear el worker y renderizar ALFAR) puede tardar cientos de ms en un móvil, justo en el primer toque, que es el que da la primera impresión. | `CLAUDE.md`, ya aclarado: preparar en silencio sí se puede antes del gesto. Medirlo en la fase 4 (tarea 6, ya en el plan). Si el toque tarda más de 150 ms en sonar, precargar ALFAR al acercarse al instrumento (PLAN §5, «Síntesis»). |
| 3 | Menor | `src/app/audio/engine/unlock.ts`; `check-bundles` | El desbloqueo del bundle inicial pesa 1,9 kB, con el límite en 2 kB. No hace falta subirlo, pero no le cabe nada más. | Si una fase necesita tocarlo, que saque lo que no sea del gesto (por ejemplo, `setAudioSessionType`) al motor diferido antes de subir el límite. |
| 4 | Menor | `.github/workflows/ci.yml` (paso `npx playwright install --with-deps chromium webkit`) | **El CI del último commit de `main` (`03e20e5`) se ha quedado colgado instalando los navegadores.** Lleva más de 12 min en ese paso, con todo lo anterior en verde (lint, tests, banco, build y presupuestos); los CI anteriores tardaban ~5 min en total. No es del código: es la descarga de los navegadores o de los paquetes de `apt`. Pero sin caché, cada push se juega esa descarga, y con el `timeout-minutes: 20` del job un cuelgue se lleva 20 min antes de fallar. | En la 4.a (tarea 1): caché de los navegadores de Playwright (`actions/cache` sobre `~/.cache/ms-playwright`, con la versión de `@playwright/test` en la clave; con la caché acertada, solo `playwright install-deps`), `timeout-minutes: 10` en ese paso y volver a lanzar el CI si este falla por tiempo (`gh run rerun`). |

## Propuestas del informe de la fase 3 (§10)
1. **CPU a 240 BPM con el filtro en §5:** aceptada (65×; 36× en el peor caso; suelo de 30×).
2. **El −60 dB se refiere a las imágenes del plegado:** aceptada (fase 3, tarea 7).
3. **Render ≤ 50 ms en caliente y a 48 kHz,** con las cifras en frío y a 96 kHz documentadas: aceptada, más la medición de la primera reproducción en frío en el móvil (hallazgo 2).

## Cambios ya hechos en los documentos (sin commit)
- `docs/PLAN.md`:
  - §5: CPU con el filtro y fila «Síntesis»;
  - fase 3, tarea 7: la nota sobre el −60 dB;
  - fase 4: dos entregas, tarea 6 ampliada y tarea 7 nueva (página de pruebas y `?diagnostico=1`).
- `CLAUDE.md`: preparar en silencio antes del gesto.
- `docs/PENDIENTES.md`: sonidos escuchados y aprobados.
- `docs/prompts/PROMPTS.md`: los prompts de 4.a y 4.b.

Haz commit con `docs: plan tras la revisión del bloque B`, junto con esta revisión.

## Qué he comprobado
- **Estado:** `main` en `03e20e5`, sin cambios pendientes. La fase 3 está fusionada (`acef572`) y la fase 4 aplazada sin tocar nada, como manda `CLAUDE.md`.
- **Checks propios en `main`** (PC de Iván):
  - `npm run check`: **0 errores** en 100 s;
  - `npm run e2e`: **89/89** en 77 s;
  - `npm run test:bench`: en verde;
  - presupuestos: worklet 40,8 kB y worker de exportación 41,7 kB (límite 60), sin avisos.
- **CI de GitHub sobre `03e20e5`:** colgado en la instalación de los navegadores (hallazgo 4); todos los pasos anteriores en verde.
- **Revisión del subagente de la fase 3:** rigurosa. Rehízo las cuentas del filtro, probó 27 saltos de tempo a tres frecuencias de muestreo y en reverso, y sus 7 hallazgos están respondidos con tests. El #9 lo retomo aquí (hallazgo 2).
- **Escucha de Iván:** «suenan bien». He comprobado los WAV de `demo-sounds/` (estéreo, 48 kHz, 24 bits, 21,3 s): la combinación 1 tiene el pico a −2,2 dBFS y RAÍZ a −16,5 dBFS, coherente con la tabla de niveles por papel.
- **Presupuestos** (del informe y del CI): el JS de `/` está en 301,5 kB (aviso 330), y el worklet (40,6 kB) y el worker de exportación (41,6 kB) caben en los 60 kB nuevos.
