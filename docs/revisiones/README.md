# Revisiones

- **Por fase** (`fase-N.md`): las escribe el subagente revisor dentro del ciclo de `CLAUDE.md`.
- **Por bloque** (`bloque-X.md`, del bloque 0 al F): las escribe la sesión de plan y revisión al terminar cada bloque.

Esta lista sirve para que Claude Code sepa de antemano qué se va a mirar.

## Qué se revisa
1. **Criterios de aceptación**: ¿se cumplen y están demostrados en el informe (cifras, salidas, capturas), no solo afirmados?
2. **Corrección del audio**: exactitud a la muestra (cola, tomas, juntas), deriva, clics, *varispeed*, reverso, disco, latencia, bloqueos durante una toma, estados límite (capa vacía, toma de 60 s, tempo 40 y 240, pausa con cola, reposo durante una toma).
3. **Hilo de audio**: `process()` sin reservas de memoria, sin `async` ni `console`; parámetros suavizados; eventos agrupados ≤ 30/s; un solo reloj.
4. **Arranque y micrófono**: contexto creado y reanudado en el gesto antes de cualquier `await`; nada suena ni se pide antes de una acción; el micrófono se libera siempre; interrupciones y pestaña oculta.
5. **Arquitectura**: capas de §4.2, imports prohibidos, `LoopCore` compartido por worklet, exportación y tests; API de `AudioEngine` y `SceneEngine` estrechas y estables; un único modelo del instrumento.
6. **Angular**: signals bien usados (sin `effect()` para derivar estado), zoneless, seguridad en el prerenderizado (`@defer`, `afterNextRender`) y limpieza con `DestroyRef`.
7. **Three.js**: `dispose()` completo, espacio de color y *tone mapping*, DPR, VRAM, draw calls, render bajo demanda (0 fps en reposo) y pérdida de contexto.
8. **Interacción y accesibilidad**: controles nativos proyectados, zonas ≥ 44 px, `touch-action`, teclado completo, foco visible en 3D, `aria-valuetext` y `aria-live` sin ruido, contraste, `prefers-reduced-motion` y «Pausar movimiento».
9. **Rendimiento**: presupuestos de §5, bundle inicial sin `three` ni el motor de audio, arranque sin tareas largas y peso de red.
10. **Diseño visual**: capturas coherentes con `docs/DISENO.md` y con el diseño aprobado del instrumento, jerarquía, estados de carga y error, móvil; **nada que recuerde al original** (paleta, fuentes, distribución, textos).
11. **Archivos y privacidad**: validación completa del `.torno`, WAV correctos, autoguardado borrable, 0 cookies, 0 peticiones a terceros y 0 peticiones al grabar, guardar o exportar.
12. **Contenido**: textos propios según `docs/ESTILO.md`, cifras de la ficha técnica medidas y enlazadas, `FUENTES.md` al día.
13. **Tests**: que prueben comportamiento real con criterios numéricos, no tests triviales.
14. **Higiene**: commits pequeños, sin secrets, sin dependencias fuera de la lista, sin código muerto ni `console.log` olvidados.

## Formato
```
# Revisión: Fase N | Bloque X
Veredicto: APROBADA / APROBADA CON CAMBIOS MENORES / CAMBIOS NECESARIOS

| # | Severidad | Archivo:línea | Hallazgo | Qué hacer |
|---|---|---|---|---|
```
Severidades:
- **Bloqueante**: impide fusionar o seguir.
- **Importante**: se corrige ya.
- **Menor**: se corrige ahora o se anota.
- **Sugerencia**: opcional.
