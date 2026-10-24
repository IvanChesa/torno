# Informe: Fase 0 (cimientos y pruebas técnicas)

- **Rama:** `fase-0-cimientos`
- **Fecha:** 2026-10-24
- **Estado:** revisada (`docs/revisiones/fase-0.md`) y corregida; lista para fusionar

## 0. Plan de la fase

Bloque 0 = solo la fase 0, en modo autónomo. Tres entregas, cada una con commits pequeños:

**0.a · Repositorio, Angular y configuración**
1. `git init -b main` y primer commit `docs: plan inicial` (solo `CLAUDE.md` y `docs/`); el resto en `fase-0-cimientos`. `core.autocrlf=false` en el repo local y `.gitattributes` con `eol=lf`, para que Windows no mezcle finales de línea.
2. `ng new torno-scaffold` (Angular CLI 22.2.x por `npx`, la global es la 20) desde la carpeta padre con `NG_CLI_ANALYTICS=false`, `--ssr`, `--style=css`, `--prefix=trn`, `--skip-git`, `--skip-install` y `--ai-config=claude` (para comparar sus reglas con `docs/angular-buenas-practicas.md`). Mover el resultado sin tocar `CLAUDE.md` ni `docs/`, borrar `server.ts` y Express, `npm install` aquí.
3. Configuración: `outputMode: "static"` con las 3 rutas prerenderizadas; `strict`, `noUncheckedIndexedAccess`, `strictTemplates`; presupuestos de §5 en `angular.json`; ESLint plano con las capas de §4.2 (incluidos los `import()` dinámicos) y un test de Vitest que pasa código real por ESLint y demuestra que un import prohibido falla; Prettier; tsconfig sin DOM para las capas de TS puro (`tsc` demuestra que no usan el navegador), tsconfig propios para el worklet y los workers.
4. Tests: dos ejecutores. Vitest directo con entorno `node` para `audio/core`, `audio/synth`, `audio/files`, `instrument` y los scripts; el builder `@angular/build:unit-test` (Vitest + jsdom) para los componentes. `npm test` lanza los dos.
5. Estructura de §4.1 con índices mínimos; `site.config.ts` como fuente única; `seo.service.ts` mínimo (título, descripción y `noindex` en la 404).
6. Skills copiadas de tierra-luna-sol, fuera de git y de Prettier. `.mcp.json` (Angular CLI MCP), `README.md`, `docs/informes/DIARIO.md`.

**0.b · Pruebas técnicas del audio y presupuestos**
1. `audio/core/`: generador de pitido puro (seno con rampas de 5 ms, duración exacta en muestras, sin reservas en `process`) y `protocol.ts` tipado y versionado.
2. `audio/worklet/processor.ts` (adaptador mínimo) y `scripts/build-worklet.mjs` con esbuild 0.28.2 (la versión de `@angular/build` 22.2.4): `public/audio/processor.<hash>.js` + `audio/engine/worklet-url.generated.ts`, ambos ignorados; antes de `start` (vigilancia), `build`, `test`, `lint` y `e2e`.
3. `audio/engine/`: `index.ts` estrecho con el desbloqueo síncrono en el gesto (`AudioContext` creado y reanudado antes de cualquier `await`, búfer silencioso de una muestra) y la sonda diferida (`import()`), que carga el módulo, hace sonar el pitido y mide el pico con un `AnalyserNode`.
4. `audio/synth/` + `audio/workers/synth.worker.ts`: render determinista de un tono en un Web Worker (`new Worker(new URL(...))`), devuelto como `Transferable` y medido.
5. Botones de prueba temporales en la portada, con el resultado visible (estado, frecuencia de muestreo, pico en dBFS).
6. Tests: Vitest (Node) del generador y del render; Playwright (Chromium) contra `ng serve` **y** contra el build estático servido en local (`scripts/serve-static.mjs`, sin dependencias): el worklet carga y la salida no es silencio, el worker responde, nada se crea antes del gesto y el contexto está en `running` dentro del gesto aunque el módulo tarde 1,5 s; axe en las 3 rutas.
7. `scripts/check-bundles.mjs` con el metafile de esbuild del build: JS inicial ≤ 300/400 kB, worklet ≤ 40 kB, workers ≤ 40 kB, motor ≤ 60 kB, chunk 3D (cuando exista) y que el inicial no contenga el motor, la síntesis ni `three`.
8. CI (`.github/workflows/ci.yml`): lint, test, build, presupuestos y e2e (Chromium), con acciones fijadas por SHA.

