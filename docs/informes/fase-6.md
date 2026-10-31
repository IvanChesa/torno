# Informe: Fase 6 (interacción y sincronía)

- **Rama:** `fase-6-interaccion`
- **Fecha:** 2026-10-31
- **Estado:** terminada, con la revisión corregida (§12). Las cuatro entregas están hechas (6.a–6.d), con lo que añadió la revisión parcial del bloque C (`docs/revisiones/bloque-C.md`): la pantalla legible (hallazgo 1) y la carrera del autoguardado.

## 0. Plan de la fase

**Objetivo (PLAN, fase 6):** tocar el aparato 3D como un objeto de verdad, con el ratón, el dedo y el teclado. Desde esta fase, el 3D es el instrumento de la portada; el plato HTML queda para `?sin3d=1` y para cuando no hay WebGL.

**Diseño aprobado (fase 5, Iván, 30-10):** distribución redonda, Terracota, Neutral y el plato HTML redondo.

### Entregas (commits pequeños, uno por pieza; revisión de la fase 5, n.º 11)

**6.a · Motor 3D (`scene/`), con tests en Node**
- **Encuadres.** `setShot()` sustituye a `setView()` para tocar; las 4 vistas de las capturas siguen.
  - «Tocar» tiene tres: `completo` (la silueta entera, la `frente` de hoy), `capas` (el arco de los diales de la izquierda con sus pilotos) y `controles` (las teclas, el brazo y el disco). Cada uno es un ángulo y un subconjunto de la silueta para `frame()`.
  - «Inspeccionar» es una órbita limitada: acimut de ±150°, elevación de 10° a 85° y zum acotado.
  - En el móvil (caja 1:1), cada encuadre tiene una elevación más alta, para aplastar menos el fondo.
  - Las transiciones interpolan la posición y el punto de mira en unos 600 ms, pintando seguido solo mientras duran. Con el movimiento en pausa, cortan.
- **`project()`.** Por cada control devuelve:
  - la caja en píxeles CSS (las esquinas de su caja envolvente, proyectadas) y su centro;
  - el **eje del arrastre** en pantalla, que es la proyección de una dirección del mundo en su centro: el brazo va por la tangente de su arco (hacia el disco, más filtro), la rueda en radial hacia fuera (más volumen) y los diales en vertical;
  - si se ve. En «Inspeccionar», un rayo de la cámara al centro: si choca antes con otra pieza, el control se oculta y se desactiva (§4.7).
  - Se recalcula solo cuando cambian la cámara o el tamaño, y se avisa con un evento `camera`.
- **`setHighlight(id | null)`.** Un anillo de luz (un toro emisivo con el color del foco de `DISENO.md`) alrededor de la pieza enfocada o bajo el puntero, a la medida de su huella. En el brazo va en la costilla, y en el disco, en su canto.
- **`setMotion({ discTurns, levels, recordBlink })`.** Lo pide el escenario en cada fotograma mientras suena.
  - El disco gira (`rotation.y`).
  - Los pilotos laten con el nivel de su capa (RMS en dB, de −48 a 0 dBFS, sobre la intensidad de su estado).
  - El piloto de grabar parpadea con el pulso en la cuenta previa.
  - Las mismas cifras van a `stats()`, para el panel (`?diagnostico=1`) y los e2e.
- **Pantalla.**
  - Una franja dinámica en un segundo lienzo pequeño (unos 256×64 px), en la parte de abajo de la pantalla: los medidores de las 4 capas, la forma de onda de la elegida y el cabezal. Se sube a la GPU en cada fotograma solo mientras suena (unos 64 kB).
  - El texto sigue en `ScreenPainter` y solo se repinta si cambia.

**6.b · La capa de controles y el 3D como instrumento** (`features/instrument-stage/`)
- **Estructura de la portada.** Hay un solo instrumento en el DOM:
  - el escenario 3D (en `@defer`, como ahora);
  - el plato HTML con `?sin3d=1`, o si `createSceneEngine` falla (cambio automático; el aviso pulido es de la fase 8).
  - `hydration.spec` y los demás e2e que abren `/` sin `?sin3d=1` pasan a usarlo (sus controles no tienen que esperar al WebGL por software).
- **Carcasa común**, sacada de `HtmlInstrument` para no duplicarla:
  - un componente con el `input type=file`, `setFilePicker` y `checkAutosave`;
  - una directiva con los atajos (`shortcutFor`), la precarga al acercarse (puntero, foco e `IntersectionObserver`) y el grupo con su nombre.
  - El plato HTML usa las dos; sus e2e tienen que seguir igual.
- **`StageControls`.** Un elemento por control con la directiva `trnControl` de siempre (el mismo teclado, los mismos nombres y los mismos `data-control`, así que `InstrumentDriver` sirve):
  - el orden del tabulador de siempre: principal, capas, teclas, disco, brazo, volumen y reposo;
  - las posiciones se escriben en `style` directamente, fuera de los signals, solo con el evento `camera`;
  - cada zona mide `max(44 px, caja proyectada)` y va centrada en la pieza;
  - `trnAxis` sale de `project()`;
  - `touch-action: none` en los controles y `pan-y` en el lienzo;
  - están ocultos (`visibility: hidden`) hasta la primera proyección;
  - el foco y el *hover* pasan a `setHighlight`.
