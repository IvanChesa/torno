// Las piezas de la síntesis (PLAN fase 3, tarea 1): osciladores sin aliasing audible, envolventes que
// acaban en 0, filtro, azar con semilla, búfer circular y efectos calculados en bucle.
import { describe, expect, it } from 'vitest';
import { peaks, spectrum } from '../core/analysis';
import { clap, hat, kick, rim, shaker, snare, tom } from './drums';
import {
  dbToGain,
  gainToDb,
  levelLoop,
  loopEcho,
  peakOf,
  removeDc,
  rmsOf,
  saturate,
  softClip,
} from './effects';
import { adsr, adsrLength, percussive } from './envelope';
import { filter } from './filter';
import { LoopBuffer, processLooped } from './loop-buffer';
import { chordAt, midiToFrequency, PROGRESSION } from './music';
import { glide, oscillator, polyBlep, sine, sweep } from './oscillators';
import { createRandom, jitter, noise } from './random';
import {
  bell,
  droplet,
  electricPiano,
  fm,
  pad,
  pluckBass,
  rubberBass,
  subBass,
  woodTone,
} from './voices';

const RATE = 48_000;

/**
 * Lo que hay en el espectro fuera de los armónicos de `hz` por debajo de `belowHz` (lo que ha
 * plegado en la zona donde más se oye), en dB respecto a la fundamental.
 */
function aliasingDb(signal: Float64Array, hz: number, belowHz: number): number {
  const spec = spectrum(signal, RATE, 1 << 16);
  const all = peaks(spec, 20, belowHz, 0);
  const fundamental = Math.max(
    ...all.filter((p) => Math.abs(p.hz - hz) < 3).map((p) => p.magnitude),
  );
  let worst = 0;
  for (const peak of all) {
    const harmonic = peak.hz / hz;
    if (Math.abs(harmonic - Math.round(harmonic)) * hz > 8) worst = Math.max(worst, peak.magnitude);
  }
  return gainToDb(worst / fundamental);
}

function naiveSaw(hz: number): Float64Array {
  const out = new Float64Array(RATE);
  let phase = 0;
  for (let i = 0; i < RATE; i++) {
    out[i] = 2 * phase - 1;
    phase = (phase + hz / RATE) % 1;
  }
  return out;
}

describe('osciladores', () => {
  it.each([
    [57, 10_000],
    [69, 10_000],
    [95, 10_000],
  ])(
    'la sierra con PolyBLEP pliega mucho menos que la ingenua (nota %i, por debajo de %i Hz)',
    (note, below) => {
      const hz = midiToFrequency(note);
      const withBlep = aliasingDb(oscillator('saw', RATE, RATE, hz), hz, below);
      const without = aliasingDb(naiveSaw(hz), hz, below);
      console.warn(
        `Plegado de una sierra de ${hz.toFixed(1)} Hz: ingenua ${without.toFixed(1)} dB, PolyBLEP ${withBlep.toFixed(1)} dB`,
      );
      expect(withBlep).toBeLessThan(without - 10);
    },
  );

  it('formas, amplitudes y anchos de pulso', () => {
    const square = oscillator('square', RATE, RATE, 100);
    expect(peakOf(square)).toBeLessThan(1.3);
    // Pulso del 25 %: la media es −0,5 (un cuarto arriba, tres abajo).
    const pulse = oscillator('square', RATE, RATE, 100, { width: 0.25 });
    expect(pulse.reduce((a, b) => a + b, 0) / RATE).toBeCloseTo(-0.5, 2);
    const triangle = oscillator('triangle', RATE, RATE, 100);
    expect(peakOf(triangle.subarray(RATE / 2))).toBeGreaterThan(0.9);
    expect(peakOf(triangle.subarray(RATE / 2))).toBeLessThan(1.1);
    const sineWave = oscillator('sine', RATE, RATE, 1000, { phase: 0.25 });
    expect(sineWave[0]).toBeCloseTo(1, 6);
    // La tabla del seno: error < 10⁻⁷.
    for (let i = 0; i < 1000; i++)
      expect(Math.abs(sine(i / 997) - Math.sin((2 * Math.PI * i) / 997))).toBeLessThan(1e-7);
    expect(polyBlep(0.5, 0.01)).toBe(0);
  });

  it('barridos y portamentos van de un tono al otro', () => {
    const down = sweep(RATE, RATE, 150, 50, 0.04);
    expect(down[0]).toBe(150);
    expect(down[RATE - 1]).toBeCloseTo(50, 3);
    const up = glide(RATE, RATE, 100, 200, 0.02);
    expect(up[0]).toBeCloseTo(100, 6);
    expect(up[RATE - 1]).toBeCloseTo(200, 3);
    // Con una curva de frecuencia, el oscilador la sigue.
    expect(oscillator('sine', RATE, RATE, up)).toHaveLength(RATE);
  });
});

