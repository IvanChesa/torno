# Informe: Fase 9 (lanzamiento), parte sin el dominio

- **Rama:** `fase-9-lanzamiento`
- **Fecha:** 2026-11-04
- **Estado:** en curso

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
