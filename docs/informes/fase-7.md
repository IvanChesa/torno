# Informe: Fase 7 (web de producto, guía y contenido)

- **Rama:** `fase-7-web-producto`
- **Fecha:** 2026-11-01
- **Estado:** fusionada; el criterio de Lighthouse no se cumple en el rendimiento de `/` (70–72 en PageSpeed Insights): §2 y §10

## 0. Plan de la fase

Antes de la fase, en `main` (revisión del bloque C, rama `fix/bloque-c`):
- **#1, el CI en paralelo:** `build` (con los presupuestos y el artefacto que se despliega), `comprobaciones` (lint, tests y banco) a la vez, y los e2e en tres grupos, cada uno en su máquina y con el build de `build`: el audio (`dev`, `estatico` y `webkit`), `escena-dev` y `escena-estatico` (con `--no-deps`). Si falla un grupo, `e2e-informe` une los informes `blob`. El despliegue sigue esperando a que termine el workflow entero.
- **#3:** `.claude/launch.json` al `.gitignore`.
- **#2 (el disco lavado en el «Completo» del móvil):** en esta fase, entrega 7.e.

### La página (el argumento)
Cada sección, con lo que afirma y cómo lo demuestra (`taste-skill`, paso 2; la dirección visual ya está decidida en `DISENO.md` y no se sortea):

| Sección | Afirma | Lo demuestra |
|---|---|---|
| Portada | Torno es un instrumento de bucles que se toca aquí, ya | El H1 y una frase, «Tocar» y «Cómo se toca», y el instrumento al lado, en la primera pantalla |
| Qué es | Cuatro capas que se repiten, un disco que arrastra el tiempo y lo que grabes, sin salir de tu navegador | Tres hechos cortos con un render del propio motor (encuadre «Capas») |
| Conoce tu instrumento | Se aprende en un minuto: 9 controles | La guía, cada control con sus gestos y teclas y «Ver en el instrumento» (viaje de cámara y foco; nunca suena) |
| Los detalles | Es un objeto, no un dibujo: barro, latón, cerámica y fósforo | El aparato despiezado (render del motor) con sus materiales, y «Despiezar» en el 3D |
| Anatomía de un bucle | Cuatro capas, un solo reloj | El disco de cuatro anillos con la forma de onda real de cada sonido; «Escuchar» cada capa o las cuatro (solo tras pulsar) |
| Ficha técnica | Cifras medidas, no promesas | Cada cifra con cómo se midió y el informe donde está |
| Preguntas frecuentes | Lo que se pregunta antes de tocar | Acordeón nativo (`details`) |
| Cierre | Tócalo, lee cómo está hecho, habla con Iván | «Tocar», caso de estudio, contacto, código y compartir |

La idea (paso 4 de `taste-skill`): **el disco del torno**, una vuelta por compás, **se vuelve la anatomía del bucle**: cuatro anillos concéntricos, uno por capa, con la forma de onda real de cada sonido alrededor y un cabezal que gira mientras suena. Es la «cosa viva» de la página, aparte del propio instrumento.

### Entregas (commits pequeños, uno por pieza; informe y push al final de cada una)
- **7.a · Base y maqueta.**
  1. Tarea 8: `site.config.ts` a `torno.ivanchesa.com`, autor «desarrollador de software», contacto y enlaces legales en ivanchesa.com; búsqueda de `ivanchesa.es` en `src/`, `public/`, `scripts/` y tests.
  2. Tarea 1: `docs/ESTILO.md`.
  3. Tarea 2: maqueta de alta fidelidad en `docs/maqueta/` (HTML estático con `tokens.css`, las fuentes del proyecto y renders del motor), con capturas de escritorio y móvil, y las **dos opciones del espejo de la pantalla** (propuesta 2 de la fase 6): A, encima del 3D (como ahora); B, en el escritorio, como lectura pequeña en una esquina libre de la caja (el aparato es redondo: las esquinas de la caja 5:4 quedan vacías) y, en el móvil, encima.
- **7.b · Portada, qué es y guía.**
  1. La portada con el instrumento al lado del titular; fuera el muestrario de la fase 0.
  2. El espejo según la opción elegida.
  3. «Qué es».
  4. La guía de 9 controles con «Ver en el instrumento»: un servicio diminuto (`InstrumentSpotlight`, en el bundle inicial) con la petición; el escenario 3D viaja a un encuadre nuevo de cerca del control (`CameraGoal` `control`) y le pasa el foco (el anillo de luz ya sigue al foco); el plato HTML, el foco y el desplazamiento. Nunca inicia el audio ni pide el micrófono (e2e).
- **7.c · Los detalles y la anatomía.**
  1. La vista despiezada en el motor (`setExploded`: las piezas en cinco niveles, con viaje y con corte si hay pausa de movimiento; los controles se ocultan mientras).
  2. La sección de materiales, con el render despiezado del propio motor (`?captura=1&encuadre=despiezado`).
  3. La anatomía de un bucle: las formas de onda de los 4 sonidos de la demostración, calculadas en Node con la misma síntesis (`scripts/loop-anatomy.mjs` → datos en TS), y `previewSound()` en el motor de audio (un `AudioBufferSourceNode` del contexto, solo tras pulsar, sin tocar la sesión).
