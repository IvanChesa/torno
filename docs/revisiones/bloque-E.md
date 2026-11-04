# Revisión: Bloque E (fase 8)
Veredicto: APROBADO. Solo falta el criterio que depende de Iván: las pruebas en su móvil y en un iPhone (`docs/PRUEBAS-MOVIL.md`, 1 a 26).

La fase 8 cierra la calidad:
- **Lighthouse móvil en el CI** (mediana de tres pasadas): `/` saca **99, 100 y 100** (antes, en PageSpeed, 70–72), con un LCP de 1,8 s y un CLS de 0,001, y `/sobre-el-proyecto`, 100 en las tres.
- **El arreglo es la propuesta 2b:** el 3D llega con un gesto o con la página quieta 6 s (como mucho, 15 s), y su llegada ya no bloquea: la tarea más larga pasa a 104–139 ms con la CPU ×4 (antes, 189–449).
- **La primera visita sin el 3D pesa 564,8 kB** en el navegador (tope de 650). El JS inicial de `/` es de 318,5 kB y el chunk 3D, de 658,4 kB.
- **Accesibilidad:** axe sin ninguna violación, también a 320 px, con el zoom al 200 % y con el espaciado de texto. El foco se mueve al navegar y los clics en plena hidratación ya no se pierden (la guía y «Despiezar»).
- Regresión visual con 14 capturas de Linux, la barra del 3D simplificada y la alternativa sin WebGL automática.
- El CI de `main`, en 11,5 min y en verde, y el despliegue también (`verify-pages`, 32 de 32).

El subagente encontró 5 Importantes reales, como la barra que se salía de su columna entre 1024 y 1100 px o el 3D, que no llegaba con el clic de un lector de pantalla. Están todos corregidos.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante | `.github/dependabot.yml`; PR #3 y #5 | **Los dos PR de Dependabot fallan en `npm ci` (`ERESOLVE`).** Dependabot separa Angular en dos grupos: el de producción (`angular`: `core`, `common`, `compiler`…) y el de desarrollo (`desarrollo`: `compiler-cli`, `build`, `cli`…). Cada PR sube solo una mitad, y `@angular/compiler-cli` exige la misma versión de `@angular/compiler`. Así, ninguno de los dos podrá fusionarse nunca. | Al empezar el bloque F: un solo grupo para todo `@angular/*` (de producción y de desarrollo), cerrar los PR #3 y #5 y dejar que Dependabot lo proponga de nuevo. Fusionar el nuevo si su CI está en verde, antes de la etiqueta `v1.0.0`. |
| 2 | Menor | PLAN §5 («Síntesis»); ficha técnica | La primera reproducción en frío por red da **205–225 ms** en el escritorio, por encima de los 150 del plan, aunque ALFAR ya se precarga al acercarse. La cifra de 68–93 ms del bloque C era sin red. | Aceptado para la v1: es solo el primer toque de la visita, y las siguientes reproducciones son instantáneas. Se publica en la ficha técnica tal como se mide, por red. La cifra del móvil sale de la prueba 1 de Iván. |
| 3 | Menor | `.github/workflows/ci.yml` (Lighthouse) | Una pasada de `/` con la máquina en frío dio 89. La mediana de tres (99) es la que cuenta. | Mantener la mediana de tres como criterio. Si el job empieza a fallar por ruido, medir contra la vista previa, como ya prevé el plan (fase 8, tarea 7). |

## Qué he comprobado
- **Estado:** `main` = `origin/main` (`f176c2e`). El CI de `main` está en verde (11,5 min) y el despliegue también. La vista previa responde 200, con la CSP y `noindex`.
- **ivanchesa.com todavía no resuelve** (04-11). Sin él no se pueden poner ni `torno.ivanchesa.com` ni la indexación, y los enlaces legales del pie siguen sin comprobar.
- **El diario, el informe y la revisión de la fase 8** cuadran: los 5 Importantes, los 6 Menores y la Sugerencia, con su commit.
- **Los PR de Dependabot:** he leído el registro de los dos fallos (hallazgo 1).

## Antes del bloque F (Iván)
1. **Las pruebas del móvil y el iPhone** (`docs/PRUEBAS-MOVIL.md`), sobre todo:
   - el primer sonido en frío (prueba 1);
   - la latencia calibrada y las tomas seguidas (5 y 7);
   - los 5 minutos sin cortes (10);
   - los FPS del 3D tocando (15);
   - cómo llega el 3D (16).
2. **La licencia del código.** Recomiendo MIT: el repo ya es público y es una pieza de portfolio. La marca «Torno» y los textos se pueden excluir en el README.
3. **ivanchesa.com** comprado y con su zona en Cloudflare (lo lleva la sesión de ivanchesa.com). Con eso, `torno.ivanchesa.com` es un clic en Pages.
4. **Los textos de la web** (`reviewed: false`; la lista, en el informe de la fase 7, §9) y la confirmación del espejo B.
