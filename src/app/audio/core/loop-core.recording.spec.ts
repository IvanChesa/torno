// Grabación (PLAN §4.4): tomas libres y fijas, cuenta previa, relleno, sobregrabación, latencia,
// juntas y bloqueos, comprobados muestra a muestra con entradas sintéticas.
import { describe, expect, it } from 'vitest';
import { fadeTable } from './dsp';
import {
  constantSound,
  Harness,
  loopFrames,
  maxJump,
  rampSound,
  sound,
  type InputSource,
  exportState,
} from './test-harness';

const RATE = 48_000;
const BEAT = 32_000; // a 90 BPM
const BAR = 4 * BEAT;
const JUNCTION = 480; // 10 ms
const CENTER = Math.SQRT1_2;
const junction = fadeTable(JUNCTION);

/** Un tono de prueba como entrada del micrófono. */
const tone =
  (hz: number, amplitude = 0.3): InputSource =>
  (frame: number) =>
    amplitude * Math.sin((2 * Math.PI * hz * frame) / RATE);
const at = (input: InputSource, frame: number) =>
  Math.fround(typeof input === 'function' ? input(frame) : (input[frame] ?? 0));

/** Arnés con una capa sonando (para que haya transporte y bucle) y el transporte en marcha. */
function playing(): Harness {
  const h = new Harness({ sampleRate: RATE });
  h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.1) });
  h.send({ type: 'play' });
  return h;
}

