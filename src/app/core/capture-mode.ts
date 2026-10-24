/**
 * `?captura=1` (PLAN §2): estado, cámara y animación deterministas para las capturas de los
 * informes. Por ahora solo marca el documento; base.css anula transiciones, animaciones y el cursor
 * de texto. La escena 3D lo leerá en la fase 5.
 */
export function isCaptureMode(search: string): boolean {
  return new URLSearchParams(search).get('captura') === '1';
}

export function applyCaptureMode(document: Document): void {
  if (isCaptureMode(document.location?.search ?? '')) {
    document.documentElement.setAttribute('data-captura', '');
  }
}
