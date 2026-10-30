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

---

# Revisión: Bloque B, fase 4 (27-10)
Veredicto: APROBADA. La fase 4 está fusionada y desplegada en Cloudflare Pages. Solo queda la prueba de Iván en el móvil, que bloquea el inicio del bloque C.

El cambio a Cloudflare Pages (D19) está muy bien hecho:
- **Build para Pages:** `ruta.html` y `404.html` en la raíz, y un `_headers` con la CSP por hashes que comprueba el propio build. Lo que Pages no admite rompe el build.
- **e2e contra `wrangler pages dev`** (57 del build, con un control negativo de la CSP).
- **Despliegue seguro:**
  - `workflow_run` solo con un push a `main` y el CI en verde, con permisos mínimos y acciones fijadas por SHA;
  - wrangler sale del `package-lock.json` sin el token en el entorno;
  - la lista de proyectos de la cuenta ya no sale en el registro público (hallazgo 1 del subagente).
- **El CI colgado instalando los navegadores** (hallazgo 4 de la primera parte) está resuelto: caché, cortes por tiempo y cambio de espejo. El camino del reintento aún no se ha visto en real.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante (decisión aprobada) | PLAN §5, «Síntesis»; `src/app/state/session.store.ts` (`preload`) | La primera reproducción en frío tarda 157–238 ms en el escritorio y 203–233 ms en el CI: pasa de los 150 ms del plan, y en el móvil será peor. | **Aprobada la precarga de ALFAR** al acercarse al instrumento (propuesta 1 de la fase 4), **al empezar el bloque C** (PLAN, fase 5, ya actualizado). La prueba 1 del móvil dará la cifra de antes y la de después. |
| 2 | Sugerencia (aprobada) | `.github/workflows/deploy.yml`; PLAN, fase 4, tarea 3 | Sin vistas previas de las ramas de fase, Iván no puede ver en el móvil la maqueta 3D de la 5.a hasta fusionar. | **Aprobada la propuesta 2:** un push a `fase-*` con el CI en verde se publica en `<rama>.torno.pages.dev`, y `staging` sigue siendo solo `main`. Al empezar el bloque C (PLAN, ya actualizado). |
| 3 | Menor | PR #1 de Dependabot (wrangler 4.149.0 → 4.152.0) | No corrige los avisos de `npm audit`; eso llega en la 4.153.0. | Si su CI está en verde, fusionarlo al empezar el bloque C (o esperar a que Dependabot proponga la 4.153.0 y cerrar este). La versión de wrangler del despliegue sale del lockfile: se actualiza sola con el PR. |

## Qué he comprobado
- **Estado:** `main` = `origin/main` (`ecee61d`), sin cambios pendientes. Fusión de la fase 4 en `45c5df7`. Los últimos CI y el despliegue de `main`, en verde: el despliegue tarda 43 s.
- **La vista previa con `curl`** (`https://staging.torno.pages.dev`):

  | Ruta | Respuesta |
  |---|---|
  | `/` | 200 |
  | `/sobre-el-proyecto` | 200, sin barra |
  | `/sobre-el-proyecto/` | 308 → `/sobre-el-proyecto` |
  | `/sobre-el-proyecto.html` | 308 → `/sobre-el-proyecto` |
  | `/no-existe` | **404**, no la portada (`404.html` funciona) |

  - Cabeceras de `/`: CSP con hashes, `Permissions-Policy: microphone=(self)`, HSTS, `nosniff`, `Referrer-Policy`, `X-Robots-Tag: noindex`, y el HTML con `max-age=0, must-revalidate`.
  - El JS con hash se sirve como `application/javascript`, con un año inmutable.
  - No hay `Set-Cookie`.
  - `torno.pages.dev` (producción) da 404, porque aún no hay despliegue de producción: es lo esperado hasta la etiqueta `v1.0.0`.
- **La revisión del subagente** encontró de verdad el riesgo de la lista de proyectos en el registro público y el árbol de wrangler instalado fuera del lockfile con el token. Están corregidos (`303a452`), igual que la medida «en frío» y el inicio de la medida en el toque (`event.timeStamp`).
- **`docs/PRUEBAS-MOVIL.md`:** 14 pruebas claras, con el panel `?diagnostico=1` y «Copiar el informe» sin red. Es lo que desbloquea el bloque C.
