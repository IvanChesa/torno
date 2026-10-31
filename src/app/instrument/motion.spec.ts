// Lo que se mueve con el audio (PLAN fase 6, «Sincronía»): el disco a una vuelta por compás, a la
// velocidad del transporte (±1 %, criterio de la fase) aunque los estados lleguen con retraso; los
// medidores, los cabezales y el destello de la cuenta previa.
import { describe, expect, it } from 'vitest';
import { BEATS_PER_TURN, LAYER_COUNT } from './constants';
import { InstrumentMotion, meterLevel, type MotionStatus } from './motion';

const layer = (change: Partial<MotionStatus['layers'][number]> = {}) => ({
  hasContent: true,
  lengthBeats: 8,
  positionBeats: 0,
  rms: 0,
  discHeld: false,
  ...change,
});

function status(change: Partial<MotionStatus> = {}): MotionStatus {
  return {
    beat: 0,
    bpm: 90,
    transport: 'playing',
    recording: 'idle',
    layers: Array.from({ length: LAYER_COUNT }, () => layer()),
    ...change,
  };
}

/** Un generador pseudoaleatorio determinista (los tests no cambian de una vez a otra). */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('el movimiento con el audio', () => {
  for (const bpm of [40, 90, 240]) {
    it(`a ${bpm} BPM, el disco va a la velocidad del transporte (±1 %) con estados que llegan con retraso`, () => {
      const motion = new InstrumentMotion();
      const jitter = random(bpm);
      const statusEvery = 1000 / 30;
      const frameEvery = 1000 / 60;
      let nextStatus = 0;
      let first: number | null = null;
      let last = 0;
      const seconds = 10;
      for (let time = 0; time <= seconds * 1000; time += frameEvery) {
        // El núcleo publica su pulso exacto cada 1/30 s; llega al hilo principal de 0 a 8 ms tarde.
        while (nextStatus <= time) {
          const beat = (nextStatus * bpm) / 60_000;
          motion.update(status({ beat, bpm }), nextStatus + 8 * jitter());
          nextStatus += statusEvery;
        }
        const disc = motion.frame(time, null).disc;
        first ??= disc;
        last = disc;
      }
      const turnsPerSecond = (last - (first ?? 0)) / seconds;
      const expected = bpm / 60 / BEATS_PER_TURN;
      expect(Math.abs(turnsPerSecond / expected - 1)).toBeLessThan(0.01);
    });
  }

  it('un estado que llega tarde no hace retroceder el disco; un salto del transporte, sí', () => {
    const motion = new InstrumentMotion();
    motion.update(status({ beat: 4 }), 0);
    const ahead = motion.frame(100, null).disc;
    // Llega uno que, extrapolado, queda un poco por detrás: el disco no vuelve atrás.
    motion.update(status({ beat: 4.1 }), 99.5);
    expect(motion.frame(101, null).disc).toBeGreaterThanOrEqual(ahead);
    // Parar y volver al inicio: el disco vuelve.
    motion.update(status({ beat: 0, transport: 'stopped' }), 120);
    expect(motion.frame(130, null).disc).toBe(0);
  });

  it('agarrado, el disco va con la mano desde donde estaba; al soltarlo, vuelve al transporte', () => {
    const motion = new InstrumentMotion();
    motion.update(status({ beat: 2 }), 0);
    const before = motion.frame(0, null).disc;
    expect(before).toBeCloseTo(2 / BEATS_PER_TURN, 10);
    expect(motion.frame(16, 0).disc).toBeCloseTo(before, 10);
    expect(motion.frame(32, 0.25).disc).toBeCloseTo(before + 0.25, 10);
    expect(motion.frame(48, null).disc).toBeCloseTo((2 + (48 * 90) / 60_000) / BEATS_PER_TURN, 6);
  });

  it('los medidores suben al momento y bajan poco a poco; parado, a cero', () => {
    const motion = new InstrumentMotion();
    const loud = status({ layers: [layer({ rms: 1 }), layer(), layer(), layer()] });
    motion.update(loud, 0);
    expect(motion.frame(0, null).levels[0]).toBe(1);
    motion.update(status(), 10);
    const later = motion.frame(100, null).levels[0]!;
    expect(later).toBeLessThan(1);
    expect(later).toBeGreaterThan(0.8);
    expect(meterLevel(10 ** (-24 / 20))).toBeCloseTo(0.5, 10);
    expect(meterLevel(0)).toBe(0);
    motion.update(status({ transport: 'stopped' }), 200);
    expect(motion.rest(210).levels.every((level) => level === 0)).toBe(true);
  });

  it('los cabezales avanzan con el transporte y dan la vuelta al final del bucle', () => {
    const motion = new InstrumentMotion();
    motion.update(
      status({
        beat: 7,
        bpm: 60,
        layers: [
          layer({ positionBeats: 7, lengthBeats: 8 }),
          layer({ hasContent: false }),
          layer({ positionBeats: 3, lengthBeats: 4, discHeld: true }),
          layer({ positionBeats: 0, lengthBeats: 4 }),
        ],
      }),
      0,
    );
    // Dos pulsos después (2 s a 60 BPM): la capa 1 da la vuelta; la 3 está agarrada y no avanza.
    const heads = motion.frame(2000, null).heads;
    expect(heads[0]).toBeCloseTo(1 / 8, 10);
    expect(heads[1]).toBe(-1);
    expect(heads[2]).toBeCloseTo(3 / 4, 10);
    expect(heads[3]).toBeCloseTo(2 / 4, 10);
  });

  it('en la cuenta previa, el piloto de grabar destella al empezar cada pulso', () => {
    const motion = new InstrumentMotion();
    motion.update(status({ beat: 3, bpm: 60, recording: 'count-in' }), 0);
    expect(motion.frame(0, null).recordFlash).toBe(1);
    expect(motion.frame(100, null).recordFlash).toBeCloseTo(0.6, 6);
    expect(motion.frame(500, null).recordFlash).toBe(0);
    motion.update(status({ beat: 3, bpm: 60 }), 600);
    expect(motion.frame(600, null).recordFlash).toBe(0);
  });

  it('con la latencia de salida, el disco va con lo que suena (un poco por detrás del núcleo)', () => {
    const motion = new InstrumentMotion();
    motion.setLatency(50);
    motion.update(status({ beat: 0, bpm: 60 }), 0);
    expect(motion.frame(1000, null).disc).toBeCloseTo(0.95 / BEATS_PER_TURN, 10);
  });
});
