# Informe: Fase 8 (pulido y calidad)

- **Rama:** `fase-8-pulido`
- **Fecha:** 2026-11-01
- **Estado:** en curso (entrega 8.a)

## 0. Plan de la fase

**Antes de la fase, en `main`:** la revisión del bloque D y las decisiones de Iván del 01-11 (`2ce6047`): `@lhci/cli` aprobado y el tope de la primera visita sin el 3D a 650 kB en bruto (PLAN §1 y §5).

### Punto de partida (medido el 01-11 con el build de `main`)
- **Lighthouse móvil en local** (`lighthouse` 12.6.1 de `@lhci/cli`, Chrome 156, PC de desarrollo con un `benchmarkIndex` de unos 2900): `/` **87–90** (TBT 370–450 ms; LCP 2,0 s; CLS 0,003), `/sobre-el-proyecto` 99. Con el chunk 3D bloqueado, `/` da **98** (TBT 70 ms): todo lo que falta es la llegada del 3D en reposo, que Lighthouse ve entera (las tareas largas de `three`, del aparato y de la GPU). PageSpeed Insights, con una máquina más lenta y sin GPU, daba 70–72 (informe de la fase 7, §2).
- **JS inicial de `/`:** 318,1 kB (aviso a 330). **Chunk 3D:** 653,9 kB. **Primera visita sin el 3D:** 625 kB (fase 7).
- **La barra del 3D:** 8 botones en dos filas en el escritorio y cuatro en el móvil.

### Entregas (commits pequeños; informe «en curso» y push al final de cada una)

**8.a · Presupuestos, Lighthouse y el 3D fuera de la carga**
1. `check-bundles`: el **peso de la primera visita** de cada ruta, lo que pide su HTML (la página, el CSS, el JS inicial, las fuentes y las imágenes que no esperan a verse), con error a **650 kB** (sin el 3D, PLAN §5). Y un e2e que lo mide en el navegador entero (con los trozos que llegan sin tocar nada, sin el 3D ni la precarga del audio), con el mismo tope.
2. **El 3D, al acercarse o con la página quieta** (propuesta 2b del informe de la fase 7, pendiente de Iván): en lugar de «en reposo» (que llega en plena carga), el escenario se pide con el primer gesto en la página (puntero, dedo, rueda o tecla), al acercarse al instrumento o cuando la página lleva unos segundos sin tareas largas. Mientras, el póster, que es un render del propio aparato. Lighthouse mide la carga; la llegada del 3D se mide aparte (TBT y tareas largas con la CPU ×4, `measure-web.mjs`) y se intenta bajar (trocear lo que más bloquea).
3. **Lighthouse en el CI** con `@lhci/cli` (tarea 7): un job que usa el build de «build», lo sirve como Pages (`serve-pages.mjs`) y pasa tres veces por `/` y `/sobre-el-proyecto` en el móvil, con los umbrales de §5 (rendimiento ≥ 90 y ≥ 95; accesibilidad y buenas prácticas ≥ 95) y el informe como artefacto. `npm run lighthouse` para lo mismo en local. Si el CI lo hace inestable, se mide contra la vista previa tras desplegar.

**8.b · Lo pendiente de la guía y del foco**
1. **«Ver en el instrumento» en plena hidratación** (revisión del bloque D, #3): un clic o un Intro mientras la guía se hidrata también lleva el foco al control. e2e que pulsa sin esperar (con la CPU frenada para ensanchar la ventana).
2. **El foco al navegar dentro de la web** (tarea 3; revisiones anteriores): al cambiar de ruta, al `h1` de la página nueva (salvo en la primera carga y en los enlaces a un ancla), con test.

**8.c · El móvil y sin WebGL**
1. **Las zonas táctiles a 320 px** (revisión de la fase 6, #13; `TODO(ivan)`): en lugar de encoger, separar las zonas que se pisan sin dejar de cubrir su pieza (las de 44 px se pueden desplazar lo que les sobra), con test en Node y e2e a 320 px.
2. **Encuadres, tamaños, gestos y orientación** (tarea 1): el móvil en vertical y en horizontal (en horizontal, la caja 1:1 de borde a borde no cabe en la pantalla), con capturas y e2e de que no se ensancha la página.
3. **El disco lavado del móvil**, si sigue (revisión del bloque C, #2): capturas.
4. **Sin WebGL o con el contexto perdido** (tarea 2): el plato HTML automático con su aviso también si el contexto no vuelve (hoy solo con un aviso encima del lienzo), con e2e.

**8.d · La barra del 3D** (revisión del bloque D, #4): los tres encuadres como un control segmentado y lo demás agrupado, con capturas de antes y después y el teclado de siempre (e2e).

**8.e · Accesibilidad** (tarea 3): axe en todas las rutas y estados (también el 3D con su barra y el plato HTML), contraste, zoom al 200 % y *reflow* a 320 px (e2e) y la prueba con lector de pantalla (ver riesgos).

**8.f · Regresión visual** (tarea 6): `toHaveScreenshot` con `?captura=1` (las páginas en escritorio y móvil, y el plato HTML), con las referencias generadas en el CI (Linux) por un flujo que se lanza a mano y se suben al repositorio.

**8.g · Rendimiento: la tabla de §5** (tarea 4): todos los presupuestos medidos, por nivel de calidad donde aplica (3D), con el comando de cada cifra.

**8.h · Revisión final de diseño** (tarea 8) con `impeccable` y `web-design-guidelines`, con capturas de antes y después.

**8.i · Cierre:** `docs/PRUEBAS-MOVIL.md` con el 3D, la web y el lector de pantalla (VoiceOver y TalkBack), la vista previa publicada, informe, revisión por subagente, fusión, `DIARIO.md` y el CI y el despliegue de `main` en verde. Las pruebas de Iván en su móvil y en el iPhone (tarea 5 y criterio 3) son lo último: si no han llegado, el bloque para con todo lo demás hecho y fusionado.

### Riesgos
- **Lighthouse en el CI:** las máquinas de GitHub son más lentas que el PC y no tienen GPU (WebGL por software). Con el 3D fuera de la carga no debería pesar; si la nota baila, se mide contra la vista previa.
- **El 3D más tarde:** en un escritorio, el primer movimiento del ratón lo pide, así que llega como ahora; sin tocar nada, unos segundos después (con el póster, que es el mismo aparato). Es reversible (un disparador del `@defer`) y queda para que Iván lo confirme.
- **La prueba con lector de pantalla:** no puedo oír NVDA ni Narrador desde aquí. Haré la revisión del árbol de accesibilidad con el navegador (nombres, roles, valores y regiones vivas) y la prueba con VoiceOver y TalkBack irá en la lista de Iván. Se anota como desviación.
- **Las referencias de la regresión visual** dependen del sistema (fuentes y *antialiasing*): se generan en el CI, nunca en Windows.

### Skills consultadas
`threejs-performance` y `threejs-testing` (la llegada del 3D y las capturas), `accessible-animation` y `threejs-accessibility` (movimiento y alternativa sin WebGL), `impeccable` y `web-design-guidelines` (la revisión final), `webapp-testing` (Playwright).
