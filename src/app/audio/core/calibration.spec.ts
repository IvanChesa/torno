// Calibración de la latencia (PLAN §4.4): el núcleo hace sonar los clics en muestras exactas y
// graba la entrada; `measureLatency` encuentra el desfase aunque el clic vuelva más bajo, invertido
// o con ruido, y se niega a dar una cifra si los clics no coinciden.
import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_CLICKS,
  CALIBRATION_INTERVAL_SECONDS,
  CALIBRATION_LEAD_SECONDS,
  measureLatency,
} from './calibration';
import { clickTable, NORMAL_CLICK } from './metronome';
import { Harness, seededRandom } from './test-harness';

const RATE = 48_000;
const INTERVAL = CALIBRATION_INTERVAL_SECONDS * RATE;
const LEAD = CALIBRATION_LEAD_SECONDS * RATE;
const CLICK = clickTable(RATE, NORMAL_CLICK.frequency, NORMAL_CLICK.gain);
const CLICKS = Array.from({ length: CALIBRATION_CLICKS }, (_, i) => LEAD + i * INTERVAL);

/** Una grabación con cada clic de vuelta `latency` muestras después, con `gain` y ruido. */
function recording(latency: number, gain: number, noise = 0, skip: number[] = []): Float32Array {
  const random = seededRandom(7);
  const pcm = new Float32Array(LEAD + CALIBRATION_CLICKS * INTERVAL);
  for (let i = 0; i < pcm.length; i++) pcm[i] = noise * (random() * 2 - 1);
  CLICKS.forEach((click, index) => {
    if (skip.includes(index)) return;
    for (let k = 0; k < CLICK.length; k++) {
      const at = click + latency + k;
      if (at < pcm.length) pcm[at] = pcm[at]! + gain * CLICK[k]!;
    }
  });
  return pcm;
}

describe('measureLatency', () => {
  it.each([0, 1, 480, 7000, 23_000])('encuentra una latencia de %i muestras', (latency) => {
    const result = measureLatency(recording(latency, 0.05), CLICKS, RATE);
    expect(result?.latencyFrames).toBe(latency);
    expect(result?.detected).toBe(CALIBRATION_CLICKS);
    expect(result?.consistent).toBe(CALIBRATION_CLICKS);
  });

  it('da igual el nivel y la polaridad, y aguanta el ruido de fondo', () => {
    // Con ruido, el umbral puede adelantarse o retrasarse una muestra (0,02 ms).
    const result = measureLatency(recording(2400, -0.02, 0.001), CLICKS, RATE);
    expect(Math.abs(result!.latencyFrames - 2400)).toBeLessThanOrEqual(1);
  });

  it('con dos clics perdidos todavía mide; con tres, no', () => {
    expect(measureLatency(recording(960, 0.05, 0, [1, 5]), CLICKS, RATE)?.latencyFrames).toBe(960);
    expect(measureLatency(recording(960, 0.05, 0, [1, 4, 6]), CLICKS, RATE)).toBeNull();
  });

  it('en silencio, con solo ruido o con desfases que no coinciden, no da ninguna cifra', () => {
    expect(measureLatency(new Float32Array(LEAD + 8 * INTERVAL), CLICKS, RATE)).toBeNull();
    const noise = recording(0, 0, 0.05);
    expect(measureLatency(noise, CLICKS, RATE)).toBeNull();
    // Cada clic vuelve con un desfase distinto (un eco que no es el de los altavoces).
    const scattered = new Float32Array(LEAD + 8 * INTERVAL);
    CLICKS.forEach((click, index) => {
      for (let k = 0; k < CLICK.length; k++) scattered[click + index * 1500 + k] = CLICK[k]!;
    });
    expect(measureLatency(scattered, CLICKS, RATE)).toBeNull();
  });
});

describe('calibración en el núcleo', () => {
  it('hace sonar los clics en su muestra exacta y graba la entrada sin tocar', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-volume', volume: 0 });
    h.send({ type: 'set-input-gain', gain: 2 });
    h.render(1000);
    const start = h.frame;
    h.send({ type: 'calibrate' });
    // Micrófono simulado: cada clic vuelve 1234 muestras después, más bajo.
    const latency = 1234;
    const mic = recording(latency, 0.1);
    const total = LEAD + CALIBRATION_CLICKS * INTERVAL;
    const { left, right } = h.render(total + 1000, (frame) => mic[frame - start] ?? 0);
    // Con la rueda a cero, los clics suenan igual (van después del volumen).
    for (const click of CLICKS) {
      expect(left[click]).toBe(0);
      expect(left[click + 5]).toBeCloseTo(CLICK[5]!, 6);
      expect(right[click + 5]).toBe(left[click + 5]);
    }
    expect(h.noticesOf('calibrated')).toEqual([expect.objectContaining({ value: total })]);
    const result = h.core.calibrationResult!;
    expect(result.clickFrames).toEqual(CLICKS);
    // La grabación es la entrada tal cual (sin la ganancia de entrada).
    expect(result.pcm[CLICKS[0]! + latency + 5]).toBe(Math.fround(mic[CLICKS[0]! + latency + 5]!));
    expect(measureLatency(result.pcm, result.clickFrames, RATE)?.latencyFrames).toBe(latency);
  });

  it('solo con el transporte parado; mientras, no se puede reproducir, grabar ni cargar', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'play' });
    h.send({ type: 'calibrate' });
    h.send({ type: 'pause' });
    h.render(2000);
    h.send({ type: 'calibrate' });
    h.send({ type: 'calibrate' });
    h.send({ type: 'play' });
    h.send({ type: 'record', layer: 0, bars: 1, countIn: false, fitTempo: false });
    h.send({ type: 'reset' });
    h.flush();
    expect(h.noticesOf('rejected').map((n) => `${n.command}: ${n.reason}`)).toEqual([
      'calibrate: busy',
      'calibrate: busy',
      'play: busy',
      'record: busy',
      'reset: busy',
    ]);
    expect(h.core.transportState).toBe('stopped');
  });

  it('cancelar o el reposo la interrumpen sin resultado', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'calibrate' });
    h.render(RATE);
    h.send({ type: 'cancel-recording' });
    h.send({ type: 'calibrate' });
    h.render(RATE);
    h.send({ type: 'standby' });
    h.render(5 * RATE);
    expect(h.noticesOf('calibration-cancelled').map((n) => n.reason)).toEqual([
      'cancelled',
      'standby',
    ]);
    expect(h.noticesOf('calibrated')).toHaveLength(0);
    expect(h.core.calibrationResult).toBeNull();
  });
});
