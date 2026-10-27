# Informe: Fase 4 (staging, entrega continua y móviles reales)

- **Rama:** `fase-4-staging`
- **Fecha:** 2026-10-26 (4.a) y 2026-10-27 (4.b)
- **Estado:** terminada: revisada y fusionada en `main` (`45c5df7`), con la vista previa publicada y comprobada. Solo faltan las pruebas de Iván en el móvil, que no bloquean la fusión pero sí el bloque C.

## 0. Plan de la fase

La revisión del bloque B dividió la fase en dos entregas (PLAN, fase 4). Esta sesión hace la **4.a** (tareas 1, 2, 3 escrita, 5 y 7) y **para**. La 4.b (activar el despliegue, comprobar con `curl`, las pruebas de Iván en los móviles, los criterios, la revisión y la fusión) espera a que Iván tenga el staging y los secrets.

**Entrega 4.a:**

1. **CI** (`.github/workflows/ci.yml`; revisión del bloque B, #4):
   - caché de los navegadores de Playwright (`actions/cache` sobre `~/.cache/ms-playwright`, con la versión de `@playwright/test` en la clave); con la caché acertada, solo `playwright install-deps`;
   - `timeout-minutes: 10` en la instalación;
   - el CI también corre en los *push* a las ramas `fase-*`: hasta ahora solo lo hacía en `main` y en las *pull requests*, y este proyecto no usa *pull requests*, así que las ramas de fase no pasaban el CI de GitHub;
   - en los *push* a `main`, el build (`dist/torno/browser`, con el `.htaccess`) se guarda como artefacto: el despliegue sube exactamente lo que se ha probado.
2. **`public/.htaccess`** (Apache/LiteSpeed de Banahosting):
   - HTTPS obligatorio, HSTS, URLs sin barra final (`/ruta` → `ruta/index.html`; `/ruta/` → 301 a `/ruta`), `ErrorDocument 404`, `Options -Indexes`;
   - caché larga e `immutable` para los archivos con hash (también el worklet y las fuentes) y `no-cache` para el HTML;
   - tipos MIME de los módulos JS, las fuentes y el SVG; compresión si el servidor tiene `mod_deflate`;
   - cabeceras de seguridad: `Permissions-Policy: microphone=(self)`, `nosniff`, `Referrer-Policy`, `X-Frame-Options` y COOP/CORP;
   - **CSP** con `script-src 'self'` y `worker-src 'self'`. El HTML prerenderizado lleva tres scripts en línea (el contrato de la repetición de eventos, su arranque y el que activa el CSS no crítico de Beasties). Un paso tras el build (`scripts/htaccess.mjs`) calcula sus hashes SHA-256 y los escribe en el `.htaccess` del build. No uso `security.autoCsp`: pone la política en un `<meta>` con `'strict-dynamic'`, que no admite `frame-ancestors` y deja en el aire cómo trata `addModule` del worklet. Con la política en la cabecera, cualquier script en línea nuevo hace fallar el build hasta que tenga su hash;
   - el servidor estático local (`scripts/serve-static.mjs`) aplica las mismas cabeceras, leídas del `.htaccess` del build. Así **todos los e2e del proyecto «estático» corren bajo la CSP de producción**: worklet, workers de síntesis y de exportación, descargas por `blob:` y micrófono;
   - un e2e propio comprueba las cabeceras y que un recorrido completo (reproducir, grabar, guardar, exportar mezcla y pistas) no dispara ninguna violación de la CSP, con un control negativo (un `eval` sí la dispara);
   - tests en Node del analizador del `.htaccess` y del cálculo de hashes; el paso tras el build comprueba que cada archivo del build cae en la regla de caché que le toca.
3. **`deploy-staging.yml`** (escrito, inactivo sin secrets):
   - se dispara cuando termina en verde el CI de un *push* a `main` (`workflow_run`);
   - descarga el artefacto del build de ese CI, añade al `.htaccess` el bloque del staging (`X-Robots-Tag: noindex` y, si hay secret, la contraseña con `AuthUserFile`, porque la «privacidad de directorio» de cPanel escribe en el mismo `.htaccess` que el despliegue sobrescribiría) y sube por FTPS (`SamKirkland/FTP-Deploy-Action` fijado por SHA);
   - sin los secrets `STAGING_FTP_*`, termina con un aviso y no despliega.
5. **Dependabot** (`.github/dependabot.yml`): npm y GitHub Actions semanales, agrupados. Quedan fuera las actualizaciones que el plan fija a mano: `three` y `@types/three` (0.186), TypeScript (la versión de Angular), `esbuild` (la de `@angular/build`) y las versiones mayores de Angular.
7. **Página de pruebas** (`docs/PRUEBAS-MOVIL.md`) con la lista de la tarea 6, casillas y huecos para las cifras, y **panel de diagnóstico** con `?diagnostico=1`. El panel enseña:
   - la frecuencia de muestreo, las latencias del contexto, la automática y la calibrada;
   - el estado del audio;
   - las estadísticas de reproducción del navegador, si las da (cortes);
   - **el tiempo del toque al primer sonido**, con la primera reproducción en frío (worker y ALFAR) aparte, para el criterio de 150 ms de la revisión del bloque B, #2;
   - un botón para copiar el informe.

   Todo en local: sin red y sin datos personales. Va en un `@defer`: nada en el bundle inicial.

**Riesgos:**
- **El servidor real:** LiteSpeed o Apache, la versión de `mod_headers` y las reglas de Imunify360 pueden tratar el `.htaccess` de otra forma. Se comprueba con `curl` en la 4.b; el `.htaccess` evita lo exótico.
- **Los hashes de la CSP** cambian si Angular cambia sus scripts en línea, pero el build lo detecta.
- **La caché de los navegadores** no cubre los paquetes del sistema (`install-deps` sigue usando `apt`).

**Skills consultadas:** `threejs-deployment` (la parte de cabeceras y caché de los archivos con hash, adaptada a Apache).

**Entrega 4.b** (27-10). Iván cambia el hosting a **Cloudflare Pages** (D19) y pone los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` (comprobados con `gh secret list`). La 4.b pasa lo de la 4.a a Pages, lo despliega y cierra la fase:

1. **El build, preparado para Pages** (tarea 2). `scripts/pages.mjs` sustituye a `scripts/htaccess.mjs` en el paso tras el build:
   - las rutas, como `ruta.html` (Pages sirve `/sobre-el-proyecto` y redirige `/sobre-el-proyecto/`); `404.html` en la raíz; fuera `index.csr.html`;
   - `_headers` desde la plantilla `public/_headers`, con los hashes de la CSP. Lleva las cabeceras de seguridad de la 4.a sin COOP (`CLAUDE.md`) y `X-Robots-Tag: noindex` para `torno.pages.dev`;
   - caché: inmutable para lo que lleva hash; el HTML, con la de Pages (se revalida siempre). Se comprueba archivo a archivo con las reglas de `_headers`, por la URL de cada uno;
   - se borran `public/.htaccess` y sus reglas de Apache;
   - `check-bundles` añade los límites de Pages: 25 MiB por archivo y menos de 20 000 archivos.
2. **En local, el servidor es Pages.** `wrangler` 4.149.0 entra en desarrollo (PLAN §1). `scripts/serve-pages.mjs` arranca `wrangler pages dev` sobre el build. Los e2e del build («estatico» y «webkit») y las capturas pasan a él, y se borra `scripts/serve-static.mjs`, que imitaba a Apache.
3. **Comprobación como con `curl`** (tarea 4), en `scripts/verify-pages.mjs`:
   - rutas, barra final, 404, cabeceras, MIME de los módulos y caché;
   - `noindex`, cookies y Cloudflare Web Analytics;
   - y que el HTML servido es el del build probado.

   Corre en un e2e contra `wrangler pages dev` y, tras cada despliegue, contra la vista previa.
4. **`deploy.yml`** (tarea 3), en lugar de `deploy-staging.yml`. Cuando el CI de un *push* a `main` termina en verde:
   - descarga su artefacto;
   - crea el proyecto `torno` si no existe;
   - despliega con `--branch=staging` y comprueba la vista previa.

   La versión de wrangler sale del `package.json` del commit probado: la misma que la de los e2e.
5. **Fusión y verificación real.** El `workflow_run` solo se dispara con el flujo que está en `main`, así que la vista previa se despliega al fusionar. Después:
   - `curl` en `staging.torno.pages.dev`, con los resultados en este informe (criterio 2);
   - si Pages se comporta distinto de `wrangler pages dev`, se ajusta en `main`.
6. **Documentos:**
   - `docs/PRUEBAS-MOVIL.md`, con la dirección nueva (sin contraseña);
   - el README, PLAN §3 (secrets ✅) y `docs/PENDIENTES.md`.

**Riesgos de la 4.b:**
- **Diferencias entre Pages y `wrangler pages dev`:** pueden estar en lo que Pages añade a las vistas previas (`noindex`, *Early Hints*) o en cómo une las cabeceras. Se ve en la comprobación tras el despliegue.
- **`wrangler pages dev` en los e2e:** tarda unos segundos en arrancar y lanza `workerd`, que hay que cerrar entero en Windows.

## 1. Resumen
La fase 4 deja Torno publicado de forma continua en Cloudflare Pages y listo para probarse en el móvil:
- **4.a (26-10, sin credenciales):**
  - CI con caché de los navegadores y también en las ramas de fase;
  - CSP con los hashes de los scripts en línea, que calcula el build;
  - Dependabot;
  - la lista de pruebas en el móvil y el panel `?diagnostico=1`.
- **4.b (27-10, Cloudflare Pages, D19):**
  - el build se prepara para Pages: rutas como `ruta.html`, `404.html`, `_headers` con la CSP y los límites de Pages;
  - los e2e del build y las capturas corren contra `wrangler pages dev`, que aplica las mismas reglas que Pages;
  - `deploy.yml` publica en `staging.torno.pages.dev` el build que probó el CI y lo comprueba después con `scripts/verify-pages.mjs`.

La vista previa ya está publicada en `https://staging.torno.pages.dev`, y la comprobación contra ella da 52 de 52. Quedan las pruebas de Iván en Android e iPhone. No bloquean la fusión, pero sí el inicio del bloque C.

## 2. Criterios de aceptación
| Criterio | Estado | Evidencia |
|---|---|---|
| CI verde y la vista previa `staging.torno.pages.dev` actualizada solo al hacer *push* a `main`, con el mismo build que probó el CI | ✅ | CI de la rama y de `main` en verde (§6). `deploy.yml` se dispara con el CI (`workflow_run`, `branches: [main]`) y solo si terminó en verde y fue un *push*: los dos intentos fallidos del CI de la fusión dejaron el despliegue saltado. Sube el artefacto `torno-browser` de esa misma ejecución (`run-id`). En la vista previa, el HTML de las tres páginas es, byte a byte, el del artefacto (§6, «La vista previa»). |
| Comprobaciones con `curl` en el informe: `/sobre-el-proyecto` sin barra da 200, con barra redirige a la URL sin ella y una URL desconocida da 404 con la página 404 | ✅ | En la vista previa: `curl` en §6 (200, 308 → `/sobre-el-proyecto`, 404 con «Página no encontrada») y `verify-pages`, 52 de 52. Antes, en local con `wrangler pages dev`: 50 de 50. |
| Lista de prueba en el informe y resultados de Iván en Android e iPhone | ⏳ (lista ✅; resultados, de Iván) | `docs/PRUEBAS-MOVIL.md`: 14 pruebas con casillas y huecos para las cifras, y el panel `?diagnostico=1`. Ya apunta a la vista previa. |

Lo demostrado:
- **El build de los e2e es el de Pages.** Los 57 e2e del build (56 en Chromium y 1 en WebKit) corren contra `wrangler pages dev`, con el `_headers` del build: CSP, rutas sin barra final y 404. Ninguna violación de la CSP en el recorrido completo: reproducir, grabar con el micrófono, guardar y exportar la mezcla y las pistas. Como control, un script en línea sin hash se bloquea (`e2e/headers.spec.ts`).
- **Las rutas de Pages, como quiere `CLAUDE.md`** (URLs sin barra final):
  - `/sobre-el-proyecto` da 200;
  - `/sobre-el-proyecto/` y `/sobre-el-proyecto.html` redirigen con un 308 a `/sobre-el-proyecto`, con la consulta (`?diagnostico=1`);
  - `/index.html` → `/` y `/404.html` → `/404`;
  - lo desconocido da 404 con la página de error, también dentro de una ruta (`/sobre-el-proyecto/no-existe`). Sin `404.html`, Pages devolvería la portada con un 200.
- **Caché:** el build comprueba los 24 archivos por la URL en la que los sirve Pages:
  - JS, CSS, fuentes y worklet llevan hash y un año inmutable;
  - el HTML se revalida siempre;
  - el favicon y las licencias, un día.
- **Las capturas no cambian con Pages:** las 30 de `docs/informes/img/fase-4/`, rehechas con el build servido por `wrangler pages dev`, salen idénticas byte a byte a las de la 4.a. Tras la revisión solo cambian las 2 del panel (la fila «Navegador», #12).
- **Panel de diagnóstico (4.a):** mide del toque a que el sonido sale por el altavoz. En el escritorio (Chromium, build estático, PC tranquilo), la primera reproducción en frío tarda 157–238 ms; las siguientes, 48–54 ms (con unos 40 ms de latencia de salida, la que informa Chrome en Windows). Tras la revisión, la medida empieza en el momento del toque (`event.timeStamp`), y «en frío» es la primera reproducción de la página (#4 y #5): con los e2e en marcha a la vez, 325 ms en frío y 51 ms después.

## 3. Tareas del plan
| Tarea | Estado | Notas |
|---|---|---|
| 4.1 CI verde, caché de navegadores y límite de tiempo | hecha | `.github/workflows/ci.yml` (4.a; revisión del bloque B, #4). En la 4.b, los e2e del build van contra Pages |
| 4.2 Cabeceras y rutas para Cloudflare Pages | hecha | `public/_headers`, `scripts/pages.mjs`, `scripts/pages-headers.mjs`, límites en `scripts/check-bundles.mjs`, `scripts/serve-pages.mjs` y `e2e/headers.spec.ts`. Se borran `public/.htaccess`, `scripts/htaccess*.mjs` y `scripts/serve-static.mjs` |
| 4.3 Despliegue (`deploy.yml`) | hecha; se activa al fusionar | Sustituye a `deploy-staging.yml` (FTPS) |
| 4.4 Verificación con `curl` | hecha en local; en la vista previa, al fusionar | `scripts/verify-pages.mjs` (también corre tras cada despliegue) y `curl` en §6 |
| 4.5 Dependabot | hecha (4.a) | `.github/dependabot.yml`. wrangler entra en el grupo de desarrollo |
| 4.6 Pruebas de Iván en Android e iPhone | pendiente de Iván | Con `docs/PRUEBAS-MOVIL.md` y el panel |
| 4.7 Página de pruebas y `?diagnostico=1` | hecha (4.a) | En la 4.b, con la dirección de la vista previa |

## 4. Desviaciones del plan y motivo
**De la 4.a, siguen valiendo:**
- **El CI también corre en los *push* a `fase-*`.** El proyecto nunca ha usado *pull requests* para las fases; las de Dependabot siguen disparándolo.
- **La CSP se completa en el build**, no con `security.autoCsp`. `autoCsp` pone la política en un `<meta>` con `'strict-dynamic'`:
  - no admite `frame-ancestors`;
  - no se aplicaría a los workers, que se rigen por la cabecera de su propia respuesta (el worklet sí hereda la del documento, también la de un `<meta>`; corregido tras la revisión, #15);
  - obligaría a una segunda política por cabecera, compatible con la del `<meta>`.

  Con los hashes en la cabecera hay una sola política, y cualquier script en línea nuevo rompe el build hasta que tenga su hash.
- **El despliegue sube el artefacto del CI**, no un build nuevo.
- **El panel mide hasta el altavoz** (`getOutputTimestamp()`): es lo que se oye.
- *(Obsoleta con Pages: la contraseña del staging que escribía el despliegue en el `.htaccess`. La vista previa es pública con `noindex`; protegerla con Cloudflare Access es opcional, decisión de Iván.)*

**De la 4.b:**
- **La comprobación en la vista previa va después de la fusión.** El plan pone el despliegue antes de la revisión y la fusión, pero un `workflow_run` solo se dispara con el flujo que hay en `main`. Antes de fusionar, las mismas comprobaciones corren contra `wrangler pages dev`, en local y en el CI.
- **La versión de wrangler del despliegue sale del `package.json` del commit probado**, no de un `wranglerVersion` escrito a mano. Sigue siendo fija (`4.149.0`, sin `^`; el despliegue falla si no es exacta), y no puede separarse de la de los e2e.
- **El despliegue comprueba la vista previa cada vez** (`verify-pages`), no solo en este informe. Si algo no cuadra, el job sale en rojo y el resumen dice qué.
- **El HTML lleva la caché por defecto de Pages** (`public, max-age=0, must-revalidate`), no `no-cache`. En Pages, las páginas se sirven en URLs sin extensión y `_headers` va por URL: una regla por página habría que tocarla con cada ruta nueva. El efecto es el mismo: se revalida siempre, con `ETag`.
- **Sin COOP** (`CLAUDE.md`). **CORP (`same-origin`) se queda:** solo impide que otras webs incrusten los archivos de Torno y no tiene que ver con el aislamiento.
- **Pages añade `Access-Control-Allow-Origin: *`** a los archivos estáticos (se ve en `wrangler pages dev`). Lo dejo: son archivos públicos, sin cookies ni credenciales.
- **«`/_headers` no se sirve» admite cualquier código de error, no solo 404.** Pages no publica `_headers`, porque wrangler lo manda aparte como configuración (lo he visto en su código: `IGNORE_LIST`), y responde 404. Pero en Linux, `wrangler pages dev` responde 502: busca `_headers/index.html` y `lstat` falla con `ENOTDIR`; en Windows da `ENOENT` y un 404. Así falló el primer CI de la 4.b (`ec4638a`, 2 de 97). Lo que importa es que no se sirva: un código de error y sin su contenido.

## 5. Decisiones técnicas nuevas
**De la 4.a**, siguen valiendo:
- `style-src 'self' 'unsafe-inline'`: los estilos de los componentes de Angular van en línea. Los scripts, nunca sin hash.
- HSTS sin `includeSubDomains`.
- Dependabot no toca `three`, TypeScript, `esbuild` ni las versiones mayores de Angular.
- La caché de los navegadores del CI lleva en la clave la versión de Playwright.

Las de Apache (`<IfModule>`, `Header always set`, `DirectorySlash Off`) se van con el `.htaccess`.

**De la 4.b:**
- **Todos los e2e del build contra `wrangler pages dev`**, no solo los de las cabeceras: los 57 corren con las reglas de producción.
  - La alternativa era un servidor propio que imitara a Pages, como el que imitaba a Apache. La descarté: es una imitación más que mantener, y puede separarse de Pages sin que nadie lo note.
  - Coste: unos 3–5 s de arranque de `workerd`.
- **`scripts/serve-pages.mjs`:**
  - escucha solo en 127.0.0.1;
  - `WRANGLER_SEND_METRICS=false`, sin métricas de uso de wrangler;
  - cierra el árbol de procesos entero, porque wrangler lanza otro `node` y `workerd`: `taskkill /T` en Windows y el grupo de procesos en Linux y macOS. Comprobado: tras los e2e y las capturas no queda ningún `workerd`.
- **`noindex` de `torno.pages.dev`, con `https://:project.pages.dev/*`.** Un `:nombre` no cruza puntos en el dominio, así que la regla no casa con `staging.torno.pages.dev`: el `noindex` de las vistas previas lo pone Pages. Se comprueba tras cada despliegue.
- **El analizador de `_headers` (`scripts/pages-headers.mjs`)** solo sirve para comprobar la caché en el build y la CSP tras desplegar. Rechaza lo que no entiende (`!`, dos `*`) y, tras la revisión (#8), lo que en Pages no casaría nunca (`http://…`, reglas de dominio sin ruta).
- **Todo lo que lleva hash, inmutable** (`isHashed`, tras la revisión, #9): el JS y el CSS con el hash de Angular o de esbuild, y cualquier otro archivo con el de los recursos de Angular (`-XXXXXXXX.ext`, en mayúsculas). Así cabrán las imágenes de `media/` de la fase 7, y una página como `sobre-el-proyecto.html` no pasa por tener hash.
- **Límites del `_headers` comprobados en el build:** 100 reglas y 2000 caracteres por línea. La CSP crece con cada script en línea: hoy lleva 3 hashes (la línea, 469 caracteres) y con 30 aún cabría.
- **El HTML servido se compara byte a byte con el del build.** Demuestra que se publica lo que probó el CI y que Cloudflare no inyecta nada: Web Analytics, ni, con el dominio propio, Rocket Loader o la ofuscación de correos.
- **El despliegue** (con las correcciones de la revisión, #1–#3):
  - pregunta a la API de Cloudflare solo por el proyecto `torno` (`curl`, sin imprimir la respuesta): el registro es público y la lista de la cuenta no tiene por qué salir en él. La primera versión la listaba con `quiet`, pero el `env:` del paso siguiente la habría impreso igual;
  - instala wrangler con `npm ci --ignore-scripts` desde el `package-lock.json` del commit probado (el árbol exacto, con sus integridades) y sin el token en el entorno; las acciones lo usan desde `repo/` y no instalan nada. Probado en local: 430 paquetes en 29 s y `wrangler --version` responde sin los scripts de instalación;
  - avisa si la vista previa no queda en `staging.torno.pages.dev` (si el subdominio `torno` estuviera cogido, la API daría otro);
  - marca cada despliegue con el commit probado (`--commit-hash`);
  - usa Node de `.nvmrc`, porque wrangler 4 pide Node 22 o más;
  - nunca cancela un despliegue en curso (`concurrency` sin cancelación).

## 6. Salida de los checks
```
npm run check   (80 s, PC de Iván, tras la respuesta a la revisión)
lint: All files pass linting · Prettier sin cambios
test:node: 453 passed · sentencias 98,4 % · ramas 94,98 %   (4.a: 442)
test:ng: 67 passed   (4.a: 65)
build + postbuild:
✔ Pages: /404, /sobre-el-proyecto como ruta.html; CSP con 3 hashes de scripts en línea (3 páginas); caché comprobada en 24 archivos
check-bundles (sin cambios de tamaño respecto a la 4.a):
✔ JS inicial de /                         302.1 kB  (aviso > 330.0 kB · error > 400.0 kB)
✔ Desbloqueo de audio en el inicial         1.9 kB  (error > 2.0 kB)
✔ Motor de audio (engine.ts)               22.6 kB  (error > 60.0 kB)
✔ Worker synth.worker.ts                   17.4 kB  · Worker export.worker.ts 41.7 kB · Worklet 40.8 kB
✔ Fuentes                                 144.1 kB  (error > 150.0 kB)
✔ Archivo más grande (Pages)              0.28 MiB  (error > 25.00 MiB)  main-PZAKFP57.js
✔ Archivos del despliegue (Pages)      24 archivos  (error > 20000 archivos)
npm run e2e: 97 passed (1,2 min): 40 con ng serve y 57 con el build en wrangler pages dev
  (56 en Chromium, con la comprobación del despliegue entera, y 1 en WebKit)
```

**El build servido como en Pages, con `curl`** (`node scripts/serve-pages.mjs`, en local):
```
/                          200
/sobre-el-proyecto         200
/sobre-el-proyecto/        308 → /sobre-el-proyecto
/sobre-el-proyecto.html    308 → /sobre-el-proyecto
/no-existe                 404   (<h1>Página no encontrada</h1>)
/404                       200

$ curl -sI /
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=0, must-revalidate
Strict-Transport-Security: max-age=31536000
content-security-policy: default-src 'self'; script-src 'self' 'sha256-8sGKvDKC8crv9OBcqEMvqrNDWlm1/80h7NJpJzqOnLI=' …
cross-origin-resource-policy: same-origin
permissions-policy: microphone=(self), camera=(), geolocation=(), payment=(), usb=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY
```
`node scripts/verify-pages.mjs http://localhost:4393 --build dist/torno/browser`: **50 de 50 bien** (39 de 39 antes de la revisión, #6).
- Las tres páginas: 200, se revalidan y son las del build.
- Cinco redirecciones con 308 y la consulta.
- Dos 404 con la página de error; `_headers` y `_redirects` no se sirven.
- La CSP, también en la 404 e igual a la del `_headers`; Permissions-Policy, nosniff, DENY, Referrer-Policy y HSTS; sin COOP ni COEP.
- Los 17 archivos con hash del build (con el worklet, los dos workers y las dos fuentes, que tienen que estar), con su tipo e inmutables; el favicon, un día.
- Ni cookies ni scripts inyectados.

**CI de GitHub en la rama** (Ubuntu 24.04, con WebKit de Linux reproduciendo con audio bajo la CSP):

| Ejecución | Navegadores | e2e | Total |
|---|---|---|---|
| `61acc49` (4.a, primera, sin caché) | descarga completa con `--with-deps` (37 s) | 92 passed | 4 min 22 s |
| `1e77c41` (4.a, con la caché) | caché en 3 s y solo `install-deps` (33 s) | 96 passed en 2,7 min | 4 min 51 s |
| `ec4638a` (4.b, con `wrangler pages dev`) | caché y solo `install-deps` | 95 passed, 2 failed: el 502 de `/_headers` en Linux (§4) | 5 min 52 s |
| `bb40504` (4.b, corregido) | caché y solo `install-deps` (24 s) | **97 passed** en 3,1 min | 5 min 41 s |

**CI de `main` tras la fusión:**

| Ejecución | Navegadores | Resultado |
|---|---|---|
| `45c5df7`, intentos 1 y 2 | sin caché en `main`: instalación completa | ✖ los dos, a los 10 min. El espejo de `apt` de Azure se quedó parado a mitad de una descarga (`libsvtav1enc1d1`, `libvpx9`). El despliegue se saltó las dos veces |
| `b434f25`, con `apt` con tiempo límite, reintentos y sin *pipelining* (corrección en `main`) | instalación completa en 40 s | ✅ 6 min 5 s; e2e en verde |
| `cbf0849` (documentos) | con la caché de `main` | ✅ 4 min 45 s |
| `79e3eed` (documentos) | con caché: solo `install-deps` | ✖ a los 10 min: el espejo seguía a cuentagotas (`librav1e0`), y eso no lo corta el tiempo límite de `apt`. El despliegue se saltó y la vista previa siguió con `cbf0849`, el mismo build |
| `cac69e6`, intentos cortados con `timeout` y hasta 3 | con caché | ✖ a los 3 min: `timeout` cortó `npx`, pero no el `apt-get` que Playwright lanza con `sudo` (va en su propia sesión). Siguió vivo, con el bloqueo de `dpkg`, y los intentos 2 y 3 chocaron con él |
| Corrección en `main`: `scripts/ci-playwright.sh` | cada instalación, en intentos de 3 min (con caché) o 4 min (sin ella), hasta 3. Tras un intento cortado, cierra aparte ese `apt-get`, `dpkg --configure -a` y, desde el segundo intento, `apt` usa `archive.ubuntu.com` en vez del espejo de Azure. `apt` espera el bloqueo de `dpkg` hasta 2 min; el job tiene 30 min de margen | — |

En la rama, la caché de los navegadores hace que solo se instalen los paquetes del sistema. Pero `main` no puede leer la caché de otra rama: su primera vez es una instalación completa, la más expuesta a un espejo lento. Desde `b434f25`, `main` ya tiene su caché.

**La vista previa** (`https://staging.torno.pages.dev`), primer despliegue (`deploy.yml`, ejecución 40547930197, commit `b434f25`):
- **Proyecto:** `torno` no existía y se creó (la API respondió 404 y luego `pages project create`). El subdominio estaba libre: la vista previa queda en `staging.torno.pages.dev`, sin aviso de dirección distinta.
- **Subida:** 24 archivos y el `_headers` en 2 s. Este despliegue: `https://3ca22254.torno.pages.dev`. La acción usó el wrangler del lockfile («✅ Using Wrangler 4.149.0», sin instalar nada).
- **La comprobación del job falló**, pero no por el sitio: `fetch failed`, con `ssl/tls alert handshake failure`. El certificado del subdominio recién creado aún no estaba en todos los nodos de Cloudflare. Minutos después, desde aquí y con el artefacto exacto que se desplegó (descargado del CI), **52 de 52**. Para que no vuelva a pasar, `verify-pages` reintenta los cortes de red y de TLS y, si no hay manera, lo dice con su causa (`e71669a`).
- **Segundo despliegue** (ejecución 40549729359, commit `cbf0849`): en verde de principio a fin, en 48 s. El proyecto ya existía, así que el paso de crearlo se salta. La comprobación pasa en el propio job: **52 de 52**. Este despliegue: `https://49d76608.torno.pages.dev`.

`node scripts/verify-pages.mjs https://staging.torno.pages.dev --build <artefacto de b434f25>`: **52 de 52 bien**. Respecto de las 50 de local, añade dos:
- `X-Robots-Tag: noindex`, que pone Pages en las vistas previas;
- `http://` → `https://` con un 301.

Además, Pages da 404 a `/_headers` y `/_redirects`; ni cookies ni scripts inyectados; y el HTML de las tres páginas, idéntico byte a byte al del artefacto.

**`curl` en la vista previa:**
```
/                          200
/sobre-el-proyecto         200
/sobre-el-proyecto/        308 → https://staging.torno.pages.dev/sobre-el-proyecto
/sobre-el-proyecto.html    308 → https://staging.torno.pages.dev/sobre-el-proyecto
/no-existe                 404   (<h1>Página no encontrada</h1>)
/404                       200

$ curl -sI https://staging.torno.pages.dev/sobre-el-proyecto/
HTTP/1.1 308 Permanent Redirect
Location: /sobre-el-proyecto

$ curl -sI https://staging.torno.pages.dev/
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=0, must-revalidate
Link: <chunk-DJVAsKa_.js>; rel="modulepreload", <chunk-455DNjWZ.js>; rel="modulepreload"
Strict-Transport-Security: max-age=31536000
content-security-policy: default-src 'self'; script-src 'self' 'sha256-8sGKvDKC8crv9OBcqEMvqrNDWlm1/80h7NJpJzqOnLI=' …
cross-origin-resource-policy: same-origin
permissions-policy: microphone=(self), camera=(), geolocation=(), payment=(), usb=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY
x-robots-tag: noindex

$ curl -sI https://torno.pages.dev/
HTTP/1.1 404 Not Found        (aún no hay producción: llega en la fase 9)
```
Lo único que Pages añade y `wrangler pages dev` no: el `Link` de *Early Hints* (los `modulepreload` de la página) y el `noindex` de la vista previa. Ninguna de las dos cosas pide cambiar nada.

## 7. Capturas
En `docs/informes/img/fase-4/`, de escritorio y móvil (30):
- `instrumento-diagnostico-*`: el panel `?diagnostico=1` antes de tocar, sin cifras para que la captura no cambie (4.a).
- El resto, idénticas a las de la fase 3, porque la CSP no cambia nada a la vista. La excepción es `instrumento-recuperar-confirmar-movil`, que ya parte la línea de la pantalla tras el «·» (revisión de la fase 3, #6).
- **4.b:** rehechas con el build servido por `wrangler pages dev`, las 30 salen idénticas byte a byte (`git status` limpio). La 4.b no cambia nada a la vista.
- **Tras la revisión (#12):** en `instrumento-diagnostico-*`, la fila «Navegador» dice «Oculto en las capturas» en vez del agente de usuario, que cambiaba con cada versión de Playwright. Las otras 28 no cambian.

## 8. Dependencias añadidas
| Paquete | Versión | Motivo | ¿En la lista permitida? |
|---|---|---|---|
| `wrangler` (desarrollo) | 4.149.0, exacta | `wrangler pages dev` en los e2e y las capturas; la misma versión en el despliegue | Sí (PLAN §1, D19) |

Acciones de GitHub, fijadas por SHA:

| Acción | Versión | Para |
|---|---|---|
| `actions/cache` | v6.1.0 | Caché de los navegadores de Playwright (4.a) |
| `actions/download-artifact` | v8.0.2 | El despliegue descarga el build del CI (4.a) |
| `cloudflare/wrangler-action` | v4.1.3 (`953926a…`, comprobado con la etiqueta) | Crear el proyecto y desplegar en Pages (4.b) |
| ~~`SamKirkland/FTP-Deploy-Action`~~ | — | Se va con el FTPS (4.b) |

**`npm audit`:** wrangler 4.149.0 trae miniflare con `undici` 7.29.1, que tiene tres avisos (dos altos): una denegación de servicio en su lector de `EventSource`, otra con demasiadas codificaciones y un salto de SRI.
- **Están arreglados** en wrangler 4.153.0, que salió ayer (26-10).
- **Aquí no hay a quién atacar:** `undici` solo trabaja en el servidor local, que sirve nuestros archivos en 127.0.0.1, y en las llamadas del despliegue a la API de Cloudflare.
- **No subo ya a una versión de un día** que además manejaría el token de Cloudflare. Dependabot la propondrá y pasará el CI antes de llegar al despliegue.

Sigue también el aviso de `vite` dentro de `@angular/build`, solo del servidor de desarrollo (bloque 0).

## 9. Pendientes y `TODO(ivan)`
También en `docs/PENDIENTES.md`:
- **Iván:**
  - las pruebas de `docs/PRUEBAS-MOVIL.md` en Android e iPhone, en `https://staging.torno.pages.dev/?diagnostico=1`. Desbloquean el bloque C;
  - opcional: proteger la vista previa con Cloudflare Access;
  - fase 9: `torno.ivanchesa.es` en *Custom domains* y su CNAME.
- **Claude Code:**
  - ~~tras fusionar, comprobar el primer despliegue~~: hecho (§6, «La vista previa»);
  - las dos PR que abrió Dependabot al llegar `dependabot.yml` a `main`, sin tocar:
    - #1: wrangler 4.149.0 → 4.152.0. Los avisos de `undici` se arreglan en la 4.153.0;
    - #2: `@types/node` 22 → 26, una versión mayor que no corresponde (el proyecto admite Node 22 y 24). `dependabot.yml` ya no propone versiones mayores de `@types/node` (`d3edeab`), así que la #2 se puede cerrar;
  - en la fase 7, la imagen Open Graph (revisión, #10): CORP `same-origin` va en todo, y si esa imagen tuviera que poder incrustarse desde otra web, haría falta quitarle la cabecera (`! Cross-Origin-Resource-Policy`, que el analizador tendría que aprender) o llevar CORP de `/*` a las reglas que la necesiten;
  - en la fase 9, la producción (`--branch=main` con una etiqueta `v*`).

## 10. Propuestas de cambio al plan
1. **Aprobar ya la precarga de ALFAR al acercarse al instrumento** (de la 4.a; la revisión, #14, pide proponerla ya). Preparar en silencio (cargar el motor, crear el worker y renderizar ALFAR a la caché) está permitido (`CLAUDE.md`). La primera reproducción en frío ya pasa de los 150 ms de PLAN §5 en el escritorio:
   - 157–238 ms en mi PC, con el PC tranquilo;
   - 203–233 ms en el CI de Linux (las dos últimas ejecuciones de la rama, en `dev` y en `estatico`);
   - 266–405 ms en la pasada del revisor, con carga.

   Un móvil solo puede ir más lento. Propuesta: hacerla al empezar el bloque C (o antes, si Iván quiere). Las cifras de la prueba 1 en el móvil servirán para medir el efecto.
2. **Vistas previas de las ramas de fase.** Un *push* a `fase-*` con el CI en verde publicaría en `<rama>.torno.pages.dev`; `staging` seguiría siendo solo `main`. Así Iván podría probar en el móvil antes de fusionar: el 3D de las fases 5 y 6 y el pulido de la 8. Hoy solo despliega `main` (D19), y un `workflow_run` no sirve para las ramas: haría falta un job de despliegue dentro del CI.

## 11. Cómo probarlo
- `npm run build` y `node scripts/serve-pages.mjs`: el build en `http://localhost:4300`, servido por `wrangler pages dev` como en Pages.
  - `curl -I http://localhost:4300/` enseña la CSP con sus hashes, Permissions-Policy y la caché.
  - `curl -I http://localhost:4300/sobre-el-proyecto/` da un 308 a la ruta sin barra.
- `node scripts/verify-pages.mjs http://localhost:4300 --build dist/torno/browser`: las comprobaciones del despliegue, en local.
- `http://localhost:4300/?diagnostico=1`: el panel bajo el instrumento. Pulsa REPRODUCIR y verás «Del toque al primer sonido» (la primera, en frío). «Copiar el informe» lo deja en el portapapeles.
- Tras la fusión: `https://staging.torno.pages.dev/?diagnostico=1` en el móvil, con `docs/PRUEBAS-MOVIL.md`.

---

## Respuesta a la revisión
[Revisión](../revisiones/fase-4.md): CAMBIOS NECESARIOS, sin Bloqueantes. Corregidos el Importante, los 6 Menores y 6 de las 8 Sugerencias; las otras 2 quedan anotadas (#10, para la fase 7) o como propuesta a Iván (#14).

| Hallazgo | Acción | Commit |
|---|---|---|
| 1 · Importante: la lista de proyectos de la cuenta saldría en el registro público | Corregido. Se pregunta a la API solo por `torno` (`curl`, sin imprimir la respuesta): 200 existe, 404 se crea, otro código falla. Frase del §5 corregida | `303a452` |
| 2 · Menor: wrangler se instalaba fuera del lockfile y con el token en el entorno | Corregido: `npm ci --ignore-scripts` en el commit probado, sin el token, y `workingDirectory: repo` en las acciones. Probado en local que wrangler funciona sin los scripts de instalación | `303a452` |
| 3 · Menor: `staging.torno.pages.dev` se daba por hecha | Corregido: aviso en el job si el alias es otro. La dirección real se apunta tras el primer despliegue | `303a452` |
| 4 · Menor: «en frío» era la primera medida, no la primera reproducción | Corregido: el store sabe si ya ha habido una reproducción, con o sin panel. Dos tests nuevos: la primera reproducción sin panel y una pausa de verdad, que no mide | `543d3af` |
| 5 · Menor: la medida empezaba en el manejador, no en el toque | Corregido: las pulsaciones llevan `event.timeStamp` (clic, gesto, teclado y atajos); si no es del reloj de `performance.now()`, el de ahora (test) | `543d3af` |
| 6 · Menor: las comprobaciones del worklet y de los workers podían desaparecer | Corregido: con `--build`, todos los archivos con hash, y falla si falta el worklet, alguno de los dos workers o las fuentes. 50 comprobaciones en local | `626df18` |
| 7 · Menor: comentario del «ErrorDocument de Apache» | Corregido | `540c29b` |
| 8 · Sugerencia: reglas `http://` y de dominio sin ruta | Hecha: el analizador las rechaza (tests) | `626df18` |
| 9 · Sugerencia: `HASHED` solo con `.js`, `.css` y `.woff2` | Hecha: `isHashed` con cualquier extensión para los recursos de Angular, y todo lo que lleva hash, inmutable (tests con una imagen de `media/`) | `626df18` |
| 10 · Sugerencia: CORP `same-origin` y la imagen Open Graph | Anotada para la fase 7 (§9): es entonces cuando existirá esa imagen | — |
| 11 · Sugerencia: el navegador de las capturas, fuera del `try`; `close()` con wrangler ya cerrado | Hecha: `chromium.launch()` dentro del `try`, y en Linux y macOS se mata siempre el grupo (ignorando `ESRCH`) | `540c29b` |
| 12 · Sugerencia: el agente de usuario en las capturas del panel | Hecha: con `?captura=1`, «Oculto en las capturas». Las 2 capturas del panel, rehechas | `5d50530` |
| 13 · Sugerencia: la prueba 1 con auriculares Bluetooth | Hecha: las pruebas 1 y 2 piden el altavoz o auriculares de cable, y esperar al panel antes de tocar | `18a48ea` |
| 14 · Sugerencia: proponer ya la precarga de ALFAR | Propuesta en §10.1, con las cifras de los tres sitios. Lo decide Iván | `18a48ea` |
| 15 · Sugerencia: dos frases del informe | Corregidas: el worklet hereda la política del documento, y son 57 los e2e contra `wrangler pages dev` | `18a48ea` |

Tras las correcciones:
- `npm run check`: en verde (453 tests en Node y 67 en Angular).
- e2e: 97 de 97.
- `verify-pages` en local: 50 de 50.
- Sin procesos `workerd` propios al terminar. Los dos que quedaban vivos eran de otra sesión, la de `ivan-chesa.es`, y no los he tocado.
