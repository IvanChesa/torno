# Torno: plan de la versión 1

> Documento maestro. Lo ejecuta Claude Code (Opus 5.5) en el PC de Iván, por fases y en bloques autónomos. Otra sesión de Claude planifica y revisa cada bloque (`docs/revisiones/`).
> Si este plan y el código no coinciden, manda el plan. Los cambios se proponen en el informe de fase y los aprueba Iván.
> Revisión 1 del plan: 24-10-2026.

---

## 0. Qué es y para qué

**Torno** es un **instrumento de bucles de cuatro capas, en 3D, que se toca en el navegador**. Cada capa repite un sonido: un ritmo, una línea de bajo, unos acordes, una textura o algo grabado con el micrófono. El instrumento es un objeto 3D realista que se puede girar e inspeccionar. Todos sus controles funcionan: diales, teclas, un disco que se agarra para arrastrar el tiempo y un brazo que filtra el sonido. Alrededor hay una web de producto en español que lo presenta, enseña a tocarlo y cuenta cómo está hecho. El nombre viene del **torno de alfarero**: un disco que gira y barro que se moldea a mano, como las capas de sonido (dirección visual «Barro», §10).

Se inspira en **TAPE** (`ethanplusai/tape`, tape.ethanplus.ai) y tiene **todas sus funcionalidades** y **mejoras propias**. No se copia nada de él (ni código, ni textos, ni diseño, ni nombres de sonidos): se escribe desde cero.

**Objetivo:** pieza de portfolio de Iván Chesa Lapena (desarrollador web freelance, ivanchesa.es). Tiene que demostrar Angular moderno, **audio en tiempo real de calidad profesional** (AudioWorklet, DSP propio), 3D web, interacción accesible y rendimiento. Complementa a tierra-luna-sol: allí manda el rigor científico; aquí, el audio, la interacción y el diseño de producto. **El SEO es secundario.**

**Dónde vive:** subdominio de ivanchesa.es en Banahosting (propuesto: `torno.ivanchesa.es`; staging: `staging-torno.ivanchesa.es`). Proyecto y repositorio independientes.

### 0.1 Paridad con el original (todo esto entra en la v1)

| Funcionalidad del original | Fase |
|---|---|
| **4 capas en bucle**, cada una con su dial: girar = nivel, pulsar = seleccionar, mantener = silenciar | 1, 2, 6 |
| Teclas de transporte: **reproducir/pausa** (mantener = parar y volver al inicio), **grabar** (pulsar de nuevo = terminar o cancelar) y **deshacer** (mantener = rehacer) | 1, 2, 6 |
| Al darle a reproducir por primera vez, la capa 1 arranca con una batería y la capa 2 queda seleccionada | 3 |
| **Grabación con el micrófono**: toma libre (hasta 60 s, se cierra al pulsar), tomas de 1, 2 o 4 compases, cuenta previa, metrónomo, **sobregrabación** y relleno con silencio si se cierra antes | 1, 2 |
| **Deshacer y rehacer** hasta 3 estados por capa | 1 |
| **Tempo de 40 a 240 BPM** con el dial principal (*varispeed*: velocidad y tono cambian juntos) | 1, 6 |
| **Disco**: mantener para congelar la capa seleccionada y arrastrar adelante o atrás; al soltar, vuelve a la línea de tiempo común | 1, 6 |
| **Brazo de expresión**: filtro paso bajo de la capa seleccionada; en el extremo, sin filtro | 1, 6 |
| **Reverso** por capa | 1, 3 |
| **Dial principal con menú en la pantalla del aparato**: sonido, bucle, entrada (ganancia 0–200 %), sesión (guardar, cargar, exportar, borrar capa, sesión nueva, con confirmación) y ayuda | 2, 3 |
| **12 bucles originales sintetizados** (batería, bajo, acordes y textura; 3 de cada), en el mismo tono y tempo nativo | 3 |
| Cambios de sonido **en cola hasta el siguiente compás**, con fundido; deshacer cancela la cola; confirmar antes de sustituir una grabación | 1, 3 |
| Volumen general (rueda) y **reposo** (para el audio y libera el micrófono) | 2, 6 |
| **Bloqueos durante una toma** (tempo, selección, reverso, disco, archivos y deshacer); niveles, silencio, filtro y volumen siguen libres | 1, 2 |
| **Guardar y cargar un proyecto** editable (versionado y validado) y **exportar la mezcla en WAV** | 2 |
| Micrófono privado: nunca se sube; pestaña oculta = toma cancelada y pausa | 2 |
| **Arranque de audio robusto** (contexto reanudado en el gesto, reintento, errores visibles, `navigator.audioSession`) | 2 |
| **Teclado completo** (flechas, Mayús ×10, Inicio/Fin, Intro, Mayús+Intro = mantener, Esc, Espacio en el disco) | 2, 6 |
| **Guía de 9 controles** con «Ver en el instrumento», que nunca inicia el audio ni cambia nada | 7 |
| Vistas del aparato: completo, capas y controles | 6 |
| «Pausar movimiento» y `prefers-reduced-motion` | 6 |
| Web de producto: portada con el instrumento, secciones, ficha técnica, preguntas frecuentes y cierre | 7 |
| Tests del DSP a nivel de muestras, del formato de archivo y del navegador con micrófono sintético y AudioWorklet real | 1–8 |

### 0.2 Mejoras sobre el original

| Mejora | Fase |
|---|---|
| **Instrumento 3D de verdad**: se gira y se inspecciona desde cualquier lado (el original es una foto fija con controles encima) | 5, 6 |
| **«Ver en el instrumento» con viaje de cámara** hasta cada control, y **vista despiezada** de los materiales | 6, 7 |
| **Autoguardado local** (IndexedDB) y recuperación tras recargar; el original pierde la sesión | 2 |
| **Compensación de latencia** de la grabación: automática y con calibración por clic | 1, 2 |
| **Mezcla estéreo con panorama por capa** y **WAV estéreo de 24 bits**, con N repeticiones y fundido final (el original: mono, 16 bits) | 1, 2 |
| **Exportar pistas por separado** (un WAV por capa) | 2 |
| **Tempo por pulsaciones** (*tap tempo*) y **tempo a partir de la primera toma libre** si no hay otras capas | 1, 3 |
| **Interpolación cúbica** al cambiar de tempo y **filtro de variables de estado** (más limpio que un paso bajo de un polo) | 1 |
| **Formas de onda y medidores de nivel** de cada capa en la pantalla y los LED del aparato | 6 |
| **Atajos de teclado** dentro del instrumento, con chuleta accesible (`?`) | 6 |
| **Funciona sin WebGL**: instrumento HTML completo y accesible, también para lectores de pantalla | 2, 8 |
| **Privacidad total y comprobada**: sin cookies, sin analítica (el original usa Vercel Analytics) y sin peticiones a terceros | 7 |
| **Ficha técnica con cifras medidas** (latencia, CPU del audio, FPS), no objetivos de un hardware imaginario | 7 |
| **`/sobre-el-proyecto` como caso de estudio** (arquitectura del audio, decisiones y mediciones) | 7 |

### 0.3 Fuera del alcance de la v1
- El estudio de hardware del original (costes, precio, unidades, proveedores) y su boletín. Torno se presenta como **concepto de diseño + instrumento web que funciona**, sin precio ni promesas de fabricación.
- Backend, cuentas o compartir sesiones por URL.
- Muestras de audio, importar archivos de audio y audio generado por IA.
- Monitorización del micrófono en directo (riesgo de acoples) y estiramiento de tiempo sin cambio de tono.

---

## 1. Decisiones tomadas