**0.c · Diseño base**
1. `docs/DISENO.md` con la dirección B «Barro»: tokens de color, tipografías (Fraunces + Geist Mono, a confirmar por peso y licencia), escala tipográfica, espaciado, componentes base y materiales del instrumento (valores PBR de partida para la fase 5).
2. Contraste AA de cada combinación comprobado por un test que lee los tokens del CSS.
3. Fuentes autoalojadas (solo subconjunto latino, ≤ 150 kB), estilos base, página base con muestrario temporal, modo `?captura=1` y script de capturas (Playwright) → `docs/informes/img/fase-0/`.

**Cierre:** `npm run check`, informe con evidencias, revisión por subagente, correcciones, fusión `--no-ff` y `DIARIO.md`. Fin del bloque 0: **parada**.

**Riesgos:** audio en Chromium sin interfaz en el CI (sin tarjeta de sonido); que el builder de Angular empaquete el worker también en el build de servidor; peso de Fraunces (eje `opsz`); finales de línea en Windows.

**Skills consultadas:** `webapp-testing` (Playwright), `taste-skill`, `impeccable` (sin descargas) y `web-design-guidelines` para `DISENO.md`.

---

## 1. Resumen

Proyecto Angular 22 estático (prerenderizado de `/`, `/sobre-el-proyecto` y `/404`), zoneless, con TypeScript estricto, ESLint que hace cumplir las capas de §4.2 (también en `import()` dinámicos y en `new URL(…)` de los workers), tsconfig sin DOM para el TS puro y dos ejecutores de Vitest (Node para el núcleo, jsdom para Angular). Las dos pruebas técnicas de riesgo están resueltas: **el AudioWorklet**, compilado aparte con esbuild y con hash, **suena** (pico medido a la salida de −12,0 dBFS y duración exacta en muestras) en `ng serve` y en el build estático, y **el worker de síntesis** con import de `audio/synth/` renderiza y suena en los dos. El contexto se crea y se reanuda dentro del propio evento `click` (el e2e lo comprueba con `window.event`, porque el Chromium de Playwright deja sonar un contexto creado sin gesto), y está en `running` aunque el módulo tarde 1,5 s. `docs/DISENO.md` desarrolla la dirección «Barro» con contrastes medidos por test, Fraunces (eje `SOFT`) y Geist Mono autoalojadas en 144 kB, y los materiales de partida del instrumento.

## 2. Criterios de aceptación

| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| `npm run check` sin errores; el bundle inicial cumple §5 | ✅ | §6: lint (4 tsconfig + ESLint + Prettier), 122 tests en Node + 31 en Angular, build y presupuestos sin errores ni avisos. JS inicial de `/`: **293,5 kB** en bruto (aviso > 300, error > 400), contando también los `modulepreload` de la ruta; Angular, solo `main` + chunks iniciales: 286,0 kB. El inicial no lleva ni motor, ni síntesis, ni worklet, ni `three` (comprobado en el metafile, archivo a archivo). |
| El pitido suena en Chromium y el e2e lo demuestra; el núcleo se testa en Node | ✅ | `e2e/audio.spec.ts` «el pitido suena por el AudioWorklet»: estado `done`, contexto `running`, creado y reanudado **dentro del `click`** (`window.event` anotado en el constructor y en `resume()`: `['new:click', 'resume:click']`; un control negativo demuestra que la anotación da `ninguno` fuera del gesto), **pico −12,0 dBFS** medido con `AnalyserNode` a la salida (esperado: ganancia 0,25 = −12,04 dBFS; el test exige −13 < pico < −11) y **24.000 de 24.000 muestras** a 48 kHz según el propio worklet. El generador (`audio/core/beep.ts`) se testa en Node: 22 tests a 44,1, 48 y 96 kHz (duración exacta, rampas, ganancia, 220 ± 1 ciclos, sin clics según el criterio de §5, mismos bytes en bloques de 1, de 128 o de una vez). |
| El worklet y el worker funcionan en `ng serve` y en el build estático servido en local | ✅ | Playwright con dos proyectos, `dev` (`ng serve`) y `estatico` (`scripts/serve-static.mjs` sobre `dist/torno/browser`): los 6 tests de `audio.spec.ts` pasan en los dos (31/31 e2e en total). El worker: **48.000 de 48.000 muestras**, renderizadas en 5,2 ms, pico −10,5 dBFS. |
| El lint rechaza un import prohibido (demostrado) | ✅ | `scripts/eslint-layers.spec.ts` pasa código real por `eslint.config.mjs`: **33 casos prohibidos rechazados y 12 permitidos aceptados** (incluidos los rodeos por `window.`/`globalThis.` y `console.log`). Demostración manual (archivo temporal `src/app/audio/core/demo-prohibido.ts`, borrado después): ver abajo. |
| `DISENO.md` completo y capturas de la página base en escritorio y móvil | ✅ | `docs/DISENO.md` (idea, paleta, contraste de 21 combinaciones, tipografías, escala, espacio, forma, componentes, materiales del instrumento, comprobaciones). Capturas en §7. |

