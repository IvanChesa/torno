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