| # | Decisión | Motivo |
|---|---|---|
| D1 | **Angular 22 + TypeScript estricto** | Elección de Iván (valor en el portfolio). |
| D2 | **Standalone + zoneless + signals.** `OnPush` es el valor por defecto: **no se declara** | Guía oficial (`docs/angular-buenas-practicas.md`). |
| D3 | **Three.js 0.186 directo**, sin `angular-three` | Igual que tierra-luna-sol; control total del bucle de render. |
| D4 | **Audio propio: Web Audio API + AudioWorklet, sin librerías de audio.** El núcleo DSP (`LoopCore`) es TS puro y se ejecuta **igual** en el worklet, en la exportación y en los tests de Node | Es lo que más luce del proyecto; se prueba a nivel de muestras. |
| D5 | **El worklet se compila aparte con esbuild** (`scripts/build-worklet.mjs`), con hash en el nombre, antes de `ng serve` y `ng build`. Se valida en la fase 0 | El builder de Angular empaqueta los workers de `new Worker(new URL(...))`, pero no los módulos de `audioWorklet.addModule()`. |
| D6 | **Un solo reloj: el de muestras del worklet.** El transporte cuenta muestras (entero) y calcula los pulsos por tramos de tempo; cada capa convierte pulso → muestra | Sincronía exacta y sin deriva; la animación nunca manda sobre el audio. |
| D7 | **Mensajes tipados por `MessagePort`**, sin `SharedArrayBuffer` | No exige aislamiento de origen cruzado (COOP/COEP); compatible con el hosting. |
| D8 | **Biblioteca sintetizada y determinista**, renderizada en un **Web Worker** a la frecuencia del contexto. Colección propia: **Re menor, 90 BPM, 2 compases de 4/4** | Sin descargas de audio ni licencias; distinta del original. |
| D9 | **Instrumento 3D procedural**: geometría y texturas generadas por código (sin GLB ni texturas descargadas, salvo que una prueba demuestre que hace falta). Luz de entorno con `RoomEnvironment` + PMREM y sombra de contacto horneada | Todo es propio, pesa poco y se puede testar. |
| D10 | **Capa de controles HTML proyectada**: cada control del aparato es un elemento HTML enfocable (`button` nativo o `role="slider"`), colocado sobre la proyección en pantalla de su pieza 3D. Puntero, táctil, teclado y lector de pantalla usan **el mismo elemento**. El 3D solo pinta el estado | Un solo camino de código, accesible por diseño; permite `touch-action: none` en los controles sin bloquear el desplazamiento de la página. |
| D11 | **Un único modelo del instrumento** (`instrument/`: controles, gestos, menú y pantalla) alimenta el 3D, el instrumento HTML y la guía | Coherencia y tests sin navegador. |
| D12 | **Dos modos de cámara:** «Tocar» (encuadres fijos: completo, capas, controles) e «Inspeccionar» (órbita libre limitada) | En móvil, arrastrar un dial y girar la cámara no pueden competir. |
| D13 | **Render bajo demanda**: continuo solo mientras algo se mueve | Batería, calor y 0 fps en reposo. |
| D14 | **Prerenderizado estático** (`outputMode: "static"`). El 3D y el audio, siempre diferidos | Hosting sin Node y primera carga inmediata. |
| D15 | **Formato de proyecto propio `.torno`** (cabecera JSON versionada + PCM float32 por capa), validado entero antes de tocar nada | Guardar y cargar sin perder calidad y sin riesgos. |
| D16 | **Autoguardado local en IndexedDB**, visible y borrable desde la web y desde el menú | Mejora clara sobre el original sin salir del dispositivo. |
| D17 | **Privacidad:** 0 cookies, 0 analítica, 0 peticiones a terceros; el audio nunca sale del navegador | Cumplimiento sin banner y garantía visible de calidad. |
| D18 | **SEO secundario:** title y description simples, una imagen Open Graph global y `robots.txt` básico | Es una pieza de portfolio dentro de ivanchesa.es. |
| D19 | **Despliegue:** GitHub Actions → FTPS a Banahosting (staging en cada push a `main`, producción con etiqueta `v*`) | El SSH está bloqueado; mismo sistema que tierra-luna-sol. |
| D20 | **Tests:** Vitest (núcleo, síntesis, archivos y modelo) + Playwright (Chromium con micrófono sintético y AudioWorklet real; WebKit de escritorio) + axe + regresión visual | — |
| D21 | **Solo español en la v1** | — |
| D22 | **Frecuencia de muestreo: la del dispositivo** (`latencyHint: "interactive"`), sin forzar 48 kHz | Si no coincide con la del hardware, el navegador remuestrea: más CPU y más latencia. |
| D23 | **Diseño propio: dirección visual B «Barro»** (§10), elegida por Iván el 24-10 | Ni la paleta, ni las fuentes, ni la distribución del original. |

### Dependencias permitidas (lista cerrada)
Cualquier otro paquete → **preguntar a Iván antes de instalarlo**.

- **Producción:** `@angular/*` 22.x · `three` `^0.186.0` · las dos familias tipográficas de `DISENO.md` (`@fontsource/*` o `@fontsource-variable/*`; candidatas: Fraunces y Geist Mono, ambas OFL 1.1)
- **Desarrollo:** lo que genera `ng new` (incluidos Vitest y jsdom) · `@types/three` · `esbuild` (fijado a la versión que usa `@angular/build`) · `angular-eslint`, `eslint`, `@eslint/js` y `typescript-eslint` · `prettier` · `@playwright/test` · `@axe-core/playwright` · `sharp` (póster e imagen Open Graph) · `@vitest/coverage-v8`
- **Propuesta pendiente de Iván** (se pide en su fase): `@lhci/cli` (Lighthouse en el CI, fase 8).
- **Recursos de three que no son dependencias nuevas:** `three/addons/*` (`RoomEnvironment`, `RoundedBoxGeometry`, `OrbitControls`).

---

## 2. Rutas

| Ruta | Contenido |
|---|---|
| `/` | Web de producto con el instrumento en la portada |
| `/sobre-el-proyecto` | Caso de estudio de portfolio |
| `/404` | Página de error (`noindex`) |

Parámetros de `/`: `?sin3d=1` (instrumento HTML, para pruebas y sin WebGL) y `?captura=1` (estado, cámara y animación deterministas; sin interfaz animada).

---

## 3. Requisitos previos

| Requisito | Estado | Acción |
|---|---|---|
| Node ≥ 22.22.3 o ≥ 24.15 | ✅ v24.22.1 | — |
| Nombre y carpeta del proyecto | ✅ `torno` | — |
| **Dirección visual** (§10) | ✅ B «Barro» (24-10) | — |
| **Repo en GitHub** | ✅ `IvanChesa/torno`, público (24-10) | Se conecta al empezar el bloque A; push de `main` tras cada fusión |
| **GitHub CLI** (`gh auth login`, para los secrets del staging) | ❌ | Iván, **antes del bloque B (fase 4)** |
| **Staging en cPanel** | ❌ | Iván, antes de la fase 4: subdominio `staging-torno.ivanchesa.es` con AutoSSL, protección con contraseña, cuenta FTP limitada a esa carpeta y `gh secret set` de las credenciales |
| Móvil Android real | Iván | Desde la fase 4, por la URL de staging |
| **Un iPhone para probar** (aunque sea prestado) | Iván | **Fase 4**: el audio en iOS es el mayor riesgo del proyecto |
| Auriculares, mejor con cable (los Bluetooth añaden mucha latencia) | Iván | Fase 4, para probar la sobregrabación |

Si los requisitos de la fase 4 no están cuando llegue el bloque B, **la fase 4 se aplaza** (no bloquea): se sigue y se retoma en cuanto Iván los tenga.

---

## 4. Arquitectura

### 4.1 Estructura de carpetas

