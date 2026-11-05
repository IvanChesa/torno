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
- [x] **Licencia del código: MIT** (Iván, 04-11). Cubre el código; la marca «Torno», los textos de la web y las imágenes quedan fuera, y el README lo dice. La pone la fase 9.
- [x] `@lhci/cli` en el CI (fase 8): aprobado (01-11). Y el tope de la primera visita sin el 3D, a 650 kB en bruto (01-11).
- [x] **Autoguardado con el panel de recuperar sin contestar** (revisión de la fase 2, #21): **segundo hueco** (decisión de Iván, 26-10; PLAN §4.8). Se implementa al empezar el bloque B (`docs/revisiones/bloque-A.md`, #3).
- [ ] **Micrófono entre tomas** (si las pruebas del móvil lo piden; sus cifras, en la fase 8): mantenerlo abierto durante una «sesión de grabación» o recalibrar cada toma con la cuenta previa (informe de la fase 2, §10, propuesta 1).
- [ ] **Indexación en el lanzamiento (fase 9).** Hasta entonces todas las páginas llevan `noindex` (`indexable: false` en `src/app/core/site.config.ts`); al lanzar se pone a `true` y solo la 404 sigue con `noindex`. Confirmar que quieres que se indexe.
- [x] **Precargar ALFAR al acercarse al instrumento** (revisión del bloque B, fase 4, #1): hecha al empezar el bloque C (30-10). En el escritorio, la primera reproducción en frío baja de 200–272 ms a 68–93 ms; la prueba 1 del móvil da la cifra de antes y la de después.
- [x] **Las dos PR de Dependabot:** la #1 (wrangler 4.152.0) fusionada con su CI en verde (30-10); la #2 (`@types/node` 26), cerrada.
- [x] **El autoguardado con los dos huecos ofrecidos** (informe de la fase 6, §10, propuesta 1): **aceptada** en la revisión del bloque C (01-11). Lo que se toca espera a que se conteste el panel, y el panel tiene que verse siempre; ya está en PLAN §4.8.
- [x] **Las zonas táctiles a 320 px de ancho** (revisión de la fase 6, #13): resuelto en la fase 8 sin encoger nada. Las zonas de 44 px que se pisaban (la capa 1 y el volumen, unos 4 px) se apartan lo que les sobra sin dejar de cubrir su pieza (menos de 4 px cada una), con test en Node y e2e a 320 y 360 px. Ninguna baja de 44 × 44 px.
- [x] **El rendimiento de `/` en Lighthouse móvil** (criterio de la fase 7; PageSpeed Insights daba 70–72, por el TBT de la llegada del 3D): la sesión de plan aprueba la **propuesta 2b** el 03-11 (Iván: «Continúa»). Desde la fase 8, el 3D llega con el primer gesto en la página o con la página quieta, y la generación del aparato va troceada (2c, en parte). Lighthouse en local: `/` de 87–90 a 98–99. Las cifras, en el informe de la fase 8.
- [ ] `TODO(ivan)`: **confirmar en tu móvil cómo llega el 3D** (propuesta 2b, fase 8). Hasta el primer gesto (mover el ratón, tocar o desplazar la página, o una tecla) se ve el póster, que es un render del mismo aparato; sin ningún gesto, el 3D llega cuando la página lleva 6 s quieta. Si no te gusta, se deshace en un solo sitio: el disparador del `@defer` del instrumento en `src/app/pages/home/home-page.ts` (y `QUIET_MS` en `src/app/core/page-presence.ts`).
- [x] **El peso de la primera visita sin el 3D:** tope a 650 kB en bruto (Iván, 01-11). Desde la fase 8 lo comprueban `check-bundles` y un e2e.
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
  - `TODO(ivan)`: el **primer sonido en frío con la precarga** (prueba 1, con la cifra de antes y la de después). En la fase 8 también se mide en la primera visita real, por red y con la pestaña visible, además de en local. La sesión de plan vio 803 ms en el escritorio, pero con la pestaña en segundo plano: no es una cifra fiable. **Medido en la fase 8** (03-11), por red y en una visita nueva, en el escritorio: 205–225 ms (el reparto, en el informe de la fase 8, §6);
  - `TODO(ivan)`: **calibrar la latencia y grabar varias tomas seguidas** con auriculares (pruebas 5 y 7), para ver si quedan alineadas entre sí. En Chromium, la latencia del camino del micrófono cambia en cada apertura de la pista (12–21 ms medidos en un retorno; informe de la fase 2, §10, propuesta 1);
  - `TODO(ivan)`: una de **5 min con las 4 capas largas** (tomas de 30–60 s) y el autoguardado activo, girando diales: sin cortes en el audio (prueba 10; revisión de la fase 2, #6).
  - `TODO(ivan)`: los **FPS del 3D** en el móvil, con el panel «Escena 3D» de `?diagnostico=1` y su botón «Medir 5 s» (prueba 15). PLAN §5 pide 30 o más en un móvil de gama media, en calidad baja y tocando (revisión de la fase 5, #5).

## Fase 9: lo que falta para lanzar (en este orden)
Hecho el 04-11 (informe de la fase 9): la licencia MIT, el README, el CHANGELOG, la ficha técnica y el flujo de producción (`.github/workflows/production.yml`), probado en seco tras la fusión (informe de la fase 9, «Tras la fusión»). `package.json` ya está en 1.0.0. Lo que queda depende de ivanchesa.com y de tus pruebas:

1. [ ] **Iván: ivanchesa.com en Cloudflare** (comprado en Cloudflare Registrar y con su zona en la misma cuenta; lo lleva la sesión de ivanchesa.com). Comprobar que responde: `curl -sI https://ivanchesa.com/`.
2. [ ] **Iván: las pruebas del móvil y del iPhone** (`docs/PRUEBAS-MOVIL.md`, pruebas 1 a 26, en `https://staging.torno.pages.dev/?diagnostico=1`). Si algo falla, se arregla antes de la etiqueta.
3. [ ] **Claude: los enlaces legales y de contacto** de `site.config.ts`, con `curl`; las cinco tienen que dar 200 (o una redirección a una página que dé 200):
   ```bash
   for u in https://ivanchesa.com https://ivanchesa.com/contacto/ https://ivanchesa.com/aviso-legal/ https://ivanchesa.com/privacidad/ https://ivanchesa.com/cookies/; do curl -sSIL -o /dev/null -w "%{http_code} $u\n" "$u"; done
   ```
   Si una URL es otra en la web nueva, se cambia solo en `src/app/core/site.config.ts`.
4. [ ] **Claude: `indexable: true`** en `src/app/core/site.config.ts`, cuando Iván marque la decisión «Indexación en el lanzamiento» (arriba, todavía sin marcar). Con los tests al revés: `src/app/core/site.config.spec.ts` (el «no es indexable hasta el lanzamiento»), `src/app/app.routes.spec.ts` (la portada y `/sobre-el-proyecto` sin `noindex`; la 404, con él) y `e2e/static.spec.ts` (`noindex` solo en la 404). Commit en `main`, el CI y el despliegue en verde, y comprobar staging (`node scripts/verify-pages.mjs https://staging.torno.pages.dev`). Siguen con `noindex` por la cabecera `X-Robots-Tag`: `torno.pages.dev` por la regla de `public/_headers`, y las vistas previas (`staging` y las de cada rama) porque Pages se la pone sola.
5. [ ] **Claude: la fecha en `CHANGELOG.md`** (`## [1.0.0] - AAAA-MM-DD`), commit en `main` y CI en verde.
6. [ ] **Claude: la etiqueta**, en ese commit de `main` con el CI en verde:
   ```bash
   git tag -a v1.0.0 -m "Torno 1.0.0"
   git push origin v1.0.0
   ```
   `production.yml` publica el build del CI de ese commit en `torno.pages.dev` (rama `main` de Pages) y lo comprueba. Si falla, se puede repetir a mano: `gh workflow run production.yml -f etiqueta=v1.0.0 -f en_seco=false`.
7. [ ] **Iván: `torno.ivanchesa.com`** en Pages → `torno` → *Custom domains* → *Set up a custom domain* (ya con la versión en producción del paso 6). La zona está en la misma cuenta: el CNAME y el certificado salen solos; esperar a que diga *Active*.
8. [ ] **Claude: comprobar producción** en el dominio:
   - `gh workflow run production.yml -f etiqueta=v1.0.0 -f en_seco=false` (vuelve a publicar el mismo build y ahora comprueba también `torno.ivanchesa.com`), o en local `node scripts/verify-pages.mjs https://torno.ivanchesa.com`;
   - Lighthouse móvil contra producción con la misma configuración (probado contra staging el 04-11: 98 · 100 · 100 en una pasada):
     ```bash
     npx lhci collect --url=https://torno.ivanchesa.com/ --url=https://torno.ivanchesa.com/sobre-el-proyecto --start-server-command="" && npx lhci assert
     ```
   - que solo la 404 lleva `noindex`: `curl -s https://torno.ivanchesa.com/ | grep -c noindex` da 0, y `curl -s https://torno.ivanchesa.com/404 | grep -c noindex`, 1 o más.
9. [ ] **Iván:** la ficha del proyecto en ivanchesa.com con el enlace a `torno.ivanchesa.com` (en su repo) y la difusión.
- [ ] `TODO(ivan)`: **confirmar qué textos quedan fuera de la MIT** (revisión de la fase 9, #8). Propuesta, ya en el README y en `NOTICE`: fuera, los textos de las páginas (`site.content.ts`, `app.content.ts`, `app.routes.content.ts`, `features/product/*.content.ts` y `pages/**/*.content.ts`); con la MIT, los de la interfaz del instrumento (controles, pantalla, avisos y diagnóstico), que son parte del código. Si prefieres otra línea, se cambia en esos dos archivos.
