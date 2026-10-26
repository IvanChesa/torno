/**
 * Las filas del panel de diagnóstico y el texto que se copia: una función pura de lo que dice el
 * motor, las medidas del primer sonido y el navegador.
 */
import type { EngineDiagnostics } from '../../audio/engine';
import type { FirstSound } from '../../state';
import { DIAGNOSTICS_CONTENT } from './diagnostics.content';

export interface ReportRow {
  readonly label: string;
  readonly value: string;
}

const text = DIAGNOSTICS_CONTENT;

/** Número con coma decimal (es-ES), sin separador de miles. */
const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');
const ms = (value: number | null, digits = 1) =>
  value === null ? text.values.none : `${decimal(value, digits)} ms`;

export function firstSoundsText(firstSounds: readonly FirstSound[]): string {
  if (firstSounds.length === 0) return text.values.firstSoundEmpty;
  return firstSounds
    .map(({ ms: value, cold }) => {
      const time = value === null ? text.values.silent : `${decimal(value, 0)} ms`;
      return cold ? `${time} (${text.values.cold})` : time;
    })
    .join(' · ');
}

export function diagnosticsRows(
  snapshot: EngineDiagnostics | null,
  firstSounds: readonly FirstSound[],
  userAgent: string,
): ReportRow[] {
  const rows = text.rows;
  const values = text.values;
  const head: ReportRow = { label: rows.firstSound, value: firstSoundsText(firstSounds) };
  const browser: ReportRow = { label: rows.browser, value: userAgent || values.none };
  if (!snapshot) return [head, { label: rows.context, value: values.notStarted }, browser];
  const { latency } = snapshot;
  const mode = values.latencyModes[latency.mode];
  const playback = snapshot.playback
    ? Object.entries(snapshot.playback)
        .map(([key, value]) => `${key} ${Number.isInteger(value) ? value : decimal(value, 3)}`)
        .join('; ')
    : values.notGiven;
  return [
    head,
    { label: rows.context, value: snapshot.contextState ?? values.none },
    {
      label: rows.sampleRate,
      value: snapshot.sampleRate === null ? values.none : `${snapshot.sampleRate} Hz`,
    },
    { label: rows.baseLatency, value: ms(snapshot.baseLatencyMs) },
    { label: rows.outputLatency, value: ms(snapshot.outputLatencyMs) },
    { label: rows.inputLatency, value: ms(snapshot.inputLatencyMs) },
    { label: rows.autoLatency, value: ms(snapshot.autoLatencyMs) },
    {
      label: rows.latency,
      value: latency.mode === 'auto' ? mode : `${mode}: ${ms(latency.ms)}`,
    },
    { label: rows.audioSession, value: snapshot.audioSession ?? values.none },
    {
      label: rows.memory,
      value:
        snapshot.memoryBytes === null
          ? values.none
          : `${decimal(snapshot.memoryBytes / 1_000_000)} MB`,
    },
    { label: rows.playback, value: playback },
    browser,
  ];
}

/** El informe para pegar: una línea por fila. */
export function reportText(rows: readonly ReportRow[]): string {
  return [text.title, ...rows.map((row) => `${row.label}: ${row.value}`)].join('\n');
}