```
src/app/
├─ core/              site.config.ts (fuente única), seo.service.ts
├─ audio/
│  ├─ core/           TS PURO: LoopCore (transporte, capas, grabación, deshacer, cola, disco, filtro, limitador), protocol.ts
│  ├─ synth/          TS PURO: osciladores, envolventes, batería sintética, efectos y los 12 bucles (presets)
│  ├─ files/          TS PURO: formato .torno, WAV, validación
│  ├─ worklet/        processor.ts (adaptador del núcleo; lo compila esbuild)
│  ├─ workers/        synth.worker.ts, export.worker.ts
│  └─ engine/         AudioEngine (hilo principal): contexto, worklet, micrófono, latencia, sesión de audio, autoguardado. API en index.ts
├─ instrument/        TS PURO: catálogo de controles, gestos (pulsar/mantener/girar), menú, pantalla, atajos
├─ scene/             THREE.JS SIN ANGULAR
│  ├─ engine.ts       SceneEngine (API pública en index.ts)
│  ├─ model/          piezas procedurales (cuerpo, disco, brazo, diales, teclas, pantalla, rueda, LED, tornillos)
│  ├─ materials/      materiales y texturas procedurales
│  ├─ camera/         encuadres, modos, viajes, vista despiezada
│  ├─ projection.ts   proyección de cada control a pantalla (para la capa HTML)
│  └─ quality.ts      niveles y calidad adaptativa
├─ state/             session.store.ts (signals, puente con el motor de audio)
├─ features/          instrument-stage, control-layer, html-instrument, display-mirror, guide, exploded-view, loop-anatomy, faq
└─ pages/             home, about, not-found
scripts/              build-worklet, make-fake-mic, render-poster, demo-sounds, check-bundles
```

### 4.2 Capas (ESLint `no-restricted-imports`)
- `audio/core/`, `audio/synth/`, `audio/files/` e `instrument/`: ni Angular, ni `three`, ni RxJS, ni DOM, ni tipos de Web Audio. Se testan en Node.
- `audio/worklet/`: solo `audio/core/`.
- `audio/workers/`: solo `audio/synth/`, `audio/core/` y `audio/files/`.
- `audio/engine/`: sin Angular ni `three`; puede usar `audio/core/` (protocolo) y `audio/files/`.
- `scene/`: sin Angular, sin RxJS y sin `audio/`; puede usar `instrument/` (modelo de controles y de pantalla). **Único sitio donde se importa `three`.**
- `state/`, `features/` y `pages/`: llegan al audio y al 3D **solo** por `audio/engine/index.ts` y `scene/index.ts`; pueden usar `instrument/`, `core/` y `state/`.
- **Patrón de las API** (`audio/engine/index.ts` y `scene/index.ts`): exportan tipos y funciones diminutas que cargan la implementación con `import()`. Del motor, solo el desbloqueo de audio (§4.9) va de verdad en el bundle inicial.

### 4.3 Audio: hilos, reloj y mensajes
- **Hilo de audio (worklet):** `LoopCore` es la **fuente de verdad** del audio (PCM de las capas, transporte, cola). `process()` no reserva memoria.
- **Hilo principal:** `AudioEngine` envía comandos tipados y recibe eventos agrupados (≤ 30/s): posición del transporte, estado de grabación, niveles RMS por capa y avisos discretos (toma cerrada, sonido aplicado, error).
- **PCM hacia el hilo principal:** solo copias al guardar, exportar o autoguardar (con antirrebote y fuera de una toma), como `Transferable`.
- **Workers:** `synth.worker` renderiza los bucles de la biblioteca a la frecuencia del contexto; `export.worker` instancia **el mismo `LoopCore`** sin conexión para exportar (lo que suena es lo que se exporta).
- **Micrófono:** `getUserMedia` (mono, sin cancelación de eco, supresión de ruido ni control de ganancia automáticos, con respaldo si el navegador no lo permite) → `MediaStreamAudioSourceNode` → entrada del worklet.
- **Sesión de audio:** `navigator.audioSession.type` = `playback` al escuchar y `play-and-record` al grabar, si existe.

### 4.4 Núcleo DSP (`LoopCore`): especificación
**Transporte**
- Contador entero de muestras; la posición en pulsos (float64) se calcula por tramos de tempo constante (`beatAtSegmentStart + (frame − segmentStartFrame) × bpm / 60 / sampleRate`), sin acumular errores. Compás = 4 pulsos. Tempo 40–240 BPM (inicial: 90).
- Mantener reproducir = parar y volver al pulso 0. Pausa = congelar el contador.

**Capas (4)**
- Cada capa guarda: PCM mono float32, su tempo nativo (el de su grabación o el de la biblioteca), su duración en pulsos, nivel, silencio, panorama, reverso, filtro, origen (biblioteca + id o grabación) y su pila de deshacer.
- Posición de lectura = `(beat mod lengthInBeats) × nativeFramesPerBeat`, o su espejo en reverso. Las capas de distinta duración se repiten sobre la misma línea de tiempo.
- ***Varispeed*:** cambiar el tempo cambia la velocidad de lectura de todas las capas (velocidad y tono a la vez). Lectura con **interpolación cúbica de Hermite**.
- **Juntas del bucle:** fundido cruzado de ~5 ms en el punto de unión.

**Suavizado y mezcla**
- Nivel, silencio, panorama, filtro y volumen general con suavizado de un polo (~10 ms).
- **Filtro:** variables de estado (TPT/SVF), paso bajo, corte exponencial ~18 kHz → ~150 Hz según la posición del brazo; en el extremo exterior, *bypass* sin coste.
- Salida estéreo (panorama de igual potencia) y **limitador** con techo de −0,3 dBFS (pico rápido + saturación suave de seguridad).
- **Metrónomo** y cuenta previa: clics sintetizados que **nunca** se graban ni se exportan.

**Grabación**
- Estados: `idle` → `countIn` → `recording` → `idle`. La toma se alinea con lo que el usuario oyó restando la **latencia** de ida y vuelta (ver «Latencia», más abajo).
- Grabar con el transporte parado lo pone en marcha (tras la cuenta previa, si está activa).
- **Toma libre:** la primera se cierra exactamente al pulsar (o sola a los 60 s) y fija la duración del bucle; si no hay otras capas y la opción está activa, el tempo se ajusta para que la toma dure un número entero de compases (dentro de 40–240). Las siguientes tomas libres siguen la duración existente.
- **Toma fija:** 1, 2 o 4 compases; empieza en el siguiente compás (o tras la cuenta previa de al menos 4 pulsos) y se cierra sola. Si se cierra antes, el resto se rellena con silencio.
- **Sobregrabación:** grabar en una capa ocupada suma la toma a lo que había; si era de la biblioteca, pasa a «grabación propia» (el sonido de la biblioteca sigue disponible con deshacer).
- **Bloqueos durante una toma:** tempo, selección, reverso, disco, archivos y deshacer. Siguen libres niveles, silencio, filtro y volumen.

**Deshacer**
- Hasta 3 estados por capa, con copia en escritura. Una edición nueva invalida el rehacer.
- **Contabilidad de memoria:** el núcleo informa de los bytes en uso; peor caso documentado (4 capas de 60 s con 3 estados cada una).

**Cola de sonidos**
- Con el transporte en marcha, un cambio de sonido espera al siguiente límite de compás (**exacto a la muestra**), conserva la fase común y entra con un fundido corto. En pausa, se aplica al momento; pausar aplica lo que estuviera en cola. Deshacer cancela la cola o restaura el sonido anterior.

**Disco**
- Mantener = la capa seleccionada se separa de la línea de tiempo y su cabeza sigue al ángulo del disco (1 vuelta = 1 compás), adelante o atrás, con la misma interpolación. Al soltar, vuelve a su posición en la línea de tiempo común con un fundido de ~15 ms. Las demás capas siguen sonando.

