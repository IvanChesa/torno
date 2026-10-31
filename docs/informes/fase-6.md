# Informe: Fase 6 (interacción y sincronía)

- **Rama:** `fase-6-interaccion`
- **Fecha:** 2026-10-31
- **Estado:** en curso. Entrega 6.a hecha (`f70779a`); sigue la 6.b. La revisión parcial del bloque C (`docs/revisiones/bloque-C.md`) añade a la fase la pantalla legible (hallazgo 1) y la carrera del autoguardado.

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
  - se activa con la preferencia guardada en `localStorage` (`torno:movimiento`, con `try/catch`) o con `prefers-reduced-motion`;
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
(en curso)

### Progreso por entregas
- **6.a · Motor 3D** (`f70779a`):
  - encuadres de «Tocar» (completo, capas y controles), con su versión del móvil (lienzo 1:1, cámara más alta; el completo apura el aparato sin su sombra, con un margen del 2 %);
  - órbita de «Inspeccionar» (acimut ±150°, elevación de 10° a 85°, a distancia fija) y viaje de 650 ms entre encuadres;
  - `project()`, con la caja de la cara que se toca y el eje del arrastre de cada control. En la órbita, un rayo dice qué controles tapa otra pieza (10 veces por segundo como mucho);
  - el anillo de luz del foco, el movimiento ligado al audio (`setMotionSource`: en el mismo fotograma, 0 fps sin fuente) y la pantalla nueva.
  - Las piezas comparten `engine.ts`, así que van en un solo commit; desde aquí, un commit por pieza.
  - Tests en Node (57 de la escena): las zonas de 44 px no se pisan en 360×360, 390×390 ni en el escritorio de 900×720; los encuadres caen dentro del lienzo; la bandeja tapa el reposo visto desde el fondo.
- **Pantalla (revisión del bloque C, hallazgo 1).** Ocupa todo el ancho: arriba, la capa elegida en grande y, debajo, el tempo y el estado; abajo, un carril por capa con su forma de onda y su medidor.
  - Medido (`screenFontPx`, el alto de la pantalla proyectado por el cuerpo de la fila): 10,2 px de cuerpo en la portada de 1440×900, frente a unos 5 px antes.
  - El móvil se mide con el encuadre 1:1 de la 6.b.
  - Los cabezales y los medidores los pinta el *shader* con *uniforms*: la textura de 1664×256 solo se sube cuando cambia el texto o una forma de onda.

## 2. Criterios de aceptación
| Criterio | ✅/❌ | Evidencia |
|---|---|---|
| Todas las funciones de §0.1 se pueden hacer en 3D, con teclado y en móvil (e2e) | | |
| Zonas táctiles ≥ 44 px en el encuadre de móvil (test) | | |
| Velocidad del disco = transporte ±1 %; respuesta ≤ 20 ms (§5) | | |
| Con movimiento reducido o «Pausar movimiento», 0 animaciones automáticas | | |
| Capturas de cada encuadre y de «Inspeccionar» en escritorio y móvil | | |