describe('tomas fijas', () => {
  it('empieza en el siguiente compás exacto, dura 1 compás y se alinea restando la latencia', () => {
    const h = playing();
    const input = tone(100);
    h.renderUntil(60_000, input);
    h.send({ type: 'record', layer: 1, bars: 1, countIn: false, fitTempo: false });
    expect(h.status().recording).toBe('count-in');
    h.renderUntil(2 * BAR + 2000, input);
    expect(h.noticesOf('take-started')[0]?.value).toBe(BAR);
    expect(h.noticesOf('take-committed')[0]?.value).toBe(BAR);
    const content = h.core.layerContent(1)!;
    expect(content.frames).toBe(BAR);
    expect(content.lengthBeats).toBe(4);
    expect(content.offsetBeats).toBe(0);
    expect(content.source).toEqual({ kind: 'recording' });
    // La muestra k de la toma es la entrada que llegó D = 48 muestras (la latencia del núcleo)
    // después de que el transporte pasara por BAR + k.
    const d = h.core.outputLatency;
    for (let k = JUNCTION; k < BAR; k++) expect(content.data[k]).toBe(at(input, BAR + k + d));
    // Junta: el principio se cruza con lo que se grabó justo después de la vuelta completa.
    for (let k = 0; k < JUNCTION; k++) {
      const expected =
        at(input, BAR + k + d) * junction[k]! + at(input, 2 * BAR + k + d) * (1 - junction[k]!);
      expect(content.data[k]).toBeCloseTo(expected, 6);
    }
  });

  it('desplaza la toma la latencia de ida y vuelta que se le diga (N muestras)', () => {
    const h = playing();
    const input = tone(150);
    h.send({ type: 'set-latency', frames: 1000 });
    h.renderUntil(60_000, input);
    h.send({ type: 'record', layer: 1, bars: 1, countIn: false, fitTempo: false });
    h.renderUntil(2 * BAR + 3000, input);
    const content = h.core.layerContent(1)!;
    const shift = 1000 + h.core.outputLatency;
    for (let k = JUNCTION; k < BAR; k += 97)
      expect(content.data[k]).toBe(at(input, BAR + k + shift));
  });

  it('si se cierra antes, el resto queda en silencio (con el final fundido)', () => {
    const h = playing();
    const input = tone(200);
    h.renderUntil(60_000, input);
    h.send({ type: 'record', layer: 1, bars: 2, countIn: false, fitTempo: false });
    h.renderUntil(BAR + 100_000, input);
    h.send({ type: 'record', layer: 1, bars: 2, countIn: false, fitTempo: false });
    h.renderUntil(BAR + 100_000 + 2000, input);
    const content = h.core.layerContent(1)!;
    expect(content.frames).toBe(2 * BAR);
    expect(content.lengthBeats).toBe(8);
    const d = h.core.outputLatency;
    expect(content.data[50_000]).toBe(at(input, BAR + 50_000 + d));
    for (let k = 0; k < JUNCTION; k++) {
      const expected = at(input, BAR + 100_000 + k + d) * (1 - junction[k]!);
      expect(content.data[100_000 + k]).toBeCloseTo(expected, 6);
    }
    expect(content.data.subarray(100_000 + JUNCTION).every((x) => x === 0)).toBe(true);
  });

  it('con la cuenta previa y el transporte en marcha, empieza al menos 4 pulsos después', () => {
    const h = playing();
    h.renderUntil(60_000); // pulso 1,875
    h.send({ type: 'set-metronome', enabled: false });
    h.send({ type: 'record', layer: 1, bars: 1, countIn: true, fitTempo: false });
    h.renderUntil(60_000 + 1000);
    expect(h.status().countInBeats).toBeCloseTo(8 - 61_000 / BEAT, 6);
    const { left } = h.renderUntil(2 * BAR + 100);
    expect(h.noticesOf('take-started')[0]?.value).toBe(2 * BAR); // pulso 8
    // Suenan los clics de la cuenta previa en los pulsos 2 a 7 (sobre la capa 0 constante).
    const d = h.core.outputLatency;
    const base = Math.fround(0.1 * CENTER);
    for (const beat of [2, 3, 4, 5, 6, 7]) {
      const n = beat * BEAT + d + 20 - 61_000;
      expect(Math.abs(left[n]! - base)).toBeGreaterThan(0);
    }
    expect(left[3 * BEAT + 10_000 - 61_000]).toBe(base);
  });

  it('con la cuenta previa y el transporte parado, cuenta 4 pulsos y arranca grabando', () => {
    const h = new Harness({ sampleRate: RATE });
    const input = tone(100);
    h.send({ type: 'record', layer: 0, bars: 1, countIn: true, fitTempo: false });
    expect(h.status().countInBeats).toBe(4);
    const { left } = h.render(BAR + 1000, input);
    // Clics en las muestras 0, 32.000, 64.000 y 96.000 (con el transporte aún parado).
    const d = h.core.outputLatency;
    for (const beat of [0, 1, 2, 3]) {
      expect(left[beat * BEAT + d]).toBe(0);
      expect(left[beat * BEAT + d + 5]).not.toBe(0);
    }
    expect(left[BEAT / 2]).toBe(0);
    expect(h.core.transportState).toBe('playing');
    expect(h.noticesOf('take-started')[0]?.value).toBe(0);
    h.render(BAR + 1000, input);
    // La toma solo tiene el micrófono: los clics no se graban.
    const content = h.core.layerContent(0)!;
    for (let k = JUNCTION; k < BAR; k += 101) expect(content.data[k]).toBe(at(input, BAR + k + d));
  });

  it('en pausa a mitad de compás, la cuenta previa acaba justo donde empieza la toma', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'play' });
    h.renderUntil(Math.round(5.3 * BEAT));
    h.send({ type: 'pause' });
    h.render(RATE / 10);
    const paused = h.core.transportFrame;
    h.send({ type: 'record', layer: 1, bars: 1, countIn: true, fitTempo: false });
    // El transporte se coloca en el compás siguiente (pulso 8) antes de contar.
    expect(h.core.beat).toBe(8);
    const { left } = h.render(6 * BEAT);
    // Cuatro clics a un pulso exacto entre sí y nada más: la toma empieza un pulso después del
    // último, en el pulso 8, y las capas no vuelven a sonar a mitad de compás.
    const d = h.core.outputLatency;
    for (const beat of [0, 1, 2, 3]) {
      expect(left[beat * BEAT + d]).toBe(0);
      expect(left[beat * BEAT + d + 5]).not.toBe(0);
    }
    expect(left.subarray(3 * BEAT + d + 3000).every((x) => x === 0)).toBe(true);
    expect(h.noticesOf('take-started')[0]?.value).toBe(paused);
    expect(h.core.transportFrame - paused).toBe(2 * BEAT);
    expect(h.core.beat).toBeCloseTo(10, 9);
  });
});

