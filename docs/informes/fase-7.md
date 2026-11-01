# Informe: Fase 7 (web de producto, guía y contenido)

- **Rama:** `fase-7-web-producto`
- **Fecha:** 2026-11-01
- **Estado:** en curso

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
  2. La sección de materiales, con el render despiezado del propio motor (`?captura=1&despiece=1`).
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
En curso.

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
- **7.e (en curso).**
  - **`scripts/render-poster.mjs`** (tarea 5): los dos pósteres, los renders de «Qué es» y de los detalles, y la imagen Open Graph de 1200×630 en JPEG (el aparato con su nombre al lado, con Fraunces y los colores de `tokens.css`; 60 kB). Sale de `capture.mjs`.
  - **El disco lavado en el «Completo» del móvil** (revisión del bloque C, #2): el vidriado a 0,25 (era 0,45), la base a 0,06 (0,2) y el entorno a 0,5 (0,6). Desde los 64° del móvil se lee oliva y de frente conserva el brillo. Capturas: `docs/informes/img/fase-7/disco-movil-{antes,despues}.jpg`.
  - **e2e:** privacidad en las tres rutas recorridas enteras (0 cookies, 0 peticiones a terceros y nada en `localStorage` que no sea de Torno), axe en la portada con todas sus secciones hidratadas y las etiquetas para compartir en el HTML (con la imagen sin CORP servida por `wrangler pages dev`).