**Latencia**
- Automática: `baseLatency + outputLatency` del contexto + la latencia de entrada que informe la pista del micrófono.
- **Calibración** (menú ENTRADA): suenan clics por los altavoces, se graban por el micrófono y se mide el desfase (detección de ataques). Ajuste manual en ms. El valor se guarda en `localStorage`.

**Reposo:** para el audio y libera el micrófono; conserva las capas.

### 4.5 Modelo del instrumento (`instrument/`)
- **Catálogo de controles:** id, nombre accesible, tipo (tecla, dial con pulsación, disco, brazo, rueda, botón), rango, paso, paso grande (×10), valor por defecto, gestos y `aria-valuetext` en español.
- **Gestos:** máquina de estados pura, igual para puntero, táctil y teclado: pulsar = soltar antes de 500 ms sin mover; mantener = 500 ms sin mover; girar/arrastrar = moverse más allá de un umbral (que cancela la pulsación).
- **Menú del dial principal** (máquina de estados con tests): girar = recorrer o ajustar, pulsar = entrar o confirmar, mantener o Esc = atrás. Confirmaciones en la pantalla con «Cancelar» seleccionado primero.
  - **SONIDO** → BATERÍA / BAJO / ACORDES / TEXTURA → 3 sonidos + APAGADO. Recorrer nunca cambia el audio.
  - **BUCLE** → duración de la toma (LIBRE / 1 / 2 / 4 compases), cuenta previa, metrónomo, reverso de la capa, panorama de la capa, tempo por pulsaciones, ajustar el tempo a la toma libre.
  - **ENTRADA** → ganancia 0–200 %, latencia (automática / calibrar / manual).
  - **SESIÓN** → guardar, cargar, exportar mezcla (repeticiones), exportar pistas, borrar capa, sesión nueva, borrar autoguardado.
  - **AYUDA** → los gestos de pulsar, girar y mantener.
- **Pantalla:** modelo de texto (líneas, iconos, capa destino, EN COLA, GRABANDO) que pintan el 3D (textura de canvas) y el instrumento HTML, y que resume una región `aria-live` sin ruido (con antirrebote).
- **Atajos** (solo con el foco dentro del instrumento, como pide la WCAG 2.1.4): Espacio = reproducir/pausa, R = grabar, Z = deshacer, 1–4 = seleccionar capa, `?` = chuleta. Si el control enfocado usa esa tecla, manda el control (Espacio en el disco lo mantiene; Intro o Espacio en una tecla la pulsan).

### 4.6 Escena 3D
- **Modelo procedural** por piezas (`scene/model/`): cuerpo con bisel, disco, brazo, 4 diales de capa, dial principal, 3 teclas de transporte, pantalla, rueda de volumen, botón de reposo, LED, tornillos y patas. Medidas reales en mm, documentadas.
- **Materiales físicos** (`MeshPhysicalMaterial`): metal anodizado o cepillado (anisotropía), plástico de teclas con *clearcoat*, cerámica o pintura mate según la dirección visual. **Texturas procedurales** (ruido, cepillado, moleteado, rótulos de las teclas) generadas en el arranque.
- **Luz:** `RoomEnvironment` + PMREM, una luz principal para los brillos y una **sombra de contacto horneada** una vez (sin mapas de sombras en tiempo real).
- **Color:** salida sRGB y *tone mapping* neutro (Khronos PBR Neutral) o AgX, decidido con capturas en la fase 5.
- **Animación ligada al audio:** el disco da **1 vuelta por compás** según el transporte; diales, teclas, brazo, LED y pantalla reflejan el estado real.
- **Niveles de calidad** (`low` / `medium` / `high`): DPR, segmentos, tamaño del entorno y antialiasing; bajada automática si los FPS no llegan.
- **Recuperación** de la pérdida de contexto WebGL y `dispose()` completo.

### 4.7 Interacción y accesibilidad (D10)
- `control-layer`: un elemento enfocable por control (`button` nativo para teclas; `role="slider"` con `tabindex="0"`, `aria-valuenow` y `aria-valuetext` para diales, rueda, brazo y disco), colocado sobre la caja proyectada de su pieza. La posición se recalcula **solo** cuando cambian la cámara o el tamaño.
- Los controles llevan `touch-action: none`; el resto del lienzo, `touch-action: pan-y` (la página se puede desplazar por encima del instrumento).
- Zonas táctiles **≥ 44 × 44 px** en el encuadre de móvil (con test).
- En «Inspeccionar», los controles que dan la espalda a la cámara se ocultan y se desactivan.
- El foco y el *hover* del elemento HTML se reflejan en 3D (anillo de foco visible y con contraste).
- **Instrumento HTML** (`html-instrument`): los mismos controles en una maqueta 2D en CSS. Es la alternativa sin WebGL (`?sin3d=1` o fallo de WebGL) y la base de los e2e del audio.

### 4.8 Archivos y persistencia
- **`.torno`:** firma, versión, cabecera JSON (tempo, frecuencia de muestreo, ajustes, por capa: duración, tempo nativo, origen, nivel, silencio, panorama, reverso, filtro) y PCM float32 LE por capa. **Validación completa antes de cambiar nada** (tamaños, límites, `NaN`/`Infinity`, versión). Si la frecuencia difiere, `audio/engine/` remuestrea con `OfflineAudioContext`. No se guarda el historial de deshacer.
- **WAV:** mezcla estéreo de 24 bits con N repeticiones (1–8) y fundido final opcional, renderizada por `export.worker` con el mismo núcleo; **pistas por separado**: un WAV mono de 24 bits por capa. Sin metrónomo.
- **Autoguardado:** IndexedDB, tras cada edición confirmada (no durante una toma), con antirrebote. Al volver: «Recuperar la sesión anterior» o «Empezar de cero». Errores de cuota controlados.

### 4.9 Prerenderizado y carga
- `/` se prerenderiza con el texto y un **póster** del instrumento (render del propio motor, fase 7). El LCP es el H1 o el póster, **nunca el canvas**.
- El 3D se carga con `@defer` (al entrar en pantalla o en reposo) y sustituye al póster con un fundido cuando su primer frame está listo, en la misma caja (CLS 0).
- **Desbloqueo de audio** en el bundle inicial (< 2 kB): una escucha **nativa** en fase de captura (`addEventListener`, no un enlace de plantilla de Angular), registrada al arrancar, que reacciona al primer gesto que activa el audio (`click`, `pointerup`, `touchend` o `keydown`) sobre un elemento marcado (`[data-audio-unlock]`: el instrumento y los botones «Tocar»). En ese gesto y **antes de cualquier `await`**: pone `navigator.audioSession.type = 'playback'` si existe (en iOS, así suena aunque el interruptor de silencio esté activado), crea y reanuda el `AudioContext` y reproduce un búfer silencioso de una muestra. El `AudioEngine` diferido adopta ese contexto. Si el módulo del worklet tarda, el contexto ya está en marcha y el sonido empieza al cargar.
- **Hidratación y repetición de eventos** (`withEventReplay`): un toque anterior a la hidratación se repite después, ya fuera del gesto. Como la escucha nativa actúa en el gesto real, el contexto ya está desbloqueado cuando llega la repetición. Si el toque fue anterior a la carga del propio JS, no se puede desbloquear: la interfaz pide otro toque («Toca para activar el sonido»), sin error.
- El motor de audio se precarga cuando el puntero o el foco se acercan al instrumento.

---

## 5. Presupuestos de calidad