- **Gestos nuevos en la directiva:** el arrastre circular de los diales (si empieza girando alrededor del centro, 270° son todo el recorrido) y la aceleración del vertical con la velocidad. El disco ya va por ángulo.
- **Encima del aparato**, el espejo de la pantalla en HTML: `InstrumentScreen` con el mismo `display()`.
- **Debajo**:
  - los avisos (`InstrumentNotices`, que ya trae la chuleta de atajos);
  - la región viva;
  - una barra: «Completo», «Capas» y «Controles» (`aria-pressed`), «Inspeccionar», «Pantalla completa» (oculta sin `document.fullscreenEnabled`), «Pausar movimiento» y «Atajos» (`toggle-help`).
- **«Inspeccionar» con teclado:** una superficie de órbita con `role="slider"`. ←/→ giran el acimut y ↑/↓ cambian la altura; `aria-valuetext` dice la vista.
- **Móvil:**
  - la caja es 1:1 y ocupa el ancho entero.
  - Las parejas más justas son capa 1–volumen (≈ 45 mm), volumen–reposo (≈ 47 mm) y las teclas (≈ 51 mm). Para que las zonas de 44 px no se pisen hace falta ≥ 1 px/mm (360 px de ancho, cenital alto), con un test.
- **«Pausar movimiento»** (`core/`, un servicio):
  - se activa con la preferencia guardada en `localStorage` (`torno.movimiento`, con `try/catch`) o con `prefers-reduced-motion`;
  - en pausa no hay ningún bucle de `requestAnimationFrame`: el disco quieto, los pilotos fijos, los medidores parados, las cámaras cortan y no hay fundidos;
  - también en el plato HTML: hoy, con movimiento reducido, sus medidores se repintan cada 250 ms; pasan a quedarse parados.

**6.c · Sincronía con el audio**
- **`TransportClock`** (`instrument/`, TS puro):
  - se ancla en el último estado (su pulso y el momento en que llegó) y extrapola con el tempo;
  - si el motor la da, descuenta la latencia de salida;
  - con el disco agarrado, enseña el ángulo del agarre más `discTurns`, sin esperar al estado;
  - test en Node con estados a 30/s y fluctuación: pendiente = tempo ±1 %.
- **El escenario** lleva un bucle de `requestAnimationFrame` mientras suena o el disco está agarrado, y sin pausa de movimiento: reloj, `setMotion` y franja de la pantalla. En reposo, 0 fps.
- **Forma de onda:**
  - la calcula el motor de audio (picos por tramo, una función pura en `audio/core/analysis.ts`) a partir de `copySession()`, y **solo cuando cambia el contenido**;
  - para saberlo, `LayerStatus` lleva una versión del contenido por capa, porque el contador de deshacer se queda en 3. Es un cambio del protocolo, con sus tests;
  - el store expone las formas de onda con un signal (pocas veces).

**6.d · e2e, capturas y cifras**
- **`stage.spec.ts`** (proyectos del escenario):
  - cada control con el ratón sobre su elemento proyectado, con el táctil emulado y con el teclado;
  - las funciones de §0.1 en 3D, reutilizando `InstrumentDriver` con `{ stage: true }`;
  - 44 px sin solaparse en el encuadre del móvil;
  - la página se desplaza al deslizar el lienzo (CDP `Input.dispatchTouchEvent`);
  - **velocidad del disco frente al transporte ±1 %**, por el panel;
  - **respuesta ≤ 20 ms**: `MessagePort.prototype.postMessage` con marca de tiempo frente al `timeStamp` del puntero;
  - 0 animaciones con `reducedMotion: 'reduce'` y con «Pausar movimiento»: el disco no se mueve y no hay bucle continuo.
- **Capturas** (`?captura=1`, `scripts/capture.mjs`): cada encuadre (completo, capas y controles) e «Inspeccionar», en escritorio y móvil, más los pósteres de nuevo (escritorio 5:4 y móvil 1:1).
- **Fuera de la fase, apuntada en la 5:** la carrera del autoguardado (`files.spec.ts:287`). No se autoguarda mientras la confirmación de «Recuperar» está abierta.

### Riesgos
- **Posiciones a cada fotograma:** solo con el evento `camera`, escritas directamente en el DOM.
- **44 px en el móvil:** el encuadre propio, más un test que mide las cajas.
- **e2e con WebGL por software:** van en los proyectos del escenario, los últimos. Los demás, con `?sin3d=1`.
- **Subir la textura de la franja en el móvil:** es pequeña. Si los FPS no llegan, solo los medidores, con *uniforms*.
- **Tamaño del chunk 3D:** 622,6 kB de 800.

### Skills consultadas
`threejs-interaction`, `threejs-accessibility`, `threejs-scene`, `threejs-performance`, `accessible-animation`.

## 1. Resumen
El aparato 3D es el instrumento de la portada.
- **Controles:** cada pieza lleva encima su control nativo, con los mismos gestos, teclado y nombres que el plato HTML. Se toca con el ratón, el dedo y el teclado, con zonas de 44 px como poco en el móvil y la página desplazándose por encima del aparato.
- **Cámara:** encuadres de «Tocar» (completo, capas y controles, y los suyos en el móvil), «Inspeccionar» con órbita limitada, viajes suaves (que cortan con la pausa de movimiento) y pantalla completa.
- **Sincronía con el audio:** el disco da una vuelta por compás al reloj del worklet (0,00 % de diferencia con la GPU); los pilotos laten; la pantalla, en todo el ancho y el doble de grande, lleva la forma de onda, el cabezal y el medidor de cada capa.
- **Movimiento:** «Pausar movimiento» y el movimiento reducido paran todo lo que se mueve solo, también en el plato HTML.
- **Revisión del bloque C:** la carrera del autoguardado, corregida y con su test.

