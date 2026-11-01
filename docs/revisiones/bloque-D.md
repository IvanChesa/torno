# Revisión: Bloque D (fase 7)
Veredicto: APROBADO. **Decisiones de Iván (01-11): sí a las dos.** `@lhci/cli` queda aprobado para Lighthouse en el CI, y el tope de la primera visita sin el 3D sube a 650 kB en bruto. Ya están en el plan (§1, §5 y fase 8).

La web de producto ya está en `https://staging.torno.pages.dev`:
- la portada con el titular junto al instrumento;
- la guía de los 9 controles con «Ver en el instrumento» (viaje de cámara y foco, sin sonido ni micrófono, con e2e);
- los materiales con la vista despiezada en el 3D;
- la anatomía de un bucle con las formas de onda reales;
- la ficha técnica con cada cifra medida y su informe;
- las preguntas frecuentes, el cierre y `/sobre-el-proyecto` con el diagrama de hilos y los créditos;
- la imagen Open Graph, renderizada por el propio motor.

También:
- el CI pasa de 18 a unos 9 min en paralelo;
- el dominio pasa a `torno.ivanchesa.com`;
- las secciones se hidratan al verse.

El subagente encontró un Bloqueante real (los e2e de la anatomía no bajaban a su sección y el CI estaba en rojo) y dos e2e inestables. Están corregidos.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante (decisión de Iván) | PLAN §5 y §1 (dependencias); fase 8, tarea 7 | **Lighthouse sin medir.** Hace falta una herramienta fuera de la lista cerrada. He intentado PageSpeed Insights contra la vista previa y la API gratuita ha agotado su cuota diaria. Lo que sí se mide con el navegador: LCP de 0,6 s y CLS de 0,003, muy por dentro de §5. El TBT de `/` es de unos 380 ms con la CPU ×4, por la llegada del 3D, y deja el rendimiento en torno a 90, sin asegurarlo. | Recomiendo **aprobar `@lhci/cli`** (ya estaba propuesto para la fase 8) como dependencia de desarrollo, con su paso en el CI y los presupuestos de §5. Si no, en la fase 8, PageSpeed Insights a mano. |
| 2 | Importante (decisión de Iván) | PLAN §5 («Peso de la primera visita») | **625 kB sin el 3D frente al tope de 600.** Es el contenido de la web (el HTML pasa de 15 a 48 kB) y su hidratación. Por la red son unos 310 kB con brotli; las fuentes, 144 kB, no se comprimen. | Recomiendo **la propuesta a: subir el tope a 650 kB en bruto**, y que §5 diga «en bruto» (como el JS). El plan B de las fuentes quitaría el eje `SOFT` de los títulos, la firma de «Barro», a cambio de 54 kB que no mejoran ni el LCP ni el CLS. |
| 3 | Importante (fase 8) | `src/app/features/product/guide.ts` | **Un clic o un Intro en «Ver en el instrumento» mientras la guía se hidrata no lleva el foco al control.** El primer CI de `main` tras la fusión falló por eso. El test ahora espera a que la guía esté hidratada, pero una persona real puede pulsar antes. | En la fase 8: que la acción funcione también en plena hidratación (repetición de eventos o un manejador temprano), con un e2e que pulse sin esperar. |
| 4 | Menor (fase 8) | `src/app/features/instrument-stage/stage-toolbar.ts` | **La barra del 3D tiene ya 8 botones y en el escritorio ocupa dos filas** (encuadres, Inspeccionar, Despiezar, pantalla completa, Pausar movimiento y Atajos). Es mucho para el hero. | En la revisión de diseño de la fase 8: los tres encuadres como un control segmentado y lo demás agrupado, con capturas de antes y después. Que siga todo accesible con teclado. |
| 5 | Menor (fase 9) | `src/app/core/site.config.ts` (enlaces legales y contacto) | ivanchesa.com todavía no resuelve, así que los enlaces del pie y del contacto están sin comprobar. | Comprobarlos con `curl` en la fase 9, cuando ivanchesa.com responda (ya está en el plan). |

## El espejo de la pantalla (propuesta 2 de la fase 6)
La fase 7 eligió la **opción B**: el espejo, pequeño, en la esquina del escenario. Me parece bien: deja de parecer un panel de depuración y en el móvil se lee. Pendiente solo de que Iván lo vea en el móvil y lo confirme.

## Qué he comprobado
- **Estado:** `main` = `origin/main` (`831a12d`). El último CI de `main` está en verde (9,5 min) y el despliegue también. El CI de `280e863` falló (#3) y el arreglo del test lo dejó en verde.
- **Capturas** de la portada en escritorio (`inicio-escritorio.png`, recortada por tramos): el hero, los materiales con el despiece y la anatomía con sus anillos de formas de onda. La composición es limpia, coherente con «Barro» y con mucha personalidad. Nada recuerda al original.
- **El informe, la revisión del subagente y el diario** cuadran entre ellos. Los 16 hallazgos están respondidos, y las 2 Sugerencias que no se aplican, razonadas.
