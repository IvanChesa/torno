# Informe: Fase 4 (staging, entrega continua y móviles reales)

- **Rama:** `fase-4-staging`
- **Fecha:** 2026-10-26
- **Estado:** en curso (entrega 4.a, sin credenciales; la 4.b espera al staging)

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