### Progreso por entregas
- **6.a · Motor 3D** (`f70779a`):
  - encuadres de «Tocar» (completo, capas y controles), con su versión del móvil (lienzo 1:1, cámara más alta; el completo apura el aparato sin su sombra, con un margen del 2 %);
  - órbita de «Inspeccionar» (acimut ±150°, elevación de 10° a 85°, a distancia fija) y viaje de 650 ms entre encuadres;
  - `project()`, con la caja de la cara que se toca y el eje del arrastre de cada control. En la órbita, un rayo dice qué controles tapa otra pieza (10 veces por segundo como mucho);
  - el anillo de luz del foco, el movimiento ligado al audio (`setMotionSource`: en el mismo fotograma, 0 fps sin fuente) y la pantalla nueva.
  - Las piezas comparten `engine.ts`, así que van en un solo commit; desde aquí, un commit por pieza.
  - Tests en Node (57 de la escena): las zonas de 44 px no se pisan en 360×360, 390×390 ni en el escritorio de 900×720; los encuadres caen dentro del lienzo; la bandeja tapa el reposo visto desde el fondo.
- **6.b · El 3D es el instrumento de la portada**:
  - `f122a2a` **«Pausar movimiento»** (`core/motion.ts`). Junta la preferencia de quien toca (`localStorage`, `torno.movimiento`, con `try/catch`) y `prefers-reduced-motion`. Con la de quien toca, el documento lleva `data-movimiento="pausado"` y `base.css` anula las transiciones; con la del sistema, lo hace el `@media` de `base.css`. Las animaciones de los instrumentos miran las dos.
  - `93c5858` **Lo común de los dos instrumentos**, en `features/instrument-common/`: la directiva, la pantalla, los avisos y `InstrumentShell`.
    - `InstrumentShell` lleva el grupo, las pistas, los atajos, la región viva, el selector de archivos, el autoguardado y la precarga al acercarse.
    - El plato HTML sigue «Pausar movimiento»: no pinta (antes, con movimiento reducido, repintaba los medidores cada 250 ms).
  - `124a5d4` **Gestos**:
    - aceleración de hasta ×4 al arrastrar deprisa;
    - diales en círculo: tras 45° alrededor del centro a la misma distancia (±30 %), el arrastre sigue al ángulo, y 270° son todo el recorrido;
    - `trnAxisSource`: el eje del brazo y el de la rueda los da la cámara.
  - `3553c46` **El instrumento 3D** (`InstrumentStage`):
    - el espejo de la pantalla encima, de alto fijo (cuatro líneas): al abrir el menú, el aparato no se mueve bajo el dedo;
    - la caja: 5:4 en el escritorio, de hasta `(100svh − 13rem) · 1,25`, y 1:1 de borde a borde en el móvil;
    - la capa de controles (`StageControls`) y la barra (`StageToolbar`);
    - la órbita de «Inspeccionar»: arrastrar, o las flechas en su superficie (`role="slider"`), con Inicio para volver de frente;
    - la pantalla completa (oculta si el navegador no la tiene) y el anillo de luz del foco y del puntero.
  - **La portada**:
    - un solo `@defer` para los dos instrumentos, con el mismo marcador (el póster con el sitio del espejo y de la barra). Desde `3914156`, con uno de dentro para cada instrumento (6.d);
    - con `?sin3d=1` o sin WebGL, el plato HTML;
    - con un `@defer` para cada uno, `?sin3d=1` cambiaba lo que hay dentro de `.stage` al hidratar. El toque anterior al JS, que Angular repite después, perdía su sitio y no pedía otro toque: lo encontró `hydration.spec`.
  - **Medido:**
    - En 360×740 (móvil, ×2), todas las zonas miden 44×44 como poco y ninguna se pisa: capas de 44×44, teclas de 53×47, disco de 182×162, brazo de 65×60.
    - En 1440×900 (escritorio), las teclas miden 107×68 y el disco 333×196.
    - La pantalla del 3D: 10,1 px de cuerpo en el escritorio de 1440×900 y 4,2 px en el móvil de 360. En el móvil se lee el espejo HTML, a 13 px.
  - e2e: 107 en verde y 2 saltados (los del panel, solo en desarrollo), con el build de producción y el servidor de desarrollo.
- **6.c · Sincronía con el audio**:
  - `cdd9b4d` La versión del sonido de cada capa (`LayerHistory.version` → `LayerStatus.contentVersion`). Sube con cada cambio del estado actual; los contadores de deshacer se quedan en 3 con la cuarta sobregrabación.
  - `25fdd6d` `InstrumentMotion` (TS puro, `instrument/motion.ts`):
    - el pulso del transporte en cada fotograma, extrapolado desde el último estado del audio sin retroceder por un estado que llega tarde. Desde `8060cf0` (6.d), anclado a la hora a la que ese estado suena por el altavoz, no a la de llegada;
    - el disco da una vuelta por compás (agarrado, va con la mano);
    - los pilotos laten con el nivel y los medidores suben al momento y bajan a 1,6 por segundo;
    - un cabezal por carril y el destello de la cuenta previa.
  - Las formas de onda las calcula el motor de audio de una copia de la sesión, con 96 tramos por capa. Solo cuando cambia la versión del sonido y nunca durante una toma (el pico de memoria de §5).
  - El escenario pide el movimiento solo mientras suena, en la cuenta previa o con el disco agarrado; con «Pausar movimiento», nunca.
  - **Medido:**
    - test en Node: velocidad del disco ±1 % a 40, 90 y 240 BPM, con estados que llegan con 0–8 ms de retraso;
    - en el navegador (RTX 3060, servidor de desarrollo, reproduciendo con el ratón sobre la tecla del 3D): 0,3750 y 0,3759 vueltas/s a 90 BPM, frente a 0,3750 esperadas (+0,0 % y +0,24 %). Con el reloj nuevo de la 6.d, 0,00 % (§2).
