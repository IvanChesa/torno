# Revisión: Bloque C, parte 1 (fase 5)
Veredicto: fase 5 APROBADA. El bloque sigue abierto: la fase 6 solo tiene su plan (`451286b`), porque la sesión se paró al llegar al límite de uso.

La fase 5 deja el instrumento 3D a muy buen nivel:
- **El diseño aprobado por Iván** (30-10): redondo como un torno de alfarero, en Terracota y con Neutral. El cuerpo tiene grano de cerámica, el latón va moleteado y el disco lleva esmalte oliva con anillo de latón. La pantalla es curva, en su bandeja. Nada recuerda la distribución del original.
- **Cifras:** 51 llamadas de dibujo, de 25 000 a 49 000 triángulos según el nivel, VRAM estimada de 61 MB en alto y 36 MB en bajo, generación en 71–85 ms y la tarea más larga del arranque en 53–63 ms (antes, 610–630 ms en frío). El chunk 3D pesa 623 kB, por debajo del aviso de 800, y el JS de `/`, 303,7 kB.
- **Render bajo demanda** (0 fotogramas en reposo, con e2e), `dispose()` completo y recuperación de la pérdida de contexto.
- **El revisor** encontró dos fallos visibles: los medidores tapaban los pilotos del plato y el lienzo cortaba la sombra de contacto. Están corregidos, igual que los Menores.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Menor (para la fase 6) | `src/app/scene/` (textura de la pantalla); capturas `escenario-*` | **La pantalla del 3D se lee mal**: el texto ocupa la esquina superior izquierda de la pantalla curva con un cuerpo pequeño, y el resto queda vacío. En la portada de escritorio, las tres líneas apenas se distinguen, y en el móvil no se leen. La fase 6 le añade formas de onda y medidores. | Al diseñar la pantalla de la fase 6, repartirla en todo el ancho (texto más grande arriba y formas de onda y medidores debajo) y comprobar en las capturas que el texto se lee en el encuadre de escritorio y en el de móvil (una altura mínima de letra en píxeles, con test o medida). La región `aria-live` sigue siendo la alternativa accesible. |

## Propuestas del informe de la fase 5 (§10)
- **1 a 5:** aprobadas por Iván el 30-10.
- **6. Los FPS en un móvil de gama media, a la fase 8:** **aceptada.** «Tocando» no existe hasta la fase 6; se miden con el panel `?diagnostico=1`, en la prueba 15 de `PRUEBAS-MOVIL.md`.
- **7. El presupuesto de 600 kB, sin la precarga del audio:** **aceptada.** Cuenta lo que se descarga sin acercarse al instrumento (hoy, 594 kB). La precarga (81 kB) se anota aparte en cada informe.

