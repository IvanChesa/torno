# Pendientes

Decisiones y tareas que dependen de Iván. Claude Code añade aquí cada `TODO(ivan):`.

## Ya hecho
- [x] Proyecto: instrumento de bucles en 3D inspirado en TAPE, con paridad completa y mejoras (24-10).
- [x] Nombre y carpeta: **Torno** (`torno`) (24-10; antes «Bucle»).
- [x] Forma de trabajar: una sesión planifica y revisa; Claude Code (Opus 5.5) programa (24-10).
- [x] Dirección visual: **B «Barro»** (24-10).

## Antes del bloque B (fase 4)
- [ ] Instalar GitHub CLI (`winget install --id GitHub.cli`), `gh auth login` y crear el repo privado.
- [ ] Staging en cPanel: `staging-torno.ivanchesa.es` con AutoSSL, protección con contraseña, cuenta FTP limitada y secrets con `gh secret set`.
- [ ] Conseguir un iPhone para probar (aunque sea prestado) y tener a mano unos auriculares, mejor con cable.

## Decisiones
- [ ] **Subdominio definitivo.** Propuesto: `torno.ivanchesa.es`. Si cambia, se edita solo `src/app/core/site.config.ts`.
- [ ] **Autoguardado local** (D16): por defecto, activado, visible y borrable. Si prefieres que sea opcional, díselo a la sesión de revisión antes del bloque A.
- [ ] **Licencia del código propio** cuando el repo pase a público (MIT u otra).
- [ ] `@lhci/cli` en el CI (fase 8).

## Revisiones y pruebas de Iván
- [ ] Escuchar los 12 sonidos y 3 combinaciones (`npm run demo:sounds`, final del bloque B).
- [ ] Pruebas en Android e iPhone por el staging (fase 4; necesarias antes del bloque C).
- [ ] Aprobar el diseño del instrumento (parada de la fase 5.a).
- [ ] Revisar los textos de la web (fase 7).
- [ ] Visto bueno final en el móvil y en el iPhone (fase 8).

## Fase 9 (manual)
- [ ] Subdominio de producción con AutoSSL, cuenta FTP limitada y secrets de producción.
