import type { EngineDiagnostics } from '../../audio/engine';
import { diagnosticsRows, firstSoundsText, reportText } from './diagnostics-report';

const SNAPSHOT: EngineDiagnostics = {
  contextState: 'running',
  sampleRate: 48_000,
  baseLatencyMs: 5.333,
  outputLatencyMs: 21.25,
  inputLatencyMs: null,
  autoLatencyMs: 26.583,
  latency: { mode: 'calibrated', ms: 23.4 },
  audioSession: 'playback',
  memoryBytes: 2_048_000,
  playback: { underrunEvents: 0, averageLatency: 0.0125 },
};

describe('informe de diagnóstico', () => {
  it('las medidas del primer sonido: la primera, en frío', () => {
    expect(firstSoundsText([])).toBe('Pulsa REPRODUCIR para medirlo');
    expect(
      firstSoundsText([
        { ms: 182.4, cold: true },
        { ms: 9.2, cold: false },
        { ms: null, cold: false },
      ]),
    ).toBe('182 ms (en frío) · 9 ms · no ha sonado en 5 s');
  });

  it('una fila por dato, con coma decimal y sus unidades', () => {
    const rows = diagnosticsRows(SNAPSHOT, [{ ms: 12, cold: true }], 'Navegador/1.0');
    const value = (label: string) => rows.find((row) => row.label === label)?.value;
    expect(value('Del toque al primer sonido')).toBe('12 ms (en frío)');
    expect(value('Estado del audio')).toBe('running');
    expect(value('Frecuencia de muestreo')).toBe('48000 Hz');
    expect(value('Latencia base')).toBe('5,3 ms');
    expect(value('Latencia de salida')).toBe('21,3 ms');
    expect(value('Latencia de entrada (micrófono)')).toBe('—');
    expect(value('Latencia automática (ida y vuelta)')).toBe('26,6 ms');
    expect(value('Latencia de las tomas')).toBe('calibrada: 23,4 ms');
    expect(value('Sesión de audio')).toBe('playback');
    expect(value('Memoria del audio')).toBe('2,0 MB');
    expect(value('Estadísticas del navegador')).toBe('underrunEvents 0; averageLatency 0,013');
    expect(value('Navegador')).toBe('Navegador/1.0');
  });

  it('sin motor todavía, o sin estadísticas del navegador', () => {
    expect(diagnosticsRows(null, [], '').map((row) => row.value)).toEqual([
      'Pulsa REPRODUCIR para medirlo',
      'Sin arrancar: toca el instrumento',
      '—',
    ]);
    const rows = diagnosticsRows(
      { ...SNAPSHOT, playback: null, latency: { mode: 'auto', ms: 0 }, sampleRate: null },
      [],
      'x',
    );
    const value = (label: string) => rows.find((row) => row.label === label)?.value;
    expect(value('Estadísticas del navegador')).toBe('El navegador no las da');
    expect(value('Latencia de las tomas')).toBe('automática');
    expect(value('Frecuencia de muestreo')).toBe('—');
  });

  it('el texto para copiar: título y una línea por fila', () => {
    expect(reportText([{ label: 'A', value: '1' }])).toBe('Diagnóstico del audio\nA: 1');
  });
});
