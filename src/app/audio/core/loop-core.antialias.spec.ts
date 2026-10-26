// Sin aliasing al acelerar (PLAN fase 3, tarea 7; revisión de la fase 1, #14): a 240 BPM, un bucle
// de 90 se lee 2,67 veces más deprisa. Un tono alto plegaría dentro de la banda audible; con el
// filtro, ninguna imagen pasa de −60 dB. Los tonos que caben siguen intactos, sin clics al cruzar el
// umbral y sin perder la alineación con la línea de tiempo.
import { describe, expect, it } from 'vitest';
import { peaks, spectrum } from './analysis';
import { AntialiasFilter, ANTIALIAS_STOPBAND_DB, antialiasThreshold } from './antialias';
import { LIMITER_LOOKAHEAD_SECONDS } from './constants';
import { framesOf, readLooped } from './dsp';
import { Harness, loopFrames, maxJump, sineSound } from './test-harness';
import { Voice } from './voice';
import type { Clock } from './transport';
import type { LayerContent } from './content';

const CENTER = Math.SQRT1_2;
const dB = (x: number) => 20 * Math.log10(x);

/** Un bucle de 8 pulsos a `nativeBpm` con un seno de `hz` (redondeado a vueltas enteras). */
function toneLoop(rate: number, hz: number, nativeBpm = 90) {
  const frames = loopFrames(8, rate, nativeBpm);
  const cycles = Math.round((hz * frames) / rate);
  return { sound: sineSound(rate, cycles, 0.5, 8, nativeBpm), hz: (cycles * rate) / frames };
}

/** La salida izquierda tras asentarse, a `bpm`, con el tono en la capa 1 (centrada). */
function renderAt(
  rate: number,
  hz: number,
  bpm: number,
  options: { native?: number; reversed?: boolean } = {},
) {
  const { sound } = toneLoop(rate, hz, options.native);
  const h = new Harness({ sampleRate: rate });
  h.send({ type: 'set-sound', layer: 0, sound });
  if (options.reversed) h.send({ type: 'set-reverse', layer: 0, reversed: true });
  h.send({ type: 'set-tempo', bpm });
  h.send({ type: 'play' });
  h.render(rate / 2);
  return h.render(1 << 16).left;
}

/** El mayor pico del espectro, en dB respecto a `reference` (amplitud). */
function strongestDb(
  signal: Float32Array,
  rate: number,
  reference: number,
): { db: number; hz: number } {
  const spec = spectrum(signal, rate, 1 << 16, 'flattop');
  const found = peaks(spec, 20, rate / 2 - 50, 0);
  const top = found.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
  return { db: dB(top.magnitude / reference), hz: top.hz };
}

describe('el filtro contra el aliasing', () => {
  it('el umbral: por encima de (sr − 20 kHz) / (sr / 2)', () => {
    expect(antialiasThreshold(48_000)).toBeCloseTo(7 / 6, 12);
    // A 44,1 kHz se protege hasta 19,8 kHz (el 90 % de Nyquist).
    expect(antialiasThreshold(44_100)).toBeCloseTo(1.1, 12);
    expect(antialiasThreshold(16_000)).toBeCloseTo(1.1, 12);
  });

  it('pasa lo que cabe, quita lo que plegaría y retrasa los graves lo que dice `delay`', () => {
    const rate = 48_000;
    const speed = 240 / 90;
    const stop = 28_000 / speed;
    const tone = (hz: number, length = 1 << 15) => {
      const filter = new AntialiasFilter(rate);
      filter.design(speed);
      const out = new Float64Array(length);
      for (let i = 0; i < length; i++)
        out[i] = filter.process(Math.sin((2 * Math.PI * hz * i) / rate));
      return { out, delay: filter.delay };
    };
    const level = (hz: number) => {
      const { out } = tone(hz);
      let peak = 0;
      for (let i = 8192; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!));
      return dB(peak);
    };
    expect(level(1000)).toBeGreaterThan(-0.1);
    // Banda pasante: hasta (sr − 20 kHz) / s / 1,454 (−1 dB).
    expect(level(stop / 1.5)).toBeGreaterThan(-1.5);
    for (const hz of [stop * 1.01, stop * 1.3, 15_000, 23_000]) {
      expect(level(hz)).toBeLessThan(-ANTIALIAS_STOPBAND_DB + 0.5);
    }
    // Un grave de 100 Hz sale retrasado `delay` muestras (con 0,1 de margen).
    const { out, delay } = tone(100);
    expect(delay).toBeGreaterThan(1);
    let best = 0;
    let bestError = Infinity;
    for (let d = 0; d < 20; d += 0.01) {
      let error = 0;
      for (let i = 4000; i < 4400; i++)
        error += (out[i]! - Math.sin((2 * Math.PI * 100 * (i - d)) / rate)) ** 2;
      if (error < bestError) [best, bestError] = [d, error];
    }
    expect(Math.abs(best - delay)).toBeLessThan(0.1);
  });
});

