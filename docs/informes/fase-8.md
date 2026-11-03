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

**Aprobación (03-11).** La sesión de plan aprueba el plan de la 8.a tal cual, con la **propuesta 2b** (Iván: «Continúa»): el 3D con el primer gesto, al acercarse o con la página quieta, y el póster hasta entonces. Si con la 2b no llega a 90, la 2c en la misma fase; la 2d (< 90), no sin preguntar. Iván puede deshacer la 2b: va en un solo disparador y está en `PENDIENTES.md` para que lo confirme en su móvil.

## 1. Resumen
(Se completa al cerrar la fase.)

### Progreso por entregas
- **8.a (hecha).**
  - **El 3D fuera de la carga (2b):** `core/page-presence.ts` llama una vez con el primer gesto en la página (`pointerdown`, `pointermove`, `touchstart`, `wheel` o `keydown`) o cuando la página, ya cargada, lleva 6 s sin tareas largas; la portada pide entonces el escenario (`@defer (on interaction; when stageWanted())`). Con `?captura=1`, al momento; el plato HTML (`?sin3d=1`), en reposo, como antes. Con 3 s de espera, en una de cuatro pasadas el escenario llegaba mientras Lighthouse aún recogía la página (un nodo que ya no estaba): por eso 6 s.
  - **Trocear la generación (2c, en parte):** el aparato en tres tramos con una pausa entre ellos (el modelo; las texturas de lienzo; la sombra, las formas de los controles y los encuadres). La tarea más larga de la llegada del 3D, con la CPU ×4, baja de 189–449 ms a 104–139 ms, y su TBT de 335–1192 ms a 140–286 ms (`node scripts/measure-web.mjs`, tres visitas).
  - **Sin saltos al llegar el 3D** (encontrado al medir con la red frenada de verdad: CLS de 0,6): el escenario medía 60 px más (83 en el móvil) que su marcador, por la línea del autoguardado, y entre el `@defer` de fuera y el de dentro había un fotograma sin nada. El marcador reserva la línea (el mismo texto, invisible) y una reserva con `:has()` ocupa el sitio en ese tic. Medido: el marcador y el escenario miden lo mismo en el escritorio, en el móvil (412 y 360 px) y en horizontal (844 × 390 y 667 × 375).
  - **El peso de la primera visita:** `check-bundles` suma lo que pide el HTML de cada ruta (la página, el JS inicial, el CSS, el icono, las imágenes sin `lazy` y las fuentes), con error a 650 kB; y `e2e/budgets.spec.ts` lo mide en el navegador con lo que llega sin tocar nada (sin el 3D ni la precarga del audio).
  - **Lighthouse en el CI** (`@lhci/cli` 0.15.1, con Lighthouse 12.6.1): `lighthouserc.js`, `npm run lighthouse` y el job «Lighthouse (móvil)», con el build de «build» servido como Pages, tres pasadas por ruta, la mediana y los umbrales de §5 (también LCP ≤ 2,5 s y CLS ≤ 0,05). Los informes, como artefacto.
  - **El CLS del cambio de fuente** (lo enseñó el CI: 0,098 en `/` y 0,046 en `/sobre-el-proyecto`, con DejaVu Serif de reserva en Linux, un 11 % más ancha que Fraunces): primero, la precarga de las dos fuentes (`c500aee`), que no lo cambió y subió el LCP del CI a 2,6–2,7 s (compiten con el póster en el 4G simulado): revertida. Después, las reservas con sus métricas ajustadas (`size-adjust` y `ascent`/`descent-override`), medidas con `node scripts/font-fallbacks.mjs`.
- **8.b (hecha).**
  - **«Ver en el instrumento» en plena hidratación** (revisión del bloque D, #3): el clic lo atiende la portada (`guideEntryFor`, en su escucha de `click`), que está hidratada desde el arranque; los botones solo llevan el número de su entrada. Reproducido con la CPU ×6: el Intro muy temprano se perdía porque **el salto al ancla `#guia` de la carga quitaba el foco al botón** (no había `click`): los e2e nuevos pulsan sin el ancla y sin esperar a nada (clic e Intro, con la CPU ×6), y los de siempre ya no esperan a la hidratación. 40 de 40 con seis trabajadores a la vez.
  - **El foco al navegar:** al cambiar de página, al `h1` de la nueva (`tabindex="-1"`, sin desplazar); nunca en la primera carga ni con un ancla de la misma página (test y `e2e/navigation.spec.ts`).
- **8.c (en curso).**
  - **Las zonas táctiles a 320 px** (revisión de la fase 6, #13): en lugar de encoger, `separateZones` aparta las zonas que se pisan lo que les sobra sin destapar su pieza (la capa 1 y el volumen, menos de 4 px cada una). Test en Node (320, 360 y 390 px) y e2e a 320 y 360 px.
  - **Sin WebGL o con el contexto perdido:** si el contexto no vuelve en 5 s, el plato HTML con su aviso («El 3D se ha detenido y no ha vuelto…») y el foco en el mismo control. e2e (se pierde con `WEBGL_lose_context` y nadie lo devuelve).
  - **El móvil en horizontal:** la caja pasaba a 228 × 182 px (844 × 390) con el espejo encima del aparato. Ahora, con poca altura, la caja a la izquierda (448 × 358) y el espejo y la barra a su derecha; el marcador, igual.
- **8.d (en curso).** La barra del 3D en tres grupos: los encuadres como control segmentado, «Inspeccionar» y «Despiezar» en otro y la pantalla completa, «Pausar movimiento» y los atajos como botones de icono con su nombre dentro. Una fila en el escritorio (antes, dos) y tres en el móvil (antes, cuatro).