describe('envolventes', () => {
  it('ADSR: ataque, sostenido, relajación y fin en 0 exacto', () => {
    const envelope = { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.2 };
    const out = adsr(envelope, 0.5, RATE);
    expect(out).toHaveLength(adsrLength(envelope, 0.5, RATE));
    expect(out[Math.round(0.01 * RATE) - 1]).toBeCloseTo(1, 6);
    expect(out[Math.round(0.45 * RATE)]).toBeCloseTo(0.5, 2);
    expect(out[out.length - 1]).toBe(0);
    expect(out[Math.round(0.69 * RATE)]!).toBeLessThan(0.002);
  });

  it('percusiva: sube en el ataque y acaba en 0', () => {
    const out = percussive(0.002, 0.05, 0.4, RATE);
    expect(Math.max(...out)).toBeCloseTo(1, 2);
    expect(out[out.length - 1]).toBe(0);
  });
});

describe('filtro', () => {
  it('paso bajo, paso alto y paso banda donde toca', () => {
    const low = filter(oscillator('sine', RATE, RATE, 4000), RATE, 'lowpass', 400);
    expect(rmsOf(low.subarray(RATE / 2))).toBeLessThan(0.01 * Math.SQRT1_2);
    const high = filter(oscillator('sine', RATE, RATE, 40), RATE, 'highpass', 4000);
    expect(rmsOf(high.subarray(RATE / 2))).toBeLessThan(0.001);
    const band = filter(oscillator('sine', RATE, RATE, 1000), RATE, 'bandpass', 1000, 4);
    expect(rmsOf(band.subarray(RATE / 2))).toBeGreaterThan(0.9 * Math.SQRT1_2);
    // Con el corte en una curva (barrido).
    const curve = new Float64Array(RATE).fill(400);
    const swept = filter(oscillator('sine', RATE, RATE, 4000), RATE, 'lowpass', curve);
    expect(rmsOf(swept.subarray(RATE / 2))).toBeCloseTo(rmsOf(low.subarray(RATE / 2)), 6);
  });
});

describe('azar con semilla', () => {
  it('la misma semilla da la misma serie, en [0, 1)', () => {
    const a = createRandom(7);
    const b = createRandom(7);
    const values = Array.from({ length: 1000 }, () => a());
    expect(values).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(values.reduce((x, y) => x + y, 0) / 1000).toBeCloseTo(0.5, 1);
    const c = createRandom(8);
    expect(c()).not.toBe(createRandom(7)());
    expect(Math.abs(noise(a))).toBeLessThanOrEqual(1);
    expect(Math.abs(jitter(a, 0.1))).toBeLessThanOrEqual(0.1);
  });
});