describe('cola y grabación', () => {
  it('un sonido en cola que entra antes de la toma espera a su compás y la toma se suma a él', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.125) });
    h.send({ type: 'play' });
    h.renderUntil(50_000);
    h.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.25) });
    h.renderUntil(51_280);
    const input = tone(100);
    h.send({ type: 'record', layer: 1, bars: 1, countIn: false, fitTempo: false });
    expect(h.status().layers[1]!.pending).toBe(true);
    h.renderUntil(2 * BAR + 2000, input);
    // La cola entra exacta en el compás 1, y la toma empieza en esa misma muestra.
    expect(h.noticesOf('sound-applied').at(-1)?.value).toBe(BAR);
    expect(h.noticesOf('take-started')[0]?.value).toBe(BAR);
    const content = h.core.layerContent(1)!;
    expect(content.lengthBeats).toBe(8);
    const d = h.core.outputLatency;
    for (let k = JUNCTION; k < BAR; k += 113) {
      expect(content.data[BAR + k]).toBe(Math.fround(0.25 + at(input, BAR + k + d)));
    }
    // Deshacer: primero el sonido de la cola, después el anterior.
    h.send({ type: 'undo', layer: 1 });
    expect(h.core.layerContent(1)?.source).toEqual({ kind: 'library', id: 'constante-0.25' });
    h.send({ type: 'undo', layer: 1 });
    expect(h.core.layerContent(1)?.source).toEqual({ kind: 'library', id: 'constante-0.125' });
  });

  it('si la toma empieza antes que la cola (toma libre), el sonido entra al empezar la toma', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.1) });
    h.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.125) });
    h.send({ type: 'play' });
    h.renderUntil(50_000);
    h.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.25) });
    h.renderUntil(51_280);
    h.send({ type: 'record', layer: 1, bars: 0, countIn: false, fitTempo: false });
    expect(h.noticesOf('sound-applied').at(-1)?.value).toBe(51_280);
    expect(h.noticesOf('take-started')[0]?.value).toBe(51_280);
    expect(h.status().layers[1]!.pending).toBe(false);
  });
});

describe('tomas libres', () => {
  it('la primera se cierra al pulsar y fija la duración del bucle', () => {
    const h = new Harness({ sampleRate: RATE });
    const input = tone(220);
    h.send({ type: 'record', layer: 0, bars: 0, countIn: false, fitTempo: false });
    expect(h.core.transportState).toBe('playing');
    h.render(100_000, input);
    h.send({ type: 'record', layer: 0, bars: 0, countIn: false, fitTempo: false });
    h.render(2000, input);
    const content = h.core.layerContent(0)!;
    expect(content.frames).toBe(100_000);
    expect(content.lengthBeats).toBeCloseTo(100_000 / BEAT, 12);
    expect(h.core.bpm).toBe(90);
    expect(content.data[50_000]).toBe(at(input, 50_000 + h.core.outputLatency));
  });

  it('si no hay otras capas, ajusta el tempo a un número entero de compases', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'record', layer: 0, bars: 0, countIn: false, fitTempo: true });
    h.render(100_000, tone(220));
    h.send({ type: 'record', layer: 0, bars: 0, countIn: false, fitTempo: true });
    h.render(2000, tone(220));
    // 100.000 muestras = 3,125 pulsos a 90 BPM → 1 compás a 115,2 BPM.
    expect(h.noticesOf('tempo-fitted')[0]?.value).toBeCloseTo(115.2, 9);
    expect(h.core.bpm).toBeCloseTo(115.2, 9);
    const content = h.core.layerContent(0)!;
    expect(content.lengthBeats).toBe(4);
    expect(content.offsetBeats).toBe(0);
    // La línea de tiempo empieza en la toma: el pulso 4 es la muestra 100.000.
    expect(h.core.beat).toBeCloseTo((h.core.transportFrame * 4) / 100_000, 9);
  });

  it('descarta una toma libre demasiado corta (doble pulsación)', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'record', layer: 0, bars: 0, countIn: false, fitTempo: true });
    h.render(4800, tone(220));
    h.send({ type: 'record', layer: 0, bars: 0, countIn: false, fitTempo: true });
    h.render(2000);
    expect(h.noticesOf('take-cancelled')[0]?.reason).toBe('too-short');
    expect(h.core.layerContent(0)).toBeNull();
  });

  it('se cierra sola a los 60 s', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'record', layer: 0, bars: 0, countIn: false, fitTempo: false });
    h.render(60 * RATE + 2000);
    expect(h.core.layerContent(0)?.frames).toBe(60 * RATE);
    expect(h.status().recording).toBe('idle');
  });

  it('con otras capas, sigue la duración del bucle: empieza ya y se cierra sola', () => {
    const h = playing(); // capa 0: 8 pulsos
    const input = tone(300);
    h.renderUntil(60_000, input);
    h.send({ type: 'record', layer: 1, bars: 0, countIn: false, fitTempo: true });
    h.renderUntil(60_000 + 2 * BAR + 2000, input);
    expect(h.noticesOf('take-started')[0]?.value).toBe(60_000);
    expect(h.noticesOf('tempo-fitted')).toHaveLength(0);
    const content = h.core.layerContent(1)!;
    expect(content.frames).toBe(2 * BAR);
    expect(content.lengthBeats).toBe(8);
    expect(content.offsetBeats).toBeCloseTo(60_000 / BEAT, 12);
    expect(content.data[1000]).toBe(at(input, 60_000 + 1000 + h.core.outputLatency));
  });
});

