import { describe, expect, it } from 'vitest';
import { EMPTY_LAYER, validateSessionState, type LayerState, type SessionState } from './session';

const RATE = 48_000;

function session(layers: Partial<LayerState>[] = [], extra: Partial<SessionState> = {}): unknown {
  const all: LayerState[] = [];
  for (let i = 0; i < 4; i++) all.push({ ...EMPTY_LAYER, ...layers[i] });
  return { sampleRate: RATE, bpm: 90, layers: all, ...extra };
}

/** Una capa con 2 compases a 90 BPM (256.000 muestras). */
const loop = (patch: Partial<LayerState> = {}): Partial<LayerState> => ({
  pcm: new Float32Array(256_000).fill(0.1),
  lengthBeats: 8,
  offsetBeats: 0,
  source: { kind: 'library', id: 'bateria-1' },
  ...patch,
});

describe('validateSessionState', () => {
  it('acepta una sesión vacía y una con capas válidas', () => {
    expect(typeof validateSessionState(session())).toBe('object');
    const state = session([loop(), loop({ source: { kind: 'recording' }, reversed: true })]);
    expect(validateSessionState(state, { sampleRate: RATE })).toBe(state);
  });

  it.each([
    ['not-an-object', null],
    ['not-an-object', 'torno'],
    ['sample-rate', session([], { sampleRate: 0 })],
    ['sample-rate', session([], { sampleRate: 44_100.5 })],
    ['bpm', session([], { bpm: 39 })],
    ['bpm', session([], { bpm: Number.NaN })],
    ['layer-count', { sampleRate: RATE, bpm: 90, layers: [] }],
    ['layer-count', { sampleRate: RATE, bpm: 90 }],
    ['layer', { sampleRate: RATE, bpm: 90, layers: [null, null, null, null] }],
    ['mix', session([{ level: 1.5 }])],
    ['mix', session([{ muted: 'no' as unknown as boolean }])],
    ['mix', session([{ pan: -2 }])],
    ['mix', session([{ reversed: 1 as unknown as boolean }])],
    ['mix', session([{ filter: Number.POSITIVE_INFINITY }])],
    ['source', session([{ source: { kind: 'recording' } }])],
    ['pcm', session([loop({ pcm: [0.1, 0.2] as unknown as Float32Array })])],
    ['pcm', session([loop({ pcm: new Float32Array(0) })])],
    ['pcm', session([loop({ pcm: new Float32Array(61 * RATE) })])],
    ['length', session([loop({ lengthBeats: 0 })])],
    ['length', session([loop({ offsetBeats: Number.NaN })])],
    // 8 pulsos en 256.000 muestras son 90 BPM; 80 pulsos serían 900 BPM.
    ['length', session([loop({ lengthBeats: 80 })])],
    ['source', session([loop({ source: null })])],
    ['source', session([loop({ source: { kind: 'library', id: 'x'.repeat(65) } })])],
    ['source', session([loop({ source: { kind: 'otra' } as unknown as LayerState['source'] })])],
  ])('rechaza (%s)', (error, value) => {
    expect(validateSessionState(value)).toBe(error);
  });

  it('comprueba que la frecuencia sea la del contexto', () => {
    expect(validateSessionState(session(), { sampleRate: 44_100 })).toBe('sample-rate');
  });

  it('encuentra una sola muestra no finita (salvo si se le pide no mirar las muestras)', () => {
    const pcm = new Float32Array(256_000);
    pcm[123_456] = Number.NaN;
    const state = session([loop({ pcm })]);
    expect(validateSessionState(state)).toBe('samples');
    expect(validateSessionState(state, { checkSamples: false })).toBe(state);
    const loud = new Float32Array(256_000);
    loud[7] = 100;
    expect(validateSessionState(session([loop({ pcm: loud })]))).toBe('samples');
  });
});
