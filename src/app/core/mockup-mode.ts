/**
 * `?maqueta=1` (PLAN fase 5.a): la portada enseña la maqueta 3D del instrumento, para que Iván
 * elija la variante y apruebe el diseño (también en el móvil, en la vista previa de la rama).
 */
export function isMockupMode(search: string): boolean {
  return new URLSearchParams(search).get('maqueta') === '1';
}
