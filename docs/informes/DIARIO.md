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
| 4 · Vista previa en Cloudflare Pages, entrega continua y pruebas en el móvil (`fase-4-staging`, fusión `45c5df7`) | 2026-10-27 | CAMBIOS NECESARIOS: 0 Bloqueantes; el Importante (la lista de proyectos de la cuenta habría salido en el registro público), los 6 Menores y 6 de las 8 Sugerencias, corregidos; la #10, para la fase 7, y la #14, propuesta a Iván ([revisión](../revisiones/fase-4.md), [informe](fase-4.md)) | `staging.torno.pages.dev` publicada con el build que probó el CI: `verify-pages` 52/52 (50/50 en local) · rutas sin barra final (308), 404 propia y CSP con 3 hashes · 24 archivos, el mayor 0,28 MiB de 25 · e2e 97/97, 57 de ellos contra `wrangler pages dev` · JS de `/` 302,1 kB · desbloqueo 1,9 kB · worklet 40,8 kB · worker de exportación 41,7 kB · 453 tests en Node + 67 en Angular · primera reproducción en frío hasta el altavoz: 157–238 ms en el escritorio y 203–251 ms en el CI |
| 5 · Diseño del instrumento y modelo 3D (`fase-5-modelo-3d`, fusión `673ad51`) | 2026-10-31 | CAMBIOS NECESARIOS: 0 Bloqueantes; los 2 Importantes (los medidores pisaban los pilotos del plato y el lienzo cortaba la sombra de contacto), los 5 Menores y 3 de las 4 Sugerencias, corregidos; la #11 (commits más pequeños), para la fase 6 ([revisión](../revisiones/fase-5.md), [informe](fase-5.md)) | aparato redondo aprobado por Iván (Terracota, Neutral) · 51 llamadas de dibujo; 49 158, 36 498 y 25 454 triángulos por nivel · VRAM estimada de 61,2 MB en alto y 36,3 MB en bajo en el escritorio · generación 71–85 ms · tarea más larga del arranque 53–63 ms (antes, 610–630 en frío) · 144 fps en el escritorio (RTX 3060) · chunk 3D 622,6 kB · JS de `/` 303,7 kB · primera visita de 594 kB sin el 3D y 1,22 MB con él · 518 tests en Node + 70 en Angular + 107 e2e · el compás, exacto a la muestra a cualquier tempo |
| 6 · Interacción y sincronía (`fase-6-interaccion`, fusión `cc4f6be`) | 2026-10-31 | CAMBIOS NECESARIOS: 0 Bloqueantes; los 2 Importantes (en «Capas» la página se ensanchaba; el plato HTML no tenía «Pausar movimiento»), 11 de los 12 Menores y la Sugerencia, corregidos; el #13 (320 px), para Iván ([revisión](../revisiones/fase-6.md), [informe](fase-6.md)) | el 3D es el instrumento: controles nativos encima de cada pieza (ratón, dedo y teclado) · zonas de 44 px sin pisarse en 360 y 390 px · disco = transporte 0,00 % con la GPU (±1 % en Node con estados que llegan tarde) · respuesta tecla → audio 0,4–1,1 ms y ratón 3,9–4,3 ms · 0 animaciones con «Pausar movimiento» o movimiento reducido · pantalla del 3D a 10 px de cuerpo en el escritorio (antes ~5) · primera visita sin el 3D 596,0 kB y con él 1328,9 kB · chunk 3D 650,7 kB · JS de `/` 306,6 kB · 144 fps · tarea más larga 57–64 ms · VRAM 60,6 MB en alto · 551 tests en Node + 72 en Angular + 130 e2e |

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

### Fase 4, entrega 4.a · 2026-10-26 · parada (sin credenciales; la 4.b espera al staging)