- **Pantalla (revisión del bloque C, hallazgo 1).** Ocupa todo el ancho: arriba, la capa elegida en grande y, debajo, el tempo y el estado; abajo, un carril por capa con su forma de onda y su medidor.
  - Medido (`screenFontPx`, el alto de la pantalla proyectado por el cuerpo de la fila): 10,2 px de cuerpo en la portada de 1440×900, frente a unos 5 px antes.
  - El móvil se mide con el encuadre 1:1 de la 6.b.
  - Los cabezales y los medidores los pinta el *shader* con *uniforms*: la textura de 1664×256 solo se sube cuando cambia el texto o una forma de onda.
- **Carrera del autoguardado (revisión del bloque C)** (`0e2fbc1`):
  - lo nuevo no se autoguarda con la confirmación de «Recuperar» abierta (y se anula lo que esperaba);
  - tampoco con los dos huecos ofrecidos, porque 1,5 s después de tocar algo pisaba «lo que tocaste después» (§5). Se guarda al contestar;
  - dos tests del store, y el e2e de `files.spec.ts:287`, que ahora espera 2,5 s antes de recuperar: sin el arreglo falla siempre.
- **6.d · e2e, capturas, pósteres y cifras**:
  - `fd4e545` El esmalte del disco: desde los 64° del móvil, el centro salía casi blanco; con la capa de encima a 0,45 se lee oliva (§5).
  - `8060cf0` El reloj del disco, con la hora a la que suena cada estado:
    - el worklet pone la muestra del contexto del estado (`contextFrame`) y el motor la convierte con `getOutputTimestamp` (`AudioEngine.heardAt`);
    - con el hilo principal ocupado (en los e2e, el WebGL por software), la hora de llegada desviaba la velocidad medida un 5–14 %;
    - `PROTOCOL_VERSION` pasa a 4.
  - `e3ada52` Los pósteres del escritorio (5:4) y del móvil (1:1) en un `<picture>`; `?encuadre=` en las capturas y las capturas de cada encuadre.
  - `5808e67` y `d59ebb8` (el worklet en su test) Los e2e del instrumento 3D (§2).
  - `d96563a` «Controles» con el brazo entero (antes cortaba su eje), «Inspeccionar» más cerca (la esfera justa, no la de la caja) y las capturas del móvil enteras.
  - `3914156` Cada instrumento, en su trozo: un `@defer` de fuera con los disparadores y uno de dentro para cada instrumento. Con uno solo para los dos se descargaban los dos trozos, y la primera visita sin el 3D llegaba a 608,8 kB (§6).

## 2. Criterios de aceptación
| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| Todas las funciones de §0.1 se pueden hacer en 3D, con teclado y en móvil (e2e) | ✅ | `stage.spec.ts`, en los proyectos del escenario (§6). **Ratón:** cada control sobre su pieza: los diales, el brazo, la rueda, el disco agarrado y girado, reproducir y pausar, deshacer, mantener deshacer (rehacer), mantener reproducir (parar) y el reposo; y una toma desde la tecla de grabar, con el micrófono sintético. **Teclado:** el orden del tabulador y, de §0.1, sonido desde el menú, reproducir, otra capa, sonido nuevo, deshacer, silenciar con mantener, tempo, filtro con el brazo, disco con Espacio y reposo. **Dedo** (360×740, CDP): un dial, mantener una capa (silencio, sin abrir la selección de texto), una tecla y el desplazamiento de la página. El resto de §0.1 (menú completo, archivos, sobregrabación…) va por la misma directiva y el mismo store, probados con el plato en sus e2e (§6). |
| Zonas táctiles ≥ 44 px en el encuadre de móvil (test) | ✅ | `projection.spec.ts` (Node): ninguna zona de 44 px se pisa en 360×360 y 390×390, ni en el escritorio. `stage.spec.ts` (360×740, ×2): las 12 zonas, visibles, de 44×44 como poco y sin pisarse (la del disco, elipse). Medidas: capas 44×44, teclas 53×47, disco 182×162 y brazo 65×60. |
| Velocidad del disco = transporte ±1 %; respuesta ≤ 20 ms (§5) | ✅ | **Velocidad:** `motion.spec.ts`, ±1 % a 40, 90 y 240 BPM con estados que llegan con 0–8 ms de retraso. Con la GPU (RTX 3060, build, reproduciendo), pendiente de 20 lecturas: disco 0,3750 vueltas/s y transporte 0,3750 compases/s, **0,00 %**. El e2e lo mira con un 3 % de margen (WebGL por software, §5). **Respuesta** (GPU, build, reproduciendo): de la tecla al mensaje del audio, mediana 0,4 ms y máximo 1,1 ms (20 teclas); del ratón sobre un dial, mediana 3,9 ms y máximo 4,3 ms (14 mensajes). El e2e lo comprueba (≤ 20 ms) con el transporte en pausa. |
| Con movimiento reducido o «Pausar movimiento», 0 animaciones automáticas | ✅ | `stage.spec.ts`, los dos modos: reproduciendo, en 2,5 s, el disco no se mueve, 2 fotogramas como mucho (cambios de pose, si los hay) y `document.getAnimations()` vacío. Las cámaras cortan, el plato HTML no pinta y `base.css` anula las transiciones con `data-movimiento="pausado"`. |
| Capturas de cada encuadre y de «Inspeccionar» en escritorio y móvil | ✅ | §7: `instrumento3d-{completo,capas,controles,inspeccionar}-{escritorio,movil}.jpg` y sus hojas `instrumento3d-encuadres-*.jpg`. |

