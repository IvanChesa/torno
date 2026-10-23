# Informe: Fase 0 (cimientos y pruebas técnicas)

- **Rama:** `fase-0-cimientos`
- **Fecha:** 2026-10-24
- **Estado:** en curso

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
7. `scripts/check-bundles.mjs` con el `stats.json` (metafile de esbuild) del build: JS inicial ≤ 300/400 kB, worklet ≤ 40 kB, workers ≤ 40 kB, motor ≤ 60 kB, chunk 3D (cuando exista) y que el inicial no contenga el motor, la síntesis ni `three`.
8. CI (`.github/workflows/ci.yml`): lint, test, build, presupuestos y e2e (Chromium), con acciones fijadas por SHA.

**0.c · Diseño base**
1. `docs/DISENO.md` con la dirección B «Barro»: tokens de color, tipografías (Fraunces + Geist Mono, a confirmar por peso y licencia), escala tipográfica, espaciado, componentes base y materiales del instrumento (valores PBR de partida para la fase 5).
2. Contraste AA de cada combinación comprobado por un test que lee los tokens del CSS.
3. Fuentes autoalojadas (solo subconjunto latino, ≤ 150 kB), estilos base, página base con muestrario temporal, modo `?captura=1` y script de capturas (Playwright) → `docs/informes/img/fase-0/`.

**Cierre:** `npm run check`, informe con evidencias, revisión por subagente, correcciones, fusión `--no-ff` y `DIARIO.md`. Fin del bloque 0: **parada**.

**Riesgos:** audio en Chromium sin interfaz en el CI (sin tarjeta de sonido); que el builder de Angular empaquete el worker también en el build de servidor; peso de Fraunces (eje `opsz`); finales de línea en Windows.

**Skills consultadas:** `webapp-testing` (Playwright), `taste-skill`, `impeccable` (sin descargas) y `web-design-guidelines` para `DISENO.md`.