## Para la fase 6, además de su plan
- La pantalla, según el hallazgo 1.
- La carrera del autoguardado (informe de la fase 5, §9): mientras esté abierta la confirmación de recuperar, que no se autoguarde, y cancelar el autoguardado que espera. Con un test.
- **Commits pequeños**, uno por pieza: capa de controles, gestos, cámara y sincronía (revisión de la fase 5, #11).
- La fase es grande y la sesión ya se quedó sin uso una vez: hazla por entregas (6.a, 6.b…), con el informe «en curso» commiteado al final de cada una, como dice `CLAUDE.md`.

## Qué he comprobado
- **Estado:** la fase 5 está fusionada en `main` (`673ad51`), con su fila en `DIARIO.md`. CI y despliegue de `main` en verde: la vista previa ya enseña el 3D. La rama `fase-6-interaccion` solo tiene el plan.
- **Revisión del subagente de la fase 5:** muy rigurosa:
  - rehízo las cuentas de la VRAM y de la exactitud del transporte;
  - midió en las capturas el corte de la sombra;
  - encontró que el panel de desarrollo iba en producción.
- **Capturas** (`escenario-tres-cuartos-escritorio`, `escenario-sonando-movil`): materiales creíbles (la cerámica no parece plástico), luz Neutral, el latón con brillo y la sombra de contacto ya entera. El único punto débil es la pantalla (hallazgo 1).

---

# Revisión: Bloque C, parte 2 (fase 6) · 01-11
Veredicto: APROBADO. El bloque C está completo: fases 5 y 6 fusionadas (`673ad51` y `cc4f6be`), con el CI de `main` y el despliegue en verde.

La fase 6 convierte el 3D en el instrumento de la portada:
- un control nativo encima de cada pieza, con los mismos gestos, teclado y nombres que el plato HTML;
- zonas táctiles de 44 px sin pisarse a 360 y 390 px;
- respuesta de 0,4 a 4,3 ms;
- el disco va al reloj del worklet (0,00 % de diferencia con la GPU);
- la pantalla ocupa todo el ancho, con la forma de onda, el cabezal y el medidor de cada capa;
- «Inspeccionar», pantalla completa y «Pausar movimiento», también en el plato.

El subagente encontró dos fallos reales (la página se ensanchaba en «Capas» y el plato no dejaba pausar el movimiento) y 12 Menores. Están corregidos, salvo el #13, que es tuyo.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Importante | `.github/workflows/ci.yml` (job único, `timeout-minutes: 30`) | **El CI de `main` ya tarda 18 min, y 14,6 son de e2e** (los del 3D, con WebGL por software y uno detrás de otro). Las fases 7 y 8 añaden e2e y la regresión visual: así se acerca a los 30 min del límite, y cada push espera un cuarto de hora para desplegar. | Al empezar el bloque D: repartir los e2e en 2 o 3 *shards* de Playwright en paralelo (matriz del job, con el informe unido) o separar los del 3D en su propio job. Objetivo: el CI completo en 12 min o menos. El despliegue espera a que acaben todos. |
| 2 | Menor | `src/app/scene/` (esmalte del disco); captura `instrumento3d-completo-movil.jpg` | En el encuadre «Completo» del móvil, casi cenital, el centro del disco vuelve a salir lavado por el reflejo del entorno. El arreglo de la 5.b corrigió la vista cenital del escritorio. | Ajustarlo en la fase 7 u 8 (rugosidad o *clearcoat* del esmalte, o el entorno), con la captura del móvil antes y después. |
| 3 | Menor | `.claude/launch.json` (sin seguimiento) | La sesión dejó una configuración de vista previa sin seguimiento. Cada `git status` la enseña. | Añadir `.claude/launch.json` al `.gitignore` (es local, como `settings.local.json`). |

## Propuestas y pendientes de la fase 6
- **Propuesta 1 (autoguardado con los dos huecos ofrecidos):** **aceptada.** Lo que se toca espera a que se conteste el panel. Su coste (revisión de la fase 6, #12): si se cierra la pestaña sin contestar, se pierde lo tocado desde la recarga. Para que no pase sin querer, el panel tiene que verse siempre. Va a PLAN §4.8.
- **Propuesta 2 (el espejo HTML de la pantalla, siempre encima del 3D):** **a la fase 7**, con la maqueta de la web. Mi opinión: en el escritorio, el recuadro negro grande sobre el aparato parece un panel de depuración y le quita protagonismo al 3D. Propongo:
  - en el escritorio, la pantalla del 3D se lee (10 px) y el espejo puede ir integrado en la composición (más pequeño, como una «lectura» del aparato) o solo para lectores de pantalla;
  - en el móvil, donde la del 3D no se lee (4,2 px), el espejo se ve, integrado en el diseño.

  Se decide con la maqueta de alta fidelidad, con capturas de las dos opciones.
- **#13 (320 px):** a la fase 8, con tu móvil.

## Dominio: ivanchesa.com (decisión de Iván del 31-10)
Tu web pasa a ivanchesa.com y el .es se deja caducar, así que Torno irá en **`torno.ivanchesa.com`**. Ya está en `CLAUDE.md`, en el plan (§0, D18 y fases 7 y 9), en `PENDIENTES.md` y en `PROMPTS.md`. El código cambia en la fase 7 (tarea 8: `site.config.ts`, autor, contacto y enlaces legales a ivanchesa.com). Al lanzar, el dominio personalizado sale solo, porque la zona está en la misma cuenta de Cloudflare.

## Qué he comprobado
- **Estado:** `main` = `origin/main` (`2f7789f`). El CI de `main` está en verde (18 min, la mayor parte en e2e) y el despliegue en la vista previa también. La sesión no llegó a comprobarlo porque se quedó sin uso.
- **El informe, la revisión y el diario de la fase 6:** las cifras cuadran entre ellos, y los Importantes del subagente tienen su arreglo y su e2e.
- **Capturas** `instrumento3d-completo-*`: el 3D es el instrumento, con la barra de encuadres y modos debajo. La pantalla del 3D ya se lee en el escritorio. El espejo HTML queda encima (propuesta 2).

## Respuesta a la revisión (parte 2) · 01-11
| # | Acción | Commit |
|---|---|---|
| 1 | **Hecho.** El CI, en jobs paralelos: `build` (build, presupuestos y el artefacto que se despliega), `comprobaciones` (lint, tests y banco) a la vez, y los e2e en tres grupos con su propia máquina y el build de `build` (el audio con `dev`, `estatico` y `webkit`; `escena-dev`; `escena-estatico`, estos con `--no-deps`). Si falla un grupo, `e2e-informe` une sus informes `blob` en uno. El despliegue sigue esperando a que termine el workflow entero (`workflow_run`). En la rama `fix/bloque-c`: **9,5 min** de principio a fin (antes, 18), con el grupo más largo (`escena-dev`) en 8 min. Un e2e de la hidratación lee el *metafile* del build: viaja en un artefacto aparte (`torno-stats`), que no se despliega. | `99f33ee`, `47d5c8d` |
| 2 | **En la fase 7** (entrega 7.e), con las capturas del móvil de antes y después. | — |
| 3 | **Hecho.** `.claude/launch.json` en el `.gitignore`. | `0ef420e` |

El CI también corre ahora en las ramas `fix/*` (sin desplegar: `deploy.yml` solo publica `main` y `fase-*`).