describe('sobregrabación', () => {
  it('suma la toma a lo que había y deja la biblioteca en el deshacer', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.25) });
    h.send({ type: 'play' });
    const input = tone(100);
    h.renderUntil(60_000, input);
    h.send({ type: 'record', layer: 0, bars: 2, countIn: false, fitTempo: false });
    h.renderUntil(3 * BAR + 2000, input);
    const content = h.core.layerContent(0)!;
    expect(content.source).toEqual({ kind: 'recording' });
    expect(content.frames).toBe(2 * BAR);
    const d = h.core.outputLatency;
    // Empezó en el compás 1: la cabeza estaba en la muestra 128.000 del bucle.
    for (let k = JUNCTION; k < 2 * BAR; k += 113) {
      const position = (BAR + k) % (2 * BAR);
      expect(content.data[position]).toBe(Math.fround(0.25 + at(input, BAR + k + d)));
    }
    h.send({ type: 'undo', layer: 0 });
    expect(h.core.layerContent(0)?.source).toEqual({ kind: 'library', id: 'constante-0.25' });
    h.send({ type: 'redo', layer: 0 });
    expect(h.core.layerContent(0)).toBe(content);
  });

  it('si la toma es más larga que la capa, la capa se repite hasta su duración', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.25, 4) });
    h.send({ type: 'play' });
    h.renderUntil(10_000);
    h.send({ type: 'record', layer: 0, bars: 2, countIn: false, fitTempo: false });
    h.renderUntil(3 * BAR + 2000);
    const content = h.core.layerContent(0)!;
    expect(content.lengthBeats).toBe(8);
    expect(content.frames).toBe(2 * BAR);
    expect(content.data.every((x) => x === 0.25)).toBe(true);
  });

  it('una toma de 4 compases sobre una capa de 3 suena igual durante la toma y después', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: rampSound(RATE, 12) });
    h.send({ type: 'play' });
    h.renderUntil(13 * BEAT);
    // Entrada en silencio: la capa nueva es lo que sonó durante la toma (pulsos 16 a 32).
    h.send({ type: 'record', layer: 0, bars: 4, countIn: false, fitTempo: false });
    const during = h.renderUntil(32 * BEAT).left;
    const after = h.render(16 * BEAT).left;
    expect(h.noticesOf('take-started')[0]?.value).toBe(16 * BEAT);
    const content = h.core.layerContent(0)!;
    expect(content.lengthBeats).toBe(16);
    expect(content.frames).toBe(16 * BEAT);
    // Lo que sonó en el pulso 16 + x vuelve a sonar en el 32 + x (pasado el cruce de la confirmación).
    let worst = 0;
    for (let x = 2000; x < 16 * BEAT; x++) {
      worst = Math.max(worst, Math.abs(after[x]! - during[3 * BEAT + x]!));
    }
    expect(worst).toBeLessThan(1e-4);
  });

  it('una toma libre que sigue un bucle de 12 pulsos sobre una capa de 8 no la desplaza', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.1, 12) });
    h.send({ type: 'set-pan', layer: 0, pan: 1 });
    h.send({ type: 'set-sound', layer: 1, sound: rampSound(RATE, 8) });
    h.send({ type: 'set-pan', layer: 1, pan: -1 });
    h.send({ type: 'play' });
    h.renderUntil(150_000); // pulso 4,6875
    h.send({ type: 'record', layer: 1, bars: 0, countIn: false, fitTempo: false });
    const during = h.render(12 * BEAT).left;
    const after = h.render(12 * BEAT).left;
    expect(h.noticesOf('take-started')[0]?.value).toBe(150_000);
    const content = h.core.layerContent(1)!;
    expect(content.lengthBeats).toBe(12);
    expect(content.offsetBeats).toBeCloseTo(4.6875, 12);
    let worst = 0;
    for (let x = 2000; x < 12 * BEAT; x++) {
      worst = Math.max(worst, Math.abs(after[x]! - during[x]!));
    }
    expect(worst).toBeLessThan(1e-4);
  });

  it.each([120, 60])('a %i BPM sobre una capa de 90 BPM, remuestrea la toma donde suena', (bpm) => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0) });
    h.send({ type: 'set-tempo', bpm });
    h.send({ type: 'play' });
    const input = tone(500);
    const bar = Math.round((4 * 60 * RATE) / bpm);
    h.renderUntil(1000, input);
    h.send({ type: 'record', layer: 0, bars: 2, countIn: false, fitTempo: false });
    h.renderUntil(3 * bar + 2000, input);
    expect(h.noticesOf('take-committed')).toHaveLength(1);
    // La vuelta siguiente reproduce la entrada, una vuelta (8 pulsos) después.
    const { left } = h.render(2 * bar, input);
    const start = h.frame - 2 * bar;
    let worst = 0;
    for (let n = 2000; n < 2 * bar - 2000; n++) {
      const expected = at(input, start + n - 2 * bar) * CENTER;
      worst = Math.max(worst, Math.abs(left[n]! - expected));
    }
    expect(worst).toBeLessThan(bpm < 90 ? 0.01 : 0.002);
  });

  it.each([120, 60])('en reverso y a %i BPM, también remuestrea hacia atrás', (bpm) => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0) });
    h.send({ type: 'set-reverse', layer: 0, reversed: true });
    h.send({ type: 'set-tempo', bpm });
    h.send({ type: 'play' });
    const input = tone(500);
    const bar = Math.round((4 * 60 * RATE) / bpm);
    h.renderUntil(1000, input);
    h.send({ type: 'record', layer: 0, bars: 2, countIn: false, fitTempo: false });
    h.renderUntil(3 * bar + 2000, input);
    const { left } = h.render(2 * bar, input);
    const start = h.frame - 2 * bar;
    let worst = 0;
    for (let n = 2000; n < 2 * bar - 2000; n++) {
      worst = Math.max(worst, Math.abs(left[n]! - at(input, start + n - 2 * bar) * CENTER));
    }
    expect(worst).toBeLessThan(bpm < 90 ? 0.01 : 0.002);
  });

  it('en una capa en reverso, la toma suena hacia delante (se escribe donde lee la cabeza)', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0) });
    h.send({ type: 'set-reverse', layer: 0, reversed: true });
    h.send({ type: 'play' });
    const input = tone(500);
    h.renderUntil(1000, input);
    h.send({ type: 'record', layer: 0, bars: 2, countIn: false, fitTempo: false });
    h.renderUntil(3 * BAR + 2000, input);
    const { left } = h.render(2 * BAR, input);
    const start = h.frame - 2 * BAR;
    let worst = 0;
    for (let n = 2000; n < 2 * BAR - 2000; n++) {
      worst = Math.max(worst, Math.abs(left[n]! - at(input, start + n - 2 * BAR) * CENTER));
    }
    expect(worst).toBeLessThan(1e-6);
  });
});