- **7.d · Ficha técnica, preguntas, cierre y caso de estudio.**
  1. La ficha técnica con las cifras de los informes y cómo se midió cada una.
  2. Preguntas frecuentes.
  3. El cierre y el pie (compartir con `navigator.share` o copiar el enlace; GitHub).
  4. `/sobre-el-proyecto`: arquitectura con el diagrama de hilos (SVG propio), decisiones, mediciones, accesibilidad, autor y créditos.
- **7.e · Póster, Open Graph, cierre de la fase.**
  1. `scripts/render-poster.mjs` (Playwright + `?captura=1` + `sharp`): los pósteres del escenario, el render despiezado, los de las secciones y la imagen Open Graph (1200×630), con sus metadatos (`og:*` y `twitter:card`) y CORP para esa imagen (revisión de la fase 4, #10).
  2. El disco lavado en el «Completo» del móvil (revisión del bloque C, #2), con capturas de antes y después.
  3. e2e: privacidad en todas las rutas (0 cookies, 0 peticiones a terceros), la guía sin audio ni micrófono, la anatomía que solo suena tras pulsar, axe en las secciones nuevas.
  4. Lighthouse móvil (pendiente de la herramienta: ver §9), capturas de la implementación, lista de textos para Iván (tarea 7) e informe.

### Riesgos
- **El peso de la primera visita** (§5: aviso a 330 kB de JS, ≤ 600 kB sin el 3D): todo lo que no está en la primera pantalla va en `@defer` (guía, detalles, anatomía, ficha, preguntas), y el servicio de la guía es un signal.
- **La guía no puede arrancar el audio:** sus botones no llevan `data-audio-unlock` y el escenario no arranca el motor al recibir el foco (solo lo precarga, que no crea el contexto). Lo comprueba un e2e que cuenta los `AudioContext` y las llamadas a `getUserMedia`.
- **Los e2e del 3D en el CI** (WebGL por software): los nuevos, pocos y en el grupo del escenario.
- **Lighthouse** necesita una herramienta fuera de la lista cerrada: se ha preguntado a la sesión de plan.

### Skills consultadas
`taste-skill` (el argumento, la idea y las reglas de composición; manda `DISENO.md`: Geist Mono sigue para lo que es dato), `threejs-scene` y `threejs-animation` (despiece y viajes), `accessible-animation` (movimiento reducido en la anatomía).

## 1. Resumen
La portada es ya la web de producto: el titular junto al instrumento, «Qué es», la guía de los 9 controles con «Ver en el instrumento» (viaje de cámara y foco, sin sonar nunca), los materiales con la vista despiezada en el 3D, la anatomía de un bucle (cuatro anillos con la forma de onda real de cada sonido, que se escuchan solo tras pulsar), la ficha técnica con cifras medidas, las preguntas frecuentes y el cierre con compartir. `/sobre-el-proyecto` es el caso de estudio, con el diagrama de hilos y los créditos. El dominio pasa a `torno.ivanchesa.com`, hay imagen Open Graph renderizada con el motor, el espejo de la pantalla es una lectura en la esquina del 3D en el escritorio y el disco ya no se lava en el móvil. Antes de la fase, el CI se reparte en jobs paralelos: 9,5 min en lugar de 18.

### Progreso por entregas
- **7.a (hecha).**
  - El dominio, a `torno.ivanchesa.com` (tarea 8): `site.config.ts` con la URL base, el autor («desarrollador de software»), su web, el contacto y las páginas legales en ivanchesa.com, y el repositorio; los tests, `_headers` (comentario) y el README. Ya no queda `ivanchesa.es` en `src/`, `public/`, `scripts/` ni los tests. **Los enlaces no se han podido comprobar con `curl`:** el 01-11, `ivanchesa.com` todavía no resuelve en el DNS (`Could not resolve host`). Se vuelve a probar al cerrar la fase.
  - `docs/ESTILO.md` (tarea 1).
  - La maqueta de alta fidelidad (tarea 2) en `docs/maqueta/index.html`, con sus capturas (`node scripts/capture-maqueta.mjs` → `docs/informes/img/fase-7/maqueta-espejo-{a,b}-{escritorio,movil}.png`).
  - **El espejo de la pantalla (propuesta 2 de la fase 6): opción B.** En el escritorio, la pantalla del 3D ya se lee (10 px de cuerpo) y el recuadro grande encima le quitaba protagonismo al aparato: el espejo pasa a una lectura pequeña en la esquina de arriba a la izquierda de la caja 5:4, que el aparato, redondo, deja libre. En el móvil (la pantalla del 3D no se lee, 4,2 px) sigue encima, a todo el ancho. En los dos, el espejo sigue siendo la región `aria-live` del instrumento. Se puede volver a la A cambiando solo el CSS del escenario; queda para que Iván lo confirme (`PENDIENTES.md`).
- **7.b (hecha).**
  - **La portada nueva:** el H1, la entradilla, «Tocar» y «Cómo se toca» a la izquierda y el instrumento a la derecha, en la primera pantalla (en una columna por debajo de 64 rem). «Tocar» lleva al instrumento y deja el foco en la tecla de reproducir (sin sonar: el sonido llega al pulsarla). Fuera el muestrario de la fase 0.
  - **El espejo, en la opción B:** en el escritorio, una lectura de 15 rem en la esquina de arriba a la izquierda de la caja, que deja pasar el puntero; en el móvil, encima, como antes. El marcador de la portada ocupa lo mismo (sin saltos al llegar el 3D). En el encuadre «Completo» no pisa el dial de la capa 1.
  - **«Qué es»:** una frase, tres hechos y un render del motor (`public/img/capas.webp`, encuadre «Capas»).
  - **La guía de los 9 controles** (`features/product/guide.ts`), en filas: el nombre, lo que hace con sus gestos, sus teclas y «Ver en el instrumento».
  - **«Ver en el instrumento»:** `InstrumentSpotlight`, un signal con la última petición (va en el trozo de la portada, sin el instrumento). El 3D viaja a un encuadre nuevo de cerca del control (`CameraGoal` `control`: desde su lado, nunca desde detrás, y con la pantalla si es el dial principal) o al de «Capas» para mezclar, y le pasa el foco, que enciende el anillo de luz. El plato HTML, el foco y el control al centro de la pantalla. Con la pausa de movimiento, la cámara corta y el desplazamiento no se anima.
  - **e2e:** `e2e/guide.spec.ts` (los 9 botones con el plato HTML, con ratón y con teclado: el foco llega a su control y no hay ni un `AudioContext`, ni un `resume`, ni una pista del micrófono) y un caso nuevo en `stage.spec.ts` (con el 3D: `data-camara` pasa a `cerca-main` y a `capas`, el foco llega al control y no hay audio).
  - **Presupuesto:** el JS inicial de `/` pasa de 306,6 a 309,9 kB (aviso a 330). El aviso de `angular.json` estaba a 300 kB, más estricto que PLAN §5 (330), y saltaba por 342 B con el cambio de dominio: se ha alineado con el plan (§5 de este informe).
- **7.c (hecha).**
  - **La vista despiezada en el motor** (`scene/model/exploded.ts`): el modelo va ahora en cinco niveles (`EXPLODE_LIFT_MM`: el cuerpo, quieto; la cubierta con lo impreso, el hueco del disco y los pilotos, +34 mm; la bandeja con la pantalla, +62; el disco, +84; y el latón y la cerámica que se tocan, +118). `setExploded()` los sube en 900 ms (o de golpe con la pausa de movimiento) y su cámara (`CameraGoal` `exploded`) encuadra la silueta despiezada de tres cuartos y desde abajo. Mientras no está montado, ningún control se ve ni se toca, y el anillo de luz se apaga. Cualquier otro encuadre lo monta otra vez.
  - **«Despiezar»** en la barra del 3D (con `aria-pressed`) y desde la sección de los detalles (`InstrumentSpotlight.explode()`). Con `?captura=1&encuadre=despiezado`, despiezado desde el primer fotograma.
  - **«Barro, latón y fósforo»** (`features/product/details.ts`): el render despiezado del motor (`public/img/despiezado.webp`, 38 kB) y los cinco materiales con su muestra (decorativa: el nombre dice lo mismo). Sin el 3D, en lugar del botón, una nota.
  - **«Anatomía de un bucle»** (`features/product/loop-anatomy.ts`), la idea de la página: el disco del torno con cuatro anillos, uno por capa, y alrededor de cada uno la forma de onda real de su sonido (Alfar, Raíz, Olivo y Cierzo, 96 picos por bucle). Las formas de onda salen de la misma síntesis en Node (`node scripts/loop-anatomy.mjs` → `loop-anatomy.data.ts`), y un test comprueba que siguen siéndolo. «Escuchar» cada capa o las cuatro, y «Parar»; mientras suena, el cabezal da una vuelta (CSS; quieto con movimiento reducido o la pausa) y los demás anillos se apagan. Va en `@defer` al acercarse, con su título y su entradilla prerenderizados en el marcador: no cuenta en la primera visita (`/`: 315,9 kB).
  - **Escuchar sin tocar la sesión** (`AudioEngine.preview`): una vuelta de cada bucle por la salida del contexto, con fundidos de 10 ms y la mezcla bajada lo justo para que su pico no pase de −1 dBFS (no pasa por el limitador del núcleo: `mixPeak`, con test). Solo tras pulsar: los botones llevan `data-audio-unlock` y el contexto nace en el gesto. Se para con «Parar», en reposo y al ocultar la pestaña.
  - **e2e:** `e2e/anatomy.spec.ts` (sin contexto antes de pulsar; al pulsar, nace en el gesto, suena por encima de −26 dBFS sin un `set-sound` ni un `play` al núcleo, y «Parar» la deja en silencio; las cuatro a la vez) y un caso de `stage.spec.ts` (el despiece oculta los 12 controles, «Completo» los devuelve y el botón de los detalles también despieza).
- **7.d (hecha).**
  - **La ficha técnica** (`features/product/spec-sheet.ts`): nueve cifras, todas medidas, cada una con cómo se midió y un enlace a su informe en el repositorio. Tres se han medido en esta fase (§6): la frecuencia de muestreo (48 kHz), la latencia de salida (10 + 40 ms) y la CPU del audio (218–225×). Lo que falta en el móvil, lo dice. Una tabla de verdad; en el móvil, cada fila es un bloque.
  - **Las preguntas frecuentes** (`faq.ts`): siete, en `details`/`summary` nativos, la primera abierta.
  - **El cierre** (`closing.ts`): «Tocar», el caso de estudio, el contacto, el código y compartir (el menú del sistema con `navigator.share`; si no, copia el enlace; si tampoco, lo enseña).
  - **Hidratación incremental** (`withIncrementalHydration`): las secciones de debajo de la portada van en `@defer (hydrate on viewport)`. Se prerenderizan enteras (el texto está en el HTML) y su JS llega al acercarse. Cuesta 5,7 kB en el JS inicial de todas las rutas, pero `/` baja de 327,7 a 317,1 kB (aviso a 330).
  - **`/sobre-el-proyecto`**: la arquitectura con un diagrama de hilos en SVG propio (con su descripción para los lectores de pantalla), cinco decisiones, cómo se ha medido, la accesibilidad, el autor y los créditos (sonidos, tipografías con sus licencias OFL, librerías con `licencias/terceros.txt` e «Inspirado en TAPE, de Ethan», con enlace).
  - **El pie** dice a qué se dedica el autor («desarrollador de software»).
  - **Compartir (D18):** Open Graph (`og:*`, con la imagen absoluta y su texto alternativo) y la tarjeta grande de X en cada página (`SeoService`), con test.
  - **La imagen Open Graph sin CORP** (revisión de la fase 4, #10): `! Cross-Origin-Resource-Policy` en su regla de `_headers`; el analizador (`pages-headers.mjs`) entiende ahora quitar cabeceras, como Pages, con tests.
  - **La chuleta y el diagnóstico**, con `h2` (bajo el `h1` de la portada, un `h3` saltaba un nivel: axe, `heading-order`).
- **7.e (hecha).**
  - **`scripts/render-poster.mjs`** (tarea 5): los dos pósteres, los renders de «Qué es» y de los detalles, y la imagen Open Graph de 1200×630 en JPEG (el aparato con su nombre al lado, con Fraunces y los colores de `tokens.css`; 60 kB). Sale de `capture.mjs`.
  - **El disco lavado en el «Completo» del móvil** (revisión del bloque C, #2): el vidriado a 0,25 (era 0,45), la base a 0,06 (0,2) y el entorno a 0,5 (0,6). Desde los 64° del móvil se lee oliva y de frente conserva el brillo. Capturas: `docs/informes/img/fase-7/disco-movil-{antes,despues}.jpg`.
  - **e2e:** privacidad en las tres rutas recorridas enteras (0 cookies, 0 peticiones a terceros y nada en `localStorage` que no sea de Torno), axe en la portada con todas sus secciones hidratadas y las etiquetas para compartir en el HTML (con la imagen sin CORP servida por `wrangler pages dev`).
  - **Las imágenes de las secciones y la anatomía, al verse.** Chromium carga las imágenes `loading="lazy"` que quedan a menos de unos 1250 px, y las dos de las secciones se bajaban en la primera visita (71 kB): ahora van en un `@defer (on viewport)` con su hueco reservado (sin saltos). La anatomía ya no llega en reposo.
  - **Medidas** (§6): `scripts/measure-web.mjs` (LCP y CLS en el móvil con 4G lento y CPU ×4) y `npm run capturas -- --medir` con la GPU.
  - **Capturas** de la implementación y del 3D (§7); `capture.mjs` recorre ahora la página antes de fotografiarla.

## 2. Criterios de aceptación

| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| Capturas de la maqueta y de la implementación coherentes | ✅ | Maqueta: `img/fase-7/maqueta-espejo-{a,b}-{escritorio,movil}.png`. Implementación: `img/fase-7/inicio-{escritorio,movil}.png` y `sobre-el-proyecto-*.png`. La misma retícula y el mismo orden: el titular a la izquierda del 3D, «Qué es» con su render a la derecha, la guía en filas sobre un escalón de tono, los materiales en un campo de color, la anatomía como disco a la izquierda, la ficha en tabla, las preguntas en dos columnas y el cierre con el titular grande. Diferencias, a propósito: la guía tiene los 9 controles (la maqueta, 4), la anatomía dibuja la forma de onda real de cada sonido alrededor de su anillo (la maqueta, anillos lisos) y la ficha tiene 9 filas con enlace a su informe. |
| Lighthouse móvil según §5 en `/` y `/sobre-el-proyecto` | ❌ en `/` (rendimiento) · ✅ lo demás | **PageSpeed Insights** (elegido por Iván el 01-11; Lighthouse 13.6.0, Moto G Power emulado, 4G lento) contra `https://staging.torno.pages.dev` con el build de `main` (`831a12d`), dos pasadas de `/` y una de `/sobre-el-proyecto`:<br>• **`/`: rendimiento 72 y 70** (§5: ≥ 90 ❌); accesibilidad 100 y buenas prácticas 100 (≥ 95 ✅). FCP 0,8 s, LCP 1,4–2,1 s, CLS 0,003, Speed Index 2,0–2,1 s y **TBT 2050–2860 ms**: «Minimiza el trabajo del hilo principal», 4,9 s, con 6 tareas largas (la llegada del 3D en reposo: el chunk de 631 kB y la generación del aparato con la CPU de un móvil lento).<br>• **`/sobre-el-proyecto`: 100, 100 y 100** (§5: ≥ 95 ✅). LCP 0,8 s, TBT 10 ms y CLS 0,012.<br>El SEO (66–69) no es criterio: es el `noindex` de la vista previa. Las métricas del navegador (`node scripts/measure-web.mjs`, CPU ×4) daban un TBT de 369–410 ms en `/`: Lighthouse simula una CPU mucho más lenta. Propuesta para Iván: §10, propuesta 2. |
| e2e de privacidad en todas las rutas | ✅ | `e2e/static.spec.ts`: `/`, `/sobre-el-proyecto` y `/404` recorridas enteras (lo de abajo llega al acercarse): 0 peticiones fuera de `localhost`, 0 cookies y nada en `localStorage` que no sea de Torno. Siguen los de la fase 2 (0 peticiones al grabar, guardar y exportar, `files.spec.ts`). |
| La guía nunca inicia el audio ni pide el micrófono (e2e) | ✅ | `e2e/guide.spec.ts` (plato HTML: los 9 botones con el ratón y uno con el teclado) y `stage.spec.ts` (3D): el foco llega a su control, la cámara a su encuadre, y no hay ni un `AudioContext`, ni un `resume`, ni una pista del micrófono (`audioCalls` vacío, `streamCount` 0). |
| Ficha técnica: cada cifra tiene su medición documentada en un informe, y `/sobre-el-proyecto` explica cómo se midió | ✅ | Cada fila de `spec-sheet.content.ts` lleva cómo se midió y un enlace a su informe: fases 1 (memoria), 2 (primer sonido y toma alineada), 6 (del gesto al audio) y 7 (frecuencia, latencia de salida, CPU, FPS y peso: §6 de este informe). `/sobre-el-proyecto`, «Cómo se ha medido». |

## 3. Tareas del plan
| Tarea | Estado | Notas |
|---|---|---|
| 7.1 `docs/ESTILO.md` | hecha | Voz, vocabulario, formato, cifras con `Intl` `es-ES`, mediciones y accesibilidad de los textos. |
| 7.2 Maqueta de alta fidelidad | hecha | `docs/maqueta/index.html` con `taste-skill` (el argumento, la idea y las reglas; manda `DISENO.md`). Con las dos opciones del espejo. |
| 7.3 Secciones | hecha | Portada, qué es, guía (9), detalles y vista despiezada, anatomía, ficha técnica, preguntas y cierre. |
| 7.4 `/sobre-el-proyecto` | hecha | Arquitectura y diagrama de hilos, decisiones, mediciones, accesibilidad, autor y créditos. |
| 7.5 Póster e imagen Open Graph | hecha | `scripts/render-poster.mjs`, sin `sharp` (§4). |
| 7.6 Compartir y pie | hecha | Open Graph y tarjeta de X; compartir en el cierre; el pie con los enlaces legales de ivanchesa.com y la nota de privacidad. |
| 7.7 Lista de textos para Iván | hecha | §9. |
| 7.8 El dominio, a ivanchesa.com | hecha | Los enlaces, sin comprobar con `curl`: ivanchesa.com no resuelve todavía (§9). |
| Revisión del bloque C: CI en paralelo, `launch.json`, disco del móvil | hecha | En `main` (`eafcacf`) y, el disco, en esta rama. |
| Propuesta 2 de la fase 6 (el espejo) | hecha | Opción B, para que Iván la confirme. |

## 4. Desviaciones del plan y motivo
- **Sin `sharp`** (tarea 5): el navegador ya codifica WebP (un lienzo) y JPEG (la captura de una página), y la imagen Open Graph se compone en una página con las fuentes y los tokens del proyecto. Una dependencia menos.
- **Lighthouse, sin pasar:** pide una herramienta fuera de la lista cerrada (§9). En su lugar, LCP, CLS y axe medidos.
- **El peso de la primera visita sin el 3D, por encima del presupuesto:** 625 kB (§5: ≤ 600), con el mismo criterio que las fases 5 y 6 (todo lo que se baja sin tocar nada, menos el chunk 3D, el escenario y la precarga del audio). Sube 29 kB sobre la fase 6 (596): el HTML prerenderizado pasa de unos 15 a 48 kB con el contenido de la web (17 kB de estilos de los componentes, 19 de texto y 8,5 de atributos de Angular), más 5,7 kB de la hidratación incremental. Sin diferir las imágenes y la anatomía eran 705 kB. Lo que queda no se puede quitar sin quitar contenido: §10, propuesta 1.
- **Las secciones se hidratan al verse** (`withIncrementalHydration`): no estaba en el plan; es lo que deja la web entera en el HTML sin pasar el presupuesto de JS.
- **La anatomía usa la primera combinación de la biblioteca** (Alfar, Raíz, Olivo y Cierzo): son los sonidos con los que se presenta Torno y los que Iván escuchó juntos.
- **«Despiezar» también en la barra del 3D** (el plan solo pedía la vista despiezada en «Los detalles»): hace falta un control a la vista para volver a montarlo.

## 5. Decisiones técnicas nuevas
- **`InstrumentSpotlight`**: la web pide al instrumento señalar un control o despiezarse con un signal, sin importar el instrumento (que va en `@defer`): el que haya lo atiende cuando está listo. Alternativa: un `output` desde la portada, que no llega a un componente diferido.
- **Encuadre de cerca de un control** (`CameraGoal` `control`): desde su lado (acimut acotado a ±36°), nunca desde detrás, y con la pantalla si es el dial principal (sus menús). Las capas, con el encuadre «Capas» (son cuatro).
- **Vista despiezada por niveles** en el propio modelo (cinco `Group`), en vez de mover las piezas una a una: la pose (teclas hundidas, diales) no se toca y el despiece es un `position.y` por nivel.
- **`AudioEngine.preview`**: escuchar sin tocar la sesión, con `AudioBufferSourceNode` por la salida del contexto y la mezcla bajada a −1 dBFS de pico (`mixPeak`), porque no pasa por el limitador del núcleo. Alternativa: cargar los sonidos en las capas, que cambiaría la sesión de quien toca.
- **Las formas de onda de la anatomía, como datos**: calculadas en Node con la síntesis y comprobadas por un test; así la portada no carga la síntesis para dibujarlas.
- **Hidratación incremental** (`hydrate on viewport`) para las secciones de la portada.
- **El aviso del JS inicial de `angular.json`, a 330 kB** (estaba a 300, más estricto que PLAN §5).
- **`! Nombre` en `_headers`**: la imagen Open Graph sin `Cross-Origin-Resource-Policy`; el analizador lo entiende como Pages (quita la cabecera la den las reglas que la den).
- **El esmalte del disco**: vidriado 0,25, base 0,06 y entorno 0,5 (`DISENO.md` §7).

## 6. Salida de los checks
```
npm run check
  lint: tipos de cada capa, ESLint y Prettier, sin errores
  test:node: 44 archivos, 559 tests (98,34 % de sentencias y 94,89 % de ramas en el TS puro)
  test:ng: 12 archivos, 72 tests
  build: 3 rutas prerenderizadas; Initial total 307,20 kB, sin avisos
  check-bundles:
    ✔ JS inicial de /                  317,9 kB (aviso > 330)
    ✔ JS inicial de /404               300,5 kB
    ✔ JS inicial de /sobre-el-proyecto 315,7 kB
    ✔ Desbloqueo de audio 1,9 kB · motor 25,2 kB · workers 17,4 y 41,9 kB · worklet 41,0 kB
    ✔ Chunk 3D 653,4 kB (aviso > 800) · fuentes 144,1 kB · 41 archivos en Pages
```
e2e: los de esta fase, en verde en local (guía, anatomía, privacidad y axe, compartir, despiece y «Ver en el instrumento» en el 3D). En una pasada entera en local, con `ng serve` y muchos trabajadores a la vez, salen algunos del proyecto `dev` por tiempo (distintos en cada pasada) que pasan solos: la máquina va cargada; el CI, con una máquina por grupo, es el que vale.

Métricas de la fase:
- **Web** (`node scripts/measure-web.mjs`; Pixel 7, 4G lento, CPU ×4, en frío, 3 visitas): `/` LCP 600–992 ms (el póster) y CLS 0,003; `/sobre-el-proyecto` LCP 272–464 ms y CLS 0,003.
- **Peso de la primera visita** (`decodedBodySize`, como en las fases 5 y 6): **con el 3D, 1362,4 kB** (≤ 1,5 MB); **sin el 3D, 625,4 kB** (≤ 600: ❌, §4) = 1362,4 − 631,0 (chunk 3D) − 22,4 (escenario) − 83,6 (precarga del audio: motor 25,2, worklet 41,0 y worker 17,4). Con `?sin3d=1`, 722,8 kB (el plato y la precarga). `/sobre-el-proyecto`, 468,8 kB.
- **3D** (`npm run capturas -- --medir`, RTX 3060, D3D11): primer fotograma a los 2604–2620 ms, tarea más larga de 55 ms, generación de 80–81 ms (≤ 150), VRAM de 56,2 MB en alto; 144 fps en alto, medio y bajo (lienzo de 778×622 px).
- **Audio:** banco del núcleo, 218, 225, 223 y 232× tiempo real (60 s a 48 kHz en 259–275 ms); a 240 BPM con el filtro contra el aliasing, 63× y 35× en el peor caso. Chromium en el PC de desarrollo: 48 kHz, `baseLatency` 10 ms y `outputLatency` 40 ms.
- **Pantalla del 3D** (cuerpo de la primera fila): 10 px en el «Completo» del escritorio y 4,8 px en el del móvil (se lee el espejo).

## 7. Capturas
En `docs/informes/img/fase-7/`:
- **Maqueta:** `maqueta-espejo-{a,b}-{escritorio,movil}.png`.
- **Páginas:** `inicio-{escritorio,movil}.png`, `sobre-el-proyecto-{escritorio,movil}.png` y `404-*.png`.
- **El instrumento HTML** con sus avisos: `instrumento-*-{escritorio,movil}.png`.
- **El 3D:** `escenario-*.jpg` e `instrumento3d-*.jpg` (encuadres, «Inspeccionar» y sus hojas de contactos).
- **El disco del móvil, antes y después:** `disco-movil-{antes,despues}.jpg`.
- **Las imágenes de la web:** `public/img/escenario.webp`, `escenario-movil.webp`, `capas.webp`, `despiezado.webp` y `og.jpg`.

## 8. Dependencias añadidas
Ninguna (ni `sharp`, §4).

## 9. Pendientes y `TODO(ivan)`
- `TODO(ivan)`: **Lighthouse.** ¿Vale `npx lighthouse` en local, sin añadirlo al proyecto, o PageSpeed Insights contra la vista previa? Con la respuesta se pasa (en la fase 8 si no llega antes). Relacionado: `@lhci/cli` en el CI, ya pendiente para la fase 8.
- `TODO(ivan)`: **confirmar el espejo de la pantalla (opción B).**
- `TODO(ivan)`: **el peso sin el 3D** (§10, propuesta 1).
- **Los enlaces de ivanchesa.com** (aviso legal, privacidad, cookies, contacto y la web): el 01-11 el dominio no resuelve. Se comprueban con `curl` en cuanto responda (y en la fase 9).
- `TODO(ivan)`: **revisar los textos** (todos con `reviewed: false`):
  - la portada: `pages/home/home.content.ts`;
  - las secciones: `features/product/intro.content.ts` («Qué es»), `guide.content.ts` (la guía), `details.content.ts` (los materiales), `loop-anatomy.content.ts` (la anatomía), `spec-sheet.content.ts` (la ficha técnica), `faq.content.ts` (las preguntas) y `closing.content.ts` (el cierre);
  - `/sobre-el-proyecto`: `pages/about/about.content.ts`;
  - el marco y el SEO: `app.content.ts`, `app.routes.content.ts` y `core/site.content.ts` (con el texto alternativo de la imagen Open Graph);
  - el instrumento: `instrument/instrument.content.ts` (pantalla, menús y sonidos), `features/instrument-common/instrument-common.content.ts`, `features/instrument-stage/instrument-stage.content.ts` (con «Despiezar»), `features/html-instrument/html-instrument.content.ts` y `state/session.content.ts` (los avisos);
  - el diagnóstico: `features/diagnostics/diagnostics.content.ts` y `features/instrument-stage/stage-dev.content.ts`;
  - la 404: `pages/not-found/not-found.content.ts`.

## 10. Propuestas de cambio al plan (para la aprobación de Iván)
1. **El peso de la primera visita sin el 3D** (§5: ≤ 600 kB; medido, 625 kB). La web de producto pone su contenido en el HTML (48 kB) y su hidratación (5,7 kB). Dos caminos:
   - a. Subir el presupuesto a 650 kB: es el contenido que pide la fase 7.
   - b. Mantener 600 y, en la fase 8, el plan B de las fuentes de `DISENO.md` §3 (el corte `opsz` de Fraunces, −54 kB, sin el eje `SOFT` de los títulos: cambia la firma de la dirección).

   Propongo la a: el plan B se pensó para el rendimiento, y aquí el LCP (≤ 1 s con 4G lento) y el CLS (0,003) ya están muy por dentro de §5. Un dato más (revisión, #14): esos 625 kB en bruto son unos 310 kB con brotli por la red (las fuentes, 144 kB, no se comprimen). Que §5 diga si el peso de la primera visita se mide en bruto (como el JS) o transferido.

2. **El rendimiento de `/` en Lighthouse móvil** (§5: ≥ 90; PageSpeed Insights, 70–72). Todo es el TBT (2050–2860 ms): el 3D llega «en reposo» y, con la CPU que simula Lighthouse, descargar, analizar y generar el aparato bloquea el hilo principal varios segundos. Opciones, de menos a más cambio:
   - a. **El 3D, en el móvil, solo al tocar o al acercarse el dedo** (el póster hasta entonces, como ya hace la portada mientras carga). Lighthouse no lo cargaría y el TBT bajaría a lo de `/sobre-el-proyecto`; cambia la primera impresión en el móvil (el aparato se ve, pero no se mueve hasta el primer toque).
   - b. **El 3D, cuando la página está quieta** (tras la carga y unos segundos sin trabajo): el usuario ve el póster y puede leer y desplazarse sin bloqueos, y el aparato llega después. Saca el trabajo de la ventana que mide Lighthouse, pero el móvil lento sigue notando esos segundos.
   - c. **Menos trabajo en el hilo principal** en la fase 8: generar el aparato en un worker (`OffscreenCanvas`) o trocear más la generación y la subida a la GPU. Es lo que de verdad lo arregla, pero es el cambio más grande.
   - d. **Aceptar < 90 en `/`**, porque el 3D es el producto, y dejar ≥ 90 para `/sobre-el-proyecto` y para `/?sin3d=1`.

   Propongo la b ya en la fase 8, con la c medida en la misma fase si la b no basta.

## 11. Cómo probarlo
- En la vista previa de la rama, `https://fase-7-web-producto.torno.pages.dev` (y, tras fusionar, `https://staging.torno.pages.dev`):
  1. La portada: el titular y el aparato en la primera pantalla. «Cómo se toca» baja a la guía; cada «Ver en el instrumento» lleva al aparato, viaja hasta su control y lo señala (con el teclado, el foco queda en él). No suena nada.
  2. «Despiezar el instrumento» (o «Despiezar» en la barra): las piezas suben; «Completo» lo monta otra vez.
  3. La anatomía: «Escuchar» cada capa o las cuatro, y «Parar».
  4. La ficha técnica: cada cifra, con su informe.
  5. `/sobre-el-proyecto`.
  6. En el móvil: el disco ya no sale blanquecino en el «Completo».
- En local: `npm run build`, `node scripts/serve-pages.mjs` y `http://localhost:4300`. Medidas: `node scripts/measure-web.mjs` y `npm run capturas -- --medir`. Imágenes: `node scripts/render-poster.mjs` (y otro build).

---

## 12. Respuesta a la revisión
[Revisión](../revisiones/fase-7.md): CAMBIOS NECESARIOS, con 1 Bloqueante, 2 Importantes, 9 Menores y 4 Sugerencias. Corregidos el Bloqueante, los dos Importantes, los nueve Menores y dos Sugerencias; las otras dos, razonadas.

| Hallazgo | Acción | Commit |
|---|---|---|
| 1 · Bloqueante: los e2e de la anatomía fallaban siempre | **Hecho.** Al quitar el «en reposo» de su `@defer`, la sección solo llega al verse y los tests no bajaban hasta ella: ahora bajan a la `section` (que no se repinta) y esperan al botón. El CI de la rama, en verde con ese commit (run 41339878255, 9,7 min). | `76125e4` |
| 2 · Importante: dos e2e inestables | **Hecho.** Los dos eran de tiempo, no del producto. (a) Reproducido con carga (2 de 12): el Intro llegaba mientras la guía se hidrataba. Con una espera de 2,5 s el foco acababa siempre en su control (60 de 60), así que el Intro no se pierde para quien usa el teclado de verdad; el test ahora espera a que la guía esté hidratada (`trn-guide[data-lista]`, que pone la propia guía al hidratarse). (b) El de axe no era una violación: la anatomía, al bajar deprisa, a veces no llegaba a verse y no aparecía su botón; ahora baja hasta ella. Con seis trabajadores a la vez: 108 de 108. | `504ec30` |
| 3 · Importante: el TBT | **Hecho:** `measure-web.mjs` mide también el TBT, como Lighthouse (lo que pasa de 50 ms cada tarea larga desde el FCP). En el móvil con 4G lento y CPU ×4: **`/` 379–410 ms y `/sobre-el-proyecto` 121–124 ms.** En `/`, las tareas largas son la llegada del 3D. Con LCP < 1 s y CLS ≈ 0, la nota de rendimiento de `/` rondaría el 90: no está asegurada. Lighthouse sigue pendiente de la herramienta (`TODO(ivan)`, y anotado en `DIARIO.md`); bajar el TBT del 3D en el móvil es de la fase 8 (rendimiento por nivel de calidad). | `9520cfb` |
| 4 · El marcador no ocupaba lo mismo que la barra | **Hecho.** La barra va en filas fijas: dos en el escritorio (los encuadres y las vistas; lo demás) y cuatro en el móvil, y el marcador reserva lo mismo (`--stage-toolbar-height`), también sin la pantalla completa (en el iPhone no hay). | `5e04440` |
| 5 · En reposo, «Escuchar» decía «Toca otra vez» | **Hecho:** dice que el instrumento está en reposo y cómo despertarlo. | `9eff53c` |
| 6 · Una vuelta del disco y la del anillo | **Hecho:** cada anillo es una capa, y una vuelta del anillo, su bucle entero (dos compases). La del disco sigue siendo un compás. | `9eff53c` |
| 7 · Sin espacio sin separación entre cifra y unidad | **Hecho:** ` ` en las cifras con unidad de todos los textos nuevos (31). | `5d5e94a` |
| 8 · Botones que cambian de nombre y llevan `aria-pressed` | **Hecho:** sin `aria-pressed`; el nombre dice lo que hace («Escuchar…» o «Parar»). | `9eff53c` |
| 9 · Tras «Despiezar el instrumento», el foco se quedaba en la sección | **Hecho:** pasa al botón «Despiezar» de la barra (pulsado), desde donde se monta otra vez. | `5e04440` |
| 10 · El diagrama de hilos, ilegible en el móvil | **Hecho:** rehecho en HTML y CSS, con la letra de la página; en el móvil, las cajas una debajo de otra. La descripción entera sigue en el pie de la figura. | `5d5e94a` |
| 11 · «Tres hilos», la nota de los atajos, «worker» y «portfolio» | **Hecho:** «Cuatro hilos y un solo reloj»; «Con el foco en el instrumento, Espacio reproduce…»; «hilo de síntesis» y «hilo aparte (un worker)», y «portafolio». | `5d5e94a` |
| 12 · `?despiece=1` y capturas viejas | **Hecho:** el comentario y el informe dicen `?captura=1&encuadre=despiezado`; las capturas, rehechas tras las correcciones. | `9520cfb` y el de las capturas |
| 13 · Sugerencia: la escucha no pasa por la rueda de volumen | **Anotada para la prueba de Iván.** Bajar la sesión o pausarla tocaría lo que suena en el instrumento (que la anatomía promete no tocar), y la rueda vive en el núcleo del worklet. Si en la prueba molesta, en la fase 8 la escucha puede leer el volumen general del último estado. | — |
| 14 · Sugerencia: el peso transferido | **Hecho** en la propuesta 1 (§10): los 625 kB en bruto son unos 310 kB con brotli (las fuentes, 144 kB, no se comprimen); medido comprimiendo los mismos archivos del build. Se pide a Iván que §5 diga si el peso es en bruto o transferido. | este |
| 15 · Sugerencia: compartir `location.origin` | **Se queda así hasta el lanzamiento:** la canónica, `torno.ivanchesa.com`, todavía no responde, y compartirla hoy daría un enlace roto. Apuntado para la fase 9. | — |
| 16 · Sugerencia: la tabla en el móvil y VoiceOver | **Hecho:** roles explícitos (`table`, `rowgroup`, `row`, `columnheader`, `rowheader` y `cell`). Se comprueba con un lector en la fase 8. | `5d5e94a` |
