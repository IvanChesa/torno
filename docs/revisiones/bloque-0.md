# Revisión: Bloque 0
Veredicto: APROBADO (el hallazgo 1, del entorno, ya está resuelto)

La fase 0 es de mucha calidad y cumple todos sus criterios con evidencias reales. Las dos pruebas técnicas de riesgo están resueltas: el AudioWorklet compilado con esbuild y el worker. La revisión del subagente fue rigurosa y sus 2 Importantes y 8 Menores están bien corregidos. Lo único que impedía seguir no venía del bloque: eran unos archivos de Codex que aparecieron después (hallazgo 1). Ya están borrados.

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
| 1 | Bloqueante (entorno, no del código del bloque) | `AGENTS.md`, `.agents/`, `.codex/` (sin seguimiento) | Aparecieron el 24-10 a las 13:42, después del bloque, por una conversión automática de la configuración de Claude Code a la de Codex. **`npm run check` falla en `main`**: Prettier revisa 33 archivos de `.agents/skills/`. Además: (a) `AGENTS.md` está mal convertido: dice que la revisión la hace «otra sesión de Codex» y que las skills están en `.Codex/skills/` (no existe); (b) el repo de GitHub es público y un `git add .` subiría 5 MB de skills de terceros. | Lo que decida Iván (abajo). En cualquier caso: `.agents/` y `.codex/` fuera de git, de Prettier y de ESLint, y `npm run check` en verde antes de empezar la fase 1. |
| 2 | Importante | `scripts/check-bundles.mjs`, PLAN §5 | **El margen del JS de la primera visita se acaba.** `/` pesa 293,5 kB con el aviso a 300. Con la definición estricta (que aceptamos, propuesta 3), el chunk de la portada cuenta, y crece en la fase 2 (instrumento HTML) y en la 7 (web). | PLAN §5 actualizado: aviso > 330 kB, error > 400 kB, y lo que no se ve en la primera pantalla va en `@defer`. Actualizar los umbrales de `check-bundles.mjs` y su test. El presupuesto `initial` de `angular.json` (la definición de Angular) se queda en 300/400. |
| 3 | Importante (para la fase 2) | `src/app/app.config.ts:15`, `src/app/audio/engine/unlock.ts` | **Desbloqueo del audio en iOS.** Lo apuntó la propia fase. Con `withEventReplay()`, un toque anterior a la hidratación se repite fuera del gesto. Hoy el desbloqueo se llama desde un `(click)` de Angular, que pasa por esa repetición. Además, en iOS el interruptor de silencio silencia Web Audio salvo que `navigator.audioSession.type` sea `playback`, y eso tiene que ponerse en el gesto. | PLAN §4.9, la fase 2 (tarea 1) y sus criterios están actualizados: escucha nativa en fase de captura sobre `[data-audio-unlock]`, `audioSession.type = 'playback'` en el mismo gesto, aviso «Toca para activar el sonido» si el toque llegó antes del JS, y un e2e nuevo. |
| 4 | Menor | `src/app/audio/worklet/processor.ts:61` | `postMessage` desde `process()` reserva memoria (clonado estructurado). Es inevitable para avisar al hilo principal, pero la regla de `CLAUDE.md` lo prohibía sin excepción. | `CLAUDE.md` lo admite ahora como única excepción: eventos agrupados, ≤ 30/s y reutilizando el objeto. En la fase 1, que el ritmo lo marque un contador de muestras, nunca un mensaje por bloque de 128. |
| 5 | Menor | `src/app/core/site.config.ts` (`legal`) | Los enlaces legales apuntan a `/aviso-legal/`, `/privacidad/` y `/cookies/` de ivanchesa.es, que se está rediseñando en otra sesión. Hoy responden 200, pero pueden cambiar. | Comprobarlos en la fase 9 (tarea añadida al plan). Si cambian antes, se toca solo `site.config.ts`. |
| 6 | Sugerencia | PLAN fase 8 | La sugerencia 12 del subagente (foco al navegar dentro de la SPA) solo estaba en el informe. | Añadida a la fase 8, tarea 3. |

