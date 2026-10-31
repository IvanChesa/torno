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