describe('LoopCore a 240 BPM', () => {
  it.each([48_000, 44_100])(
    'un tono alto no deja imágenes por encima de −60 dB (%i Hz)',
    (rate) => {
      // Referencia: un tono que cabe (1 kHz → 2,67 kHz), con la misma cadena (pan central).
      const reference = 0.5 * CENTER;
      const passing = strongestDb(renderAt(rate, 1000, 240), rate, reference);
      expect(passing.db).toBeGreaterThan(-0.5);
      expect(passing.db).toBeLessThan(0.5);
      // 12 kHz a 2,67× serían 32 kHz: sin filtro, plegaría a 16 kHz (48 kHz) o 12,1 kHz (44,1 kHz).
      const high = strongestDb(renderAt(rate, 12_000, 240), rate, reference);
      console.warn(
        `${rate} Hz, tono de 12 kHz a 240 BPM: lo más alto, ${high.db.toFixed(1)} dB a ${high.hz.toFixed(0)} Hz`,
      );
      expect(high.db).toBeLessThan(-60);
    },
  );

  it('sin el filtro, la imagen estaría ahí (control: lectura de Hermite directa)', () => {
    const rate = 48_000;
    const { sound, hz } = toneLoop(rate, 12_000);
    const speed = 240 / 90;
    const out = new Float32Array(1 << 16);
    for (let i = 0; i < out.length; i++) {
      out[i] = readLooped(sound.pcm, sound.pcm.length, (i * speed) % sound.pcm.length);
    }
    const alias = strongestDb(out, rate, 0.5);
    expect(Math.abs(alias.hz - Math.abs(rate - hz * speed))).toBeLessThan(5);
    expect(alias.db).toBeGreaterThan(-20);
  });

  it('también en reverso y con una grabación lenta (60 BPM leída a 240: 4×)', () => {
    const rate = 48_000;
    const reference = 0.5 * CENTER;
    expect(
      strongestDb(renderAt(rate, 12_000, 240, { reversed: true }), rate, reference).db,
    ).toBeLessThan(-60);
    // A 4×, la banda eliminada empieza en 7 kHz: un tono de 9 kHz (36 kHz → 12 kHz) desaparece.
    expect(strongestDb(renderAt(rate, 9000, 240, { native: 60 }), rate, reference).db).toBeLessThan(
      -60,
    );
    // Y uno de 1 kHz (4 kHz a la salida) sigue igual.
    const low = strongestDb(renderAt(rate, 1000, 240, { native: 60 }), rate, reference);
    expect(Math.abs(low.db)).toBeLessThan(0.5);
  });

  it('el filtro no desalinea la capa: a 240 BPM el tono sigue en fase con la línea de tiempo', () => {
    const rate = 48_000;
    const { sound } = toneLoop(rate, 300);
    const cycles = Math.round((300 * sound.pcm.length) / rate);
    const h = new Harness({ sampleRate: rate });
    h.send({ type: 'set-sound', layer: 0, sound });
    h.send({ type: 'set-tempo', bpm: 240 });
    h.send({ type: 'play' });
    h.render(rate);
    // Lo que debería sonar sale del pulso del transporte (la muestra i del bucle suena en el pulso
    // 8·i/frames), con la anticipación del limitador, que retrasa la salida.
    const beat = h.status().beat;
    const lookahead = framesOf(LIMITER_LOOKAHEAD_SECONDS, rate);
    const { left } = h.render(4096);
    let worst = 0;
    for (let i = 0; i < left.length; i++) {
      const loopPhase = (beat + ((i - lookahead) * 240) / 60 / rate) / 8;
      const expected = 0.5 * CENTER * Math.sin(2 * Math.PI * cycles * loopPhase);
      worst = Math.max(worst, Math.abs(left[i]! - expected));
    }
    // Un desfase de una muestra a 800 Hz ya serían 0,037.
    expect(worst).toBeLessThan(0.002);
  });

  it('sin clics al pasar el umbral en un sentido y en otro (girando el tempo)', () => {
    const rate = 48_000;
    const { sound } = toneLoop(rate, 441);
    const h = new Harness({ sampleRate: rate });
    h.send({ type: 'set-sound', layer: 0, sound });
    h.send({ type: 'set-tempo', bpm: 100 });
    h.send({ type: 'play' });
    h.render(rate / 4);
    const out: Float32Array[] = [];
    // De 100 a 112 BPM y vuelta, un BPM cada 20 ms (el umbral está en 105 y el encendido en 107).
    for (const bpm of [
      101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 111, 110, 109, 108, 107, 106, 105,
      104, 103,
    ]) {
      h.send({ type: 'set-tempo', bpm });
      out.push(h.render(960).left);
    }
    const all = new Float32Array(out.reduce((n, part) => n + part.length, 0));
    let at = 0;
    for (const part of out) {
      all.set(part, at);
      at += part.length;
    }
    // El mayor salto de la propia señal: un seno de 441 × 112/90 Hz con amplitud 0,35.
    const own = 2 * Math.PI * ((441 * 112) / 90 / rate) * 0.5 * CENTER;
    expect(maxJump(all)).toBeLessThanOrEqual(own + 0.01);
  });

  it.each([
    [44_100, 1000, 240, 110, 90, false],
    [44_100, 441, 240, 110, 90, false],
    [48_000, 1000, 160, 110, 90, false],
    [48_000, 2000, 180, 120, 90, false],
    [48_000, 441, 240, 52, 40, false],
    [48_000, 441, 240, 52, 40, true],
    [48_000, 1000, 110, 240, 90, false],
  ] as const)(
    'sin clics con un salto de tempo grande (%i Hz, tono de %i Hz, de %i a %i BPM, bucle de %i, reverso %s)',
    (rate, tone, from, to, native, reversed) => {
      // MARCAR TEMPO salta de golpe: rediseñado de una vez, el filtro dejaba un transitorio (0,191
      // frente a 0,144 en el primer caso); a pasos, no (revisión de la fase 3, #1).
      const { sound, hz } = toneLoop(rate, tone, native);
      const h = new Harness({ sampleRate: rate });
      h.send({ type: 'set-sound', layer: 0, sound });
      if (reversed) h.send({ type: 'set-reverse', layer: 0, reversed: true });
      h.send({ type: 'set-tempo', bpm: from });
      h.send({ type: 'play' });
      h.render(rate);
      h.send({ type: 'set-tempo', bpm: to });
      const { left } = h.render(rate / 2);
      // El mayor salto propio: el del tempo más rápido de los dos.
      const own = 2 * Math.PI * ((hz * Math.max(from, to)) / native / rate) * 0.5 * CENTER;
      expect(maxJump(left)).toBeLessThanOrEqual(own + 0.01);
    },
  );

  it('a 240 BPM durante varias vueltas, sin saltos en las juntas del bucle', () => {
    const rate = 48_000;
    const { sound } = toneLoop(rate, 200);
    const h = new Harness({ sampleRate: rate });
    h.send({ type: 'set-sound', layer: 0, sound });
    h.send({ type: 'set-tempo', bpm: 240 });
    h.send({ type: 'play' });
    h.render(rate / 4);
    // 3 vueltas de 2 s.
    const { left } = h.render(6 * rate);
    const own = 2 * Math.PI * ((200 * 240) / 90 / rate) * 0.5 * CENTER;
    expect(maxJump(left)).toBeLessThanOrEqual(own * 1.01);
  });
});

