# Diario

Lo escribe Claude Code (CLAUDE.md, «Ciclo de cada fase» y «Paradas»):

- **Al fusionar cada fase**, una fila en «Fases».
- **Al terminar cada bloque** (o en una parada), un apartado en «Bloques» con lo hecho, las métricas, las desviaciones y lo pendiente para Iván.

## Fases

| Fase | Fecha | Veredicto de la revisión | Métricas clave |
|---|---|---|---|
| 0 · Cimientos y pruebas técnicas (`fase-0-cimientos`, fusión `1924d2a`) | 2026-10-24 | CAMBIOS NECESARIOS: 0 Bloqueantes; los 2 Importantes y los 8 Menores, corregidos ([revisión](../revisiones/fase-0.md), [informe](fase-0.md)) | JS inicial de `/` 293,5 kB (aviso a 300) · desbloqueo de audio 0,7 kB · worklet 1,9 kB · worker 1,3 kB · fuentes 144,1 kB · pitido por el worklet −12,0 dBFS y 24.000/24.000 muestras · tono del worker 48.000/48.000 en 5,2 ms · 122 tests en Node (100 % de líneas en el TS puro) + 31 en Angular + 31 e2e · axe: 0 violaciones |
| 1 · Núcleo de audio en TS puro (`fase-1-nucleo-audio`, fusión `e170652`) | 2026-10-24 | CAMBIOS NECESARIOS: 0 Bloqueantes; los 2 Importantes, los 10 Menores y 3 de las 4 Sugerencias, corregidos (la #14 queda para la fase 3) ([revisión](../revisiones/fase-1.md), [informe](fase-1.md)) | `LoopCore` a 240–242× tiempo real · 0,0 KiB reservados por `process()` en 60 s · peor caso de memoria 195,84 MB a 48 kHz (≤ 220) · limitador −0,342 dBFS · cola y tomas exactas a la muestra, deriva 0 en 10 min · `LoopCore` minificado 34,1 kB · 314 tests en Node (98,35 % de sentencias y 94,38 % de ramas en el TS puro) + 31 en Angular + 31 e2e |
| 2 · Motor en el navegador, archivos e instrumento HTML (`fase-2-motor-navegador`, fusión `40d75e5`) | 2026-10-26 | CAMBIOS NECESARIOS: 0 Bloqueantes; los 6 Importantes, los 8 Menores de código y las 6 Sugerencias, corregidos o anotados (la #20, para la fase 5.a; la mitad de la #21, decisión de Iván) ([revisión](../revisiones/fase-2.md), [informe](fase-2.md)) | primer sonido tras pulsar 7–14 ms · toma alineada a −2 muestras (0,04 ms) tras calibrar · mezcla exportada = render del núcleo (≤ 1 LSB de 24 bits) · remuestreo: 15 kHz a 0,00 dB, imágenes < −87 dB · copia de la sesión por tramos: peor bloque 0,26 ms (de golpe, 7,8 ms) · 1000 `.torno` malformados rechazados · 0 peticiones de red al grabar, guardar y exportar · CI de `main` en verde, con WebKit y audio en Linux · JS de `/` 301,4 kB · desbloqueo 1,8 kB · worklet 37,7 kB · worker de exportación 38,6 kB · `LoopCore` a 204–233× · 398 tests en Node (98,23 % de sentencias y 94,65 % de ramas en el TS puro) + 41 en Angular + 81 e2e · axe: 0 violaciones |
| 3 · Biblioteca de sonidos y menú completo (`fase-3-sonidos`, fusión `acef572`) | 2026-10-26 | CAMBIOS NECESARIOS: 0 Bloqueantes; el Importante (clic con saltos de tempo grandes y el filtro antialias encendido), los 6 Menores y 1 de las 2 Sugerencias, corregidos; la #9, razonada ([revisión](../revisiones/fase-3.md), [informe](fase-3.md)) | 12 bucles propios en Re menor a 90 BPM, deterministas (hash fijado) y sin junta · picos −1,1 a −14,1 dBFS, RMS en su objetivo por papel · fundamentales de los bajos, nota a nota, a ≤ 15 cents · render ≤ 32 ms en caliente a 48 kHz (en frío, hasta 43–61 ms; a 96 kHz, hasta 93) · tono de 12 kHz a 240 BPM: imagen a −68,7 dB · LoopCore 237× (97 BPM), 65× a 240 BPM, 36× en el peor caso · la cola entra en la muestra 128 000 (el compás siguiente) · JS de `/` 301,5 kB · worklet 40,8 kB · worker de exportación 41,7 kB · worker de síntesis 17,4 kB · 430 tests en Node (98,4 % de sentencias) + 50 en Angular + 89 e2e |

## Bloques

### Bloque 0 · 2026-10-24 · terminado (parada de fin de bloque)

**Hecho.** Fase 0 completa y fusionada en `main`:
- Repositorio con el plan como primer commit.
- Angular 22 estático y zoneless con las tres rutas prerenderizadas.
- ESLint que hace cumplir las capas de §4.2 (también `import()`, `new URL()` de los workers y rodeos por `window.`).
- tsconfig sin DOM para el TS puro y dos ejecutores de Vitest (Node para el núcleo, jsdom para Angular).
- Presupuestos de §5 comprobados con el metafile del build y CI con acciones fijadas por SHA.
- Las dos pruebas técnicas de riesgo superadas: el **AudioWorklet** (compilado con esbuild y con hash) y el **worker de síntesis** funcionan en `ng serve` y en el build estático. El contexto se crea y se reanuda dentro del `click` y no espera al módulo.
- `docs/DISENO.md` con la dirección «Barro», contrastes AA comprobados por test, Fraunces (eje `SOFT`) y Geist Mono autoalojadas, y materiales de partida del instrumento.

**Métricas.** Las de la fila de la fase 0. Además:
- **Tiempos:** e2e 31/31 en 15,4 s y `npm run check` completo en 21 s (medido en `main` tras la fusión, en el PC de Iván).
- **Calidad:** cobertura del TS puro del 100 % en líneas y del 94 % en ramas.

**Desviaciones** (detalle en el informe, §4):
- Regla de capas propia en ESLint, en lugar de `no-restricted-imports`.
- `audio/engine/index.ts` como API diminuta en el bundle inicial, con la implementación cargada con `import()`.
- Fraunces con todos los ejes (121 kB), sin cursiva.
- `noindex` en todo hasta el lanzamiento.
- Licencias de terceros publicadas en `licencias/`.
- Dos límites de Chromium con Playwright, ya resueltos en los tests:
  - no deja ver ni retrasar la descarga del módulo del worklet (se instrumenta `addModule`);
  - deja sonar un contexto sin gesto (se comprueba con `window.event`).

**Para la sesión de revisión del bloque** (informe, §9 y §10):
- **Margen del JS inicial:** quedan 6,5 kB hasta el aviso, porque Angular ya ocupa casi todo.
- **Fase 2:**
  - con la repetición de eventos de la hidratación, un toque antes de hidratar se repite fuera del gesto (riesgo en iOS);
  - los errores del motor deberían ser códigos traducidos desde un archivo de contenido.
- **Fase 4:**
  - CSP con los scripts en línea de Angular;
  - aviso de `npm audit` de `vite` dentro de `@angular/build`, que solo afecta al servidor de desarrollo.
- **Cuatro propuestas de cambio al plan:**
  - patrón de las API de `index.ts`;
  - retraso del worklet por instrumentación;
  - definición del «JS inicial»;
  - activar la indexación en la fase 9.

**Pendientes para Iván** (`docs/PENDIENTES.md`):
- **Ahora:** mirar `docs/DISENO.md` y las capturas de `docs/informes/img/fase-0/`: paleta, Fraunces con `SOFT` y Geist Mono.
- **Antes del bloque A (si quieres cambiarlo):** el autoguardado, que por defecto está activado.
- **Antes del bloque B (fase 4):**
  - GitHub CLI y el repo privado;
  - staging en cPanel con AutoSSL, contraseña, FTP limitado y secrets;
  - un iPhone y unos auriculares con cable.
- **Decisiones abiertas:**
  - subdominio definitivo;
  - licencia del código;
  - `@lhci/cli` (fase 8);
  - indexación al lanzar (fase 9).

**Siguiente.** Revisión del bloque 0 por la sesión de plan (`docs/revisiones/bloque-0.md`). Después, el bloque A (fases 1 y 2) con el prompt de `docs/prompts/PROMPTS.md`.

### Bloque A · 2026-10-26 · terminado (parada de fin de bloque)

**Hecho.** Fases 1 y 2 completas y fusionadas en `main`. Torno ya se toca en el navegador, con el instrumento HTML:
- **Fase 1, núcleo de audio en TS puro** (`LoopCore`, PLAN §4.4): transporte por muestras sin deriva, 4 capas con lectura de Hermite, *varispeed*, reverso, juntas, filtro SVF, limitador, metrónomo y cuenta previa, tomas libres y fijas, sobregrabación, deshacer con copia en escritura, cola exacta al compás, disco y bloqueos. Todo probado a nivel de muestras en Node.
- **Fase 2, motor en el navegador:**
  - desbloqueo nativo en el gesto (1,8 kB en el inicial), que reintenta en cada gesto mientras el contexto no suena;
  - `AudioEngine` con el núcleo en el AudioWorklet: 5 s de espera con «Reintentar», interrupciones, reposo y pestaña oculta;
  - micrófono solo al grabar y suelto siempre; latencia automática, calibrada por clic y manual;
  - `.torno` validado entero, WAV de 24 bits y pistas en ZIP con el mismo núcleo, y autoguardado en IndexedDB;
  - modelo del instrumento en TS puro (catálogo, gestos, menú, pantalla y atajos) y `SessionStore` con signals ≤ 10/s;
  - instrumento HTML accesible en la portada, diferido con `@defer`.

**Métricas.** Las de las filas de las fases 1 y 2. Además:
- **Tiempos:** e2e 81/81 en 57 s y `npm run check` completo en 76 s (en `main` tras la fusión, en el PC de Iván con otras aplicaciones abiertas).
- **CI de `main`:** en verde en GitHub Actions (`40ae336`): lint, tests, build, presupuestos y 81 e2e en 2,4 min, sin reintentos, con WebKit de Linux reproduciendo y pausando con audio. Para llegar ahí, cuatro commits en `main` tras la fusión (informe de la fase 2, #14):
  - la prueba de WebKit ya no puede pasar sin audio fuera de Windows;
  - los tests del DSP en Node tienen 120 s de límite (uno, que tarda 19 s con la cobertura, se pasó de 30 en un runner lento);
  - los fallos de los e2e salen como anotaciones del commit (reporter `github`), que se leen sin credenciales;
  - el e2e del autoguardado espera a que termine el borrado antes de recargar. Era una carrera del test, no un fallo del flujo: reproducida en local frenando la CPU (6 de 6) y arreglada (6 de 6).

  En el CI siguiente, también en verde, la prueba del micrófono sintético pasó al reintentar: la captura falsa de Chromium había perdido o repetido un bloque de 10 ms (441 muestras a 44,1 kHz), lo mismo que se vio en local con el PC cargado. La prueba admite ahora como mucho un salto de 10 ms justos (`c85c42f`).

**Desviaciones** (detalle en los informes, §4):
- **Fase 1:**
  - la junta del bucle se cruza al grabar (10 ms, tras la revisión), no al leer;
  - fundidos de 10 ms en los cambios;
  - el «heap estable», medido con el perfil de muestreo de V8;
  - campos privados de JavaScript (`#campo`), que esbuild acorta;
  - banco de rendimiento aparte (`npm run test:bench`).
- **Fase 2:**
  - la alineación de ±2 ms se prueba con un retorno determinista (`DelayNode`), no con el micrófono sintético;
  - el WebKit de Playwright para Windows no tiene Web Audio: reproducir y pausar con audio solo se prueban en el CI de Linux;
  - el worker de exportación se crea al arrancar el motor, para que exportar no haga peticiones de red;
  - un sonido de prueba por categoría;
  - `@defer` cuesta unos 10 kB en el `main`;
  - token nuevo `--instrument-plate`, para el contraste AA del instrumento HTML;
  - en el menú, la flecha abajo va al elemento siguiente.

**Para la sesión de revisión del bloque** (informes, §9 y §10):
- **Propuestas de cambio al plan:**
  - Fase 1: la junta de 10 ms al grabar y la regla de la toma libre (§4.4), y el «heap estable» con el perfil de V8.
  - Fase 2:
    - si la latencia del micrófono cambia en cada apertura, mantenerlo abierto entre tomas o recalibrar con la cuenta previa (lo decide Iván con las medidas de la fase 4);
    - el criterio de alineación: ±2 ms con un retorno determinista en el e2e y ±5 ms en dispositivos reales;
    - anotar en §5 lo que cuesta `@defer`;
    - el pico de memoria de una copia de la sesión que coincide con el principio de una toma: 241,92 MB, por encima de los 220 de §5, durante menos de 1 s y solo en el peor caso.
- **Riesgos y avisos:**
  - el worklet (37,7 kB) y el worker de exportación (38,6 kB) están cerca de los 40 kB: los dos llevan el núcleo entero;
  - con el PC muy cargado (otras aplicaciones al 83 % de CPU), el banco bajó a 27–50× (el test pide ≥ 100×) y un e2e del micrófono sintético perdió un bloque de captura de 10 ms. Con el PC tranquilo: 204–233× y 8 de 8. En el CI, el banco pasó en las cuatro ejecuciones en las que llegó a correr;
  - los runners de GitHub son más lentos e irregulares que el PC: los tests que dependen del tiempo (banco, copia por tramos < 2 ms y esperas de los e2e) son los primeros candidatos si el CI vuelve a fallar;
  - la maqueta 2D recuerda en parte la distribución del original (revisión de la fase 2, #20): se alinea en la fase 5.a.
- **Para la fase 3:**
  - los 12 bucles sustituyen a los de prueba (mismos ids por categoría) y se sintetizan sin junta, con un test;
  - el alias del *varispeed* hacia arriba a 240 BPM (revisión de la fase 1, #14);
  - el tempo por pulsaciones y la primera reproducción con la batería en la capa 1.
- **Para la fase 4:**
  - la CSP y el `.htaccess`, con el worklet, los dos workers y `blob:`;
  - en la lista de los móviles: tomas seguidas tras calibrar y 5 min sin cortes con capas largas.

**Pendientes para Iván** (`docs/PENDIENTES.md`):
- **Ahora:** probar el instrumento (`npm start`, sección «Tócalo») y mirar las capturas de `docs/informes/img/fase-2/`: en reposo, menú, atajos, cargando, error y recuperar.
- **Decisión nueva:** qué hacer con el autoguardado mientras el panel de recuperar sigue sin contestar. La propuesta es un segundo hueco en IndexedDB.
- **Antes del bloque B (fase 4):**
  - GitHub CLI y `gh auth login`;
  - staging en cPanel con AutoSSL, contraseña, FTP limitado y secrets;
  - un iPhone y unos auriculares con cable.

  Si no están, la fase 4 se aplaza.
- **Decisiones abiertas:**
  - subdominio definitivo;
  - licencia del código;
  - `@lhci/cli` (fase 8);
  - indexación al lanzar (fase 9);
  - tras la fase 4, el micrófono entre tomas.

**Siguiente.** Revisión del bloque A por la sesión de plan (`docs/revisiones/bloque-A.md`). Después, el bloque B (fases 3 y 4) con el prompt de `docs/prompts/PROMPTS.md`.

### Bloque B · 2026-10-26 · terminado con la fase 4 aplazada (parada de fin de bloque)

**Hecho.**
- **Revisión del bloque A**, aplicada en `main` (respuesta al final de `docs/revisiones/bloque-A.md`):
  - el banco de rendimiento fuera de `check`, y en el CI con un suelo de 50×;
  - worklet y workers a 60 kB;
  - CI en `ubuntu-24.04`;
  - autoguardado con dos huecos (decisión de Iván): mientras el panel de recuperar sigue sin contestar, lo nuevo va al segundo hueco; «Recuperar» pide confirmación si la sesión actual tiene sonido.
- **Fase 3, fusionada:**
  - síntesis propia en TS puro y la colección de 12 bucles (BATERÍA ALFAR, HORNO y ADOBE; BAJO RAÍZ, CINCA y SURCO; ACORDES OLIVO, VEGA y ALMENDRO; TEXTURA CIERZO, ACEQUIA y BRASA);
  - el *varispeed* ya no pliega frecuencias al acelerar (Chebyshev II en secciones TPT antes de interpolar);
  - la primera reproducción arranca con ALFAR y deja elegida la capa 2;
  - BUCLE → MARCAR TEMPO;
  - `npm run demo:sounds` para escuchar la colección.
- **Fase 4, aplazada** (CLAUDE.md, «Decisiones ya tomadas»): el repo no tiene secrets (`gh secret list` vacío) y `staging-torno.ivanchesa.es` no resuelve. No he tocado nada de la fase 4.

**Métricas.** Las de la fila de la fase 3. Además: `npm run check` en 72 s y `npm run e2e` 89/89 en 1,1 min (PC de Iván).

**Desviaciones** (detalle en el informe de la fase 3, §4):
- ids nuevos para la colección (la misma estructura por categoría);
- «MARCAR TEMPO» como nombre del tempo por pulsaciones;
- el banco de la síntesis empaquetado como el worker (script, no Vitest), con el criterio medido en caliente.

**Para la sesión de revisión del bloque** (informe de la fase 3, §9 y §10):
- **Propuestas de cambio al plan:**
  - anotar en §5 la CPU a 240 BPM con el filtro (65×; peor caso 36×);
  - el criterio de −60 dB se refiere a las imágenes del plegado, no a las de la interpolación de Hermite;
  - el render ≤ 50 ms, medido en caliente y a 48 kHz (en frío llega a 43–61 ms; a 96 kHz, a 93).
- **Riesgos:**
  - el filtro en el peor caso (grabaciones de 40 BPM a 240, 4 capas) puede pesar en un móvil de gama media: entra en la prueba de 5 min de la fase 4;
  - la primera reproducción en frío (crear el worker y renderizar ALFAR) no está medida en un móvil;
  - el desbloqueo del bundle inicial está en 1,9 kB de 2.
- **Fase 4:** sigue todo pendiente (CSP, `.htaccess`, despliegue, Dependabot y móviles). Las partes que no necesitan credenciales (`.htaccess`, CSP con su e2e, Dependabot) se podrían adelantar si Iván quiere, aunque el staging no esté.

**Pendientes para Iván** (`docs/PENDIENTES.md`):
- **Ahora:** escuchar la colección con `npm run demo:sounds` (12 bucles y 3 combinaciones en `demo-sounds/`) y decir qué cambiar; mirar las capturas de `docs/informes/img/fase-3/`.
- **Para la fase 4 (y antes del bloque C):**
  - staging en cPanel: `staging-torno.ivanchesa.es` con AutoSSL, contraseña y FTP limitado;
  - los secrets con `gh secret set` (GitHub CLI ya está autenticado);
  - un iPhone y unos auriculares con cable.
- **Decisiones abiertas:** subdominio definitivo, licencia, `@lhci/cli` (fase 8), indexación al lanzar (fase 9) y el micrófono entre tomas (tras la fase 4).

**Siguiente.** Revisión del bloque B por la sesión de plan. Después, la fase 4 en cuanto estén el staging y los secrets. El bloque C no puede empezar sin las pruebas de la fase 4 en móviles.