**Hecho.**
- **Revisión del bloque B:** el plan y la revisión, en `main` (`b255c2d`). El CI de `main` que se había colgado instalando los navegadores se canceló y el siguiente salió en verde.
- **Entrega 4.a**, en la rama `fase-4-staging` (sin fusionar: la fase se revisa y se fusiona en la 4.b):
  - CI con caché de los navegadores de Playwright, 10 min como mucho para instalarlos y también en las ramas de fase. En `main`, el build se guarda como artefacto para el despliegue.
  - `public/.htaccess`:
    - HTTPS, URLs sin barra y 404;
    - caché `immutable` para lo que lleva hash y `no-cache` para el HTML;
    - Permissions-Policy, nosniff, COOP/CORP y HSTS;
    - una CSP con `script-src 'self'` y los hashes de los scripts en línea, que el build calcula y escribe (`scripts/htaccess.mjs`).
  - El servidor local sirve el build con esas cabeceras: los 55 e2e del build y el de WebKit corren bajo la CSP de producción, sin ninguna violación (con control negativo).
  - `deploy-staging.yml`, escrito e inactivo sin secrets: sube por FTPS el artefacto del CI, con noindex y la contraseña de cPanel.
  - Dependabot.
  - `docs/PRUEBAS-MOVIL.md`, con 14 pruebas, y el panel `?diagnostico=1`. El panel mide del toque al primer sonido hasta el altavoz, con la hora del propio audio, y copia el informe sin red.

**Métricas.**
- `npm run check` en 66 s: 442 tests en Node y 65 en Angular.
- e2e: 96/96 en 65 s.
- CI de la rama en verde: 4 min 22 s sin caché y 4 min 51 s con ella.
- Presupuestos: JS de `/` 302,1 kB y motor 22,3 kB; desbloqueo 1,9 kB, sin cambios.
- Primera reproducción en frío en el escritorio: 157–238 ms hasta el altavoz; después, 48–54 ms.

**Desviaciones** (informe de la fase 4, §4):
- el CI también corre en los *push* a `fase-*`;
- la CSP se completa en el build, no con `autoCsp`;
- el despliegue sube el artefacto del CI;
- la contraseña del staging la vuelve a poner el despliegue;
- el panel mide hasta el altavoz.

**Para la sesión de revisión** (§10): propuesta de precargar ALFAR ya en la 4.b. En el escritorio, la primera reproducción en frío ya pasa de los 150 ms de la revisión del bloque B, #2.

**Pendientes para Iván** (`docs/PENDIENTES.md`): el staging en cPanel (subdominio con AutoSSL, privacidad de directorios y FTP limitado) y los cuatro secrets: `STAGING_FTP_SERVER`, `STAGING_FTP_USERNAME`, `STAGING_FTP_PASSWORD` y `STAGING_AUTH_USER_FILE`. Después, las pruebas de `docs/PRUEBAS-MOVIL.md` en Android e iPhone.

**Siguiente.** Con el staging listo, el prompt de la 4.b (`docs/prompts/PROMPTS.md`).

### Bloque B, cierre con la fase 4 · 2026-10-27 · terminado (parada de fin de bloque)

**Hecho.**
- **Plan:** Iván cambia el hosting a Cloudflare Pages (D19) y pone los secrets. Sus cambios en el plan, `CLAUDE.md`, los pendientes y los prompts van en un commit aparte (`3d4e8c3`).
- **Entrega 4.b; fase 4 revisada y fusionada** (`45c5df7`):
  - el build se prepara para Pages tras el prerenderizado (`scripts/pages.mjs`): rutas como `ruta.html` (URLs sin barra final), `404.html` en la raíz, fuera `index.csr.html` y `_headers` con la CSP por hashes de la 4.a. Se borran el `.htaccess` y sus scripts;
  - `check-bundles` añade los límites de Pages (25 MiB por archivo y 20 000 archivos);
  - los 57 e2e del build y las capturas corren contra `wrangler pages dev` (`scripts/serve-pages.mjs`), que aplica las reglas de Pages;
  - `deploy.yml` sustituye al FTPS. Con el CI de `main` en verde, publica su artefacto en `staging.torno.pages.dev` y lo comprueba con `scripts/verify-pages.mjs`. Pregunta a la API solo por el proyecto `torno` y usa el wrangler del `package-lock.json`, sin el token en el entorno.
