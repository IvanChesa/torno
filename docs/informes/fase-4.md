# Informe: Fase 4 (staging, entrega continua y móviles reales)

- **Rama:** `fase-4-staging`
- **Fecha:** 2026-10-26 (4.a) y 2026-10-27 (4.b)
- **Estado:** en curso (entrega 4.b: Cloudflare Pages)

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

## 1. Resumen (entrega 4.a)
Todo lo de la fase 4 que no necesita credenciales está hecho en la rama `fase-4-staging`:
- **CI:** caché de los navegadores de Playwright, 10 min como mucho para instalarlos, también en las ramas de fase, y el build de `main` guardado como artefacto para el despliegue.
- **`.htaccess`:** HTTPS, URLs sin barra, 404, caché por tipo y cabeceras de seguridad. La CSP lleva los hashes de los scripts en línea, que escribe el build.
- **Despliegue a staging** por FTPS, escrito e inactivo hasta que haya secrets.
- **Dependabot.**
- **Pruebas en el móvil:** la lista de `docs/PRUEBAS-MOVIL.md` y el panel `?diagnostico=1`, que mide del toque al primer sonido.

Los e2e del build corren ahora bajo la CSP de producción, también en WebKit. La 4.b (desplegar, `curl` y las pruebas de Iván) espera al staging.

## 2. Criterios de aceptación
Los criterios de la fase 4 se cierran en la 4.b; esto es lo que deja la 4.a.

| Criterio | Estado | Evidencia |
|---|---|---|
| CI verde y staging actualizado solo al hacer *push* a `main` | ⏳ (CI ✅; staging en la 4.b) | CI de la rama en verde, con y sin la caché (§6). `deploy-staging.yml` solo se dispara tras el CI en verde de un *push* a `main` (`workflow_run`, `branches: [main]`, `event == 'push'`) y, sin secrets, no despliega. |
| Comprobaciones con `curl` en el informe | ⏳ 4.b | En local, el servidor del build aplica las cabeceras del `.htaccess`, y un e2e comprueba las cabeceras, los códigos y la caché (`e2e/headers.spec.ts`). Contra el servidor real, en la 4.b. |
| Lista de prueba en el informe y resultados de Iván | ⏳ (lista ✅; resultados en la 4.b) | `docs/PRUEBAS-MOVIL.md`: 14 pruebas con casillas y huecos para las cifras, más el panel `?diagnostico=1` para leerlas. |

Lo demostrado en esta entrega:
- **CSP compatible con todo el instrumento:** en un recorrido completo bajo la CSP de producción (reproducir, grabar con el micrófono, guardar, exportar la mezcla y las pistas), ninguna violación. Control: un script en línea sin hash se bloquea y dispara `script-src-elem` (`e2e/headers.spec.ts`). Los 55 e2e del proyecto «estático» y el de WebKit corren con esas cabeceras.
- **Caché:** el build comprueba que los 26 archivos caen en su regla: JS, CSS, fuentes y worklet con hash, `immutable`; HTML `no-cache`; el resto, un día.
- **Panel de diagnóstico:** mide del toque a que el sonido sale por el altavoz. En el escritorio (Chromium, build estático, PC tranquilo): **primera reproducción en frío 157–238 ms; después, 48–54 ms** (con unos 40 ms de latencia de salida que informa Chrome en Windows).

