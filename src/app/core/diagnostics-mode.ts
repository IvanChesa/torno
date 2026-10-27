/**
 * `?diagnostico=1` (PLAN fase 4, tarea 7): la portada enseña, junto al instrumento, el panel de
 * diagnóstico del audio para las pruebas en los móviles (`docs/PRUEBAS-MOVIL.md`).
 */
export function isDiagnosticsMode(search: string): boolean {
  return new URLSearchParams(search).get('diagnostico') === '1';
}