- **Revisión de la fase 4:** CAMBIOS NECESARIOS, sin Bloqueantes. Corregidos el Importante (la lista de proyectos de la cuenta habría salido en el registro público), los 6 Menores y 6 Sugerencias. Entre ellos, «en frío» del panel ya es la primera reproducción, y la medida empieza en el toque.
- **CI de `main` tras la fusión:** los dos intentos se colgaron instalando los navegadores, porque el espejo de `apt` de Azure se paraba a mitad de una descarga y en `main` aún no había caché. Corregido en `main` (`b434f25`): `apt` con 20 s de tiempo límite, 5 reintentos y sin *pipelining*. Como el espejo volvió a colgarse a cuentagotas en el CI de `79e3eed` (solo documentos: el despliegue se saltó y la vista previa siguió con el mismo build), cada instalación va ahora en intentos de 3–4 min, hasta 3 (`scripts/ci-playwright.sh`). Tras un intento cortado, cierra aparte el `apt-get` que lanza Playwright con `sudo` (el primer intento de la corrección chocó con él) y pasa a `archive.ubuntu.com`.
- **La vista previa:** `https://staging.torno.pages.dev`, publicada por `deploy.yml`, que creó el proyecto en el primer despliegue. La comprobé con el artefacto desplegado: 52 de 52 (rutas, 308, 404, CSP, `noindex`, `http` → `https`, sin cookies y el HTML idéntico al del CI). La comprobación del propio job falló esa primera vez por un corte de TLS: el certificado recién emitido aún no estaba en todos los nodos de Cloudflare. `verify-pages` ya reintenta esos cortes (`e71669a`). El segundo despliegue (`cbf0849`) sale en verde de principio a fin: 52 de 52 en el propio job.

**Métricas.** Las de la fila de la fase 4. Además:
- **Tiempos:** `npm run check` en 80 s y e2e 97/97 en 1,2 min (PC de Iván); CI de la rama en 6 min 16 s (e2e en 3,0 min).
- **Primera reproducción en frío, hasta el altavoz:** 157–238 ms en el escritorio y 203–251 ms en el CI de Linux.

**Desviaciones** (informe de la fase 4, §4):
- la comprobación en la vista previa va tras la fusión, porque el `workflow_run` solo usa el flujo de `main`;
- la versión de wrangler del despliegue sale del `package.json` del commit probado;
- el despliegue comprueba la vista previa cada vez;
- el HTML lleva la caché por defecto de Pages (`max-age=0, must-revalidate`);
- sin COOP; CORP se queda;
- «`/_headers` no se sirve» admite el 502 de `wrangler pages dev` en Linux.

**Para la sesión de revisión del bloque** (informe, §9 y §10):
- **Propuesta 1:** aprobar ya la precarga de ALFAR. La primera reproducción en frío pasa de 150 ms ya en el escritorio.
- **Propuesta 2:** vistas previas de las ramas de fase, para probar en el móvil antes de fusionar (fases 5, 6 y 8).
- **Dependabot ya está activo y ha abierto dos PR, que no he tocado:**
  - **#1:** wrangler 4.149.0 → 4.152.0. Ojo: los avisos de `undici` se arreglan en la 4.153.0;
  - **#2:** `@types/node` 22 → 26, una versión mayor que no corresponde (`engines`: Node 22 o 24). He añadido a `dependabot.yml` que no proponga versiones mayores de `@types/node`. Se puede cerrar la #2.
