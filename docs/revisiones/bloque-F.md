# Revisión: Bloque F (fase 9, parte sin el dominio)
Veredicto: APROBADO. Todo lo que no depende de ivanchesa.com ni de las pruebas del móvil está hecho y fusionado, con el CI, el despliegue y la prueba en seco en verde. La `v1.0.0` espera a lo de Iván: ivanchesa.com (el 05-11 sigue sin resolver), las pruebas del móvil y el iPhone, los textos y dos decisiones (abajo).

Lo que deja la fase 9:
- **Producción por etiqueta** (`.github/workflows/production.yml`):
  - publica el build que **ya probó el CI** de `main` en ese commit, sin construir nada;
  - antes, valida la etiqueta (y que coincide con `package.json`) y exige que el commit esté en `main` con el CI en verde;
  - después comprueba `torno.pages.dev` y, si ya resuelve, el dominio;
  - a mano se lanza en seco por defecto.
- **Probado de verdad tras la fusión:**
  - en seco (run 42099608489), encuentra el CI de `c6326f9`, descarga su build y comprueba el `_headers`; la API de Cloudflare responde 200 por el proyecto, y los dos pasos que publican se saltan;
  - en real con `main` (run 42099761316), se niega antes de tocar nada.
- **Licencia MIT con `NOTICE`:** quedan fuera la marca, los textos de las páginas y las imágenes. GitHub ya reconoce la MIT.
- **README de portfolio:** el GIF del aparato (Playwright y `sharp`, sin dependencias nuevas), la arquitectura, las cifras medidas con su informe y el crédito a TAPE.
- **CHANGELOG** de la 1.0.0, sin fecha.
- **Ficha técnica:** el primer toque por red (205–225 ms) y el peso de la fase 8, con las referencias visuales nuevas generadas por el CI.
- **Dependabot arreglado:** un solo grupo para todo Angular. Los PR #7, #8 y #9 están fusionados con el CI en verde y no queda ninguno abierto.

El subagente encontró 1 Importante: el flujo se daba por probado en seco antes de haberlo lanzado. Encontró también 7 Menores. Todos están corregidos (`500bbc8` y `63ebc5a`), y la prueba en seco se hizo después.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Menor (al lanzar) | `README.md:7`; `docs/PENDIENTES.md` (pasos 7–9); el *About* del repo | **Después del lanzamiento, el repo seguirá apuntando a staging.** El README da la vista previa como enlace principal («En producción irá en…»), y el repo de GitHub no tiene web, descripción ni temas. Ningún paso de la lista lo cambia. | Un paso más tras el 8: el README con `https://torno.ivanchesa.com` como enlace principal (staging, como vista previa). Con el OK de Iván, `gh repo edit IvanChesa/torno --homepage https://torno.ivanchesa.com --description "…"` y unos temas. La imagen para redes del repo (`public/img/og.jpg`) se sube a mano en *Settings → Social preview* (Iván). |
| 2 | Sugerencia | `CHANGELOG.md` (enlace `[1.0.0]`); paso 6 | El enlace del CHANGELOG lleva a `releases/tag/v1.0.0`, pero el flujo solo crea la etiqueta: GitHub enseñará la etiqueta sin notas. | Después de la etiqueta, una *release* con la sección 1.0.0 del CHANGELOG: `gh release create v1.0.0 --verify-tag --title "Torno 1.0.0" --notes-file <la sección>`. Queda mejor en el portfolio y no toca el despliegue. |

## Qué he comprobado
- **Estado:** `main` = `origin/main` (`62f66a2`), sin cambios locales.
  - El CI de `c6326f9`, en verde entero en 8 min, y el despliegue también (`verify-pages`, 64 de 64).
  - Staging responde 200 con `x-robots-tag: noindex` y ya sirve la fila nueva de la ficha («205–225 ms»).
- **`torno.pages.dev` da 404**, lo esperable: todavía no hay ningún despliegue de producción.
- **ivanchesa.com y `torno.ivanchesa.com` no resuelven** (05-11).
- **`production.yml`, leído entero:**
  - `DRY_RUN` llega como cadena, y el run en seco lo confirma;
  - la etiqueta y el formulario solo entran por `env:` y se validan antes de usarlos;
  - el token aparece solo en los pasos que lo usan, y las acciones van fijadas por SHA;
  - `ci.yml` no se dispara con etiquetas, así que no hay un segundo build;
  - el build de `main` se guarda 90 días.
- **El `noindex`:**
  - la regla `https://:project.pages.dev/*` de `_headers` deja `torno.pages.dev` fuera de los buscadores, y Pages ya pone el `noindex` en las vistas previas;
  - `verify-pages` solo exige el `noindex` en `*.pages.dev`, así que la comprobación de `torno.ivanchesa.com` no fallará con `indexable: true`.
- **`NOTICE`:** las rutas que cita existen.
- **`dependabot.yml`:** un grupo `angular` sin `dependency-type`, y el de desarrollo lo excluye de forma explícita. Las versiones mayores de Angular, three y TypeScript siguen fijadas a mano.
- **Los pasos de `PENDIENTES.md`**, en buen orden:
  - `indexable: true` y la fecha del CHANGELOG van antes de la etiqueta, así que llegan a ella;
  - el dominio se añade después del primer despliegue de producción;
  - la comprobación del dominio espera a que Pages diga *Active*.

## Decisiones de Iván (con mi recomendación) · **aprobadas las dos el 05-11**
1. **Indexación en el lanzamiento: sí.** Es una pieza de portfolio y conviene que se encuentre. Solo se indexa `torno.ivanchesa.com`, la dirección canónica; `torno.pages.dev` y las vistas previas siguen con `noindex`. El SEO sigue siendo secundario: no hace falta nada más.
2. **Qué textos quedan fuera de la MIT: la propuesta tal cual.** Fuera, los de las páginas; dentro, los de la interfaz del instrumento, que son parte del código. Así, quien reutilice el código tiene un instrumento que funciona, pero no puede copiar la web.

## Antes de la `v1.0.0` (Iván)
1. **ivanchesa.com** comprado y con su zona en Cloudflare (lo lleva la sesión de ivanchesa.com). Sin él se quedan parados los pasos 3, 7 y 8.
2. ~~Las pruebas del móvil y el iPhone~~: «bien están» (05-11), sin cifras. Con ellas quedan confirmados la 2b y el espejo B.
3. ~~Los textos de la web~~: aprobados tal cual (05-11). En el lanzamiento, `reviewed: true` (paso 2 de `PENDIENTES.md`).
4. ~~Las dos decisiones de arriba~~: aprobadas el 05-11, y ya marcadas en `PENDIENTES.md`, que tiene también el paso nuevo (el 9) de los hallazgos #1 y #2.

Con eso, el resto de `PENDIENTES.md` («Fase 9: lo que falta para lanzar») lo hace Claude, salvo el dominio en Pages, que es un clic tuyo. El prompt está en `docs/prompts/PROMPTS.md`, «Lanzamiento».
