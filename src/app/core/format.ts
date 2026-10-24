import { SITE_CONFIG } from './site.config';

/** Cifras para la interfaz, en el idioma del sitio (`es-ES`; docs/ESTILO.md en la fase 7). */

/** Espacio duro: une una cifra con su unidad para que no se separen al cortar la línea. */
export const NBSP = ' ';

const formatters = new Map<number, Intl.NumberFormat>();

/** Número con `digits` decimales fijos. */
export function formatNumber(value: number, digits = 0): string {
  let formatter = formatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat(SITE_CONFIG.locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(digits, formatter);
  }
  // El signo menos tipográfico, no el guion.
  return formatter.format(value).replace('-', '−');
}

/** Cifra con su unidad: «48.000 Hz», con espacio duro. */
export function formatQuantity(value: number, unit: string, digits = 0): string {
  return `${formatNumber(value, digits)}${NBSP}${unit}`;
}

/** Nivel en dBFS con un decimal; el silencio absoluto no tiene nivel. */
export function formatDbfs(dbfs: number): string {
  return Number.isFinite(dbfs) ? formatQuantity(dbfs, 'dBFS', 1) : 'silencio';
}
