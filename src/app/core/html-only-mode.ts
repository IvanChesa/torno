/**
 * `?sin3d=1` (PLAN §2): solo el instrumento HTML, sin cargar el 3D (para pruebas y para quien no lo
 * quiera). Los e2e del audio lo usan: no necesitan pintar el aparato.
 */
export function isHtmlOnlyMode(search: string): boolean {
  return new URLSearchParams(search).get('sin3d') === '1';
}