describe('juntas, bloqueos y estados', () => {
  it('la junta de una toma de vuelta completa no hace clic', () => {
    const h = playing();
    const input = tone(97, 0.5);
    h.renderUntil(60_000, input);
    h.send({ type: 'record', layer: 1, bars: 1, countIn: false, fitTempo: false });
    h.renderUntil(2 * BAR + 2000, input);
    h.send({ type: 'set-mute', layer: 0, muted: true });
    h.render(RATE / 2);
    const { left } = h.render(3 * BAR);
    const own = 0.5 * 2 * Math.PI * (97 / RATE) * CENTER;
    expect(maxJump(left)).toBeLessThanOrEqual(own + 0.01);
  });

  it('tampoco con polaridad opuesta a fondo de escala (Δ = 1,8 a 44,1 kHz)', () => {
    const rate = 44_100;
    const bar = loopFrames(4, rate); // 117.600 muestras
    const junctionFrames = 441; // 10 ms
    // Medio ciclo por compás: la toma empieza en −0,9 y acaba en +0,9.
    const input: InputSource = (frame) => 0.9 * Math.cos((Math.PI * frame) / bar);
    const h = new Harness({ sampleRate: rate });
    h.send({ type: 'play' });
    h.renderUntil(1000, input);
    h.send({ type: 'record', layer: 0, bars: 1, countIn: false, fitTempo: false });
    h.renderUntil(2 * bar + 2000, input);
    const content = h.core.layerContent(0)!;
    // En la junta, el final de la vuelta (+0,9) se cruza con el principio de la toma (−0,9).
    expect(content.data[0]).toBeCloseTo(0.9, 2);
    expect(content.data[junctionFrames + 10]).toBeCloseTo(-0.9, 2);
    h.send({ type: 'set-pan', layer: 0, pan: -1 });
    h.render(rate / 2);
    const { left } = h.render(2 * bar);
    const own = (0.9 * Math.PI) / bar;
    // π/2 · 1,8 / 441 ≈ 0,0064: dentro del margen (con 5 ms serían 0,0128).
    expect(maxJump(left)).toBeGreaterThan(0.005);
    expect(maxJump(left)).toBeLessThanOrEqual(own + 0.01);
  });

  it('durante una toma se bloquean tempo, reverso, disco, deshacer, sonidos y archivos', () => {
    const h = playing();
    h.renderUntil(BAR + 1000);
    h.send({ type: 'record', layer: 1, bars: 2, countIn: false, fitTempo: false });
    // Empieza en el compás siguiente (2 × BAR); la cuenta hasta allí también bloquea.
    h.renderUntil(2 * BAR + 20_000);
    expect(h.status().recording).toBe('recording');
    h.send({ type: 'set-tempo', bpm: 120 });
    h.send({ type: 'set-reverse', layer: 0, reversed: true });
    h.send({ type: 'disc-hold', layer: 0 });
    h.send({ type: 'undo', layer: 0 });
    h.send({ type: 'redo', layer: 0 });
    h.send({ type: 'set-sound', layer: 2, sound: constantSound(RATE, 0.2) });
    h.send({ type: 'clear-layer', layer: 0 });
    h.send({ type: 'load-session', session: exportState(h.core) });
    h.send({ type: 'reset' });
    h.send({ type: 'record', layer: 2, bars: 1, countIn: false, fitTempo: false });
    // Siguen libres: nivel, silencio, panorama, filtro y volumen.
    h.send({ type: 'set-level', layer: 0, level: 0.5 });
    h.send({ type: 'set-mute', layer: 2, muted: true });
    h.send({ type: 'set-pan', layer: 0, pan: 0.5 });
    h.send({ type: 'set-filter', layer: 0, amount: 0.5 });
    h.send({ type: 'set-volume', volume: 0.8 });
    const status = h.status();
    h.flush();
    expect(h.noticesOf('locked').map((n) => n.command)).toEqual([
      'set-tempo',
      'set-reverse',
      'disc-hold',
      'undo',
      'redo',
      'set-sound',
      'clear-layer',
      'load-session',
      'reset',
      'record',
    ]);
    expect(h.core.bpm).toBe(90);
    expect(status.recording).toBe('recording');
    expect(status.layers[0]).toMatchObject({ level: 0.5, pan: 0.5, filter: 0.5, reversed: false });
    expect(status.layers[0]!.hasContent).toBe(true);
    expect(status.layers[2]!.muted).toBe(true);
  });

  it('pausar cierra la toma; pausar en la cuenta previa la cancela; el reposo también', () => {
    const h = playing();
    const input = tone(100);
    h.renderUntil(BAR, input);
    h.send({ type: 'record', layer: 1, bars: 2, countIn: false, fitTempo: false });
    h.render(50_000, input);
    h.send({ type: 'pause' });
    h.render(5000, input);
    expect(h.core.layerContent(1)?.frames).toBe(2 * BAR);
    expect(h.noticesOf('take-committed')).toHaveLength(1);

    h.send({ type: 'play' });
    h.send({ type: 'record', layer: 2, bars: 1, countIn: true, fitTempo: false });
    h.render(1000);
    h.send({ type: 'pause' });
    h.render(1000);
    expect(h.noticesOf('take-cancelled').at(-1)?.reason).toBe('cancelled');
    expect(h.core.layerContent(2)).toBeNull();

    h.send({ type: 'play' });
    h.send({ type: 'record', layer: 2, bars: 0, countIn: false, fitTempo: false });
    h.render(1000);
    h.send({ type: 'standby' });
    h.render(1000);
    expect(h.noticesOf('take-cancelled').at(-1)?.reason).toBe('standby');
    expect(h.core.transportState).toBe('stopped');
    // El reposo conserva las capas.
    expect(h.core.layerContent(0)).not.toBeNull();
    expect(h.core.layerContent(1)).not.toBeNull();
  });

  it('pulsar grabar en la cuenta previa la cancela; cancelar descarta la toma', () => {
    const h = playing();
    h.send({ type: 'record', layer: 1, bars: 1, countIn: true, fitTempo: false });
    h.send({ type: 'record', layer: 1, bars: 1, countIn: true, fitTempo: false });
    expect(h.status().recording).toBe('idle');
    h.send({ type: 'record', layer: 1, bars: 0, countIn: false, fitTempo: false });
    h.render(10_000, tone(100));
    h.send({ type: 'cancel-recording' });
    h.render(BAR * 3);
    expect(h.core.layerContent(1)).toBeNull();
    expect(h.noticesOf('take-cancelled')).toHaveLength(2);
  });

  it('el estado informa del avance de la toma', () => {
    const h = playing();
    h.renderUntil(BAR);
    h.send({ type: 'record', layer: 1, bars: 1, countIn: false, fitTempo: false });
    h.render(BAR / 2);
    const status = h.status();
    expect(status.recordLayer).toBe(1);
    expect(status.recordProgress).toBeCloseTo(0.5, 2);
    expect(status.recordSeconds).toBeCloseTo(BAR / 2 / RATE, 2);
  });

  it('rechaza las tomas que pasarían de 60 s (record: too-long)', () => {
    // Un bucle de 88 pulsos a 90 BPM dura 58,7 s; a 60 BPM, una toma libre que lo siga duraría 88 s.
    const a = new Harness({ sampleRate: RATE });
    a.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.1, 88) });
    a.send({ type: 'set-tempo', bpm: 60 });
    a.send({ type: 'record', layer: 1, bars: 0, countIn: false, fitTempo: false });
    // Sobregrabar una capa de 4 pulsos grabada a 40 BPM (72.000 muestras por pulso) para que siga un
    // bucle de 44 pulsos: la toma dura 11 s a 240 BPM, pero la capa crecería a 66 s.
    const b = new Harness({ sampleRate: RATE });
    b.send({ type: 'set-sound', layer: 0, sound: sound('rapida', 44 * 12_000, 44, () => 0.1) });
    b.send({ type: 'set-sound', layer: 1, sound: sound('lenta', 4 * 72_000, 4, () => 0.1) });
    b.send({ type: 'set-tempo', bpm: 240 });
    b.send({ type: 'record', layer: 1, bars: 0, countIn: false, fitTempo: false });
    for (const h of [a, b]) {
      expect(h.noticesOf('rejected')).toEqual([
        expect.objectContaining({ command: 'record', reason: 'too-long' }),
      ]);
      expect(h.status().recording).toBe('idle');
      expect(h.core.layerContent(1)?.source.kind).toBe(h === a ? undefined : 'library');
    }
  });

  it('rechaza tomas imposibles: duración no válida o con el disco agarrado', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'record', layer: 0, bars: 3 as 1, countIn: false, fitTempo: false });
    h.send({ type: 'record', layer: 9, bars: 1, countIn: false, fitTempo: false });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.1) });
    h.send({ type: 'disc-hold', layer: 0 });
    h.send({ type: 'record', layer: 1, bars: 1, countIn: false, fitTempo: false });
    h.send({ type: 'disc-release' });
    // 4 compases a 40 BPM son 24 s: caben. Una toma libre de un bucle de 60 s a 40 BPM, no.
    h.send({ type: 'set-tempo', bpm: 40 });
    h.send({ type: 'record', layer: 1, bars: 4, countIn: false, fitTempo: false });
    h.send({ type: 'cancel-recording' });
    h.flush();
    const reasons = h.noticesOf('rejected').map((n) => `${n.command}: ${n.reason}`);
    expect(reasons).toEqual(['record: range', 'record: range', 'record: disc']);
    expect(h.noticesOf('take-cancelled')).toHaveLength(1);
    expect(loopFrames(16, RATE, 40)).toBe(24 * RATE);
  });
});
