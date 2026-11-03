# Informe: Fase 8 (pulido y calidad)

- **Rama:** `fase-8-pulido`
- **Fecha:** 2026-11-01 a 2026-11-03
- **Estado:** listo para revisión (falta lo del móvil de Iván, que es lo último del bloque)

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
La portada pasa Lighthouse en el móvil (en el CI: `/` 99 de mediana, `/sobre-el-proyecto` 100; LCP 1,8 s y CLS 0,001), porque el 3D ya no llega en plena carga sino con el primer gesto o con la página quieta (la 2b), y porque se han quitado los saltos que salían al medirlo: el marcador reserva todo lo del escenario, el tic entre los dos `@defer` y la fuente de reserva sin ajustar hasta que llegaba la hoja de estilos. El CI lleva Lighthouse (`@lhci/cli`), la regresión visual (14 capturas con referencias de Linux) y el peso de la primera visita (≤ 650 kB, en `check-bundles` y en un e2e). Lo pendiente de las revisiones: «Ver en el instrumento» funciona en plena hidratación, el foco va al `h1` al cambiar de página, las zonas táctiles no se pisan a 320 px, la barra del 3D cabe en una fila y el móvil en horizontal tiene su disposición. Con el contexto perdido, el plato HTML. La tabla de todos los presupuestos de §5, medida (§6); lo del móvil, con Iván.

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
- **8.c (hecha).**
  - **Las zonas táctiles a 320 px** (revisión de la fase 6, #13): en lugar de encoger, `separateZones` aparta las zonas que se pisan lo que les sobra sin destapar su pieza (la capa 1 y el volumen, menos de 4 px cada una). Test en Node (320, 360 y 390 px) y e2e a 320 y 360 px.
  - **Sin WebGL o con el contexto perdido:** si el contexto no vuelve en 5 s, el plato HTML con su aviso («El 3D se ha detenido y no ha vuelto…») y el foco en el mismo control. e2e (se pierde con `WEBGL_lose_context` y nadie lo devuelve).
  - **El móvil en horizontal:** la caja pasaba a 228 × 182 px (844 × 390) con el espejo encima del aparato. Ahora, con poca altura, la caja a la izquierda (448 × 358) y el espejo y la barra a su derecha; el marcador, igual.
- **8.d (hecha).** La barra del 3D en tres grupos: los encuadres como control segmentado, «Inspeccionar» y «Despiezar» en otro y la pantalla completa, «Pausar movimiento» y los atajos como botones de icono con su nombre dentro. Una fila en el escritorio (antes, dos) y tres en el móvil (antes, cuatro).

## 2. Criterios de aceptación

| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| Tabla con **todos** los presupuestos de §5 medidos y cumplidos | ✅ (salvo lo del móvil, ⏳) | La tabla de §6, con el comando de cada cifra. Todo lo que se mide en el PC y en el CI cumple. Quedan para las pruebas de Iván en su móvil los FPS en un móvil de gama media, los 5 min sin cortes, la latencia calibrada y la primera reproducción en frío en el móvil (pruebas 1, 5, 7, 10 y 15 de `PRUEBAS-MOVIL.md`). |
| axe sin violaciones graves; e2e y regresión visual en verde en el CI | ✅ | axe: 0 violaciones (de ninguna gravedad) en las tres rutas, en el móvil, con la chuleta, en las vistas del 3D y en el plato HTML (`e2e/static`, `a11y`, `stage` e `instrument.spec.ts`). e2e y regresión visual: el CI de la rama (§6). |
| Iván da el visto bueno en su móvil y en un iPhone | ⏳ | La lista, ampliada con el 3D, la web y el lector de pantalla (pruebas 15 a 24), en `docs/PRUEBAS-MOVIL.md`. Es lo último del bloque: si no llega antes del cierre, el bloque para con todo lo demás hecho y fusionado (`DIARIO.md`). |

## 3. Tareas del plan
| Tarea | Estado | Notas |
|---|---|---|
| 8.1 Móvil: encuadres, tamaños, gestos y orientación | hecha | Horizontal rehecho (la caja al lado del espejo y la barra), zonas a 320 px sin pisarse, el disco del móvil comprobado en las capturas y la barra en tres filas (antes, cuatro). Los gestos, con sus e2e de siempre (dedo emulado). |
| 8.2 Sin WebGL o con el contexto perdido | hecha | Sin WebGL, como antes; con el contexto perdido y sin volver en 5 s, el plato HTML con su aviso y el foco en el mismo control (e2e). |
| 8.3 Accesibilidad | hecha (salvo la prueba con lector, §4) | axe en todo, contraste (`scripts/contrast.spec.ts` y axe), el foco al navegar, zum al 200 %, *reflow* a 320 px y espaciado de texto (e2e), y el árbol de accesibilidad revisado (§4). |
| 8.4 Rendimiento: la tabla de §5 | hecha | §6. |
| 8.5 iOS Safari en un iPhone real (Iván) | pendiente de Iván | `PRUEBAS-MOVIL.md`. |
| 8.6 Regresión visual | hecha | `e2e/visual.spec.ts` (14 capturas: las tres rutas, tres secciones y el 3D, en escritorio y móvil), con las referencias de Linux generadas por el CI y subidas al repositorio. |
| 8.7 Lighthouse en el CI | hecha | Job «Lighthouse (móvil)» con `@lhci/cli`; en local, `npm run lighthouse`. |
| 8.8 Revisión final de diseño | hecha | Con `web-design-guidelines` e `impeccable` (§5), capturas de antes y después (§7). |
| Revisión del bloque D: #1 y #2 (Lighthouse y peso) | hecha | Decisiones de Iván del 01-11, en el plan desde `2ce6047`. |
| Revisión del bloque D: #3 (la guía en plena hidratación) | hecha | La escucha en la portada y e2e que no esperan. |
| Revisión del bloque D: #4 (la barra) | hecha | Tres grupos y una fila en el escritorio. |
| Revisión del bloque D: #5 (enlaces de ivanchesa.com) | fase 9 | Como dice la revisión. |
| Pendiente de revisiones anteriores: el foco al navegar, las zonas a 320 px y las cifras del móvil | hecha · hecha · ⏳ | Las cifras del móvil, en la lista de Iván. |

## 4. Desviaciones del plan y motivo
- **La prueba con lector de pantalla** (tarea 3: «prueba manual con NVDA o Narrador»): no puedo oír un lector desde aquí. En su lugar, el árbol de accesibilidad del 3D y del plato revisado con el navegador (nombres, roles, valores y pistas de cada control, grupos con nombre y regiones vivas: todo en español y sin huecos), y la prueba de verdad, con TalkBack y VoiceOver, en la lista del móvil (prueba 23). Una cosa para esa prueba: el valor de una capa dice el nivel («100 %») pero no si es la elegida o está en silencio; lo dicen el piloto y la pantalla. Si a Iván se le hace corto con el lector, se añade.
- **La revisión de `impeccable` sin su lanzador:** la primera vez descarga un binario y `CLAUDE.md` pide preguntar antes de cualquier descarga. Se ha usado su modo sin lanzador (sus guías de *critique*, *polish* y el *craft floor*, con `DISENO.md`).
- **La precarga de las fuentes, probada y revertida** (`c500aee` y `251acf3`): no arreglaba el CLS y subía el LCP del CI. El arreglo es otro (§5).
- **El 3D a los 6 s sin gestos** (el plan decía «unos segundos»): con 3 s, en una de cuatro pasadas el escenario llegaba mientras Lighthouse aún recogía la página.
- **La parte de la 2c que se ha hecho:** trocear la generación; no el *worker* con `OffscreenCanvas`, que con la 2b no hace falta para el 90 (98–99 en local).

## 5. Decisiones técnicas nuevas
- **`core/page-presence.ts`:** el primer gesto o la página quieta (sin tareas largas) como disparador del 3D; el plato HTML, en reposo, y las capturas, al momento.
- **El marcador del instrumento reserva todo lo del escenario**, también la línea del autoguardado, y una reserva con `:has()` cubre el tic entre el `@defer` de fuera y el de dentro. Alternativas: quitar el `@defer` anidado (descargaría los dos instrumentos) o `@loading` en los de dentro (probado: el hueco seguía).
- **Las reservas de Fraunces con sus métricas** (`size-adjust` y `ascent`/`descent-override`, medidas con `scripts/font-fallbacks.mjs`) y **sus `@font-face` en el `<head>`** (solo las de `local()`: las de Fraunces antes del primer pintado retrasaban el FCP de Lighthouse de 1,7 a 2,6 s).
- **La precarga del póster** (`<link rel="preload" as="image">` con la `media` de cada imagen), desde `scripts/pages.mjs`.
- **«Ver en el instrumento» lo atiende la portada** (`guide-target.ts`): los botones llevan su control y su encuadre en atributos; la guía no entra en el JS inicial.
- **`separateZones`:** apartar las zonas de 44 px que se pisan sin destapar su pieza, en lugar de encogerlas.
- **La barra en tres grupos** (dos controles segmentados y botones de icono con su nombre dentro). Alternativa: un menú «Más» con lo demás, que escondía «Pausar movimiento».
- **El icono de «Pausar movimiento»:** la pausa dentro de dos flechas de giro (dos barras solas se confundían con la tecla de reproducir).
- **La regresión visual con las referencias del CI:** si falta una, el grupo «visual» la escribe, la deja en el artefacto «referencias-visuales» y falla hasta que se sube.
- **Lighthouse con la mediana de tres pasadas** (no la mejor, que es lo que hace `@lhci/cli` si no se dice).

## 6. Salida de los checks y la tabla de §5

### La tabla de todos los presupuestos de §5 (tarea 4)

Medido en la fase 8 (01–03-11) con el build de la rama, en el PC de desarrollo (RTX 3060, D3D11) salvo donde se dice. «Por nivel» es por nivel de calidad del 3D (alto, medio y bajo). ⏳: depende de las pruebas de Iván en su móvil (`docs/PRUEBAS-MOVIL.md`), que son el último paso del bloque.

| Área | Objetivo (§5) | Medido | Cómo | |
|---|---|---|---|---|
| JS de la primera visita | aviso > 330 kB · error > 400 kB | `/` 317,0 kB · `/sobre-el-proyecto` 316,0 · `/404` 301,4 | `node scripts/check-bundles.mjs` | ✅ |
| Chunk 3D (three + escena) | aviso > 800 kB | 657,3 kB | `check-bundles` | ✅ |
| Motor de audio · worklet · workers | ≤ 60 kB cada uno | 25,2 · 41,0 · 17,4 y 41,9 kB | `check-bundles` | ✅ |
| Fuentes | ≤ 150 kB | 144,1 kB (2 archivos) | `check-bundles` | ✅ |
| Peso de la primera visita sin el 3D | ≤ 650 kB en bruto | `/` 560,1 kB · `/sobre-el-proyecto` 468,5 · `/404` 440,7 (en el navegador, con lo que llega sin tocar nada); lo que pide el HTML: 562,8 · 494,8 · 466,1 | `e2e/budgets.spec.ts` y `check-bundles` | ✅ |
| Peso con el 3D | ≤ 1,5 MB | 1374,9 kB | `npm run capturas -- --medir` | ✅ |
| Arranque del 3D | generación ≤ 150 ms (escritorio); sin tareas > 200 ms | por nivel, en frío: 112,8 · 109,5 · 80,9 ms; la tarea más larga, 58–132 ms. En el móvil emulado (CPU ×4, tras un gesto): la más larga, 104–139 ms | `capturas -- --medir` y `node scripts/measure-web.mjs` | ✅ |
| VRAM estimada | ≤ 96 MB (alto) · ≤ 48 MB (bajo) | 56,2 · 35,4 · 31,2 MB por nivel | `capturas -- --medir` | ✅ |
| FPS | ≥ 55 (escritorio, alto) · ≥ 30 (móvil de gama media, bajo) | escritorio: 144 fps en los tres niveles (p95 de 7 ms, 778 × 622 px) · móvil: ⏳ (prueba 15) | panel de la escena (`?diagnostico=1`) | ✅ · ⏳ |
| Reposo | 0 fps en pausa y sin interacción (y con movimiento reducido) | 0 fotogramas en reposo, con movimiento reducido y con «Pausar movimiento» | `e2e/stage.spec.ts` (escena-dev) | ✅ |
| CPU del audio | ≥ 100× (Node) · ≥ 30× a 240 BPM · 0 cortes en 5 min en el móvil | 223–224× · 62–63× y 34× en el peor caso · ⏳ (prueba 10) | `npm run test:bench` | ✅ · ⏳ |
| Síntesis | ≤ 50 ms por bucle en caliente (48 kHz) · primera reproducción en frío en el móvil ≤ 150 ms | 5,6–36,8 ms (en una pasada justo detrás del banco del núcleo, «olivo» dio 50,9; en las dos siguientes, 36,8) · escritorio 68–93 ms (fase 5), móvil ⏳ (prueba 1) | `node scripts/bench-synth.mjs` | ✅ · ⏳ |
| Exactitud | cola y tomas exactas a la muestra · *varispeed* ±1 muestra · deriva 0 en 10 min | los tests del núcleo, en verde (567 en Node) | `npm test` | ✅ |
| Sin clics | salto ≤ el mayor de la señal + 0,01 | los tests de juntas, cambios, fundidos y disco, en verde | `npm test` | ✅ |
| Arranque del audio | primer sonido ≤ 100 ms · contexto en `running` dentro del gesto con el worklet retrasado 1,5 s | 7–15 ms (fase 2) · el e2e del gesto, en verde | `e2e/instrument.spec.ts` | ✅ |
| Respuesta | ≤ 20 ms del gesto al audio | mediana 0,4 ms (tecla) y 3,9 ms (dial) en la fase 6; el e2e (≤ 20 ms), en verde | `e2e/stage.spec.ts` | ✅ |
| Latencia de grabación | ±5 ms tras calibrar (móvil) | ±2 ms con el micrófono sintético (e2e) · ⏳ (pruebas 5 y 7) | `e2e/microphone.spec.ts` | ✅ · ⏳ |
| Memoria de audio | ≤ 64 MB típica · peor caso ≤ 220 MB | 16,4 MB · 195,84 MB a 48 kHz (fase 1, `docs/AUDIO.md` §4) | tests del núcleo | ✅ |
| Memoria 3D | 10 cambios sin crecimiento de `renderer.info.memory` | sin crecimiento | `e2e/stage.spec.ts` (escena-dev) | ✅ |
| Lighthouse móvil `/` | rendimiento ≥ 90 · accesibilidad y buenas prácticas ≥ 95 | local: 98–99 · 100 · 100 | `npm run lighthouse` (y el job del CI) | ✅ |
| Lighthouse móvil `/sobre-el-proyecto` | ≥ 95 en las tres | local: 98–100 · 100 · 100 | ídem | ✅ |
| LCP / CLS | ≤ 2,5 s · ≤ 0,05 | Lighthouse local: `/` 2,0 s y 0,001; `/sobre-el-proyecto` 1,7 s y 0. Con la hoja de estilos retrasada 1,5 s: 0,001 y 0 | Lighthouse y `cssdelay` (§5) | ✅ |
| Accesibilidad | axe: 0 violaciones graves o críticas · todo con teclado y sin WebGL | 0 violaciones (de ninguna gravedad) en las tres rutas, el móvil, la chuleta y las vistas del 3D; teclado y plato HTML con sus e2e | `e2e/static`, `a11y`, `stage` e `instrument.spec.ts` | ✅ |
| Privacidad | 0 cookies · 0 peticiones a terceros · 0 al grabar, guardar o exportar | 0 · 0 · 0 | `e2e/static.spec.ts` y `files.spec.ts` | ✅ |

### Salida de `npm run check`
```
npm run check   (03-11, 563fbbd)
  lint: tipos de cada capa, ESLint y Prettier, sin errores
  test:node: 44 archivos, 569 tests (98,34 % de sentencias y 94,89 % de ramas en el TS puro)
  test:ng: 13 archivos, 83 tests
  build: 3 rutas prerenderizadas; Initial total 309,51 kB, sin avisos
  Pages: 3 hashes de scripts en la CSP; 4 @font-face (las reservas) en el <head>
  check-bundles:
    ✔ JS inicial de /                  317,1 kB (aviso > 330)
    ✔ JS inicial de /sobre-el-proyecto 316,0 kB · /404 301,4 kB
    ✔ Desbloqueo de audio 1,9 kB · motor 25,2 kB · workers 17,4 y 41,9 kB · worklet 41,0 kB
    ✔ Chunk 3D 657,3 kB (aviso > 800) · fuentes 144,1 kB
    ✔ Primera visita: / 562,9 kB · /sobre-el-proyecto 494,8 kB · /404 466,1 kB (error > 650)
```
Lighthouse en el CI (`2ef3098`, tres pasadas): `/` 95, 99 y 99 en rendimiento, 100 y 100 (LCP 1,8–2,1 s, CLS 0,001); `/sobre-el-proyecto` 100, 100 y 100 (LCP 0,8 s, CLS 0).

## 7. Capturas
En `docs/informes/img/fase-8/` (`npm run capturas -- --fase=8` y `--solo=escenario`): las páginas en escritorio y móvil, el plato HTML con sus avisos y el 3D en cada encuadre. Antes y después de la barra: `docs/informes/img/fase-7/instrumento3d-*.jpg` frente a `img/fase-8/instrumento3d-*.jpg`; el móvil en horizontal, antes y después: `img/fase-8/horizontal-{antes,despues}.png`.

## 8. Dependencias añadidas
| Paquete | Versión | Motivo | ¿Está en la lista permitida? |
|---|---|---|---|
| `@lhci/cli` | 0.15.1 (con Lighthouse 12.6.1) | Lighthouse en el CI (tarea 7) | Sí: aprobada por Iván el 01-11 (PLAN §1) |

## 9. Pendientes y `TODO(ivan)`
- `TODO(ivan)`: **las pruebas en tu móvil y en un iPhone** con la lista nueva de `docs/PRUEBAS-MOVIL.md` (sobre todo las cifras: 1, 5, 7, 10 y 15; y del 3D y la web: 16 a 24).
- `TODO(ivan)`: **confirmar cómo llega el 3D** (la 2b; prueba 16). Se deshace en un solo sitio (`home-page.ts` y `QUIET_MS`).
- Siguen los de antes: el espejo B, los textos y los enlaces de ivanchesa.com (fase 9).

## 10. Propuestas de cambio al plan
Ninguna.

## 11. Cómo probarlo
- En la vista previa de la rama, `https://fase-8-pulido.torno.pages.dev` (y, tras fusionar, `https://staging.torno.pages.dev`):
  1. La portada sin tocar nada: el póster y, a los 6 s, el aparato. Recarga y mueve el ratón: llega enseguida.
  2. La barra: COMPLETO · CAPAS · CONTROLES, INSPECCIONAR · DESPIEZAR y los tres iconos (pantalla completa, pausar movimiento y atajos), con el ratón y con el tabulador.
  3. «Ver en el instrumento» en la guía, nada más cargar.
  4. «Sobre el proyecto» desde la cabecera: el foco va a su título.
  5. En el móvil, en vertical y en horizontal.
- En local: `npm run build`, `npm run lighthouse`, `node scripts/measure-web.mjs`, `npm run capturas -- --medir`, `node scripts/font-fallbacks.mjs` y `VISUAL=1 npx playwright test --project=visual` (en Windows no casa con las referencias de Linux: solo para ver que funciona).