Demostración del lint con un archivo en `audio/core/` que importa Angular, `three` y el motor, y usa `window` y `Math.random`:

```
$ npx eslint src/app/audio/core/demo-prohibido.ts
  1:24  error  La capa «audio/core» no puede importar el paquete «@angular/core» (PLAN §4.2)   torno/capas
  2:22  error  `three` solo se importa dentro de src/app/scene/ (PLAN §4.2)                    torno/capas
  3:29  error  La capa «audio/core» no puede importar de «audio/engine» (PLAN §4.2)            torno/capas
  5:49  error  Unexpected use of 'window'. Las capas de TS puro no usan el navegador ni Node…  no-restricted-globals
  5:68  error  'Math.random' is restricted from being used. El audio es determinista (PLAN D8)…  no-restricted-properties
✖ 5 problems (5 errors, 0 warnings)

$ npx tsc -p tsconfig.pure.json      # sin DOM: la segunda red
src/app/audio/core/demo-prohibido.ts(2,22): error TS2307: Cannot find module 'three' or its corresponding type declarations.
src/app/audio/core/demo-prohibido.ts(5,49): error TS2304: Cannot find name 'window'.
```

## 3. Tareas del plan

| Tarea | Estado | Notas |
|---|---|---|
| 0.1 Repo y primer commit | hecha | `9022f4b docs: plan inicial` solo con `CLAUDE.md` y `docs/`. Todo lo demás, en `fase-0-cimientos`. |
| 0.2 Angular 22 con `ng new` | hecha | CLI 22.2.4 por `npx` desde la carpeta padre (`--directory=torno-scaffold`), movido sin tocar `CLAUDE.md` ni `docs/`. Las reglas para IA que genera (`CLAUDE.md`) son **idénticas** a `docs/angular-buenas-practicas.md` (`diff` vacío): no se ha cambiado nada. `.mcp.json` con el servidor MCP de la CLI local (como tierra-luna-sol); `README.md` en español. |
| 0.3 Configuración | hecha | `outputMode: "static"`, sin `server.ts` ni Express; `strict`, `noUncheckedIndexedAccess` y `strictTemplates` explícitos (TypeScript 6 ya trae `strict` por defecto); presupuestos de §5 en `angular.json` y `scripts/check-bundles.mjs`; ESLint con las capas y su test; Prettier; Vitest con entorno `node`. |
| 0.4 Estructura y `site.config.ts` | hecha | Índices mínimos en cada capa de §4.1 (`audio/core`, `synth`, `files`, `worklet`, `workers`, `engine`, `instrument`, `scene`, `state`); `features/` y `pages/` con lo que existe. `site.config.ts`: nombre, subdominio provisional, idioma, autor, contacto y enlaces legales de ivanchesa.es (`/aviso-legal/`, `/privacidad/`, `/cookies/`). `seo.service.ts`: título, descripción, robots y canonical. |
| 0.5 Prueba técnica del worklet | hecha | Ver §2. `build-worklet.mjs` probado también en vigilancia con `npm start`: un cambio en `processor.ts` generó `processor.IM2SXCM3.js`, borró el anterior y `ng serve` lo sirvió (200, `text/javascript`); al revertir volvió el hash original. |
| 0.6 Prueba técnica del worker | hecha | Ver §2. Funciona en `ng serve` y en el build prerenderizado; el build de servidor no lo rompe. |
| 0.7 `DISENO.md`, fuentes, estilos y capturas | hecha | Fraunces + Geist Mono **confirmadas** (OFL 1.1, latino, 144,1 kB). Contraste AA comprobado por test. |
| 0.8 CI | hecha | `.github/workflows/ci.yml`: lint, test, build, presupuestos y e2e. Acciones fijadas por SHA, comprobados con `git ls-remote` contra los tags (`checkout` v7.0.1, `setup-node` v7.1.0, `upload-artifact` v7.0.2). Correrá cuando haya remoto (fase 4). |
| 0.9 Skills | hecha | `.claude/skills/` copiada (27 skills, 5 MB), fuera de git, de Prettier y de ESLint. |
| 0.10 `DIARIO.md` | hecha | Creado con su formato (vacío). |

