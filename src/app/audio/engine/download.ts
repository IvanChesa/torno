/**
 * Descargas sin red: el archivo se crea en el navegador y se entrega con un enlace `blob:` (nada sale
 * del dispositivo).
 */

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Se libera después: algunos navegadores empiezan la descarga de forma asíncrona.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Sello de fecha para los nombres de archivo: «2026-10-24-1830». */
export function fileStamp(date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}`;
}
