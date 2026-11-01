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
- [x] ~~Staging en cPanel (subdominio, contraseña, FTP y sus 4 secrets)~~: ya no hace falta. Desde el 27-10, el hosting es **Cloudflare Pages** (PLAN D19).
- [x] **Secrets de Cloudflare en `IvanChesa/torno`** (para la entrega 4.b), como en tierra-luna-sol: puestos el 27-10 (`gh secret list`). Desde la carpeta `torno` (cada orden pide el valor, que no se ve):
  - `gh secret set CLOUDFLARE_API_TOKEN`: un token con **solo** «Account → Cloudflare Pages → Edit». Vale el mismo de tierra-luna-sol si está limitado a tu cuenta y no a un proyecto;
  - `gh secret set CLOUDFLARE_ACCOUNT_ID`: el *Account ID*, que sale en la columna derecha de la página de inicio de tu cuenta de Cloudflare.

  El proyecto `torno` lo crea el propio despliegue si no existe. Con los secrets, cada push a `main` con el CI en verde se publica en `staging.torno.pages.dev`.
- [ ] (Opcional) Proteger la vista previa con Cloudflare Access (Pages → `torno` → Settings). Por defecto queda pública con `noindex`, porque el repo ya es público.
- [ ] Conseguir un iPhone para probar (aunque sea prestado) y tener a mano unos auriculares, mejor con cable.