## 4. Desviaciones del plan y motivo

1. **Regla de capas propia en ESLint** (`torno/capas`, definida en `eslint.config.mjs`) en lugar de `no-restricted-imports` por patrones (lo que usa tierra-luna-sol): `no-restricted-imports` no mira los `import()` dinámicos, y por patrones de texto no distingue `core/` de `audio/core/`. La regla resuelve cada ruta y la compara con el mapa de §4.2; mira imports estáticos, `export … from`, `import()` y `new URL('…', import.meta.url)` (las referencias a los workers). Sin dependencias nuevas.
2. **`audio/engine/index.ts` es a la vez la API pública y el único trozo del motor en el inicial.** §4.2 dice que los componentes solo llegan al audio por `index.ts`, y §4.9 que el desbloqueo va en el inicial y el resto diferido. `index.ts` exporta `unlockAudio()` (0,7 kB) y funciones `async` que cargan la implementación con `import()`; los tipos se reexportan sin coste. Así se cumplen las dos cosas sin una segunda entrada.
3. **e2e del retraso del worklet:** Chromium no enseña a Playwright las descargas de módulos de AudioWorklet (ni en los eventos de red ni en `page.route`; comprobado con un script). El test envuelve `AudioWorklet.prototype.addModule` para registrar las cargas y retrasarlas 1,5 s, y el tipo MIME del módulo se comprueba con una petición directa a su URL con hash.
4. **Dos ejecutores de tests** (Vitest directo en Node con `vitest.node.config.mts` y `ng test` con jsdom). El builder de Angular no permite otro entorno por carpeta, y ejecutar el núcleo en Node puro es la mejor prueba de que no depende del navegador. El builder excluye las carpetas de TS puro para no ejecutarlas dos veces.
5. **Más tsconfig** que los de `ng new`: `tsconfig.pure.json` (sin DOM), `tsconfig.worklet.json` (con tipos propios del `AudioWorkletGlobalScope`, que TypeScript no trae), `tsconfig.worker.json` (el builder empaqueta los workers sin comprobar tipos) y `tsconfig.node.json` (tests de Node, scripts, e2e). `npm run typecheck` los pasa todos dentro de `lint`.
6. **Fraunces con todos los ejes (121 kB)** en lugar del corte solo `opsz` (67 kB): el eje `SOFT` es la firma de la dirección. Sin cursiva (no cabe). Comparado con capturas; justificado en `DISENO.md` §3 con un plan B.
7. **Textos de licencia OFL servidos** en `public/licencias/*.txt`: el `3rdpartylicenses.txt` de Angular solo cubre el JS y no se pudo confirmar que los subconjuntos lleven la licencia en sus metadatos.
8. **`/404` responde 200 si se pide directamente** en el servidor local (es un archivo real, como hará Apache); el 404 lo da cualquier URL desconocida, con esa página. Probado en e2e.
9. **Presupuesto de «JS inicial» más estricto que el de Angular:** `check-bundles` suma también los `modulepreload` de cada página prerenderizada (lo que de verdad baja en la primera visita a esa ruta).
10. **Tinta tenue nueva** (`--color-ink-faint`, 3,3:1) para el nombre grande del pie: axe lo marcaba con la superficie elevada. Solo para texto ≥ 24 px.
11. **Favicon propio en SVG** en lugar del `favicon.ico` de Angular (su logo).
12. **Secciones temporales en la portada:** la prueba técnica (`features/audio-probe`) y el muestrario (`features/design-sample`). Se quitan cuando llegue el instrumento (fase 2) y la web (fase 7).

## 5. Decisiones técnicas nuevas