## 3. Tareas del plan
| Tarea | Estado | Notas |
|---|---|---|
| 4.1 CI verde, caché de navegadores y límite de tiempo | hecha | `.github/workflows/ci.yml` (revisión del bloque B, #4) |
| 4.2 `.htaccess` y CSP con su e2e | hecha | `public/.htaccess`, `scripts/htaccess.mjs`, `scripts/htaccess-rules.mjs`, `e2e/headers.spec.ts` |
| 4.3 `deploy-staging.yml` | escrita | Se activa en la 4.b con los secrets |
| 4.4 Comprobación con `curl` | 4.b | — |
| 4.5 Dependabot | hecha | `.github/dependabot.yml` |
| 4.6 Pruebas de Iván en Android e iPhone | 4.b | Con la lista y el panel de la tarea 7 |
| 4.7 Página de pruebas y `?diagnostico=1` | hecha | `docs/PRUEBAS-MOVIL.md`, `features/diagnostics/`, `audio/engine/diagnostics.ts` |

## 4. Desviaciones del plan y motivo
- **El CI también corre en los *push* a `fase-*`.** El comentario del CI daba por hecho que las ramas de fase pasaban por *pull request*, pero el proyecto nunca ha usado *pull requests*. Las *pull requests* siguen disparándolo (las de Dependabot).
- **La CSP se completa en el build** (`scripts/htaccess.mjs`), no con `security.autoCsp`. `autoCsp` pone la política en un `<meta>` con `'strict-dynamic'`. Eso no admite `frame-ancestors`, no se aplicaría al worklet ni a los workers (que se rigen por la cabecera de su propia respuesta) y obligaría a una segunda política por cabecera, compatible con la del `<meta>`. Con los hashes en la cabecera, hay una sola política para todo, y cualquier script en línea nuevo rompe el build hasta tener su hash.
- **El despliegue sube el artefacto del CI**, no un build nuevo: lo que se despliega es exactamente lo que ha pasado los e2e.
- **La contraseña del staging la escribe el despliegue** (`STAGING_AUTH_USER_FILE`). La «privacidad de directorios» de cPanel guarda la protección en el `.htaccess` de la carpeta, que cada despliegue sustituye.
- **El panel mide hasta el altavoz** (con `getOutputTimestamp()`), no a la salida del motor. Es lo que se oye, y lo que importa para el criterio de 150 ms de la revisión del bloque B, #2.

## 5. Decisiones técnicas nuevas
- **Sin `<IfModule>` en las cabeceras y la reescritura:** si al servidor le faltara el módulo, mejor un error 500 visible en el staging que una web sin CSP. La compresión sí va en `<IfModule>` (es opcional; LiteSpeed comprime solo).
- **`Header always set`** para que la 404 y las redirecciones también lleven las cabeceras.
- **COOP y CORP, sin COEP:** no hace falta el aislamiento de origen cruzado (no hay `SharedArrayBuffer`, D7) y COEP solo complicaría.
- **HSTS sin `includeSubDomains`:** solo afecta a este subdominio, no a ivanchesa.es.
- **`style-src 'self' 'unsafe-inline'`:** los estilos de los componentes de Angular van en `<style>` en línea. Los scripts, nunca sin hash.
- **Nada que empiece por punto** se sirve: el estado del despliegue por FTP (`.ftp-deploy-sync-state.json`) queda en la raíz del sitio.
- **`DirectorySlash Off`** con `Options -Indexes`, más dos reglas: `/ruta/` redirige a `/ruta` y `/ruta` sirve `ruta/index.html`.
- **Dependabot sin** `three`, TypeScript, `esbuild` ni las versiones mayores de Angular: el plan los fija a mano.
- **La caché de los navegadores en el CI** lleva en la clave la versión de `@playwright/test` y los navegadores (`chromium-webkit`).

## 6. Salida de los checks
```
npm run check   (66 s, PC de Iván)
lint: All files pass linting.
test:node: 442 passed · sentencias 98,4 % · ramas 94,98 %
test:ng: 65 passed
build + postbuild:
✔ .htaccess: CSP con 3 hashes de scripts en línea (4 páginas); caché comprobada en 26 archivos
check-bundles:
✔ JS inicial de /                     302.1 kB  (antes 301,5; aviso > 330 kB)
✔ Desbloqueo de audio en el inicial     1.9 kB  (sin cambios; error > 2 kB)
✔ Motor de audio (engine.ts)           22.3 kB  (antes 21,0)
✔ Worker synth.worker.ts               17.4 kB
✔ Worker export.worker.ts              41.7 kB
✔ Worklet                              40.8 kB
✔ Fuentes                             144.1 kB
npm run e2e: 96 passed (65 s): 40 con ng serve, 55 con el build estático y las cabeceras
  del .htaccess, y 1 en WebKit (también con las cabeceras)
```

**CI de GitHub en la rama** (Ubuntu 24.04, con WebKit de Linux reproduciendo con audio bajo la CSP):

| Ejecución | Navegadores | Instalación | e2e | Total |
|---|---|---|---|---|
| `61acc49` (primera, sin caché) | descarga completa con `--with-deps` | 37 s | 92 passed | 4 min 22 s |
| `1e77c41` (con la caché) | caché restaurada en 3 s y solo `install-deps` (apt) | 3 s + 33 s | 96 passed en 2,7 min | 4 min 51 s |

La caché apenas acorta la instalación, porque los paquetes de `apt` siguen siendo la mayor parte. Lo que quita es la descarga de los navegadores, que es donde se quedó colgado el CI de `03e20e5`. Si se colgara `apt`, el límite de 10 min lo corta a tiempo.

## 7. Capturas
`docs/informes/img/fase-4/`, escritorio y móvil, del build servido con las cabeceras del `.htaccess`:
- `instrumento-diagnostico-*`: el panel `?diagnostico=1` antes de tocar (sin cifras, para que la captura no cambie).
- El resto, idénticas byte a byte a las de la fase 3: la CSP no cambia nada a la vista. Solo `instrumento-recuperar-confirmar-movil` cambia, porque ya parte la línea de la pantalla detrás del «·» (revisión de la fase 3, #6, corregida después de aquellas capturas).

## 8. Dependencias añadidas
Ninguna en `package.json`. Acciones de GitHub nuevas, fijadas por SHA:

| Acción | Versión | Para |
|---|---|---|
| `actions/cache` | v6.1.0 | Caché de los navegadores de Playwright en el CI |
| `actions/download-artifact` | v8.0.2 | El despliegue descarga el build del CI |
| `SamKirkland/FTP-Deploy-Action` | v4.4.0 | Subida por FTPS (la que nombra el plan) |

## 9. Pendientes y `TODO(ivan)`
Para la 4.b (también en `docs/PENDIENTES.md`):
- **Iván:** el staging en cPanel (subdominio con AutoSSL, privacidad de directorios y cuenta FTP limitada) y los cuatro secrets (`STAGING_FTP_SERVER`, `STAGING_FTP_USERNAME`, `STAGING_FTP_PASSWORD` y `STAGING_AUTH_USER_FILE`). Después, las pruebas de `docs/PRUEBAS-MOVIL.md` en Android e iPhone.
- **Claude Code, en la 4.b:**
  - fusionar para activar el despliegue (el `workflow_run` solo funciona desde `main`);
  - comprobar con `curl` los códigos, las cabeceras, el MIME y la caché del servidor real, y ver si Imunify360 deja pasar el FTP desde GitHub;
  - si el certificado del FTP no casa, ajustar `security` en el despliegue;
  - la revisión y la fusión.

## 10. Propuestas de cambio al plan
1. **Precargar ALFAR al acercarse al instrumento ya en la 4.b**, sin esperar a las cifras del móvil. En el escritorio, la primera reproducción en frío ya tarda 157–238 ms hasta el altavoz, por encima de los 150 ms que fijó la revisión del bloque B, y un móvil de gama media irá más lento. Preparar en silencio (cargar el motor, crear el worker y renderizar ALFAR a la caché) está permitido desde el bloque B (CLAUDE.md). Las pruebas de Iván medirían ya el resultado con la precarga.

## 11. Cómo probarlo
- `npm run build` y `node scripts/serve-static.mjs`: el build en `http://localhost:4300`, con las cabeceras del `.htaccess`. Con `curl -I http://localhost:4300/` se ven la CSP (con sus hashes), Permissions-Policy y la caché; `curl -I http://localhost:4300/sobre-el-proyecto/` da un 301 a la ruta sin barra.
- `http://localhost:4300/?diagnostico=1`: el panel bajo el instrumento. Pulsa REPRODUCIR y verás «Del toque al primer sonido» (la primera, en frío); «Copiar el informe» lo deja en el portapapeles.
- El `.htaccess` final está en `dist/torno/browser/.htaccess`.