describe('búfer circular y efectos en bucle', () => {
  it('lo que pasa del final entra por el principio', () => {
    const loop = new LoopBuffer(10);
    loop.add(Float64Array.from([1, 2, 3, 4]), 8);
    expect([...loop.data]).toEqual([3, 4, 0, 0, 0, 0, 0, 0, 1, 2]);
    loop.add(Float64Array.from([1]), -1, 2);
    expect(loop.data[9]).toBe(4);
    const other = new LoopBuffer(10);
    other.mix(loop, 0.5);
    expect(other.data[0]).toBe(1.5);
  });

  it('el eco es periódico: sus repeticiones del final suenan al principio', () => {
    const loop = new LoopBuffer(RATE);
    loop.add(percussive(0.001, 0.01, 0.05, RATE), RATE - 2400);
    const wet = loopEcho(loop.data, RATE, { delay: 0.1, feedback: 0.5, mix: 0.5, damping: 5000 });
    // El golpe está a 50 ms del final: su primera repetición cae a 50 ms del principio.
    expect(peakOf(wet.subarray(2300, 2500))).toBeGreaterThan(0.2);
    expect(Math.abs(wet[0]! - wet[RATE - 1]!)).toBeLessThan(0.05);
  });

  it('processLooped da varias vueltas y devuelve la última', () => {
    let calls = 0;
    const out = processLooped(Float64Array.from([1, 2, 3]), (x) => x + calls++, 2);
    expect(calls).toBe(6);
    expect([...out]).toEqual([4, 6, 8]);
  });

  it('saturación, continua y nivel', () => {
    const x = Float64Array.from([0, 0.5, 1, -1, 4]);
    saturate(x, 2);
    expect(x[2]).toBeCloseTo(1, 12);
    expect(x[1]).toBeGreaterThan(0.5);
    // Por encima de la saturación, el techo: 1 / softClip(drive).
    expect(x[4]).toBeCloseTo(1 / softClip(2), 12);
    // La curva se parece a tanh (≤ 2,5 % de diferencia) y es continua en ±3.
    for (let v = -4; v <= 4; v += 0.01) {
      expect(Math.abs(softClip(v) - Math.tanh(v))).toBeLessThan(0.025);
    }
    expect(softClip(-3)).toBe(-1);
    const dc = removeDc(Float64Array.from([1, 2, 3]));
    expect([...dc]).toEqual([-1, 0, 1]);
    // Nivel: el RMS objetivo salvo que el pico pase del techo.
    const tone = oscillator('sine', RATE, RATE, 100);
    expect(gainToDb(rmsOf(levelLoop(tone, -20, -1)))).toBeCloseTo(-20, 3);
    const spiky = new Float64Array(RATE);
    spiky[0] = 1;
    spiky[1] = 0.001;
    expect(gainToDb(peakOf(levelLoop(spiky, -20, -6)))).toBeCloseTo(-6, 3);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(levelLoop(new Float64Array(4), -20, -1).every((v) => v === 0)).toBe(true);
  });
});

describe('batería y voces', () => {
  it('cada golpe y cada voz es finito, con amplitud razonable, y acaba en silencio', () => {
    const random = createRandom(1);
    const sounds: [string, Float64Array][] = [
      [
        'bombo',
        kick(RATE, random, {
          from: 150,
          to: 50,
          sweep: 0.04,
          decay: 0.18,
          length: 0.55,
          click: 0.35,
          drive: 1.8,
        }),
      ],
      [
        'caja',
        snare(RATE, random, {
          tone: 190,
          bodyDecay: 0.06,
          noiseDecay: 0.07,
          snappy: 0.6,
          length: 0.35,
        }),
      ],
      ['charles', hat(RATE, random, { decay: 0.02, length: 0.15, tone: 9000 })],
      ['palmas', clap(RATE, random)],
      ['aro', rim(RATE, random)],
      ['tom', tom(RATE, random, 110)],
      ['maraca', shaker(RATE, random)],
      ['piano', electricPiano(RATE, 220, 0.5, 0.8)],
      ['campana', bell(RATE, 880, 1, 0.8)],
      ['madera', woodTone(RATE, 220)],
      [
        'pad',
        pad(RATE, [220, 277], [1, 0.8], 0.5, {
          envelope: { attack: 0.1, decay: 0.5, sustain: 0.7, release: 0.4 },
          cutoff: 600,
          cutoffPeak: 2000,
          q: 0.9,
        }),
      ],
      ['sub', subBass(RATE, 55, 0.5)],
      ['pulsado', pluckBass(RATE, 55, 0.3, 0.9)],
      ['goma', rubberBass(RATE, 55, 73.4, 0.2, 1)],
      ['gota', droplet(RATE, 1000)],
      ['fm', fm(RATE, 4800, 440, { ratio: 2, index: 3, indexEnd: 0, indexDecay: 0.01 })],
    ];
    for (const [name, sound] of sounds) {
      expect(sound.every(Number.isFinite), name).toBe(true);
      expect(peakOf(sound), name).toBeGreaterThan(0.05);
      expect(peakOf(sound), name).toBeLessThan(3);
      if (name !== 'fm') expect(Math.abs(sound[sound.length - 1]!), name).toBeLessThan(1e-3);
    }
  });

  it('la progresión: un acorde cada dos pulsos y el La7 en el último', () => {
    expect(PROGRESSION.map((chord) => chord.beat)).toEqual([0, 2, 4, 6, 7]);
    expect(chordAt(0.5).root).toBe(38);
    expect(chordAt(7.5).voicing).toContain(61);
  });
});