| Área | Objetivo |
|---|---|
| JS de la primera visita a cada ruta | `main` + chunks iniciales + `modulepreload` de la ruta (lo que mide `check-bundles`): aviso > 330 kB · error > 400 kB, en bruto. Angular solo ya ocupa ~280 kB: lo que no se ve en la primera pantalla va en `@defer` y el motor y el 3D, con `import()` |
| Chunk 3D (three + escena) | Aviso > 800 kB en bruto; tamaño en cada informe |
| Motor de audio · worklet · workers | ≤ 60 kB · ≤ 40 kB · ≤ 40 kB cada uno, en bruto |
| Fuentes | ≤ 150 kB en total, con subconjunto latino |
| Peso de la primera visita | ≤ 600 kB sin el 3D · ≤ 1,5 MB con el 3D (no hay texturas que descargar) |
| Arranque del 3D | Generación del modelo y texturas ≤ 150 ms en escritorio; sin tareas largas > 200 ms |
| VRAM estimada | ≤ 96 MB (alto) · ≤ 48 MB (bajo) |
| FPS | ≥ 55 en escritorio (alto) · ≥ 30 en móvil de gama media (bajo), tocando |
| Reposo | 0 fps en pausa y sin interacción (y con movimiento reducido) |
| **CPU del audio** | `LoopCore` con 4 capas, filtros y limitador ≥ 100× tiempo real en Node (escritorio); 0 cortes (*underruns*) en 5 min tocando en el móvil de gama media |
| **Exactitud** | Cola y tomas fijas exactas a la muestra en el límite de compás · *varispeed* ±1 muestra por bucle · deriva 0 en 10 min |
| **Sin clics** | Salto máximo entre muestras consecutivas en juntas, cambios, fundidos y al soltar el disco ≤ el mayor salto de la propia señal + 0,01 (escala ±1) |
| **Arranque del audio** | Primer sonido ≤ 100 ms tras pulsar (motor ya cargado); con el worklet retrasado 1,5 s, el contexto está en `running` dentro del gesto |
| **Respuesta** | De un gesto al cambio de parámetro en el audio ≤ 20 ms (medido) |
| **Latencia de grabación** | Tras calibrar, toma alineada ±5 ms (prueba de Iván en el móvil) |
| Memoria de audio | ≤ 64 MB en una sesión típica (4 capas de 2 compases) · peor caso documentado y ≤ 220 MB |
| Memoria 3D | 10 cambios de vista y de nivel de calidad sin crecimiento de `renderer.info.memory` |
| Lighthouse móvil `/` | Rendimiento ≥ 90 · accesibilidad y buenas prácticas ≥ 95 (el SEO no es criterio) |
| Lighthouse móvil `/sobre-el-proyecto` | ≥ 95 en rendimiento, accesibilidad y buenas prácticas |
| LCP / CLS | ≤ 2,5 s · ≤ 0,05 |
| Accesibilidad | axe: 0 violaciones graves o críticas · todo usable con teclado y sin WebGL |
| Privacidad | 0 cookies · 0 peticiones a terceros · **0 peticiones de red al grabar, guardar o exportar** (e2e) |

---

## 6. Fases y bloques

Todo se trabaja en **modo autónomo por bloques**, con el ciclo de `CLAUDE.md`: dentro de un bloque, cada fase va en su rama `fase-N-nombre` y termina con `npm run check`, un informe, una revisión por subagente, correcciones y fusión, sin esperar el OK de Iván. **Al final de cada bloque, la ejecución para** y la sesión de revisión hace una revisión completa antes de seguir. Prompts en `docs/prompts/PROMPTS.md`.

| Bloque | Fases | Esfuerzo | Por qué se para ahí |
|---|---|---|---|
| 0 | 0 | `max` | Cimientos y pruebas técnicas: la base de todo lo demás |
| A | 1–2 | `max` | El núcleo de audio y el motor en el navegador |
| B | 3–4 | `max` | Sonidos (Iván los escucha) y staging con pruebas en móviles reales e iPhone |
| C | 5–6 | `max` | El instrumento 3D y su interacción. **Parada prevista tras 5.a** para que Iván apruebe el diseño |
| D | 7 | `high` | Web de producto, guía y contenido (Iván revisa los textos) |
| E | 8 | `max` | Pulido y calidad final |
| F | 9 | `high` | Lanzamiento, con Iván |

**Capturas:** toda fase con cambios visuales aporta capturas deterministas (`?captura=1`) en escritorio y móvil en `docs/informes/img/fase-N/`.

### Fase 0: Cimientos y pruebas técnicas

**Requisito:** dirección visual elegida ✅ (B «Barro», §10).

Tareas:
1. **Repo:** `git init -b main`; primer commit `docs: plan inicial` solo con `CLAUDE.md` y `docs/`. El resto, en `fase-0-cimientos`.
2. **Angular 22:** `ng new` en una carpeta temporal **ejecutado desde la carpeta padre** (`--directory=torno-scaffold`; la CLI no admite rutas `../`), con `NG_CLI_ANALYTICS=false`, y mover el resultado aquí **sin sobrescribir `CLAUDE.md` ni `docs/`**. Si `ng new` genera reglas para IA (un `CLAUDE.md` o similar), su contenido pasa a `docs/angular-buenas-practicas.md` solo si difiere del que ya hay. `.mcp.json` con el servidor MCP de Angular CLI (como en tierra-luna-sol); `README.md` breve en español.
3. **Configuración:**
   - `outputMode: "static"` y prerenderizado de las 3 rutas; sin `server.ts`.
   - `strict`, `noUncheckedIndexedAccess` y `strictTemplates`.
   - Presupuestos de §5 en `angular.json` y `scripts/check-bundles.mjs` (inicial, worklet y workers).
   - ESLint con las capas de §4.2 (con un test que demuestre que un import prohibido falla), Prettier y Vitest con entorno `node` para las carpetas de TS puro.
   - Se puede usar como **referencia** la configuración de `../tierra-luna-sol` (lint por capas, presupuestos, CI), que es del mismo autor. **Solo lectura.**
4. **Estructura** de §4.1 con archivos índice mínimos y `site.config.ts` (nombre, subdominio provisional, idioma, autor y enlaces legales de ivanchesa.es).
5. **Prueba técnica del worklet (D5):**
   - `audio/worklet/processor.ts` mínimo que importa una función de `audio/core/` (por ejemplo, un oscilador seno).
   - `scripts/build-worklet.mjs` con esbuild → `public/audio/processor.<hash>.js` + `audio/engine/worklet-url.generated.ts` (los dos, ignorados por git); se genera antes de `start` (en modo vigilancia), `build`, `test` y `lint`, también en el CI.
   - Botón de prueba temporal: crea el contexto **en el gesto**, carga el módulo y suena un pitido de 0,5 s.
   - La misma función, testada en Vitest (Node).
   - Playwright (Chromium): el worklet carga, procesa y la salida no es silencio (`AnalyserNode`).
6. **Prueba técnica de los workers:** `new Worker(new URL(...))` desde Angular, con import de `audio/synth/`; funciona en `ng serve` y en el build prerenderizado.
7. **`docs/DISENO.md`** con la dirección B «Barro» (§10) desarrollada: paleta (tokens), tipografías, escala tipográfica, espaciado, componentes base y **materiales y colores del instrumento**. Tipografías candidatas: Fraunces + Geist Mono; se confirman o se cambian por otras OFL, con subconjunto latino, ≤ 150 kB en total y el contraste AA de cada combinación de color comprobado. Estilos base y fuentes instalados. Capturas de la página base.
8. **CI** (`.github/workflows/ci.yml`): lint, test, build y e2e de la prueba del worklet. Correrá cuando haya remoto.
9. **Skills:** copiar `../tierra-luna-sol/.claude/skills/` a `.claude/skills/` y excluirlas de git y de Prettier.
10. `docs/informes/DIARIO.md` creado (vacío, con su formato).