| Decisión | Alternativas consideradas |
|---|---|
| Protocolo con `v` en cada mensaje e `isCurrentMessage()`; el worklet reserva sus eventos antes (`process()` solo cambia un número y hace `postMessage` del mismo objeto) | Mensajes sin versión (más frágil con cachés); crear el evento en `process()` (reserva memoria en el hilo de audio) |
| Rampas de coseno alzado en el pitido y en el tono (pendiente 0 en los extremos) | Rampas lineales (esquina de pendiente; peor para el criterio de clics) |
| El pitido avisa de su fin aunque empiece y acabe en el mismo bloque (`endPending`) | Detectar el flanco «sonaba → no suena» (se pierde en pitidos de menos de 128 muestras) |
| `build-worklet.mjs` escribe la ruta solo si cambia y borra las versiones antiguas | Reescribir siempre (recompila `ng serve` sin motivo) |
| Servidor estático propio de 80 líneas que imita a Apache | `http-server` o `serve` (dependencias fuera de la lista) |
| Capturas: escritorio 1440 × 900 a 1×; móvil Pixel 7 (412 px) a 2×; `reducedMotion: reduce`, página completa | Solo la primera pantalla (no se ve el pie ni el muestrario) |
| `SeoService` como `TitleStrategy` del router: título, descripción, robots y canonical en cada navegación y al prerenderizar | Un servicio que escuche `NavigationEnd` (no corre en el orden del prerenderizado de forma tan directa) |
| Tokens con identificadores en inglés (`--color-bg`) y documentados en español | Nombres en español (CLAUDE.md: identificadores en inglés) |
| axe en e2e exige **cero** violaciones de cualquier impacto, no solo graves y críticas | Lo mínimo de §5 (deja pasar las moderadas) |
| **`noindex` en todas las páginas hasta el lanzamiento** (`indexable: false` en `site.config.ts`; la 404, siempre). El plan solo lo pide en la 404 y en staging (con `X-Robots-Tag`); así nada se indexa por accidente antes de la fase 9. Recordatorio en `PENDIENTES.md` y propuesta en §10. | Indexar desde ya (riesgo de que se indexe una web a medias) |
| «Saltar al contenido» con la ruta actual en el `href` (`router.lastSuccessfulNavigation`, que en Angular 22 es un signal) y foco en `main` con JS | `href="#contenido"` (con `<base href="/">` lleva a la portada); `toSignal` de los eventos del router (+1,4 kB en el inicial) |
| e2e del gesto: `window.event` anotado al crear el contexto y en `resume()`, con control negativo | Solo comprobar `running` (el Chromium de Playwright deja sonar contextos sin gesto) |
| Cifras con unidad por `formatQuantity()` (espacio duro) y `Intl` con `SITE_CONFIG.locale` | Espacios normales (la unidad se separa al cortar la línea en móvil) |
| Avisos de licencias de terceros publicados con la web (`postbuild`: `licencias/terceros.txt`) | Dejarlos en `dist/torno/`, que no se despliega |

## 6. Salida de los checks

```
$ npm run check
> npm run typecheck && ng lint && prettier --check .
  tsc -p tsconfig.pure.json && tsc -p tsconfig.worklet.json && tsc -p tsconfig.worker.json && tsc -p tsconfig.node.json   ✔
  All files pass linting.
  All matched files use Prettier code style!
> vitest run --config vitest.node.config.mts --coverage
  Test Files  6 passed (6)
       Tests  122 passed (122)
  Statements 100% (78/78) · Branches 94,23% (49/52) · Functions 100% (11/11) · Lines 100% (68/68)
> ng test --watch=false
  Test Files  8 passed (8)
       Tests  31 passed (31)
> ng build
  Initial chunk files | Names   |  Raw size | Estimated transfer size
  main-42Q37WMW.js    | main    | 279.68 kB |                77.08 kB
  styles-HCJYP3MY.css | styles  |   5.86 kB |                 1.84 kB
  chunk-DJVAsKa_.js   | -       | 464 bytes |               464 bytes
                      | Initial total  | 286.00 kB |         79.39 kB
  Lazy: home-page 13.39 kB · probe 2.99 kB · about-page 1.54 kB · synth-worker 1.27 kB · not-found-page 803 B
  Prerendered 3 static routes.
> node scripts/publish-licenses.mjs
  ✔ Licencias de terceros: dist/torno/browser/licencias/terceros.txt
> node scripts/check-bundles.mjs
  ✔ JS inicial de /                     293.5 kB  (aviso > 300.0 kB · error > 400.0 kB)  3 archivos
  ✔ JS inicial de /404                  280.1 kB  (aviso > 300.0 kB · error > 400.0 kB)  2 archivos
  ✔ JS inicial de /sobre-el-proyecto    281.7 kB  (aviso > 300.0 kB · error > 400.0 kB)  3 archivos
  ✔ Desbloqueo de audio en el inicial     0.7 kB  (error > 2.0 kB)
  ✔ Motor de audio (probe.ts)             3.0 kB  (error > 60.0 kB)
  ✔ Worker synth.worker.ts                1.3 kB  (error > 40.0 kB)
  ✔ Worklet                               1.9 kB  (error > 40.0 kB)
  ✔ Chunk 3D (three + escena)             0.0 kB  (aviso > 800.0 kB)  aún no existe
  ✔ Fuentes                             144.1 kB  (error > 150.0 kB)  2 archivos
  ✔ Bundle inicial sin motor de audio, síntesis, worklet ni 3D.

$ npm run e2e        (tras npm run build)
  31 passed (15.4s)   [dev] 6 de audio + 5 de «Saltar al contenido» · [estatico] lo mismo + 9 del build estático
```

