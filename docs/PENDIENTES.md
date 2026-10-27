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
- [ ] **Subdominio definitivo.** Propuesto: `torno.ivanchesa.es`. Si cambia, se edita solo `src/app/core/site.config.ts`.
- [x] **Autoguardado local** (D16): activado por defecto, visible y borrable (sin cambios de Iván antes del bloque A).
- [ ] **Licencia del código propio** cuando el repo pase a público (MIT u otra).
- [ ] `@lhci/cli` en el CI (fase 8).
- [x] **Autoguardado con el panel de recuperar sin contestar** (revisión de la fase 2, #21): **segundo hueco** (decisión de Iván, 26-10; PLAN §4.8). Se implementa al empezar el bloque B (`docs/revisiones/bloque-A.md`, #3).
- [ ] **Micrófono entre tomas** (si las pruebas de la fase 4 lo piden): mantenerlo abierto durante una «sesión de grabación» o recalibrar cada toma con la cuenta previa (informe de la fase 2, §10, propuesta 1).
- [ ] **Indexación en el lanzamiento (fase 9).** Hasta entonces todas las páginas llevan `noindex` (`indexable: false` en `src/app/core/site.config.ts`); al lanzar se pone a `true` y solo la 404 sigue con `noindex`. Confirmar que quieres que se indexe.
- [ ] **Precargar ALFAR al acercarse al instrumento** (informe de la fase 4, §10.1, y su revisión, #14). La primera reproducción en frío ya pasa de los 150 ms de PLAN §5 en el escritorio: 157–238 ms en el PC y 203–251 ms en el CI. La propuesta es hacerla al empezar el bloque C; tus cifras del móvil (prueba 1) medirán el efecto.
- [ ] **Las dos PR de Dependabot** (abiertas el 27-10, sin tocar):
  - #1: wrangler 4.149.0 → 4.152.0, que también cambia la versión del despliegue. Los avisos de `undici` de `npm audit` se arreglan en la 4.153.0;
  - #2: `@types/node` 22 → 26, una versión mayor que no corresponde. Ya no se proponen (`dependabot.yml`), así que se puede cerrar.

## Revisiones y pruebas de Iván
- [ ] Ver `docs/DISENO.md` y las capturas de la fase 0 (`docs/informes/img/fase-0/`): paleta «Barro», Fraunces con el eje SOFT y Geist Mono (revisión del bloque 0).
- [x] **Escuchar los 12 sonidos y 3 combinaciones** (`npm run demo:sounds`): Iván los ha escuchado y «suenan bien», sin cambios (26-10).
- [ ] **Pruebas en Android e iPhone** en la vista previa, ya publicada (27-10): **`https://staging.torno.pages.dev/?diagnostico=1`** (fase 4; necesarias antes del bloque C), con la lista de **`docs/PRUEBAS-MOVIL.md`** y el panel de diagnóstico. En la prueba 1, espera a que aparezca el panel antes de tocar, y usa el altavoz o auriculares de cable.
  - `TODO(ivan)`: en esas pruebas, calibrar la latencia y grabar varias tomas seguidas con auriculares, para ver si quedan alineadas entre sí. En Chromium, la latencia del camino del micrófono cambia en cada apertura de la pista (12–21 ms medidos en un retorno; informe de la fase 2, §10, propuesta 1).
  - `TODO(ivan)`: y una de 5 min con las 4 capas largas (tomas de 30–60 s) y el autoguardado activo, girando diales: sin cortes en el audio (revisión de la fase 2, #6).
- [ ] Aprobar el diseño del instrumento (parada de la fase 5.a).
- [ ] Revisar los textos de la web (fase 7).
- [ ] Visto bueno final en el móvil y en el iPhone (fase 8).

## Fase 9 (manual)
- [ ] **`torno.ivanchesa.es`:**
  1. En Pages → `torno` → *Custom domains*, añadir `torno.ivanchesa.es`.
  2. Un **CNAME** `torno` → `torno.pages.dev` en el DNS de ivanchesa.es: hoy en el *Zone Editor* del cPanel de Banahosting y, si ivanchesa.es ya ha pasado a Cloudflare, en su DNS.

  Pages emite el certificado solo. Ya no hacen falta subdominio en cPanel, FTP ni secrets de producción.