Criterios de aceptación:
- [ ] `npm run check` sin errores; el bundle inicial cumple §5.
- [ ] El pitido suena en Chromium y el e2e lo demuestra; el núcleo se testa en Node.
- [ ] El worklet y el worker funcionan en `ng serve` y en el build estático servido en local.
- [ ] El lint rechaza un import prohibido (demostrado).
- [ ] `DISENO.md` completo y capturas de la página base en escritorio y móvil.

### Fase 1: Núcleo de audio (TS puro)

**Objetivo:** el instrumento entero funcionando **a nivel de muestras**, sin navegador, demostrado con tests.

Tareas:
1. **`LoopCore`** según §4.4: transporte, 4 capas, lectura con Hermite, reverso, *varispeed*, juntas, suavizado, panorama, SVF, limitador, metrónomo, cuenta previa, tomas libres y fijas, ajuste de tempo a la toma libre, relleno, sobregrabación, deshacer/rehacer con copia en escritura, cola exacta al compás con fundido, disco (mantener, arrastrar y volver), bloqueos, reposo y desplazamiento por latencia.
2. **`protocol.ts`:** comandos y eventos tipados, versionados, sin `any`.
3. **Render sin conexión** (`renderOffline(state, frames)`) para exportar con el mismo código.
4. **Contabilidad de memoria** y documento corto del peor caso.
5. **Tests a nivel de PCM** (con señales sintéticas):
   - límites de compás y cola exactos a la muestra;
   - *varispeed* (a doble tempo, el bucle dura la mitad ±1 muestra) y reverso (espejo exacto, salvo el fundido de la junta);
   - sin clics en juntas, cambios, fundidos y al soltar el disco (criterio de §5);
   - filtro: −3 dB en la frecuencia de corte ±10 % y *bypass* transparente;
   - limitador: nunca supera −0,3 dBFS con 4 capas a tope;
   - tomas libres, fijas, relleno, cuenta previa y desplazamiento por latencia de N muestras;
   - sobregrabación (suma), deshacer/rehacer y su invalidación;
   - bloqueos durante una toma;
   - deriva 0 en 10 minutos simulados;
   - determinismo (misma entrada → mismos bytes).
6. **Banco de pruebas** de rendimiento y comprobación de que `process()` no reserva memoria (revisión del código + test de *heap* estable durante 60 s simulados).

Criterios de aceptación:
- [ ] Todos los tests anteriores en verde, con las cifras en el informe.
- [ ] Rendimiento ≥ 100× tiempo real (§5).
- [ ] Peor caso de memoria documentado y dentro de §5.
- [ ] `audio/core/` sin dependencias de navegador (lo demuestra el lint).

### Fase 2: Motor en el navegador, archivos e instrumento HTML

**Objetivo:** tocar el instrumento completo en el navegador con controles HTML accesibles, antes de que exista el 3D.

Tareas:
1. **Desbloqueo de audio** en el bundle inicial, con escucha nativa (§4.9), y **`AudioEngine`** (§4.3): worklet, adopción del contexto, tiempo de espera de 5 s con «Reintentar», errores visibles, `navigator.audioSession`, interrupciones, `visibilitychange` (pestaña oculta = toma cancelada, pausa y micrófono liberado) y reposo. El motor devuelve **códigos de error**; los textos los pone la interfaz desde archivos de contenido con `reviewed: false`. La sonda temporal de la fase 0 desaparece.
2. **Micrófono:** permiso tras la acción, cancelación de la petición pendiente, ganancia de entrada, liberación garantizada de la pista.
3. **Latencia:** cálculo automático + **calibración por clic** + ajuste manual.
4. **Archivos** (§4.8): `.torno` (guardar y cargar, con validación y remuestreo), WAV estéreo de 24 bits con repeticiones y fundido, y pistas por separado, con `export.worker`.
5. **Autoguardado** en IndexedDB con recuperación y borrado.
6. **`instrument/`** (§4.5): catálogo de controles, gestos, menú completo (SONIDO con un sonido de prueba hasta la fase 3), pantalla y atajos, con tests.
7. **`SessionStore`** (signals ≤ 10/s) como puente con el motor.
8. **Instrumento HTML** (`?sin3d=1`): todos los controles, la pantalla y el menú, accesibles y con teclado (§4.7).
9. **`scripts/make-fake-mic.mjs`:** genera un WAV propio (clics y tonos con ataques conocidos) para el micrófono sintético de Chromium.
10. **Playwright:** Chromium con micrófono sintético y WebKit de escritorio (reproducir, pausar y menú).

Criterios de aceptación:
- [ ] e2e: reproducir → salida no silenciosa; grabar con el micrófono sintético → la capa contiene la toma **alineada** (ataques ±2 ms tras compensar); la pista del micrófono queda `ended` tras terminar, cancelar, reposo y pestaña oculta.
- [ ] e2e: con la carga del worklet retrasada 1,5 s (instrumentando `addModule`, porque Playwright no puede retrasar esa descarga), el contexto se crea y se reanuda dentro del gesto (`window.event` anotado, con control negativo) y suena al cargar.
- [ ] e2e: un toque sobre el instrumento antes de la hidratación termina con el audio desbloqueado o con el aviso «Toca para activar el sonido», nunca con un error ni en silencio sin explicación.
- [ ] `.torno`: ida y vuelta idéntica byte a byte (misma frecuencia) y correcta con remuestreo; **1000 archivos malformados** rechazados sin cambiar el estado.
- [ ] WAV válidos (los lee el test y `decodeAudioData`); la mezcla exportada coincide con el render del núcleo.
- [ ] Autoguardado: recargar y recuperar devuelve la misma sesión.
- [ ] Instrumento HTML: todo con teclado, axe sin violaciones graves y capturas.
- [ ] e2e de privacidad: 0 peticiones de red al grabar, guardar y exportar.

### Fase 3: Biblioteca de sonidos y menú completo

**Objetivo:** 12 bucles propios que suenen bien juntos y el menú SONIDO completo.

Tareas:
1. **`audio/synth/`:** osciladores sin *aliasing* (PolyBLEP), ruido con semilla, envolventes ADSR, filtros, FM sencilla (campanas y teclas), batería sintética (bombo con barrido, caja, charles, percusión), eco y saturación suave.
2. **Colección propia** (D8: Re menor, 90 BPM, 2 compases de 4/4, progresión propia): BATERÍA ×3, BAJO ×3, ACORDES ×3 y TEXTURA ×3, con **nombres propios en español**. Patrones y voces originales; nada del original.
3. **Equilibrio por papel:** picos ≤ −1 dBFS y niveles RMS objetivo por tipo, documentados.
4. **Renderizado en `synth.worker`** a la frecuencia del contexto, con caché en memoria.
5. **Menú SONIDO** completo: recorrer sin cambiar el audio, confirmar, EN COLA con la capa destino, APAGADO, confirmación al sustituir una grabación («Cancelar» primero), deshacer que cancela la cola. Primera reproducción: batería en la capa 1 y capa 2 seleccionada.
6. **Tempo por pulsaciones** (menú BUCLE).
7. **`npm run demo:sounds`:** exporta cada bucle y 3 combinaciones a WAV en una carpeta ignorada, para que Iván los escuche.

Criterios de aceptación:
- [ ] Tests: determinismo (hash del PCM), duración exacta (2 compases a 90 BPM), picos y RMS en rango, sin continua (DC), notas fundamentales de los bajos en la tonalidad (FFT) y render ≤ 50 ms por bucle en escritorio.
- [ ] e2e: la cola entra exactamente en el siguiente compás y deshacer la cancela.
- [ ] **Iván ha escuchado los sonidos** al final del bloque (se apunta en `PENDIENTES.md`; no bloquea las demás fases del bloque).

### Fase 4: Staging, entrega continua y móviles reales