Tests en Node por archivo: `eslint-layers` 45 · `contrast` 23 · `check-bundles` 16 · `beep` 22 · `protocol` 8 · `tone` 8. En Angular: configuración del sitio, formato de cifras, modo captura, SEO, rutas con su SEO (portada, `/sobre-el-proyecto`, `/404` y una URL desconocida), marco de la app («Saltar al contenido» en otra ruta y su foco), portada y la sonda (incluido el error visible sin Web Audio).

Métricas de la fase:
- **Audio:** pitido de 0,5 s = 24.000 muestras exactas a 48 kHz; pico a la salida −12,0 dBFS (esperado −12,04); módulo cargado en 6 ms en local; contexto en `running` en < 1 s tras el clic con el módulo retrasado 1,5 s. Worker: 48.000 muestras en 5,2 ms, pico −10,5 dBFS (esperado −10,46). Salto máximo entre muestras del pitido ≤ el del propio seno + 0,01 (criterio de §5) a 44,1, 48 y 96 kHz.
- **Tamaños:** desbloqueo en el inicial 0,7 kB; sonda del motor 3,0 kB; worker 1,3 kB; worklet 1,9 kB (17,8 kB en desarrollo, sin minificar y con mapa de fuentes en línea); fuentes 144,1 kB.
- **Accesibilidad:** axe (WCAG 2.0/2.1 A y AA + buenas prácticas): **0 violaciones** de cualquier impacto en `/`, `/sobre-el-proyecto` y `/404`.
- **Privacidad:** 0 peticiones a otros dominios y 0 cookies en la portada (e2e); el revisor lo comprobó también en `/sobre-el-proyecto`, `/404`, `/no-existe` y `/?captura=1`.

## 7. Capturas

`npm run capturas -- --fase=0` sobre el build, con `?captura=1`:

| Página | Escritorio (1440 px) | Móvil (Pixel 7, 412 px a 2×) |
|---|---|---|
| Portada (página base con la prueba técnica y el muestrario) | `docs/informes/img/fase-0/inicio-escritorio.png` | `docs/informes/img/fase-0/inicio-movil.png` |
| Sobre el proyecto | `docs/informes/img/fase-0/sobre-el-proyecto-escritorio.png` | `docs/informes/img/fase-0/sobre-el-proyecto-movil.png` |
| 404 | `docs/informes/img/fase-0/404-escritorio.png` | `docs/informes/img/fase-0/404-movil.png` |

## 8. Dependencias añadidas

| Paquete | Versión | Motivo | ¿Está en la lista permitida? |
|---|---|---|---|
| `@angular/*` (common, compiler, core, forms, platform-browser, platform-server, router, ssr; build, cli, compiler-cli) | 22.2.x | `ng new --ssr` (el prerenderizado necesita `ssr` y `platform-server`) | ✅ |
| `rxjs`, `tslib` | ~7.8 / ^2.3 | `ng new` | ✅ |
| `typescript`, `vitest`, `jsdom`, `prettier`, `@types/node` | ~6.0.2, 5.0.5, 30, 3.8, 22 | `ng new` | ✅ |
| `@fontsource-variable/fraunces`, `@fontsource-variable/geist-mono` | 5.3.0 | Tipografías de `DISENO.md` | ✅ |
| `angular-eslint`, `eslint`, `@eslint/js`, `typescript-eslint` | 22.6.0, 10.13.0, 10.0.1, 8.72.0 | Lint por capas | ✅ |
| `@playwright/test`, `@axe-core/playwright` | 1.64.1, 4.14.0 | e2e y axe | ✅ |
| `@vitest/coverage-v8` | 5.0.5 | Cobertura de las capas puras | ✅ |
| `esbuild` | 0.28.2, fijada | Compilar el worklet; la misma que usa `@angular/build` 22.2.4 | ✅ |