## Decisiones
- [x] **Subdominio definitivo:** `torno.ivanchesa.com` (31-10: la web de Iván pasa a ivanchesa.com y el .es se deja caducar). El código lo cambia la fase 7 en `src/app/core/site.config.ts`.
- [x] **Autoguardado local** (D16): activado por defecto, visible y borrable (sin cambios de Iván antes del bloque A).
- [ ] **Licencia del código propio** cuando el repo pase a público (MIT u otra).
- [ ] `@lhci/cli` en el CI (fase 8).
- [x] **Autoguardado con el panel de recuperar sin contestar** (revisión de la fase 2, #21): **segundo hueco** (decisión de Iván, 26-10; PLAN §4.8). Se implementa al empezar el bloque B (`docs/revisiones/bloque-A.md`, #3).
- [ ] **Micrófono entre tomas** (si las pruebas del móvil lo piden; sus cifras, en la fase 8): mantenerlo abierto durante una «sesión de grabación» o recalibrar cada toma con la cuenta previa (informe de la fase 2, §10, propuesta 1).
- [ ] **Indexación en el lanzamiento (fase 9).** Hasta entonces todas las páginas llevan `noindex` (`indexable: false` en `src/app/core/site.config.ts`); al lanzar se pone a `true` y solo la 404 sigue con `noindex`. Confirmar que quieres que se indexe.
- [x] **Precargar ALFAR al acercarse al instrumento** (revisión del bloque B, fase 4, #1): hecha al empezar el bloque C (30-10). En el escritorio, la primera reproducción en frío baja de 200–272 ms a 68–93 ms; la prueba 1 del móvil da la cifra de antes y la de después.
- [x] **Las dos PR de Dependabot:** la #1 (wrangler 4.152.0) fusionada con su CI en verde (30-10); la #2 (`@types/node` 26), cerrada.
- [x] **El autoguardado con los dos huecos ofrecidos** (informe de la fase 6, §10, propuesta 1): **aceptada** en la revisión del bloque C (01-11). Lo que se toca espera a que se conteste el panel, y el panel tiene que verse siempre; ya está en PLAN §4.8.
- [ ] `TODO(ivan)`: **las zonas táctiles a 320 px de ancho** (revisión de la fase 6, #13). A 320 px, el ancho mínimo de WCAG 1.4.10, las zonas de 44 px de la capa 1 y del volumen se pisan unos 4 px; las demás, no. Desde 360 px no se pisa ninguna, con test.
  - Opción 1: por debajo de 360 px, encoger esa pareja (WCAG 2.2 pide 24 px).
  - Opción 2: dejarlo así, con el criterio en el encuadre del móvil desde 360 px.
  - Se decide en la fase 8, con tu móvil.
- [ ] `TODO(ivan)`: **confirmar el espejo de la pantalla (opción B)** (informe de la fase 6, §10, propuesta 2; decidido con la maqueta de la fase 7). En el escritorio, una lectura pequeña en la esquina de la caja del 3D; en el móvil, encima, como antes. Capturas de las dos opciones: `docs/informes/img/fase-7/maqueta-espejo-{a,b}-*.png`. Volver a la A es cambiar solo el CSS del escenario.

## Revisiones y pruebas de Iván
- [ ] Ver `docs/DISENO.md` y las capturas de la fase 0 (`docs/informes/img/fase-0/`): paleta «Barro», Fraunces con el eje SOFT y Geist Mono (revisión del bloque 0).
- [x] **Escuchar los 12 sonidos y 3 combinaciones** (`npm run demo:sounds`): Iván los ha escuchado y «suenan bien», sin cambios (26-10).
- [x] **Pruebas en el móvil** en la vista previa (`https://staging.torno.pages.dev/?diagnostico=1`), con la lista de `docs/PRUEBAS-MOVIL.md`: **Iván, 30-10: probado en el móvil, funciona bien; sin cifras ni informe del panel.** Con eso empieza la entrega 5.b (decisión de Iván del 30-10). Las cifras pasan a la fase 8 (abajo).
- [x] **Diseño del instrumento aprobado (parada de la fase 5.a).** Iván lo aprueba tal cual el 30-10, con la maqueta de `https://fase-5-modelo-3d.torno.pages.dev/?maqueta=1` (informe de la fase 5, §2 y §10):
  1. la **distribución redonda** (el aparato como un torno de alfarero visto desde arriba);
  2. la variante **Terracota**;
  3. el mapeo de tonos **Neutral**;
  4. el **instrumento HTML** como plato redondo con la pantalla encima (`docs/informes/img/fase-5/propuesta-html-*.png`).

  Con las pruebas del móvil, empieza la 5.b.
- [ ] `TODO(ivan)`: **tocar el 3D en el móvil** (fase 6): en la vista previa de la rama (`https://fase-6-interaccion.torno.pages.dev`) o, tras la fusión, en staging. Diales, disco y brazo con el dedo, y desplazar la página por encima del aparato.
- [ ] `TODO(ivan)`: **revisar los textos de la web** (fase 7): la lista, en el informe de la fase 7 (§9).
- [ ] Visto bueno final en el móvil y en el iPhone (fase 8), con las cifras que no dieron las pruebas del 30-10 (la lista de `docs/PRUEBAS-MOVIL.md` sirve otra vez):
  - `TODO(ivan)`: el **primer sonido en frío con la precarga** (prueba 1, con la cifra de antes y la de después). En la fase 8 también se mide en la primera visita real, por red y con la pestaña visible, además de en local. La sesión de plan vio 803 ms en el escritorio, pero con la pestaña en segundo plano: no es una cifra fiable;
  - `TODO(ivan)`: **calibrar la latencia y grabar varias tomas seguidas** con auriculares (pruebas 5 y 7), para ver si quedan alineadas entre sí. En Chromium, la latencia del camino del micrófono cambia en cada apertura de la pista (12–21 ms medidos en un retorno; informe de la fase 2, §10, propuesta 1);
  - `TODO(ivan)`: una de **5 min con las 4 capas largas** (tomas de 30–60 s) y el autoguardado activo, girando diales: sin cortes en el audio (prueba 10; revisión de la fase 2, #6).
  - `TODO(ivan)`: los **FPS del 3D** en el móvil, con el panel «Escena 3D» de `?diagnostico=1` y su botón «Medir 5 s» (prueba 15). PLAN §5 pide 30 o más en un móvil de gama media, en calidad baja y tocando (revisión de la fase 5, #5).

## Fase 9 (manual)
- [ ] **`torno.ivanchesa.com`:** en Pages → `torno` → *Custom domains*, añadir `torno.ivanchesa.com`. La zona de ivanchesa.com está en la misma cuenta de Cloudflare, así que el CNAME y el certificado salen solos. Antes, `torno` tiene que tener una versión en producción (la etiqueta `v*` de la fase 9).
