# Pendientes

Decisiones y tareas que dependen de Iván. Claude Code añade aquí cada `TODO(ivan):`.

## Ya hecho
- [x] Proyecto: instrumento de bucles en 3D inspirado en TAPE, con paridad completa y mejoras (24-10).
- [x] Nombre y carpeta: **Torno** (`torno`) (24-10; antes «Bucle»).
- [x] Forma de trabajar: una sesión planifica y revisa; Claude Code (Opus 5.5) programa (24-10).
- [x] Dirección visual: **B «Barro»** (24-10).

## Antes del bloque B (fase 4)
- [x] Repo en GitHub: `IvanChesa/torno`, público; se conecta en el bloque A (24-10).
- [ ] Instalar GitHub CLI (`winget install --id GitHub.cli`) y `gh auth login`, para los secrets del staging.
- [ ] Staging en cPanel: `staging-torno.ivanchesa.es` con AutoSSL, protección con contraseña, cuenta FTP limitada y secrets con `gh secret set`.
- [ ] Conseguir un iPhone para probar (aunque sea prestado) y tener a mano unos auriculares, mejor con cable.

## Decisiones
- [ ] **Subdominio definitivo.** Propuesto: `torno.ivanchesa.es`. Si cambia, se edita solo `src/app/core/site.config.ts`.
- [ ] **Autoguardado local** (D16): por defecto, activado, visible y borrable. Si prefieres que sea opcional, díselo a la sesión de revisión antes del bloque A.
- [ ] **Licencia del código propio** cuando el repo pase a público (MIT u otra).
- [ ] `@lhci/cli` en el CI (fase 8).
- [ ] **Autoguardado con el panel de recuperar sin contestar** (revisión de la fase 2, #21): mientras no se elige «Recuperar» o «Empezar de cero», no se autoguarda nada, para no pisar la sesión anterior. Si se toca un rato sin contestar y se cierra la pestaña, eso se pierde. Opciones: (a) dejarlo así; (b) un segundo hueco en IndexedDB para la sesión nueva, y el panel ofrece las dos; (c) que la primera edición pregunte y cierre el panel. Propuesta: (b).
- [ ] **Micrófono entre tomas** (si las pruebas de la fase 4 lo piden): mantenerlo abierto durante una «sesión de grabación» o recalibrar cada toma con la cuenta previa (informe de la fase 2, §10, propuesta 1).
- [ ] **Indexación en el lanzamiento (fase 9).** Hasta entonces todas las páginas llevan `noindex` (`indexable: false` en `src/app/core/site.config.ts`); al lanzar se pone a `true` y solo la 404 sigue con `noindex`. Confirmar que quieres que se indexe.

## Revisiones y pruebas de Iván
- [ ] Ver `docs/DISENO.md` y las capturas de la fase 0 (`docs/informes/img/fase-0/`): paleta «Barro», Fraunces con el eje SOFT y Geist Mono (revisión del bloque 0).
- [ ] Escuchar los 12 sonidos y 3 combinaciones (`npm run demo:sounds`, final del bloque B).
- [ ] Pruebas en Android e iPhone por el staging (fase 4; necesarias antes del bloque C).
  - `TODO(ivan)`: en esas pruebas, calibrar la latencia y grabar varias tomas seguidas con auriculares, para ver si quedan alineadas entre sí. En Chromium, la latencia del camino del micrófono cambia en cada apertura de la pista (12–21 ms medidos en un retorno; informe de la fase 2, §10, propuesta 1).
- [ ] Aprobar el diseño del instrumento (parada de la fase 5.a).
- [ ] Revisar los textos de la web (fase 7).
- [ ] Visto bueno final en el móvil y en el iPhone (fase 8).

## Fase 9 (manual)
- [ ] Subdominio de producción con AutoSSL, cuenta FTP limitada y secrets de producción.