Quitadas: `express` y `@types/express` (las añade `ng new --ssr` para `server.ts`, que no existe con salida estática). Aún no: `three` y `@types/three` (fase 5), `sharp` (fase 7).

## 9. Pendientes y `TODO(ivan)`

Para Iván (también en `docs/PENDIENTES.md`): ver `DISENO.md` y las capturas de la fase 0 en la revisión del bloque (paleta, Fraunces con `SOFT`, Geist Mono), y confirmar en la fase 9 que la web se indexe al lanzarla (hasta entonces, todo con `noindex`).

Técnicos, para fases siguientes:
- **`npm audit`:** 1 aviso alto en `vite` 8.3.0, que va dentro de `@angular/build` 22.2.4 y solo afecta al servidor de desarrollo. La corrección que propone npm baja Angular de versión; se espera al parche de Angular (Dependabot, fase 4).
- **npm 11 y `allowScripts`:** npm avisa de que no ha ejecutado los scripts de instalación de `esbuild`, `lmdb`, `msgpackr-extract` y `@parcel/watcher`; todo funciona con sus binarios precompilados. Vigilar en el CI (fase 4).
- **Hidratación y gesto (fase 2):** con `withEventReplay()`, un toque antes de que termine la hidratación se repite después, fuera del gesto; en iOS eso puede dejar el contexto sin desbloquear. El desbloqueo del bundle inicial de la fase 2 tiene que escuchar el primer gesto directamente (sin pasar por la repetición de eventos).
- **CSP (fase 4):** Angular deja scripts en línea (el contrato de eventos y el cambio de `media` de Beasties); hará falta `security.autoCsp` o hashes para `script-src 'self'`.
- **Fuentes (fase 8):** precarga de Fraunces y métricas de la fuente de reserva (`size-adjust`) para el CLS.
- **Margen del JS inicial:** `main` ya pesa 279,7 kB (casi todo es el mínimo de Angular con router e hidratación); de los 300 kB de aviso quedan 6,5 kB en la portada. Todo lo nuevo tiene que ir diferido (`@defer` o `import()`).
- **Errores del motor (fase 2):** los mensajes de error de `audio/engine/` (p. ej., «Este navegador no tiene Web Audio.») son texto visible escrito en el motor. El `AudioEngine` de la fase 2 debería devolver códigos de error y que la interfaz los traduzca desde un archivo de contenido con `reviewed: false`.
- **Foco al navegar (fase 7 u 8, sugerencia 12 de la revisión):** en las navegaciones dentro de la SPA, llevar el foco a `main` (o al `h1`) tras `NavigationEnd`, salvo en la primera carga, para que el lector de pantalla anuncie la página nueva.

## 10. Propuestas de cambio al plan

1. §4.2: dejar escrito el patrón de `audio/engine/index.ts` y `scene/index.ts` (API estrecha y diminuta en el inicial; implementación con `import()`), que es como se cumplen a la vez §4.2 y §4.9.
2. Fase 2, criterio «con el worklet retrasado 1,5 s»: aceptar el retraso por instrumentación de `addModule` (Playwright no puede retrasar la descarga del módulo de un AudioWorklet en Chromium).
3. §5, «JS inicial»: definirlo como el JS de la primera visita a cada ruta prerenderizada (con sus `modulepreload`), que es lo que mide `check-bundles`.
4. Fase 9, tareas de Claude Code: añadir «activar la indexación (`indexable: true` en `site.config.ts`) y comprobar que solo la 404 lleva `noindex`», para no lanzar con todo en `noindex`.

## 11. Cómo probarlo

```
npm install
npx playwright install chromium       # solo la primera vez, para el e2e
npm start                              # http://localhost:4200 → «Probar el pitido» y «Probar el sintetizador»
npm run check                          # lint, tests, build y presupuestos
npm run e2e                            # tras npm run build: Playwright contra ng serve y el build estático
node scripts/serve-static.mjs          # el build estático en http://localhost:4300
npm run capturas -- --fase=0           # capturas en docs/informes/img/fase-0/
node scripts/contrast.mjs              # tabla de contraste de DISENO.md
```

En la portada, «Probar el pitido» hace sonar medio segundo de La (440 Hz) generado en el hilo de audio y enseña el pico medido; «Probar el sintetizador», un Re de un segundo sintetizado en un worker.

---

## Respuesta a la revisión

