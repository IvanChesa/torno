# Diario

Lo escribe Claude Code (CLAUDE.md, «Ciclo de cada fase» y «Paradas»):

- **Al fusionar cada fase**, una fila en «Fases».
- **Al terminar cada bloque** (o en una parada), un apartado en «Bloques» con lo hecho, las métricas, las desviaciones y lo pendiente para Iván.

## Fases

| Fase | Fecha | Veredicto de la revisión | Métricas clave |
|---|---|---|---|
| 0 · Cimientos y pruebas técnicas (`fase-0-cimientos`, fusión `1924d2a`) | 2026-10-24 | CAMBIOS NECESARIOS: 0 Bloqueantes; los 2 Importantes y los 8 Menores, corregidos ([revisión](../revisiones/fase-0.md), [informe](fase-0.md)) | JS inicial de `/` 293,5 kB (aviso a 300) · desbloqueo de audio 0,7 kB · worklet 1,9 kB · worker 1,3 kB · fuentes 144,1 kB · pitido por el worklet −12,0 dBFS y 24.000/24.000 muestras · tono del worker 48.000/48.000 en 5,2 ms · 122 tests en Node (100 % de líneas en el TS puro) + 31 en Angular + 31 e2e · axe: 0 violaciones |
| 1 · Núcleo de audio en TS puro (`fase-1-nucleo-audio`, fusión `e170652`) | 2026-10-24 | CAMBIOS NECESARIOS: 0 Bloqueantes; los 2 Importantes, los 10 Menores y 3 de las 4 Sugerencias, corregidos (la #14 queda para la fase 3) ([revisión](../revisiones/fase-1.md), [informe](fase-1.md)) | `LoopCore` a 240–242× tiempo real · 0,0 KiB reservados por `process()` en 60 s · peor caso de memoria 195,84 MB a 48 kHz (≤ 220) · limitador −0,342 dBFS · cola y tomas exactas a la muestra, deriva 0 en 10 min · `LoopCore` minificado 34,1 kB · 314 tests en Node (98,35 % de sentencias y 94,38 % de ramas en el TS puro) + 31 en Angular + 31 e2e |

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
