import { formatDbfs, formatNumber, formatQuantity, NBSP } from './format';

describe('formato de cifras (es-ES)', () => {
  it('agrupa los miles con punto y usa coma decimal', () => {
    expect(formatNumber(48_000)).toBe('48.000');
    expect(formatNumber(12.345, 1)).toBe('12,3');
    expect(formatNumber(0.5, 2)).toBe('0,50');
  });

  it('usa el signo menos tipográfico', () => {
    expect(formatNumber(-12.04, 1)).toBe('−12,0');
  });

  it('une la cifra y la unidad con un espacio duro', () => {
    expect(NBSP).toBe(' ');
    expect(formatQuantity(48_000, 'Hz')).toBe('48.000 Hz');
    expect(formatQuantity(5.24, 'ms', 1)).toBe('5,2 ms');
  });

  it('da el nivel en dBFS, y «silencio» si no hay señal', () => {
    expect(formatDbfs(-12.04)).toBe('−12,0 dBFS');
    expect(formatDbfs(Number.NEGATIVE_INFINITY)).toBe('silencio');
  });
});