Revisión: `docs/revisiones/fase-0.md` (veredicto **CAMBIOS NECESARIOS**: 0 Bloqueantes, 2 Importantes, 8 Menores y 4 Sugerencias). Corregidos los 2 Importantes, los 8 Menores y 3 de las 4 Sugerencias; la que queda se anota para su fase. Después: `npm run check` en verde (122 + 31 tests, presupuestos sin avisos) y `npm run e2e` 31/31.

| Hallazgo | Acción | Commit |
|---|---|---|
| 1 · Importante: «Saltar al contenido» llevaba a la portada desde las otras páginas (`<base href="/">`) | El `href` lleva la ruta actual, también en el HTML prerenderizado (`/sobre-el-proyecto#contenido`), calculada con el signal `router.lastSuccessfulNavigation`. Con JS, el clic lleva el foco a `main` sin navegar. e2e con teclado (Tab + Intro) en `/`, `/sobre-el-proyecto`, `/404` y `/?captura=1`, más el `href` sin JS. El enlace de ejemplo del muestrario va ahora a una ruta real. | `95ae04e`, `2e2a220` |
| 2 · Importante: el e2e «dentro del clic» no lo demostraba | La instrumentación anota `window.event` al crear el contexto y en `resume()`; los tres tests con sonido exigen `['new:click', 'resume:click']`, y un control negativo demuestra que fuera del gesto da `ninguno`. El límite (un `await` sobre una promesa ya resuelta no se distingue) está escrito en el test. Redacción del informe ajustada (§1 y §2). | `377f579` |
| 3 · Menor: la sonda del sintetizador se colgaba con el contexto suspendido | `ended` con `withTimeout` (duración + 3 s), como el pitido: da un error visible y deja reintentar. | `21305f7` |
| 4 · Menor: la marca de la cabecera medía 31 px de alto en móvil | `inline-flex` con `min-block-size: var(--target-min)` (44 px). | `306efaa` |
| 5 · Menor: textos visibles sin `reviewed: false` | Nuevos `not-found.content.ts`, `app.routes.content.ts` (títulos y descripciones de las rutas) y `core/site.content.ts` (descripción y etiquetas legales). La tecla del muestrario y las frases de resultado de la sonda pasan a sus contenidos. | `2e2a220` |
| 6 · Menor: rodeo del lint con `new window.AudioContext()` | `no-restricted-syntax` fuera del motor para `window.`/`globalThis.`/`self.` + nombres de Web Audio y para `mediaDevices`/`getUserMedia` por cualquier camino. 4 casos nuevos rechazados y 2 permitidos en `eslint-layers.spec.ts`. | `1c2f293` |
| 7 · Menor: `indexable: false` sin documentar | Añadido a §5 (decisiones), recordatorio en `PENDIENTES.md` («Indexación en el lanzamiento») y propuesta 4 de §10 para la fase 9. | `0a232d2` y este informe |
| 8 · Menor: `FUENTES.md` sin Angular, RxJS ni tslib, y avisos de licencias fuera del despliegue | Filas añadidas (y nota sobre lo que solo usa el prerenderizado). `postbuild` copia `3rdpartylicenses.txt` a `browser/licencias/terceros.txt`; e2e de los tres textos de licencia. | `ff05cd3` |
| 9 · Menor: tamaños y pesos sin token en `app.css` | Tokens `--weight-brand`, `--text-colossal`, `--leading-colossal` y `--tracking-colossal` en `tokens.css` y en `DISENO.md` §3.1; la regla de qué va en tokens, precisada en `DISENO.md`. | `306efaa` |
| 10 · Menor: prefijo `ci:` | De acuerdo; sin reescribir el historial. Los commits siguientes usan los prefijos de `CLAUDE.md`. | — |
| 11 · Sugerencia: `no-console` | Activado en `src/**` (se permiten `error` y `warn`), con su caso en el test de capas. | `1c2f293` |
| 12 · Sugerencia: foco al navegar dentro de la SPA | Anotado para la fase 7 u 8 (§9): es parte de la accesibilidad de la web completa. | — |
| 13 · Sugerencia: espacio duro, frase del atajo y locale | `formatQuantity()` une cifra y unidad con espacio duro (y «440 Hz» del texto también); «Con el teclado, Espacio reproduce o pausa»; `Intl` lee `SITE_CONFIG.locale`. | `2e2a220` |
| 14 · Sugerencia: configuración de Karma en `.vscode` | Quitadas la configuración «ng test» de `launch.json` y su tarea de `tasks.json`. | `0a232d2` |