**Requisitos de Iván** (§3): GitHub CLI, subdominio de staging protegido, cuenta FTP y secrets. **Si no están, se aplaza.**

Tareas:
1. **CI verde en GitHub** (lint, test, build y e2e con Chromium). El remoto está conectado desde el bloque A.
2. **`public/.htaccess`:**
   - HTTPS obligatorio (el micrófono y el AudioWorklet lo exigen);
   - URLs sin barra final, `ErrorDocument 404`, `Options -Indexes`;
   - caché larga e `immutable` para los archivos con hash (también el worklet); corta para el HTML;
   - tipos MIME correctos para los módulos JS;
   - cabeceras de seguridad, `Permissions-Policy: microphone=(self)` y una CSP con `script-src 'self'` y `worker-src 'self'`, compatible con el worklet, los workers y el CSS crítico de Angular (valorar `security.autoCsp`).
3. **`deploy-staging.yml`:** push a `main` + CI verde → build → FTPS (`SamKirkland/FTP-Deploy-Action` fijado por SHA), con `X-Robots-Tag: noindex`.
4. **Verificación con `curl`:** códigos, cabeceras, MIME y caché. Comprobar que Imunify360 no bloquea el despliegue.
5. **Dependabot.**
6. **Prueba de Iván en Android e iPhone** con el instrumento HTML, siguiendo una lista en el informe: reproducir, grabar con auriculares, sobregrabar, cambiar de app y volver, calibrar la latencia, guardar y exportar.

Criterios de aceptación:
- [ ] CI verde y staging actualizado solo al hacer push a `main`.
- [ ] Comprobaciones con `curl` en el informe.
- [ ] Lista de prueba en el informe y resultados de Iván en Android e iPhone (versión, navegador, auriculares, latencia medida y problemas). Los resultados no bloquean la fusión de la fase 4, pero **sí el inicio del bloque C**: si el audio falla en iOS, se arregla antes de construir el 3D.

### Fase 5: Diseño del instrumento y modelo 3D

**5.a: Maqueta (termina con PARADA para Iván).**
1. Medidas y distribución propias del aparato (en mm), coherentes con `DISENO.md` y **distintas del original** (que es un cuerpo casi cuadrado marfil, disco grande a la izquierda, brazo plateado arriba a la derecha, columna de teclas azules y dial a la derecha y 4 diales delante).
2. Modelo de bloques con materiales provisionales y **3 variantes de color** dentro de la dirección elegida; capturas de 4 ángulos en escritorio y móvil.
3. Prueba de *tone mapping* (Neutral frente a AgX) con capturas.
4. **PARA** y espera la aprobación de Iván (parada prevista).

**5.b: Modelo definitivo.**
1. Todas las piezas de §4.6 con detalle (biseles, moleteado, rótulos, tornillos, LED).
2. Materiales y texturas procedurales; entorno y sombra de contacto.
3. Pantalla como textura de canvas, alimentada por el modelo de pantalla (§4.5), actualizada solo cuando cambia.
4. **`SceneEngine`** con API estrecha: estado del instrumento (entrada), cámara, calidad, tamaño, captura, `dispose()` y eventos.
5. Niveles de calidad y bajada automática; recuperación de la pérdida de contexto.
6. `instrument-stage` con `@defer`, póster provisional y fundido; bucle bajo demanda; modo `?captura=1`; indicador de FPS y `renderer.info` solo en desarrollo.

Criterios de aceptación:
- [ ] Diseño aprobado por Iván (5.a) y capturas finales coherentes con él.
- [ ] Peso, VRAM, FPS, tiempo de generación y tamaño del chunk según §5 (cifras).
- [ ] 0 fps en reposo; pérdida y recuperación del contexto probadas; sin fugas en 10 cambios de calidad.

### Fase 6: Interacción y sincronía

**Objetivo:** tocar el instrumento 3D como un objeto real, con teclado y en móvil.

Tareas:
1. **`control-layer`** (D10, §4.7): elementos nativos proyectados, `touch-action`, zonas ≥ 44 px y ocultación en «Inspeccionar».
2. **Gestos** de cada control: diales (arrastre vertical o circular con aceleración, pulsar, mantener), teclas (recorrido y pulsación), disco (mantener, arrastrar por ángulo), brazo (barrido en arco), rueda, reposo.
3. **Cámara:** modos «Tocar» (completo, capas, controles) e «Inspeccionar» (órbita limitada); transiciones suaves; encuadre de móvil; pantalla completa.
4. **Sincronía con el audio:** disco a 1 vuelta por compás, diales, brazo, teclas, LED, **formas de onda y medidores** en la pantalla, siempre leyendo el transporte.
5. Foco y *hover* en 3D; **«Pausar movimiento»** y movimiento reducido (el disco no gira solo; las cámaras cortan).
6. **Atajos** y chuleta accesible.
7. e2e: cada control con ratón (sobre los elementos proyectados), táctil emulado y teclado; la página se desplaza con normalidad fuera de los controles.

Criterios de aceptación:
- [ ] Todas las funciones de §0.1 se pueden hacer en 3D, con teclado y en móvil (e2e).
- [ ] Zonas táctiles ≥ 44 px en el encuadre de móvil (test).
- [ ] Velocidad del disco = transporte ±1 %; respuesta ≤ 20 ms (§5).
- [ ] Con movimiento reducido o «Pausar movimiento», 0 animaciones automáticas.
- [ ] Capturas de cada encuadre y de «Inspeccionar» en escritorio y móvil.

### Fase 7: Web de producto, guía y contenido

Tareas:
1. **`docs/ESTILO.md`:** tuteo, frases cortas, vocabulario en español (bucle y no *loop*, toma y no *take*, sobregrabación y no *overdub*…), cifras con `Intl` `es-ES` y cómo presentar mediciones.
2. **Maqueta de alta fidelidad** de la página (escritorio y móvil) con `taste-skill` e `impeccable`, coherente con `DISENO.md`. Después, la implementación.
3. **Secciones** (textos propios, con `reviewed: false`):
   - portada: titular, entrada, «Tocar» y «Cómo se toca» junto al instrumento;
   - qué es y para qué;
   - **conoce tu instrumento**: guía de 9 controles (reproducir y pausar, grabar, mezclar capas, tempo, disco, brazo, ajustes del bucle, sonidos y sesión) con **«Ver en el instrumento»** (viaje de cámara + resaltado; nunca inicia el audio ni cambia nada);
   - **los detalles**: materiales y **vista despiezada**;
   - **anatomía de un bucle**: diagrama interactivo de las 4 capas (escuchar solo tras pulsar);
   - **ficha técnica con valores medidos** (frecuencia de muestreo, capas, latencia, CPU del audio, FPS, peso) y cómo se midió cada uno;
   - preguntas frecuentes (acordeón accesible);
   - cierre: tocar, caso de estudio, contacto en ivanchesa.es y el código en GitHub (cuando sea público).
4. **`/sobre-el-proyecto`:** caso de estudio (arquitectura y diagrama de hilos, decisiones, mediciones, accesibilidad y autor).
5. **Póster e imagen Open Graph** renderizados con el propio motor (`scripts/render-poster.mjs`: Playwright + `?captura=1` + sharp).
6. **Compartir (D18)**, pie con los enlaces legales de ivanchesa.es y la nota «Sin cookies, sin analítica y sin peticiones a terceros. Tu audio no sale de tu navegador.»
7. Lista de textos para la revisión de Iván.

Criterios de aceptación:
- [ ] Capturas de la maqueta y de la implementación coherentes.
- [ ] Lighthouse móvil según §5 en `/` y `/sobre-el-proyecto`.
- [ ] e2e de privacidad en todas las rutas.
- [ ] La guía nunca inicia el audio ni pide el micrófono (e2e).
- [ ] Ficha técnica: cada cifra tiene su medición documentada en un informe, y `/sobre-el-proyecto` explica cómo se midió.

