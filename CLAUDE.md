# Torno

Instrumento de bucles de cuatro capas **en 3D que se toca en el navegador**, en español: biblioteca de sonidos propia sintetizada, grabación con micrófono, disco para arrastrar el tiempo, brazo de expresión para filtrar y una web de producto alrededor. La versión 1 tiene **todas las funcionalidades del proyecto que lo inspira (TAPE, `ethanplusai/tape`) y además mejoras propias**, sin copiar nada de él.
Es una pieza del portfolio de Iván Chesa Lapena (desarrollador web freelance, https://ivanchesa.es) y se publica en un subdominio de ivanchesa.es. **El SEO es secundario**; importan la calidad del audio, el 3D, el rendimiento y la accesibilidad.
Es un proyecto **independiente** del repo de ivanchesa.es: sus reglas (Astro, cero JS…) **no aplican aquí**.

**Plan maestro: `docs/PLAN.md`.** Al empezar cada sesión, lee §0–§5, §7 y la sección de tu fase (el resto, si lo necesitas). Trabaja por fases, en orden, y solo en la fase actual.
Buenas prácticas oficiales de Angular: @docs/angular-buenas-practicas.md

## Cómo trabajamos (dos IAs + Iván)
- **Tú programas.** Otra sesión de Claude planifica y revisa cada bloque (`docs/revisiones/bloque-X.md`). **Iván decide.**
- **Siempre en modo autónomo por bloques**, salvo que Iván pida otra cosa: ejecutas todas las fases del bloque que te indique (`docs/PLAN.md` §6) **sin esperar su OK** entre pasos ni entre fases. Los prompts (`docs/prompts/PROMPTS.md`) solo dicen qué bloque toca; el resto está aquí.

### Ciclo de cada fase N
1. Lee este archivo, `docs/PLAN.md` §0–§5 y §7, la sección de la fase y el informe y la revisión anteriores.
2. Escribe tu plan en el §0 de `docs/informes/fase-N.md` (`docs/informes/PLANTILLA.md`) y ejecútalo en la rama `fase-N-nombre` (nombres en `docs/prompts/PROMPTS.md`), creada desde `main`. Commits pequeños; si la fase es grande, por entregas (N.a, N.b…). El informe, siempre al día y commiteado.
3. Al terminar: `npm run check` e informe completo, con evidencias de cada criterio de aceptación (cifras y capturas con `?captura=1`).
4. **Revisión:** lanza un subagente `general-purpose` sin tu contexto. Que lea este archivo, el plan, `docs/revisiones/README.md`, el informe y el diff `main...<rama>`; que ejecute `npm run check`; que mire las capturas, y que escriba `docs/revisiones/fase-N.md`.
5. Corrige los Bloqueantes, los Importantes y los Menores rápidos, y añade «Respuesta a la revisión» al informe. Si quedaba un Bloqueante, haz una ronda más.
6. Con `npm run check` en verde y sin Bloqueantes: fusiona con `--no-ff` en `main` (y push si hay remoto), añade una línea a `docs/informes/DIARIO.md` (fase, fecha, veredicto, métricas clave) y sigue con la fase siguiente.

### Paradas
- **Al terminar el bloque:** resumen en `DIARIO.md` (hecho, métricas, desviaciones, pendientes para Iván) y **PARA**. No empieces el bloque siguiente.
- **Parada prevista:** al terminar la entrega 5.a, para que Iván apruebe el diseño del instrumento.
- **Condiciones de parada** (explícalo en `DIARIO.md` y en el chat):
  - un Bloqueante sin resolver tras dos rondas de revisión;
  - una dependencia fuera de la lista cerrada o una herramienta externa;
  - un criterio de exactitud, de audio o de rendimiento imposible sin cambiar el plan;
  - el audio no funciona en un navegador objetivo y no se arregla sin cambiar la arquitectura;
  - una acción destructiva fuera del proyecto, o que requiera credenciales.

### Decisiones ya tomadas (no preguntes por ellas)
- Autoguardado activado por defecto (D16), salvo que `docs/PENDIENTES.md` diga otra cosa.
- Sonidos propios en Re menor a 90 BPM, con nombres en español; Iván los escucha al final del bloque B.
- Textos propios con `reviewed: false`; Iván los revisa en la fase 7.
- Subdominio: el provisional de `site.config.ts`.
- Si faltan los secrets de Cloudflare para la fase 4, se aplaza, se apunta en `DIARIO.md` y se sigue. Sus pruebas en móviles no bloquean la fusión de la fase 4. **Decisión de Iván (30-10): el bloque C empieza sin ellas**, pero la entrega 5.b no empieza hasta que estén en `docs/PRUEBAS-MOVIL.md`. La parada de la 5.a se hace igual.

### Otras reglas del proceso
- **Aplicar una revisión de bloque:** corrige en `main` (o en `fix/bloque-X` si los cambios son grandes) los Bloqueantes, los Importantes y los Menores rápidos; si no estás de acuerdo con un hallazgo, explica por qué. `npm run check`, la respuesta al final de la revisión y commit.
- **Sesión nueva o contexto lleno:** deja el informe «en curso» y commiteado. Al retomar, lee `DIARIO.md`, el informe en curso, `git log` y `git status`, y sigue sin esperar OK.
- **No cambies el alcance ni los criterios de aceptación.** Propón los cambios en el informe; las ideas nuevas van al backlog (§9 del plan).
- **Si falta un dato o una decisión de Iván:** si bloquea, es una condición de parada; si no, `TODO(ivan): …` en `docs/PENDIENTES.md` y sigue con lo demás.

## Original: inspiración, no fuente
- **No abras el código, los textos ni las imágenes de TAPE** (ni el repo ni la web). La paridad funcional está descrita en `docs/PLAN.md` §0.1 y §4: con eso basta.
- Nada de su marca, nombres de sonidos, textos, paleta (marfil y azul cobalto), tipografías (Barlow Condensed, DM Sans, IBM Plex Mono) ni distribución del aparato.

## Reglas permanentes
- **Idioma:** interfaz, textos, comentarios, commits y docs en español de España. Identificadores y nombres de archivo en inglés. URLs en español y sin barra final. Los textos visibles siguen `docs/ESTILO.md` (se crea en la fase 7).
- **Stack fijo:**
  - Angular 22: standalone, zoneless y signals. `OnPush` es el valor por defecto: **no se declara**.
  - TypeScript estricto, sin `any`.
  - Three.js 0.186 directo, sin `angular-three`.
  - **Audio propio** con Web Audio API y AudioWorklet. **Sin librerías de audio** (ni Tone.js ni similares).
  - CSS propio con custom properties, dirección visual B «Barro» (`docs/DISENO.md`).
  - Sin React, sin Tailwind, sin librerías de UI.
- **Dependencias:** solo la lista cerrada de `docs/PLAN.md` §1. Para cualquier otra, o para una herramienta externa, pregunta antes.
- **Angular:**
  - `input()`/`output()`/`model()`, `inject()`, `computed()`.
  - `effect()` solo para sincronizar con sistemas externos (motor de audio, motor 3D, URL).
  - `@if`/`@for`/`@defer`. Sin NgModules.
  - RxJS solo donde lo pida una API.
- **Capas** (`docs/PLAN.md` §4.2; el lint las vigila):
  - `audio/core/`, `audio/synth/`, `audio/files/` e `instrument/` son **TS puro**: sin DOM, sin Web Audio, sin Angular. Se ejecutan igual en Node (tests) que en el navegador.
  - `audio/worklet/` solo adapta el núcleo al `AudioWorkletProcessor`.
  - `audio/engine/` es el único sitio que toca `AudioContext`, el micrófono y los archivos del navegador. No conoce Angular.
  - `three` solo se importa en `scene/`. `scene/` no conoce Angular ni el audio.
  - Los componentes llegan al audio y al 3D **solo** por `audio/engine/index.ts` y `scene/index.ts`; el modelo del instrumento (`instrument/`) lo usan directamente.
- **Hilo de audio** (`audio/core/` y `audio/worklet/`):
  - Sin asignaciones de memoria, `async`, `console` ni cierres nuevos dentro de `process()`: todo se reserva antes. Única excepción: el `postMessage` de los eventos agrupados (≤ 30/s), reutilizando el mismo objeto.
  - **Un solo reloj:** el de muestras del worklet. La animación lee la posición del transporte; nunca al revés.
  - Todo parámetro que cambie en directo se suaviza: ni clics ni chasquidos.
  - Mensajes tipados (`audio/core/protocol.ts`). Eventos hacia el hilo principal ≤ 30/s, agrupados.
- **Audio y micrófono:**
  - Nada suena y no se pide el micrófono **antes de una acción del usuario**. Preparar en silencio (cargar el motor, renderizar en un worker) sí se puede antes, por ejemplo al acercarse al instrumento.
  - El `AudioContext` se crea y se reanuda **dentro del propio gesto**, antes de cualquier `await`.
  - El micrófono se libera al terminar o cancelar una toma, en reposo y al ocultar la pestaña.
  - **El audio del usuario nunca sale del dispositivo.**
- **SSR/prerenderizado:** nada de `window`, `document`, Web Audio ni WebGL fuera de `afterNextRender`, de un bloque `@defer` o de un gesto del usuario.
- **Rendimiento:**
  - Bucle de render fuera de Angular y **bajo demanda**: 0 fps sin movimiento.
  - Signals ≤ ~10 actualizaciones/s; los medidores de nivel se pintan fuera de los signals.
  - `three`, la escena, el motor de audio y la síntesis **nunca** van en el bundle inicial (solo el desbloqueo de audio de §4.9, < 2 kB).
  - Presupuestos en `docs/PLAN.md` §5.
- **Memoria:** todo lo que crea la escena se libera con `dispose()`; el audio, con su contabilidad de memoria (§4.4).
- **Accesibilidad WCAG 2.1 AA:**
  - Cada control del instrumento es un **elemento HTML enfocable** (`button` nativo o `role="slider"`, §4.7), con etiqueta y valor en español.
  - Todo se puede tocar con teclado y sin WebGL (instrumento HTML).
  - `prefers-reduced-motion` y «Pausar movimiento» en TODAS las animaciones.
- **Privacidad:** 0 cookies, 0 analítica, 0 peticiones a dominios de terceros (todo autoalojado). `localStorage` solo para preferencias e IndexedDB solo para el autoguardado local, siempre con `try/catch`.
- **Contenido:** no inventes cifras. La ficha técnica solo publica valores **medidos** (con cómo se midieron). Textos nuevos con `reviewed: false`.
- **Sonidos:** solo síntesis propia y determinista. Ni muestras de terceros ni audio generado por IA.
- **Licencias:** todo recurso de terceros (fuentes, por ejemplo), en `docs/FUENTES.md`.
- **Capturas:** toda fase con cambios visuales aporta capturas deterministas (`?captura=1`) de escritorio y móvil en `docs/informes/img/fase-N/`.
- **Configuración del sitio:** en UN solo sitio, `src/app/core/site.config.ts`.
- **Seguridad:** nunca subas credenciales ni las pidas por chat; los secrets los introduce Iván.
- **Commits** pequeños en español: `feat:`, `fix:`, `test:`, `perf:`, `content:`, `docs:`, `chore:`.
- **Hosting: Cloudflare Pages** (D19, decisión de Iván del 27-10), proyecto `torno`:
  - un push a `main` con el CI en verde va a la vista previa `staging.torno.pages.dev`, y una etiqueta `v*`, a producción;
  - se sube con `cloudflare/wrangler-action` fijado por SHA el build que ya probó el CI;
  - `_headers` (y `_redirects` si hace falta) en lugar de `.htaccess`. Sin COOP/COEP mientras no se use `SharedArrayBuffer`;
  - 25 MiB como máximo por archivo y sin Cloudflare Web Analytics;
  - los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` los pone Iván, y también el CNAME de `torno.ivanchesa.es` al lanzar.
- **No toques** el repo de ivanchesa.es (`../ivan-chesa.es`) ni el de tierra-luna-sol (`../tierra-luna-sol`, solo lectura como referencia de configuración), ni DNS, ni cPanel, ni el WordPress de producción.

## Skills disponibles (`.claude/skills/`, copiadas en la fase 0)
Úsalas como referencia cuando toque, sin encadenarlas todas. Las reglas de este archivo mandan sobre cualquier skill.

| Para | Skills |
|---|---|
| Escena, geometría, materiales y luces | `threejs-scene`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-webgl` |
| Shaders y texturas procedurales | `threejs-shaders`, `shader-glsl` |
| Interacción y cámara | `threejs-interaction`, `threejs-animation`, `iart-threejs-animation` |
| Rendimiento, memoria y depuración | `threejs-performance`, `threejs-debugging`, `60fps-animation` |
| Tests | `threejs-testing`, `webapp-testing` |
| Accesibilidad y movimiento reducido | `threejs-accessibility`, `accessible-animation`, `web-design-guidelines` |
| Diseño y pulido visual | `taste-skill`, `impeccable` (pregunta antes de cualquier descarga), `web-design-guidelines` |
| Despliegue | `threejs-deployment` |

Ojo: los ejemplos de las skills pueden usar React/R3F o versiones antiguas de three. **Adáptalos a Three.js puro 0.186 dentro de `scene/`.** No hay skill de audio: manda §4.3–§4.4 del plan.

## Comandos
- `npm start` (añade `-- --host 0.0.0.0` para probar en el móvil por la red local; el micrófono exige HTTPS fuera de `localhost`)
- `npm test`, `npm run lint`, `npm run build`, `npm run e2e`
- `npm run check` (lint + test + build + presupuestos; obligatorio antes de cerrar una fase o entrega)

## Definición de terminado (cada fase)
1. Criterios de aceptación cumplidos **y demostrados** en el informe (salidas, cifras, capturas).
2. `npm run check` sin errores ni avisos de presupuesto.
3. Informe completo, revisión del subagente aplicada y fase fusionada en `main`.