- **Fase 7:** CORP `same-origin` y la imagen Open Graph (revisión, #10).

**Pendientes para Iván** (`docs/PENDIENTES.md`):
- **Ahora:** las pruebas de `docs/PRUEBAS-MOVIL.md` en Android e iPhone, en `https://staging.torno.pages.dev/?diagnostico=1`. Desbloquean el bloque C.
- Decidir las dos PR de Dependabot y la precarga de ALFAR.
- Opcional: Cloudflare Access para la vista previa.

**Siguiente.** Revisión del bloque B por la sesión de plan. El bloque C empieza cuando estén las pruebas en el móvil.

### Bloque C, entrega 5.a · 2026-10-30 · parada prevista (aprobación del diseño)

**Hecho.**
- **En `main`, al empezar el bloque** (revisión del bloque B, fase 4; respuesta al final de `docs/revisiones/bloque-B.md`):
  - los documentos de la revisión y la decisión de Iván: el bloque C empieza sin las pruebas del móvil, que hacen falta antes de la 5.b (`0298e30`);
  - el PR #1 de Dependabot (wrangler 4.152.0), fusionado con su CI en verde (`3bc5bbb`);
  - **vistas previas de las ramas de fase:** un *push* a `fase-*` con el CI en verde se publica en `https://<rama>.torno.pages.dev`; `staging` sigue siendo solo `main` (`7bd30da`);
  - **precarga de ALFAR** al acercarse el puntero, el foco o la vista al instrumento: carga el motor, descarga el módulo del worklet y renderiza ALFAR en el worker, sin contexto ni sonido (`765ba8a`). Destapó una carrera que ya estaba: pausar justo después de arrancar no pausaba. Corregida, con su test.
- **Entrega 5.a** (rama `fase-5-modelo-3d`, sin fusionar; [informe](fase-5.md)):
  - **Torno es redondo**, como un torno de alfarero visto desde arriba: Ø 300 mm y el disco en el centro. Las capas van a la izquierda, las teclas delante y el brazo (una costilla de alfarero) a la derecha. Detrás, la bandeja con la pantalla curva, el dial principal, el volumen y el reposo. Las medidas están en `instrument/layout.ts`, con tests de que todo cabe, nada se solapa y las zonas táctiles de 44 px no se pisan en el móvil;
  - **maqueta 3D en bloques** (`scene/`): piezas torneadas, materiales provisionales en 3 variantes, entorno con PMREM y sombra de contacto. El render es bajo demanda y `dispose()` libera todo;
  - **visor** en la portada con `?maqueta=1`: variante, mapeo de tonos y vista con botones nativos, y lo elegido en la URL;
  - **capturas:** 3 variantes × 4 vistas y Neutral frente a AgX, en escritorio y móvil, con hojas de contactos. También la **propuesta del instrumento HTML** (un plato redondo con las mismas posiciones y la pantalla encima);
  - **publicada** en `https://fase-5-modelo-3d.torno.pages.dev/?maqueta=1`.

**Métricas.**
- **Primera reproducción en frío** (panel de diagnóstico, build estático, escritorio): 200–272 ms sin la precarga y 68–93 ms con ella.
- **Pruebas:** `npm run check` sin errores, con 473 tests en Node (+20) y 74 en Angular (+5); e2e 101/101 en local.
- **Peso:** JS inicial de `/` 302,4 kB (302,1 antes); chunk 3D 631,8 kB (aviso a 800), fuera del bundle inicial.
- **La maqueta:** 44 llamadas de dibujo, 41 234 triángulos y 24–41 ms para generar el modelo y sus texturas.
- **Separación de las zonas táctiles** en el móvil (1,1 px/mm): 49,9 px desde arriba y 45,6 px a 45°.

**Desviaciones** (informe de la fase 5, §4):
- las medidas, en `instrument/` (la fuente única también para el instrumento HTML y la guía);
- la maqueta, en la portada con `?maqueta=1`, sin ruta propia;
- las capturas del 3D, en JPEG, con hojas de contactos;
- en esta entrega, solo las capturas de la maqueta (`--solo=maqueta`).

Además, el e2e del tempo por pulsaciones comprueba ahora el tempo con el momento real de cada pulsación: con la precarga, Playwright espaciaba las pulsaciones algo más de 500 ms en el servidor de desarrollo.

**Para Iván** (`docs/PENDIENTES.md`):
- **Aprobar el diseño** en `https://fase-5-modelo-3d.torno.pages.dev/?maqueta=1`:
  - la distribución redonda;
  - la variante (recomendada: Terracota);
  - el mapeo de tonos (recomendado: Neutral);
  - el instrumento HTML como plato redondo.
- **Las pruebas del móvil** (`docs/PRUEBAS-MOVIL.md`), que hacen falta antes de la 5.b. La prueba 1 ya da la cifra de antes y la de después de la precarga.

**Siguiente.** Con la aprobación y las pruebas del móvil, la 5.b en la misma rama: el modelo definitivo con la variante elegida, `SceneEngine`, la calidad, la pérdida de contexto e `instrument-stage`. Después vienen la revisión de la fase 5, la fusión y la fase 6.

**Después de la parada (30-10).** Iván aprueba el diseño tal cual:
- la distribución redonda;
- la variante Terracota y el mapeo de tonos Neutral;
- el instrumento HTML como plato redondo con la pantalla encima.

La 5.b sigue parada: falta lo otro que pide, las pruebas del móvil en `docs/PRUEBAS-MOVIL.md`, que siguen sin rellenar.

### Bloque C · 2026-10-31 · terminado (parada de fin de bloque)

**Hecho.**
- **Fase 5, fusionada** (`673ad51`): el modelo definitivo (Terracota y Neutral, aprobados por Iván), `SceneEngine`, el escenario en la portada con su póster y el plato HTML redondo. El detalle, en la sección de la entrega 5.a y en su fila.
- **Revisión parcial del bloque C** (`docs/revisiones/bloque-C.md`, con commit en la rama de la fase 6): la fase 5, aprobada. Para la 6 pedía dos cosas: la pantalla legible y la carrera del autoguardado.
- **Fase 6, fusionada** (`cc4f6be`; [informe](fase-6.md), [revisión](../revisiones/fase-6.md)): el 3D es el instrumento de la portada.
  - **Controles:** cada pieza lleva encima su control nativo, con los gestos, el teclado y los nombres del plato HTML. Se toca con el ratón, el dedo y el teclado, con zonas de 44 px como poco en el móvil.
  - **Cámara:** encuadres de «Tocar» (completo, capas y controles, con los del móvil 1:1), «Inspeccionar» con órbita limitada y pantalla completa.
  - **Sincronía:** el disco va al reloj del worklet; los pilotos laten, y la pantalla lleva en todo el ancho la forma de onda, el cabezal y el medidor de cada capa.
  - **«Pausar movimiento»** y movimiento reducido en todo, también en el plato.
  - **La carrera del autoguardado**, corregida y con su test.
  - **Lo común de los dos instrumentos**, en `instrument-common`, y cada uno en su trozo.

**Métricas** (las de la fila de la fase 6):
- disco = transporte con un 0,00 % de diferencia con la GPU, y ±1 % en el test en Node con estados que llegan tarde;
- respuesta de 0,4–4,3 ms;
- zonas de 44 px sin pisarse en 360 px;
- primera visita: 596 kB sin el 3D y 1,33 MB con él;
- 144 fps; chunk 3D de 650,7 kB; JS de `/` de 306,6 kB;
- `npm run check` en verde con 551 tests en Node y 72 en Angular; e2e 130/130, con 3 saltados;
- CI de GitHub en 12 min (los e2e, 9,6 min): los e2e del 3D, con el WebGL por software del CI y uno detrás de otro, se llevan la mayor parte.

**Desviaciones** (informe de la fase 6, §4):
- formas de onda de las cuatro capas (§0.2), no solo de la elegida;
- la pantalla del 3D no se lee en el móvil (4,2 px de cuerpo a 360 px de ancho): se lee el espejo HTML de encima;
- «Inspeccionar» va sin zum: la órbita, a una distancia fija;
- el motor de la 6.a, en un commit;
- el plato HTML ya no pinta los medidores con movimiento reducido.

**Para Iván** (`docs/PENDIENTES.md`):
- **Tocar el 3D en el móvil**: tras la fusión, en `https://staging.torno.pages.dev`.
- **Propuesta 1 del informe de la fase 6:** con los dos huecos de recuperar ofrecidos, lo que se toca espera a que se conteste (añadirlo a PLAN §4.8).
- **Propuesta 2:** el espejo HTML de la pantalla, siempre encima del 3D (decidir en la fase 7, con la maqueta de la web).
- **Las zonas táctiles a 320 px** (revisión de la fase 6, #13): la capa 1 y el volumen se pisan unos 4 px. Encogerlas por debajo de 360 px o dejarlo así; se decide en la fase 8, con tu móvil.
- Siguen para la fase 8 las cifras del móvil: primer sonido en frío, latencia calibrada, tomas seguidas y FPS del 3D tocando.

**Siguiente.** El bloque D (la fase 7: la web de producto, la guía y el contenido). No lo empiezo: espera a la revisión del bloque C y al prompt de Iván.