## 3. Tareas del plan
| Tarea | Estado | Notas |
|---|---|---|
| 6.1 `control-layer` (D10, §4.7): elementos nativos proyectados, `touch-action`, zonas ≥ 44 px, ocultación en «Inspeccionar» | hecha | `StageControls` y `SceneEngine.project()`; la ocultación, con un rayo por control (10 veces por segundo como mucho al girar) |
| 6.2 Gestos de cada control | hecha | La directiva de siempre, con aceleración (×4) y diales en círculo; el disco por ángulo, el brazo por su recorrido y la rueda en radial (ejes de la cámara) |
| 6.3 Cámara: «Tocar» (completo, capas, controles), «Inspeccionar», transiciones, móvil, pantalla completa | hecha | Viaje de 650 ms (con la pausa de movimiento, corte); encuadre del móvil 1:1 desde 62–64°; la pantalla completa se oculta donde no la hay (iPhone) |
| 6.4 Sincronía con el audio | hecha | `InstrumentMotion`: disco, pilotos, medidores, cabezales y destello de la cuenta previa; formas de onda del motor de audio, solo cuando cambia el sonido |
| 6.5 Foco y *hover* en 3D; «Pausar movimiento» y movimiento reducido | hecha | Anillo de luz en el color del foco; `MotionPreference` (preferencia + `prefers-reduced-motion`), también en el plato HTML |
| 6.6 Atajos y chuleta | hecha | Los de siempre, ahora en `InstrumentShell` para los dos instrumentos; botón «Atajos» en la barra |
| 6.7 e2e | hecha | Ratón, teclado (con lo de §0.1), táctil emulado, 44 px, desplazamiento de la página, velocidad del disco, respuesta y movimiento |
| Revisión del bloque C: pantalla legible (hallazgo 1) | hecha | En todo el ancho, el doble de grande arriba, carriles debajo; medido |
| Revisión del bloque C: carrera del autoguardado | hecha | `0e2fbc1`, con dos tests del store y el e2e determinista |

