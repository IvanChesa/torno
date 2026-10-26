# Pendientes

Decisiones y tareas que dependen de Iván. Claude Code añade aquí cada `TODO(ivan):`.

## Ya hecho
- [x] Proyecto: instrumento de bucles en 3D inspirado en TAPE, con paridad completa y mejoras (24-10).
- [x] Nombre y carpeta: **Torno** (`torno`) (24-10; antes «Bucle»).
- [x] Forma de trabajar: una sesión planifica y revisa; Claude Code (Opus 5.5) programa (24-10).
- [x] Dirección visual: **B «Barro»** (24-10).

## Antes del bloque B (fase 4)
- [x] Repo en GitHub: `IvanChesa/torno`, público; se conecta en el bloque A (24-10).
- [x] GitHub CLI instalado y `gh auth login` hecho (comprobado el 26-10).
- [ ] **Staging en cPanel** (para la entrega 4.b; la 4.a, sin credenciales, ya está en la rama `fase-4-staging`):
  1. Subdominio `staging-torno.ivanchesa.es` con AutoSSL (HTTPS).
  2. Protección con contraseña de su carpeta («Privacidad de directorios»). Apunta la ruta del archivo de contraseñas que enseña cPanel (algo como `/home/USUARIO/.htpasswds/…/passwd`): cada despliegue sustituye el `.htaccess` de la carpeta, donde cPanel escribe la protección, y el despliegue la vuelve a poner con esa ruta.
  3. Una cuenta FTP limitada a la carpeta del subdominio.
  4. Los secrets, desde la carpeta del proyecto (cada orden pide el valor, que no se ve ni queda en el historial):
     - `gh secret set STAGING_FTP_SERVER` (el servidor FTP, por ejemplo el que da cPanel en «Cuentas FTP»);
     - `gh secret set STAGING_FTP_USERNAME`;
     - `gh secret set STAGING_FTP_PASSWORD`;
     - `gh secret set STAGING_AUTH_USER_FILE` (la ruta del paso 2).

  Con eso, cada push a `main` con el CI en verde despliega solo (`.github/workflows/deploy-staging.yml`, cuando la 4.b llegue a `main`). El 26-10, el subdominio no resolvía y el repo no tenía secrets.
- [ ] Conseguir un iPhone para probar (aunque sea prestado) y tener a mano unos auriculares, mejor con cable.

## Decisiones
- [ ] **Subdominio definitivo.** Propuesto: `torno.ivanchesa.es`. Si cambia, se edita solo `src/app/core/site.config.ts`.
- [x] **Autoguardado local** (D16): activado por defecto, visible y borrable (sin cambios de Iván antes del bloque A).
- [ ] **Licencia del código propio** cuando el repo pase a público (MIT u otra).
- [ ] `@lhci/cli` en el CI (fase 8).
- [x] **Autoguardado con el panel de recuperar sin contestar** (revisión de la fase 2, #21): **segundo hueco** (decisión de Iván, 26-10; PLAN §4.8). Se implementa al empezar el bloque B (`docs/revisiones/bloque-A.md`, #3).
- [ ] **Micrófono entre tomas** (si las pruebas de la fase 4 lo piden): mantenerlo abierto durante una «sesión de grabación» o recalibrar cada toma con la cuenta previa (informe de la fase 2, §10, propuesta 1).
- [ ] **Indexación en el lanzamiento (fase 9).** Hasta entonces todas las páginas llevan `noindex` (`indexable: false` en `src/app/core/site.config.ts`); al lanzar se pone a `true` y solo la 404 sigue con `noindex`. Confirmar que quieres que se indexe.

## Revisiones y pruebas de Iván
- [ ] Ver `docs/DISENO.md` y las capturas de la fase 0 (`docs/informes/img/fase-0/`): paleta «Barro», Fraunces con el eje SOFT y Geist Mono (revisión del bloque 0).
- [x] **Escuchar los 12 sonidos y 3 combinaciones** (`npm run demo:sounds`): Iván los ha escuchado y «suenan bien», sin cambios (26-10).
- [ ] Pruebas en Android e iPhone por el staging (fase 4; necesarias antes del bloque C), con la lista de **`docs/PRUEBAS-MOVIL.md`** y el panel de diagnóstico (`?diagnostico=1`).
  - `TODO(ivan)`: en esas pruebas, calibrar la latencia y grabar varias tomas seguidas con auriculares, para ver si quedan alineadas entre sí. En Chromium, la latencia del camino del micrófono cambia en cada apertura de la pista (12–21 ms medidos en un retorno; informe de la fase 2, §10, propuesta 1).
  - `TODO(ivan)`: y una de 5 min con las 4 capas largas (tomas de 30–60 s) y el autoguardado activo, girando diales: sin cortes en el audio (revisión de la fase 2, #6).
- [ ] Aprobar el diseño del instrumento (parada de la fase 5.a).
- [ ] Revisar los textos de la web (fase 7).
- [ ] Visto bueno final en el móvil y en el iPhone (fase 8).

## Fase 9 (manual)
- [ ] Subdominio de producción con AutoSSL, cuenta FTP limitada y secrets de producción.