### Fase 8: Pulido y calidad

Tareas:
1. **Móvil:** encuadres, tamaños, gestos y orientación vertical y horizontal.
2. **Sin WebGL o con el contexto perdido:** instrumento HTML automático con aviso.
3. **Accesibilidad:** axe en todas las rutas, contraste, foco (también al navegar dentro de la SPA: a `main` o al `h1`, salvo en la primera carga), zoom al 200 % y prueba manual con NVDA o Narrador (notas en el informe).
4. **Rendimiento:** tabla de todos los presupuestos de §5 medidos por nivel de calidad.
5. **iOS Safari en un iPhone real** (Iván): audio, micrófono, segundo plano, memoria y gestos.
6. **Regresión visual** con `toHaveScreenshot` y `?captura=1`, con referencias generadas en el CI (Linux).
7. **Lighthouse en el CI** si Iván aprueba `@lhci/cli`.
8. **Revisión final de diseño** con `impeccable` y `web-design-guidelines`, con capturas antes/después.

Criterios de aceptación:
- [ ] Tabla con **todos** los presupuestos de §5 medidos y cumplidos.
- [ ] axe sin violaciones graves; e2e y regresión visual en verde en el CI.
- [ ] Iván da el visto bueno en su móvil y en un iPhone.

### Fase 9: Lanzamiento

**Iván (manual):** subdominio de producción con AutoSSL, cuenta FTP limitada, secrets de producción y licencia del código.

**Claude Code:**
1. **`deploy-production.yml`:** despliegue con una etiqueta `v*` (o manual), reutilizando el build verificado.
2. Verificación en producción con `curl` y Lighthouse.
3. **README de portfolio** (capturas, vídeo o GIF corto, stack, arquitectura, mediciones), **LICENSE**, **CHANGELOG** y etiqueta **`v1.0.0`**. El repo pasa a público.
4. **Indexación:** `indexable: true` en `site.config.ts` (hasta aquí todo lleva `noindex`) y comprobar que solo la 404 lo conserva. Comprobar también que los enlaces legales de ivanchesa.es siguen existiendo tras su rediseño.
5. Lista para Iván: ficha del proyecto en ivanchesa.es (en su propio repo) y difusión.

Criterios de aceptación:
- [ ] `v1.0.0` en producción con HTTPS, desplegada por etiqueta.
- [ ] Comprobaciones en producción según §5.

---

## 7. Flujo de trabajo entre las dos IAs

| Quién | Hace |
|---|---|
| **Claude Code (Opus 5.5)** | Ejecuta los bloques en modo autónomo: por fase, plan en el informe → trabajo → `npm run check` → revisión por subagente → correcciones → fusión → `DIARIO.md`. Para al final del bloque, en la parada prevista o ante una condición de parada. |
| **Claude (sesión de plan y revisión)** | Prepara el plan y los prompts, revisa cada bloque completo (diff, checks propios, criterios, capturas, audio y estrategia), escribe `docs/revisiones/bloque-X.md` y ajusta el plan si hace falta. |
| **Iván** | Decide, hace los pasos manuales (GitHub, cPanel, secrets), escucha los sonidos, revisa los textos, prueba en sus móviles y da el OK a cada bloque. |

Reglas:
- Una sesión de Claude Code por bloque (o por fase, si se alarga). Al empezar, lee `CLAUDE.md`, §0–§5 y §7 del plan, la sección de su fase y el informe y la revisión anteriores.
- Si el contexto se llena: informe «en curso», commit y sesión nueva con el prompt «Retomar».
- Nada fuera del alcance; las ideas van al backlog. Si falta un dato: `TODO(ivan):` + `docs/PENDIENTES.md`.

---

## 8. Riesgos y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| **El audio no arranca o se corta en iOS** | Contexto creado y reanudado en el gesto, búfer silencioso, `audioSession`, reintento visible; **staging y iPhone en la fase 4**, antes del 3D |
| El builder de Angular no empaqueta el worklet | Prueba técnica en la fase 0 con esbuild (D5) |
| Clics, deriva o desajustes del bucle | Reloj único (D6) y tests a nivel de muestras con criterios numéricos (§5) |
| Tomas desplazadas por la latencia | Compensación automática + calibración; prueba de Iván con auriculares |
| Acople de los altavoces al grabar | Aviso de usar auriculares; sin monitorización en directo |
| Memoria con tomas largas y deshacer | Copia en escritura, contabilidad y peor caso con presupuesto (§5) |
| El 3D procedural parece barato | Maqueta con 3 variantes y **aprobación de Iván en 5.a**; materiales físicos, entorno y sombra de contacto |
| Arrastrar un dial frente a desplazar la página en móvil | Capa HTML proyectada con `touch-action` por control (D10) y modos de cámara (D12) |
| La GPU del móvil compite con el audio | Render bajo demanda, calidad adaptativa y prueba de 5 min sin cortes |
| Parecerse demasiado al original | Regla de `CLAUDE.md` (no abrir su código ni sus textos), diseño propio aprobado por Iván y revisión de bloque |
| Sonidos que no gustan | Escucha de Iván al final del bloque B; los presets son datos fáciles de ajustar |
| Archivos `.torno` maliciosos o rotos | Validación completa antes de cambiar nada + 1000 casos malformados |
| Contexto de sesión lleno | Entregas, informe vivo y prompt «Retomar» |
| Imunify360 bloquea el FTP desde GitHub | Detección en la fase 4; plan B: subida manual del build |

---

## 9. Backlog (después de la v1; no se toca sin el OK de Iván)
1. Versión en inglés.
2. **Web MIDI**: controlar el instrumento con un controlador físico.
3. Estiramiento de tiempo sin cambio de tono.
4. Más colecciones de sonidos y edición de patrones.
5. PWA / funcionamiento sin conexión.
6. Ficha del proyecto en ivanchesa.es (en su propio repo).

---

## 10. Direcciones visuales

**Elegida: B «Barro»** (Iván, 24-10). La fase 0 la desarrolla en `docs/DISENO.md`; las tipografías son candidatas que se confirman allí. Las otras dos quedan como referencia.

Las tres se apartan del original (marfil y azul cobalto, tocadiscos casi cuadrado).

| | A «Taller» | B «Barro» | C «Estudio» |
|---|---|---|---|
| **Idea** | Herramienta de taller: precisa, técnica, nocturna | Objeto cálido hecho a mano, con la tierra del Bajo Cinca | Equipo de estudio de radio: sobrio, claro y funcional |
| **Instrumento** | Aluminio anodizado grafito, diales de aluminio natural moleteado, teclas **naranja señal**, pantalla blanca | Cuerpo **terracota mate** con textura de cerámica, metal **latón envejecido**, teclas crema, pantalla verde fósforo | Cuerpo **gris niebla** mate, metal cromado satinado, teclas grises y **grabar en rojo**, pantalla de cristal líquido reflectante |
| **Web** | Fondo casi negro cálido, texto hueso, acento naranja | Fondo **verde oliva oscuro** (los olivares del Bajo Cinca), texto crema, acento terracota | Fondo gris muy claro, texto grafito, acento rojo |
| **Tipografías candidatas** | Grotesca de ancho variable (Archivo) + mono (Geist Mono) | Serif expresiva (Fraunces) + mono (Geist Mono) | Grotesca neutra (Hanken Grotesk) + mono (Geist Mono) |
| **Disco** | Aluminio con anillo de luz | Cerámica esmaltada con anillo de latón | Goma negra con marcas blancas |
| **Riesgo** | Puede quedar frío | Hay que lograr que la cerámica parezca real en 3D | Puede quedar demasiado neutro |