## Propuestas del informe (§10)
1. **Patrón de las API de `index.ts`:** aceptada (PLAN §4.2).
2. **Retraso del worklet por instrumentación de `addModule`:** aceptada (criterio de la fase 2 reescrito, con `window.event` y control negativo).
3. **Definición del «JS inicial»** como la primera visita a cada ruta: aceptada, con umbrales 330/400 (hallazgo 2).
4. **Indexación en la fase 9:** aceptada (fase 9, tarea 4).

## Cambios ya hechos en los documentos (sin commit)
La sesión de revisión ha editado:
- `docs/PLAN.md`: §3, §4.2, §4.9, §5 y las fases 2, 4, 8 y 9.
- `CLAUDE.md`: la excepción del `postMessage`.
- `docs/PENDIENTES.md` y `docs/prompts/PROMPTS.md`: el repo de GitHub.

También ha borrado `AGENTS.md`, `.agents/` y `.codex/` (decisión de Iván).

Revisa el diff y haz commit con `docs: plan tras la revisión del bloque 0`, junto con esta revisión.

## Qué he comprobado
- **Estado:** el bloque terminó a las 02:35. `fase-0-cimientos` está fusionada en `main` (`1924d2a`), `DIARIO.md` está completo y `git status` solo muestra los archivos del hallazgo 1.
- **Checks propios en `main`:**
  - `npm test`: 122 tests en Node (líneas 100 %) y 31 en Angular.
  - `npm run build`: 3 rutas prerenderizadas.
  - `check-bundles`, sin avisos: `/` 293,5 kB, desbloqueo 0,7 kB, worklet 1,9 kB, worker 1,3 kB y fuentes 144,1 kB.
  - `npm run e2e`: **31/31**.
  - Prettier sin `.agents/` ni `.codex/`: en verde. Con ellos, falla (hallazgo 1).
- **Código del audio**, leído entero (`unlock.ts`, `index.ts`, `probe.ts`, `processor.ts`, `beep.ts`, `protocol.ts`):
  - el desbloqueo es síncrono y va antes de cualquier `await`;
  - el patrón de `index.ts` mantiene el motor fuera del inicial;
  - el worklet no reserva memoria salvo el `postMessage` (hallazgo 4);
  - las sondas tienen tiempos de espera;
  - el protocolo está versionado.
- **Build del worklet:** con hash, borra las versiones antiguas, en modo vigilancia con `ng serve` y antes de `lint`, `test`, `build` y `e2e`.
- **CI:** acciones fijadas por SHA y `persist-credentials: false`; corre en `main` y en los PR.
- **Diseño:** he revisado las capturas de escritorio y móvil y `DISENO.md` §7 (materiales del instrumento). La paleta «Barro» funciona: fondo de olivar, tinta de hueso, terracota solo en acciones, y Fraunces con `SOFT`. La tabla de materiales PBR y las tres variantes son una buena base para la fase 5.a. Nada recuerda al original.

## Decisiones de Iván (24-10)
- **Codex** (hallazgo 1): no se usa en este proyecto. La sesión de revisión ya ha borrado `AGENTS.md`, `.agents/` y `.codex/`, y Prettier vuelve a estar en verde. Para que no se repita, añade `AGENTS.md`, `.agents/` y `.codex/` a `.gitignore` y a `.prettierignore`.
- **Repo de GitHub:** se conecta **ya**, al empezar el bloque A.
  - Añade el remoto `https://github.com/IvanChesa/torno.git` y sube `main` (con este commit de la revisión).
  - Desde ahí, el ciclo hace push de `main` tras cada fusión, y el CI corre en GitHub desde el bloque A.
  - El repo es **público**: nada de secrets, y `.claude/skills/` sigue fuera de git.
  - Si el push pide credenciales que no tienes, es una condición de parada: avísame en el chat.
- **Licencia:** pendiente. Mientras no haya `LICENSE`, el código queda con todos los derechos reservados.
- **Autoguardado:** sin cambios; activado por defecto (D16).
