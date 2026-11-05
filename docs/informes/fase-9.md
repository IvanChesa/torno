# Informe: Fase 9 (lanzamiento), parte sin el dominio

- **Rama:** `fase-9-lanzamiento`
- **Fecha:** 2026-11-04
- **Estado:** revisada y fusionada (falta lo que depende del dominio y de las pruebas del móvil)

## 0. Plan de la fase

**Alcance de esta sesión** (prompt del bloque F, 04-11): solo lo que no depende de ivanchesa.com ni de las pruebas de Iván en el móvil. **Para antes de la etiqueta `v1.0.0`.** No se hace: la etiqueta, `indexable: true` ni el dominio personalizado.

**Antes de la rama, en `main`** (revisión del bloque E):
- `docs: revisión del bloque E y licencia MIT` (`62c4eef`): los cambios de documentación de la sesión de plan.
- #1: `.github/dependabot.yml` con un solo grupo para todo `@angular/*` (de producción y de desarrollo; el grupo `desarrollo` lo excluye de forma explícita), los PR #3 y #5 cerrados con su explicación y, cuando Dependabot proponga el nuevo, fusionarlo solo con el CI en verde.

**Entregas en la rama:**
1. **9.a · `LICENSE` MIT** a nombre de Iván Chesa Lapena. La marca «Torno», los textos de la web y las imágenes quedan fuera; el README lo explica.
2. **9.b · Ficha técnica** (revisión del bloque E, #2): la primera reproducción en frío por red, tal como se mide (205–225 ms en el escritorio, informe de la fase 8, §6), y el peso de la primera visita con la cifra de la fase 8. Cambia la captura `seccion-ficha-*`: se borra su referencia y se sube la que genere el CI (el procedimiento de `e2e/visual.spec.ts`).
3. **9.c · Flujo de producción** (`.github/workflows/production.yml`):
   - se dispara con una etiqueta `v*` o a mano (`workflow_dispatch`, con la etiqueta y la opción «en seco»);
   - despliega **el build que ya probó el CI** del push a `main` de ese mismo commit (el artefacto `torno-browser`), y no construye nada; el commit tiene que estar en `main`;
   - `--branch=main` (la rama de producción de `torno`): `torno.pages.dev` y, cuando Iván lo añada, `torno.ivanchesa.com`;
   - en seco, hace todo menos el `pages deploy` y la comprobación de producción;
   - después, `scripts/verify-pages.mjs` contra `torno.pages.dev` (que sigue con `noindex`: la canónica es `torno.ivanchesa.com`);
   - el artefacto del build de `main` pasa a guardarse 90 días (antes, 7): la etiqueta puede llegar días después del push;
   - tests en Node de los dos flujos (`scripts/workflows.spec.ts`): disparadores, ramas de Pages, acciones fijadas por SHA, el despliegue en seco, sin el token en los pasos que no lo necesitan;
   - prueba real: un `workflow_dispatch` en seco tras la fusión (un `workflow_dispatch` solo se puede lanzar con el archivo en `main`).
4. **9.d · README de portfolio:** qué es, capturas (escritorio y móvil, con `?captura=1`), un GIF corto generado con Playwright si sale con las herramientas que hay (sin dependencias nuevas; si no, capturas en secuencia), stack, arquitectura (capas y hilos), cifras medidas con enlace a su informe, el plan y los informes, la licencia y lo que no cubre, y el crédito «Inspirado en TAPE, de Ethan», con enlace.
5. **9.e · `CHANGELOG.md`:** la v1.0.0 (sin fecha hasta la etiqueta) con lo que trae, por bloques.
6. **9.f · Cierre:** `npm run check`, informe, revisión por subagente, correcciones, fusión `--no-ff`, CI y despliegue de `main` en verde, el `workflow_dispatch` en seco, y en `PENDIENTES.md` y `DIARIO.md` los pasos exactos que faltan (dominio, `indexable: true`, enlaces legales con `curl`, etiqueta y pruebas del móvil). Después, **parada**.

**Riesgos:**
- El GIF: Playwright graba vídeo en `.webm`, y pasarlo a GIF necesitaría `ffmpeg` (herramienta externa: preguntar). Alternativa sin herramientas nuevas: fotogramas con `?captura=1` y `sharp` (ya en la lista) para montar un GIF animado, si `sharp` lo permite; si no, capturas fijas.
- `workflow_dispatch` en la rama: GitHub no lo deja lanzar hasta que el archivo está en la rama por defecto, así que la prueba real va tras la fusión; antes, los tests del YAML.
- La captura de la ficha: la referencia de Linux solo la genera el CI (dos vueltas de CI en la rama).

**Skills consultadas:** `threejs-deployment` (despliegue del build y comprobaciones), `webapp-testing` (capturas y vídeo con Playwright).

## 1. Resumen
La parte del lanzamiento que no depende de ivanchesa.com ni de las pruebas del móvil: la **licencia MIT** del código (la marca, los textos y las imágenes, fuera), el **README de portfolio** con un GIF del aparato grabado con Playwright, el **CHANGELOG** de la 1.0.0 (sin fecha), la **ficha técnica** con el primer toque por red (revisión del bloque E, #2) y el **flujo de producción** (`production.yml`): una etiqueta `v*` publica en la rama `main` de Pages el build que ya probó el CI de `main`, con un modo en seco para probarlo sin etiqueta. Antes, en `main`, Dependabot pasa a subir todo Angular en un solo grupo (revisión del bloque E, #1).

## 2. Criterios de aceptación
Los dos criterios de la fase 9 dependen de lo que esta sesión no hace (la etiqueta y el dominio). Lo que sí se puede demostrar ya:

| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| `v1.0.0` en producción con HTTPS, desplegada por etiqueta | ⏳ (fuera de esta sesión) | El flujo está hecho y, tras la fusión, se prueba en seco («Tras la fusión», al final): encuentra el CI de `main`, descarga su build, prepara wrangler y pregunta por el proyecto; solo falta la etiqueta. `package.json` ya está en 1.0.0 y el flujo exige que coincidan. |
| Comprobaciones en producción según §5 | ⏳ (fuera de esta sesión) | Tras publicar, `production.yml` pasa `verify-pages.mjs` contra `torno.pages.dev` y, si ya resuelve, contra el dominio de `site.config.ts`. Lighthouse en producción y los enlaces legales, en los pasos de `PENDIENTES.md`. |

## 3. Tareas del plan
| Tarea | Estado | Notas |
|---|---|---|
| Revisión del bloque E, #1 (Dependabot) | hecha | `dependabot.yml` con un grupo para todo Angular (y su Prettier, `766f549`); PR #3 y #5 cerrados con su explicación. Dependabot propuso el #7 (11 paquetes de Angular juntos), el #8 (tslib) y el #6, que sustituyó por el #9 (vitest, eslint, typescript-eslint y wrangler). Los tres, fusionados con su CI en verde (`8d2ec8c`, `8a16534` y `67ab501`), y la rama, con ellos, en verde. |
| Revisión del bloque E, #2 (ficha técnica) | hecha | Fila nueva «Primer toque de la visita»: 205–225 ms, por red y en frío, con cómo se midió. El peso de la primera visita, con la cifra de la fase 8 (565 kB · 1,37 MB). |
| 9.1 Producción con la etiqueta `v*` | hecha, sin etiqueta | `production.yml`, el build de `main` guardado 90 días y los tests de los flujos (`scripts/workflows.spec.ts`). |
| 9.2 Verificación en producción | preparada | Dentro de `production.yml`; Lighthouse en producción, con el dominio. |
| 9.3 README, LICENSE, CHANGELOG | hecha | La etiqueta `v1.0.0`, no (fuera de esta sesión). |
| 9.4 Indexación y enlaces legales | no hecha | Dependen de ivanchesa.com: pasos exactos en `PENDIENTES.md`. |
| 9.5 Lista para Iván | hecha | En `PENDIENTES.md` y `DIARIO.md`. |

## 4. Desviaciones del plan y motivo
- **Sin etiqueta, sin `indexable: true` y sin el dominio:** lo pide el prompt del bloque F (ivanchesa.com todavía no existe y faltan las pruebas del móvil).
- **`package.json` pasa a 1.0.0 ya:** el flujo de producción exige que la etiqueta coincida con la versión, así que la versión va en el mismo commit que se etiquetará.
- **El build de `main` se guarda 90 días** (antes, 7): la etiqueta puede llegar semanas después del push que la probó. Las ramas de fase y los PR siguen en 7.

## 5. Decisiones técnicas nuevas
- **La producción no construye:** busca con `gh run list --commit` el CI en verde de un push a `main` con ese commit y descarga su artefacto. Si no lo hay (o caducó), falla con lo que hay que hacer. Alternativa descartada: reconstruir con la etiqueta (sería un build que no ha probado el CI, contra D19).
- **Solo commits de `main`** (`git merge-base --is-ancestor`), y la etiqueta con forma `vX.Y.Z` validada antes de usarla en un comando, como la rama en `deploy.yml`.
- **En seco por defecto** en el lanzamiento manual; con una etiqueta, nunca en seco (`DRY_RUN` solo puede ser `true` con `workflow_dispatch`).
- **El proyecto no se crea en producción:** si la API no lo encuentra, el flujo falla (lo creó staging).
- **Tests de los flujos como texto** (`scripts/workflows.spec.ts`), sin un analizador de YAML (no está en la lista de §1): disparadores, la expresión de la etiqueta probada con casos buenos y malos, la rama de Pages, en seco, los secrets solo donde se usan y todas las acciones fijadas por SHA con su versión.
- **El GIF** se graba sin `?captura=1` (que congela la animación) con la GPU y se monta con `sharp`, con el tiempo real entre fotogramas. No es determinista: se rehace a mano (`node scripts/readme-gif.mjs`).

## 6. Salida de los checks
```
npm run check   (04-11, en el PC de desarrollo, sobre 0262066)
lint: tipos de cada capa, ESLint y Prettier, sin errores
tests en Node: 45 archivos, 580 tests (11 nuevos de los flujos); cobertura de las capas puras 98,34 %
tests de Angular: 13 archivos, 90 tests
build + check-bundles, sin avisos:
  JS inicial de /  318,6 kB · /sobre-el-proyecto 316,9 · /404 302,3   (aviso > 330)
  desbloqueo de audio 1,9 kB · motor 25,2 · worklet 41,0 · workers 17,4 y 41,9 (≤ 60)
  chunk 3D 658,4 kB (aviso > 800) · fuentes 144,1 kB (≤ 150)
exit 0
```

**Lighthouse móvil contra staging**, con la configuración del CI y las URL de la vista previa (la orden que queda en `PENDIENTES.md` para producción, probada), una pasada: `/` **98 · 100 · 100**, LCP 2,2 s, y `lhci assert` sin fallos.

**El flujo de producción en seco:** se lanza tras la fusión, porque un `workflow_dispatch` solo se puede lanzar con el archivo en `main`; su resultado va en «Tras la fusión», al final.

## 7. Capturas
- **El GIF del README:** `docs/img/torno.gif` (560 × 448, 86 fotogramas, 8,6 s, 2,5 MB): el aparato sonando (la batería de la primera reproducción y un bajo que entra en cola), con el disco girando al compás, y la cámara por «Capas», «Controles» y «Completo».
- **La ficha técnica:** la única sección que cambia a la vista. Su referencia de la regresión visual (`e2e/visual.spec.ts-snapshots/seccion-ficha-*`) la genera el CI de Linux.
- El README enlaza las capturas de la fase 8 (`docs/informes/img/fase-8/`), que siguen valiendo: nada más cambia a la vista.

## 8. Dependencias añadidas
Ninguna. El GIF usa `@playwright/test` y `sharp`, ya en la lista de PLAN §1.

## 9. Pendientes y `TODO(ivan)`
En `docs/PENDIENTES.md`, «Fase 9: lo que falta para lanzar (en este orden)»: ivanchesa.com en Cloudflare, las pruebas del móvil y del iPhone, los enlaces legales con `curl`, `indexable: true`, la fecha del CHANGELOG, la etiqueta `v1.0.0`, el dominio personalizado y las comprobaciones en producción (con las órdenes exactas).

## 10. Propuestas de cambio al plan
Ninguna.

## 11. Cómo probarlo
- La licencia, el README (con el GIF) y el CHANGELOG, en GitHub, en la rama o en `main` tras la fusión.
- La ficha técnica: `https://fase-9-lanzamiento.torno.pages.dev/#ficha-tecnica` (o staging tras la fusión).
- El flujo de producción, en seco (no publica nada): `gh workflow run production.yml -f etiqueta=main` y `gh run watch`.
- Los tests de los flujos: `npx vitest run --config vitest.node.config.mts scripts/workflows.spec.ts`.

---

## Respuesta a la revisión
Revisión del subagente en `docs/revisiones/fase-9.md` (la primera se cortó con la sesión; esta es la segunda): **CAMBIOS NECESARIOS, sin Bloqueantes**: 1 Importante, 7 Menores y 2 Sugerencias.

| Hallazgo | Acción | Commit |
|---|---|---|
| 1 · Importante: el informe y `PENDIENTES.md` daban el flujo por «probado en seco» sin run | **Hecho.** El texto dice que la prueba en seco va tras la fusión; el run, en «Tras la fusión». | `500bbc8` |
| 2 · Menor: «Re-run all jobs» si caduca el build | **Hecho.** El mensaje pide un commit nuevo en `main` con el CI en verde y etiquetarlo (relanzar solo vale 30 días y republicaría staging con un build viejo). | `500bbc8` |
| 3 · Menor: el paso de `indexable: true` | **Hecho.** Nombra los tres tests que cambian (`site.config.spec.ts`, `app.routes.spec.ts` y `e2e/static.spec.ts`), aclara quién pone el `noindex` (`_headers` en `torno.pages.dev`, Pages en las vistas previas) y espera a que Iván marque la decisión. | `500bbc8` |
| 4 · Menor: «los cuatro» enlaces eran cinco | **Hecho.** | `500bbc8` |
| 5 · Menor: la CPU del audio del README no era la de la ficha | **Hecho.** El README da la de la ficha (218–232× y 35×, fase 7). | `500bbc8` |
| 6 · Menor: «Exactitud» y «Privacidad» sin informe | **Hecho.** Enlazan a las fases 1 y 8. | `500bbc8` |
| 7 · Menor: las referencias de la ficha sin CI en verde | **Hecho.** Subidas (`63ebc5a`); el CI de la rama, en «Tras la fusión». | `63ebc5a` |
| 8 · Menor: la exclusión de la licencia, solo en el README y demasiado amplia | **Hecho.** `NOTICE` en la raíz y el README con la lista exacta: fuera, los textos de las páginas; con la MIT, los de la interfaz del instrumento, que son código. `TODO(ivan)` para confirmarlo. `LICENSE` se queda con el texto MIT tal cual (así lo reconoce GitHub). | `500bbc8` |
| 9 · Sugerencia: `grep` de `baseUrl` sin resultado | **Hecho.** `|| base=''`: avisa en lugar de cortarse. | `500bbc8` |
| 10 · Sugerencia: el servidor del GIF, fuera del `try` | **Hecho.** El navegador arranca dentro del `try`, como en `capture.mjs`. | `500bbc8` |