describe('la voz enciende y apaga el filtro con histéresis', () => {
  const rate = 48_000;
  const content: LayerContent = {
    data: new Float32Array(loopFrames(8, rate)).fill(0.1),
    frames: loopFrames(8, rate),
    lengthBeats: 8,
    offsetBeats: 0,
    source: { kind: 'library', id: 'x' },
  };
  const framesPerBeat = content.frames / 8;
  const clockAt = (speed: number): Clock =>
    ({ beat: 1, beatsPerFrame: speed / framesPerBeat }) as Clock;

  it('por debajo del umbral, nada; por encima del 102 %, filtra; vuelve al bajar del umbral', () => {
    const fade = new Float32Array(480).map((_, i) => (i + 0.5) / 480);
    const voice = new Voice(fade, 1, 0, rate, 128);
    const threshold = antialiasThreshold(rate);
    voice.begin(content, false, false, 1, threshold / framesPerBeat, fade);
    expect(voice.antialiased).toBe(false);
    voice.sync(clockAt(threshold * 1.01));
    expect(voice.antialiased).toBe(false);
    voice.sync(clockAt(threshold * 1.03));
    expect(voice.antialiased).toBe(true);
    // Entre el umbral y el 102 %, sigue encendido (histéresis).
    voice.sync(clockAt(threshold * 1.01));
    expect(voice.antialiased).toBe(true);
    // Por debajo, se apaga con un fundido: hasta que acaba, aún mezcla las dos lecturas.
    voice.sync(clockAt(threshold * 0.99));
    const out = new Float32Array(128);
    const gains = new Float32Array(128);
    // El fundido dura 480 muestras: tras 256 sigue; tras 512, ya no.
    for (let i = 0; i < 2; i++) voice.renderTimelineAdd(out, 128, gains, null);
    expect(voice.antialiased).toBe(true);
    for (let i = 0; i < 2; i++) voice.renderTimelineAdd(out, 128, gains, null);
    expect(voice.antialiased).toBe(false);
    // Empezar ya por encima: filtra desde la primera muestra.
    voice.begin(content, false, false, 1, (threshold * 2) / framesPerBeat, fade);
    expect(voice.antialiased).toBe(true);
    // El disco nunca se filtra.
    voice.begin(content, false, true, 1, (threshold * 2) / framesPerBeat, fade);
    expect(voice.antialiased).toBe(false);
  });
});
