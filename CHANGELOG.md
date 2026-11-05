# Cambios

Lo que trae cada versión de Torno. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/). El detalle de cada fase, con sus cifras, está en [`docs/informes/`](docs/informes/).

## [1.0.0] - sin publicar

La primera versión: todas las funciones del instrumento que lo inspira (TAPE) y mejoras propias.

### El audio (fases 1 a 3)
- Núcleo DSP propio (`LoopCore`, TS puro) en un AudioWorklet: transporte por muestras con un solo reloj, cuatro capas en bucle con *varispeed* e interpolación cúbica, filtro de variables de estado por capa, panorama de igual potencia y limitador a −0,3 dBFS.
- Grabación con el micrófono: toma libre (hasta 60 s) o de 1, 2 o 4 compases, cuenta previa, metrónomo, sobregrabación y bloqueos durante la toma.
- Compensación de latencia automática y calibración por clics.
- Deshacer y rehacer (3 estados por capa), cambios de sonido en cola hasta el compás siguiente (exactos a la muestra) y disco para congelar y arrastrar una capa.
- Doce bucles propios sintetizados en un *worker* (batería, bajo, acordes y textura; Re menor, 90 BPM), con nombres en español.
- Tempo de 40 a 240 BPM, tempo por pulsaciones y tempo a partir de la primera toma libre.
- Arranque del audio dentro del gesto, con reintento, errores visibles y `navigator.audioSession`.

### Archivos y el instrumento HTML (fase 2)
- Proyecto `.torno` (versionado y validado entero antes de tocar nada), WAV estéreo de 24 bits de la mezcla (con repeticiones y fundido) y un WAV por pista.
- Autoguardado local en IndexedDB con dos huecos y panel de recuperar.
- El instrumento HTML: todos los controles con teclado y lector de pantalla, sin WebGL.
- Menú del dial principal: sonido, bucle, entrada, sesión y ayuda.

### Despliegue (fase 4)
- Cloudflare Pages: el build que prueba el CI se publica en la vista previa `staging.torno.pages.dev` y en una por rama de fase, y se comprueba como con `curl`.
- Cabeceras de seguridad con la CSP completa (hashes de los scripts en línea), caché inmutable de lo que lleva hash y Dependabot.

### El instrumento 3D (fases 5 y 6)
- Aparato redondo procedural en Three.js (geometría y texturas por código), con materiales físicos, entorno PMREM, sombra de contacto horneada y tres niveles de calidad.
- Render bajo demanda (0 fps en reposo), recuperación del contexto perdido y `dispose()` completo.
- Controles HTML proyectados sobre cada pieza (puntero, dedo, teclado y lector de pantalla con el mismo elemento), zonas táctiles de 44 px y atajos dentro del instrumento.
- Encuadres «Completo», «Capas» y «Controles», modo «Inspeccionar» y «Pausar movimiento».

### La web de producto (fase 7)
- Portada con el instrumento, guía de los 9 controles con «Ver en el instrumento» (viaje de cámara), vista despiezada, anatomía de un bucle, ficha técnica con cifras medidas y preguntas frecuentes.
- `/sobre-el-proyecto` como caso de estudio, página 404 y póster del aparato renderizado con el propio motor.

### Pulido y calidad (fase 8)
- El 3D llega con el primer gesto o con la página quieta, sin bloquear la carga.
- Lighthouse en el CI (móvil, mediana de tres pasadas): `/` 99 · 100 · 100.
- axe sin violaciones (también a 320 px, con el zum al 200 % y con espaciado de texto), foco al navegar y regresión visual con 14 referencias.
- Móvil en horizontal y en pantalla completa, y el plato HTML automático si se pierde el contexto.

### Lanzamiento (fase 9)
- Licencia MIT para el código (la marca, los textos y las imágenes, fuera).
- Flujo de producción: una etiqueta `v*` publica en producción el build del CI de `main`, con prueba en seco.
- README de portfolio, este registro de cambios y la ficha técnica con el primer toque por red.

[1.0.0]: https://github.com/IvanChesa/torno/releases/tag/v1.0.0