## 4. Desviaciones del plan y motivo
- **Las formas de onda son de las cuatro capas, no solo de la elegida** (§0). Lo pide §0.2 del plan («formas de onda y medidores de nivel de cada capa») y encaja con la pantalla en todo el ancho de la revisión del bloque C: un carril por capa, con la elegida enmarcada.
- **La pantalla del 3D no se lee en el móvil** (4,2 px de cuerpo en 360 px; 10,1 en el escritorio de 1440×900). La pantalla mide 123 × 19 mm en un aparato de 300 mm y el encuadre del móvil la ve desde 64°, así que no se puede leer sin cambiar el diseño aprobado. Lo que se lee es el espejo en HTML de encima del aparato, a 13 px, en todos los tamaños.
- **El motor de la 6.a va en un solo commit** (`f70779a`): la cámara, la proyección, el anillo, el movimiento y la pantalla comparten `engine.ts`. Desde la 6.b, un commit por pieza (revisión de la fase 5, #11).
- **«Pausar movimiento» cambia el plato HTML.** Con movimiento reducido repintaba los medidores cada 250 ms; ahora, con la pausa o con movimiento reducido, no pinta nada (salvo el disco agarrado, que va con la mano). Además lleva su botón: CLAUDE.md pide «Pausar movimiento» en todas las animaciones.
- **«Inspeccionar» no tiene zum** (el §0 lo prometía «acotado»). La órbita va a una distancia fija, la de la esfera justa del aparato con su sombra: entero y del mismo tamaño desde cualquier lado. El zum con la rueda o con dos dedos chocaría con el desplazamiento de la página por encima del aparato. Si hace falta, en la fase 8.

## 5. Decisiones técnicas nuevas
- **Lo común de los dos instrumentos, en `features/instrument-common/`** (`InstrumentShell`, la directiva, la pantalla y los avisos). Los dos instrumentos no están nunca a la vez: un solo selector de archivos, una región viva y unos atajos. *Alternativa:* duplicarlo en el escenario, descartada.
- **La zona de un control es la cara que se toca, y sale de las medidas de `layout.ts`**: un círculo o un rectángulo girado como la pieza, a su altura.
  - Con la caja de cada pieza en la escena, alineada con los ejes, las zonas de las piezas de detrás se montaban en el disco.
  - La del disco es su cara esmaltada, sin el anillo, para no tocar la del reposo. Su elemento es redondo también para el puntero.
- **El encuadre del móvil**:
  - lienzo 1:1 de borde a borde y cámara a 62–64°;
  - el completo apura el aparato sin su sombra, con un margen del 2 %. Con el de siempre, en 360 px, la capa 1 y la rueda se pisaban;
  - un test en Node lo comprueba en 360×360 y 390×390.
- **Lo que se mueve en la pantalla del 3D, en el *shader*.** Los cabezales y los medidores son *uniforms* sobre el mapa emisivo (`onBeforeCompile`, `three` 0.186). La textura de 1664×256 (1,7 MB) solo se sube cuando cambian el texto o una forma de onda. *Alternativa:* repintar un lienzo pequeño a cada fotograma (unos 4 MB/s de subidas), descartada.
- **Un solo bucle.** El motor pide el movimiento al escenario (`setMotionSource`) justo antes de pintar cada fotograma. Con dos bucles, el disco iría un fotograma por detrás del audio; sin nada que mover, 0 fps.
- **El reloj del disco (`InstrumentMotion`):**
  - se ancla en el pulso del último estado y en la hora a la que suena (punto siguiente a «`?encuadre=`»), y no retrocede por un estado que llega tarde;
  - un retroceso de más de ¼ de pulso sí se ve: es un salto del transporte;
  - es TS puro, y su test fija la velocidad.
- **Formas de onda con antirrebote, por versión del sonido** (`contentVersion`), y nunca durante una toma (sería el pico de memoria de §5). Los contadores de deshacer no servían: se quedan en 3.
- **El espejo de la pantalla tiene alto fijo** (cuatro líneas, `--instrument-mirror-height`): al abrir el menú, el aparato no se mueve bajo el dedo.
- **Un `@defer` de fuera para los dos instrumentos.** Con uno para cada uno a la misma altura, `?sin3d=1` cambiaba lo de dentro de `.stage` al hidratar, y el toque anterior al JS (que Angular repite) perdía su sitio. Lo encontró `hydration.spec`.
- **El autoguardado espera también con los dos huecos ofrecidos.** La revisión proponía esperar solo con la confirmación abierta, pero el autoguardado (1,5 s) podía llegar antes de pulsar «Recuperar». Con los dos huecos llenos no hay dónde guardar lo nuevo sin perder uno, así que se guarda al contestar. Se propone recogerlo en §4.8 del plan (§10).
- **El esmalte del disco:** la capa de encima a 0,45 y el entorno a 0,6. Desde los 64° del móvil, el centro del disco salía casi blanco (la nota de la sesión de plan sobre la vista cenital).
- **`?encuadre=`** (capas, controles o inspeccionar) con `?captura=1`, para las capturas de cada encuadre.
- **El reloj del disco va con el del contexto** (`contextFrame` + `getOutputTimestamp`), no con la hora de llegada de los mensajes: así no depende de lo ocupado que esté el hilo principal, y la latencia de salida va incluida. *Alternativa:* la hora de llegada más la latencia, descartada: con el WebGL por software, la velocidad medida se iba un 5–14 %.
- **Dentro, un `@defer` para cada instrumento** (`on immediate`, con el mismo marcador, `StagePlaceholder`): solo se descarga el trozo del que se usa. Con uno solo para los dos, la primera visita sin el 3D llegaba a 608,8 kB.
- **El e2e de la velocidad tiene un 3 % de margen**, no el 1 % del criterio. Con el WebGL por software, a unos 6 fotogramas por segundo y con la máquina cargada (otro proyecto corría sus e2e a la vez), cada lectura llega con su retraso y la pendiente medida variaba entre el 1 % y el 2,5 %. El criterio lo demuestran el test en Node y la medida con la GPU (0,00 %). El e2e queda para los fallos de verdad, que se salen de largo.

## 6. Salida de los checks
```
npm run check  (salida completa en la consola de la sesión)
  lint: typecheck (pure, worklet, worker, node) + ng lint + prettier — sin errores ni avisos
  test:node: 42 archivos, 551 tests en verde; cobertura del TS puro 98,33 % de sentencias
  test:ng: 12 archivos, 72 tests en verde
  build + check-bundles:
    ✔ JS inicial de /                 306,6 kB  (aviso > 330 · error > 400)
    ✔ Desbloqueo de audio en el inicial  1,9 kB (error > 2,0)
    ✔ Motor de audio (engine.ts)       23,8 kB  · worker de síntesis 17,4 kB · worker de exportación 41,9 kB · worklet 41,0 kB (error > 60)
    ✔ Chunk 3D (three + escena)       650,7 kB  (aviso > 800)
    ✔ Fuentes                         144,1 kB  (error > 150)
    ✔ Bundle inicial sin motor de audio, síntesis, worklet ni 3D.
```
**e2e** (`npx playwright test --workers=3`, 8,6 min, tras corregir la revisión y aligerar para el CI los del 3D, §12): **130 en verde y 3 saltados** (los del panel de desarrollo en el proyecto del build), sin fallos. Los dos proyectos del escenario van ahora uno detrás de otro, cada uno en un solo worker:
- `dev`: 42;
- `estatico` (el build, como en Pages): 58;
- `webkit`: 1;
- `escena-dev`: 16;
- `escena-estatico`: 13 y 3 saltados.

Los 16 del escenario son 5 de la fase 5 y 11 nuevos (§2 y §12). Los de escritorio usan una ventana de 800×600 y los que tocan mucho van en calidad baja. Con el WebGL por software (el del CI, y el de esta máquina con otro proyecto corriendo sus e2e a la vez), cada tecla espera a un fotograma.

Métricas de la fase:
- **3D** (`npm run capturas -- --medir`, RTX 3060, Chromium con D3D11, build):
  - en frío, tres primeras visitas: primer fotograma a los 2576–2614 ms, tarea más larga de 57–64 ms (≤ 200), generación de 84–87 ms (≤ 150) y VRAM de 60,6 MB en alto (≤ 96);
  - 144 fps en alto, medio y bajo (lienzo de 865×692 px; ≥ 55);
  - VRAM en las capturas: escritorio 60,6 / 39,7 / 35,6 MB y móvil 45,5 / 21,2 / 22,8 MB (alto / medio / bajo; ≤ 48 en bajo).
- **Peso de la primera visita** (`decodedBodySize`; el mismo criterio que la fase 5, §10.7):
  - **sin el 3D, 596,0 kB (≤ 600)**: sin el chunk 3D, sin el escenario y sin la precarga del audio, de 82,2 kB. Con un solo `@defer` era 608,8 kB;
  - con el 3D, 1328,9 kB (≤ 1,5 MB), y con `?sin3d=1`, 691,3 kB (la precarga y el póster, incluidos).
- **Pantalla del 3D** (`screenFontPx`, cuerpo de la primera fila):

  | Encuadre | Escritorio (1440×900) | Móvil (Pixel 7, 412 px) |
  |---|---|---|
  | Completo | 10 px | 4,8 px |
  | Capas | 13,3 px | 7,3 px |
  | Controles | 10,7 px | 5,4 px |
  | Inspeccionar | 8,3 px | 5 px |

  Antes, unos 5 px en el escritorio. El espejo HTML, a 13 px en todos los tamaños.
- **Respuesta y sincronía**: §2.
- **Pósteres:** 48 kB (escritorio) y 29 kB (móvil).

## 7. Capturas
En `docs/informes/img/fase-6/` (`npm run capturas -- --fase=6` y `-- --fase=6 --solo=escenario`, con `?captura=1`):
- **El instrumento 3D en cada encuadre**, con el espejo de la pantalla y la barra: `instrumento3d-completo-*`, `instrumento3d-capas-*`, `instrumento3d-controles-*` e `instrumento3d-inspeccionar-*` (`-escritorio` y `-movil`), y sus hojas `instrumento3d-encuadres-escritorio.jpg` e `instrumento3d-encuadres-movil.jpg`.
- **Sonando** (`escenario-sonando-*`), a 40 BPM:
  - ALFAR en la capa 1, con su forma de onda y su medidor en la pantalla;
  - un bajo EN COLA en la capa 2, con su piloto en aviso y el anillo de la capa elegida;
  - el anillo de luz del puntero en la tecla de reproducir.
- **Las cuatro vistas del aparato** (`escenario-vistas-*`) y **las páginas** (`inicio-*`, `sobre-el-proyecto-*`, `404-*`).
- **El plato HTML** con `?sin3d=1`: `instrumento-*`, los mismos estados que en la fase 5.
- **Los pósteres:** `public/img/escenario.webp` (1200×960) y `public/img/escenario-movil.webp` (800×800).

## 8. Dependencias añadidas
Ninguna.

## 9. Pendientes y `TODO(ivan)`
- **Los FPS del móvil tocando** (con el disco girando y la pantalla moviéndose): a la fase 8, en la prueba 15 de `PRUEBAS-MOVIL.md` (con `?diagnostico=1`), como se acordó en la revisión del bloque C.
- **Los textos nuevos** (la barra, la órbita, el aviso sin WebGL, el lienzo y la ayuda de los controles) llevan `reviewed: false`: los revisa Iván en la fase 7.
- **Probarlo en el móvil** (Iván): la vista previa de la rama (`https://fase-6-interaccion.torno.pages.dev`), con el dedo: diales, disco, brazo y desplazar la página por encima del aparato.

## 10. Propuestas de cambio al plan (para la aprobación de Iván)
1. **§4.8, autoguardado con los dos huecos ofrecidos.** Proponemos añadir: «si ya se ofrecen los dos huecos, lo nuevo espera a que se conteste el panel (no pisa ninguno)». Es lo que hace ya el arreglo de la carrera (`0e2fbc1`, §5). Con los dos huecos llenos, guardarlo en uno de ellos perdería lo que se ofrece recuperar.
   - **El coste:** si se cierra la página sin contestar, se pierde lo tocado en esa visita. Antes se perdía el «lo que tocaste después» de la visita anterior. Mientras tanto, el panel lo avisa: «Lo que toques ahora no se guardará hasta que elijas una de las dos».
   - **La alternativa:** un tercer hueco temporal, con más IndexedDB y otro botón en el panel.
2. **El espejo de la pantalla en HTML, encima del 3D, siempre.** En el móvil, la pantalla del aparato no se lee (4,2 px de cuerpo). En la fase 7, con la maqueta de la web, se puede decidir si en el escritorio se queda o se pliega.

## 11. Cómo probarlo
- **En la vista previa de la rama:** `https://fase-6-interaccion.torno.pages.dev` (la sube el CI con cada push de la rama).
- **En local:** `npm start` y `http://localhost:4200`.
- **Qué probar:**
  - **Tocar el 3D:** con el ratón (arrastrar los diales hacia arriba o abajo, o en círculo; agarrar el disco y girarlo; llevar el brazo hacia el disco), con el dedo o con el teclado (Tab y las flechas, como en el plato).
  - **Encuadres:** «Capas» y «Controles» acercan la cámara. «Inspeccionar» gira el aparato con el ratón o con las flechas en su superficie; lo que tapa la bandeja no se puede tocar.
  - **Sincronía:** al reproducir, el disco da una vuelta por compás, los pilotos laten y la pantalla del aparato enseña la forma de onda de cada capa con su cabezal y su medidor.
  - **«Pausar movimiento»:** nada se mueve solo, pero el disco sigue a la mano si se agarra.
  - **`?diagnostico=1`:** el panel de la escena (fotogramas, giro del disco y control enfocado).
  - **`?sin3d=1`:** el plato HTML de siempre.

## 12. Respuesta a la revisión
Revisión del subagente: `docs/revisiones/fase-6.md`. Veredicto: CAMBIOS NECESARIOS, sin Bloqueantes (2 Importantes, 12 Menores y 1 Sugerencia). Tras las correcciones, `npm run check` en verde (551 tests en Node y 72 en Angular, sin avisos de presupuesto) y e2e 130/130, con 3 saltados (§6).

| Hallazgo | Acción | Commit |
|---|---|---|
| 1 (Importante) | **Corregido.** La capa de controles se recorta al lienzo (`overflow: clip`). Se ocultan, y dejan de recibir el foco, los controles a los que no les quedan 44 px de zona dentro (en «Controles» del móvil, las capas 2 y 3). e2e: `scrollWidth` igual a `clientWidth` en cada encuadre, a 800×600 y a 360×740. | `ef89655`, `343af57` |
| 2 (Importante) | **Corregido.** «Pausar movimiento» y «Atajos», en `InstrumentTools`: en la barra del 3D y debajo del plato HTML. e2e con `?sin3d=1`: el disco no gira, los medidores siguen a 0 y la preferencia se recuerda. | `b14cd57`, `343af57` |
| 3 (Menor) | **Corregido.** Con el transporte parado, la fase del destello sale de los pulsos que faltan (`countInBeats`), con su test. | `b14cd57` |
| 4 (Menor) | **Corregido.** `#refreshWaveforms` vuelve a mirar si hay una toma antes de copiar la sesión. Las formas de onda solo se calculan si el 3D las pinta (`showWaveforms`). | `ef89655` |
| 5 (Menor) | **Corregido.** Una sola ventana de filas (`menuWindow`, en `instrument/display.ts`) para la pantalla del 3D, su espejo y el plato. | `b14cd57` |
| 6 (Menor) | **Corregido.** En el plato, con la pausa, el disco agarrado se repinta con cada estado del audio (≤ 10/s, sin bucle). | `b14cd57` |
| 7 (Menor) | **Corregido.** La barra del móvil va siempre en tres filas y el marcador las reserva. La nota del movimiento reducido del sistema pasa a ser la descripción del botón (y su `title`): ya no ocupa sitio. El CLS con la página desplazada hasta el instrumento, en la fase 8. | `b14cd57` |
| 8 (Menor) | **Corregido.** El recorte de las capturas, en coordenadas de la página. Capturas repetidas (§7). | `ef89655` |
| 9 (Menor) | **Corregido.** El comentario de `inspect()` dice lo que hace. Si el control enfocado deja de verse, el foco va a la superficie de girar o, fuera de la órbita, al botón del encuadre de la barra. | `ef89655` |
| 10 (Menor) | **Corregido.** Fuera `setView()`. La órbita y su test usan la misma esfera (`orbitSphere`, en `camera/views.ts`). | `ef89655` |
| 11 (Menor) | **Corregido.** En `stage.spec.ts`:<br>· con el ratón, deshacer, mantener deshacer (rehacer) y mantener reproducir (parar);<br>· una toma con el micrófono sintético desde la tecla de grabar;<br>· con el dedo, mantener una capa (silencio) sin que se seleccione texto.<br>Las zonas llevan `-webkit-touch-callout: none` y `user-select: none`. | `ef89655`, `343af57` |
| 12 (Menor) | **Corregido.** Al §10.1 y al `TODO(ivan)` se les añaden el coste y la alternativa del tercer hueco. Con los dos huecos ofrecidos, el panel avisa: «Lo que toques ahora no se guardará hasta que elijas una de las dos». | `b14cd57` y este informe |
| 13 (Menor) | **Anotado** para Iván (`PENDIENTES.md`, con las dos opciones) y fijado en un test de 320 px: solo se pisan la capa 1 y el volumen. | `ef89655` |
| 14 (Menor) | **Corregido.** En el informe:<br>· la clave es `torno.movimiento`;<br>· `data-movimiento` solo con la pausa de quien toca;<br>· «Inspeccionar» va sin zum, ahora en §4;<br>· el criterio 1 cuenta lo que prueban el ratón y el dedo. | este informe |
| 15 (Sugerencia) | **Hecho.** En «Inspeccionar», el disco no se agarra con el puntero: arrastrar encima gira el aparato (con el teclado, Espacio sí lo agarra). | `ef89655` |

**El CI de la rama.** Con estas correcciones, el CI de GitHub falló donde en local pasaba (`65387f5`). La prueba del teclado y la de la velocidad del disco se pasaban de tiempo, y la de la pose (fase 5) contaba un fotograma de más. Su WebGL es por software: cada tecla y cada lectura esperan a un fotograma, y los dos proyectos del escenario iban a la vez. `a14d521` lo arregla sin tocar lo que se comprueba:
- los dos proyectos del escenario van uno detrás de otro, cada uno en un solo worker;
- las pruebas que tocan mucho van en calidad baja y en una ventana de 800×600 (aún de escritorio), y esperan a que el 3D se quede quieto tras cambiar de calidad;
- la de la velocidad lee el panel de una vez por muestra, y la del teclado sube de diez en diez (Re Pág) en lugar de flecha a flecha;
- `drag` y `hold` llevan el control a la vista antes de tocarlo;
- la de la pose espera a que se asienten los fotogramas: el anillo del foco y la pose pueden ir en dos;
- «Inspeccionar» parte del frente (Inicio) hasta 150° y 10°, y «Capas» compara la pieza proyectada (`--w`), no su zona de 44 px;
- el arrastre del plato HTML va despacio (5 px cada 20 ms): más rápido entra la aceleración de la fase 6, con su test en Node.

Resultado: el CI de `a14d521` en verde en 12 min 12 s (e2e: 130 en verde y 3 saltados, en 9,6 min).
