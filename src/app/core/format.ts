/** Cifras para la interfaz, en español de España (PLAN §0, docs/ESTILO.md en la fase 7). */

const formatters = new Map<number, Intl.NumberFormat>();

/** Número con `digits` decimales fijos, con el formato de es-ES. */
export function formatNumber(value: number, digits = 0): string {
  let formatter = formatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(digits, formatter);
  }
  // El signo menos tipográfico (U+2212), no el guion.
  return formatter.format(value).replace('-', '−');
}

/** Nivel en dBFS con un decimal; el silencio absoluto no tiene nivel. */
export function formatDbfs(dbfs: number): string {
  return Number.isFinite(dbfs) ? `${formatNumber(dbfs, 1)} dBFS` : 'silencio';
}
