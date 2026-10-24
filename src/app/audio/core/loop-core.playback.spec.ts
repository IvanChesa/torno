// LoopCore a nivel de muestras: transporte, varispeed, reverso, cola, mezcla, filtro y deriva.
// Criterio de clics de PLAN §5: el mayor salto entre muestras ≤ el de la propia señal + 0,01.
import { describe, expect, it } from 'vitest';
import {
  constantSound,
  Harness,
  loopFrames,
  maxJump,
  rampSound,
  rms,
  seededRandom,
  sineSound,
  sound,
} from './test-harness';

const RATE = 48_000;
const CENTER = Math.SQRT1_2;
/** Frecuencia del seno de prueba: 220 ciclos en un bucle de 8 pulsos a 90 BPM (≈ 41 Hz). */
const CYCLES = 220;

/**
 * Muestras en las que el diente de sierra da la vuelta: la salida cae de golpe (Hermite reparte la
 * caída en dos o tres muestras; cuenta la primera).
 */
function wraps(signal: Float32Array, from = 1): number[] {
  const found: number[] = [];
  for (let n = Math.max(1, from); n < signal.length; n++) {
    const last = found[found.length - 1];
    if (signal[n]! < signal[n - 1]! - 0.2 && (last === undefined || n - last > 1000)) found.push(n);
  }
  return found;
}

describe('transporte', () => {
  it('nada suena con el transporte parado', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.5) });
    const { left, right } = h.render(RATE);
    expect(left.every((x) => x === 0)).toBe(true);
    expect(right.every((x) => x === 0)).toBe(true);
  });

  it('reproducir entra con un fundido sin clics y suena el bucle con panorama centrado', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.5) });
    h.send({ type: 'play' });
    const { left, right } = h.render(RATE / 2);
    const steady = Math.fround(0.5 * CENTER);
    expect(left[RATE / 4]).toBe(steady);
    expect(right[RATE / 4]).toBe(steady);
    // De 0 a 0,354 en 10 ms: el paso máximo es π/2 · 0,354 / 480 ≈ 0,0012.
    expect(maxJump(left)).toBeLessThanOrEqual(0.01);
    expect(h.core.transportState).toBe('playing');
  });

  it('pausar apaga sin clics y congela la posición; reanudar sigue donde estaba', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: rampSound(RATE) });
    h.send({ type: 'play' });
    h.render(RATE);
    h.send({ type: 'pause' });
    const paused = h.render(RATE / 2);
    // Durante el fundido de 10 ms el transporte avanza; después se para del todo.
    expect(h.core.transportState).toBe('stopped');
    expect(h.core.transportFrame).toBe(RATE + 480);
    expect(paused.left.subarray(1000).every((x) => x === 0)).toBe(true);
    expect(h.noticesOf('stopped')).toHaveLength(1);
    h.send({ type: 'play' });
    const resumed = h.render(RATE / 4);
    // El diente de sierra codifica la posición: sigue en la muestra RATE + 480 del bucle.
    const n = 2000;
    const position = resumed.left[n]! / CENTER;
    const expected = (RATE + 480 + n - h.core.outputLatency) / loopFrames(8, RATE);
    expect(position).toBeCloseTo(expected, 5);
  });

  it('parar (mantener reproducir) vuelve al pulso 0', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: rampSound(RATE) });
    h.send({ type: 'play' });
    h.render(RATE);
    h.send({ type: 'stop' });
    h.render(RATE / 10);
    expect(h.core.transportFrame).toBe(0);
    expect(h.core.beat).toBe(0);
    h.send({ type: 'play' });
    const { left } = h.render(RATE / 4);
    const n = 3000;
    expect(left[n]! / CENTER).toBeCloseTo((n - h.core.outputLatency) / loopFrames(8, RATE), 5);
  });

  it('el tempo va de 40 a 240 BPM y rechaza valores fuera de rango', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-tempo', bpm: 240 });
    expect(h.core.bpm).toBe(240);
    h.send({ type: 'set-tempo', bpm: 39 });
    h.send({ type: 'set-tempo', bpm: Number.NaN });
    h.flush();
    expect(h.core.bpm).toBe(240);
    expect(h.noticesOf('rejected')).toHaveLength(2);
  });
});

describe('varispeed y reverso', () => {
  it.each([
    [44_100, 97],
    [48_000, 61],
    [48_000, 133],
  ])('a %i Hz y %i BPM, a doble tempo el bucle dura la mitad (±1 muestra)', (rate, bpm) => {
    const period = (tempo: number) => {
      const h = new Harness({ sampleRate: rate });
      h.send({ type: 'set-sound', layer: 0, sound: rampSound(rate) });
      h.send({ type: 'set-tempo', bpm: tempo });
      h.send({ type: 'play' });
      const frames = loopFrames(8, rate);
      const { left } = h.render(Math.ceil((frames * 90 * 3.2) / tempo));
      const found = wraps(left);
      return found.slice(1).map((n, i) => n - found[i]!);
    };
    const normal = period(bpm);
    const double = period(2 * bpm);
    const exact = (loopFrames(8, rate) * 90) / bpm;
    for (const p of normal) expect(Math.abs(p - exact)).toBeLessThanOrEqual(1);
    for (const p of double) expect(Math.abs(p - exact / 2)).toBeLessThanOrEqual(1);
  });

  it('el reverso es el espejo exacto del bucle hacia delante', () => {
    const random = seededRandom(3);
    const frames = loopFrames(8, RATE);
    const noise = sound('ruido', frames, 8, () => (random() * 2 - 1) * 0.5);
    const render = (reversed: boolean) => {
      const h = new Harness({ sampleRate: RATE });
      h.send({ type: 'set-sound', layer: 0, sound: noise });
      h.send({ type: 'set-reverse', layer: 0, reversed });
      h.core.playImmediately();
      return h.render(2 * frames + 1000).left;
    };
    const forward = render(false);
    const backward = render(true);
    // Segunda vuelta (la primera empieza con el fundido de entrada de la voz), con la
    // anticipación del limitador: hacia atrás, la muestra m es la N − 1 − m de hacia delante.
    const start = frames + 48;
    let worst = 0;
    for (let m = 0; m < frames; m++) {
      worst = Math.max(worst, Math.abs(backward[start + m]! - forward[start + frames - 1 - m]!));
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it('cambiar el reverso en marcha cruza las dos cabezas sin clic', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, CYCLES, 0.5) });
    h.send({ type: 'play' });
    const before = h.render(RATE);
    h.send({ type: 'set-reverse', layer: 0, reversed: true });
    const after = h.render(RATE);
    const own = maxJump(before.left, RATE / 2);
    expect(maxJump(after.left)).toBeLessThanOrEqual(own + 0.01);
    expect(h.status().layers[0]!.reversed).toBe(true);
  });
});

describe('cola de sonidos', () => {
  it.each([
    [48_000, 90],
    [44_100, 97],
  ])('a %i Hz y %i BPM, el cambio entra exactamente en el siguiente compás', (rate, bpm) => {
    const h = new Harness({ sampleRate: rate });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(rate, 0.5) });
    h.send({ type: 'set-tempo', bpm });
    h.send({ type: 'play' });
    h.renderUntil(Math.round((5.3 * 60 * rate) / bpm)); // a mitad del 2.º compás
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(rate, -0.5) });
    expect(h.status().layers[0]!.pending).toBe(true);
    const start = h.frame;
    const { left } = h.render(3 * rate);
    // Primera muestra con pulso ≥ 8: ceil(8 · 60 · fs / bpm), sin redondeos acumulados.
    const bar = Math.ceil((8 * 60 * rate) / bpm);
    const applied = h.noticesOf('sound-applied');
    expect(applied.at(-1)?.value).toBe(bar);
    const d = h.core.outputLatency;
    const old = Math.fround(0.5 * CENTER);
    expect(left[bar + d - start - 1]).toBe(old);
    expect(left[bar + d - start]).not.toBe(old);
    expect(left[bar + d - start + 600]).toBe(Math.fround(-0.5 * CENTER));
    // El fundido cruzado (10 ms) de +0,354 a −0,354: sin clic.
    expect(maxJump(left)).toBeLessThanOrEqual(0.01);
  });

  it('en pausa se aplica al momento; pausar aplica lo que estuviera en cola', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.25) });
    expect(h.core.layerContent(0)?.source).toEqual({ kind: 'library', id: 'constante-0.25' });
    h.send({ type: 'play' });
    h.render(1000);
    h.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.5) });
    expect(h.core.layerContent(1)).toBeNull();
    h.send({ type: 'pause' });
    h.render(2000);
    expect(h.core.layerContent(1)?.data[0]).toBe(0.5);
  });

  it('deshacer cancela la cola; con la cola vacía restaura el sonido anterior', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.25) });
    h.send({ type: 'play' });
    h.render(1000);
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.5) });
    h.send({ type: 'undo', layer: 0 });
    h.render(RATE * 6);
    expect(h.core.layerContent(0)?.data[0]).toBe(0.25);
    expect(h.noticesOf('sound-applied')).toHaveLength(1);
    // Sin cola: deshacer vuelve al estado anterior (la capa vacía) y rehacer lo recupera.
    h.send({ type: 'undo', layer: 0 });
    expect(h.core.layerContent(0)).toBeNull();
    h.send({ type: 'redo', layer: 0 });
    expect(h.core.layerContent(0)?.data[0]).toBe(0.25);
    const { left } = h.render(RATE);
    expect(maxJump(left)).toBeLessThanOrEqual(0.01);
  });

  it('APAGADO deja la capa vacía con un fundido', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.5) });
    h.send({ type: 'play' });
    h.render(RATE);
    h.send({ type: 'set-sound', layer: 0, sound: null });
    const { left } = h.render(RATE * 6);
    expect(h.core.layerContent(0)).toBeNull();
    expect(left[left.length - 1]).toBe(0);
    expect(maxJump(left)).toBeLessThanOrEqual(0.01);
  });

  it('rechaza un sonido que no es válido', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({
      type: 'set-sound',
      layer: 0,
      sound: { id: 'x', pcm: new Float32Array(0), lengthBeats: 8 },
    });
    h.send({
      type: 'set-sound',
      layer: 0,
      sound: { id: 'x', pcm: new Float32Array(100), lengthBeats: 8 },
    });
    h.send({ type: 'set-sound', layer: 7, sound: constantSound(RATE, 0.5) });
    h.flush();
    expect(h.noticesOf('rejected')).toHaveLength(3);
    expect(h.core.layerContent(0)).toBeNull();
  });
});

describe('mezcla y filtro', () => {
  it('nivel, silencio y panorama se suavizan (~10 ms) y el panorama es de igual potencia', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.5) });
    h.send({ type: 'play' });
    h.render(RATE / 2);
    h.send({ type: 'set-pan', layer: 0, pan: 1 });
    const panned = h.render(RATE / 2);
    expect(panned.left[panned.left.length - 1]).toBe(0);
    expect(panned.right[panned.right.length - 1]).toBe(0.5);
    expect(maxJump(panned.left)).toBeLessThanOrEqual(0.01);
    expect(maxJump(panned.right)).toBeLessThanOrEqual(0.01);
    h.send({ type: 'set-pan', layer: 0, pan: -0.5 });
    const { left, right } = h.render(RATE / 2);
    const l = left[left.length - 1]!;
    const r = right[right.length - 1]!;
    expect(l * l + r * r).toBeCloseTo(0.25, 6);
    h.send({ type: 'set-mute', layer: 0, muted: true });
    const muted = h.render(RATE / 2);
    expect(muted.left[muted.left.length - 1]).toBe(0);
    expect(maxJump(muted.left)).toBeLessThanOrEqual(0.01);
    h.send({ type: 'set-mute', layer: 0, muted: false });
    h.send({ type: 'set-level', layer: 0, level: 0.5 });
    const level = h.render(RATE / 2);
    expect(level.left[level.left.length - 1]).toBeCloseTo((0.25 * l) / 0.5, 6);
  });

  it('el filtro en el extremo exterior es transparente al bit, y vuelve a serlo al retirarlo', () => {
    const random = seededRandom(5);
    const noise = sound('ruido', loopFrames(8, RATE), 8, () => (random() * 2 - 1) * 0.5);
    const reference = new Harness({ sampleRate: RATE });
    reference.send({ type: 'set-sound', layer: 0, sound: noise });
    reference.send({ type: 'play' });
    const plain = reference.render(3 * RATE).left;

    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: noise });
    h.send({ type: 'set-filter', layer: 0, amount: 0 });
    h.send({ type: 'play' });
    const open = h.render(RATE).left;
    for (let n = 0; n < RATE; n++) expect(open[n]).toBe(plain[n]);
    h.send({ type: 'set-filter', layer: 0, amount: 1 });
    const closed = h.render(RATE).left;
    // Con el corte en 150 Hz, el ruido blanco pierde casi toda su energía.
    expect(rms(closed, RATE / 2)).toBeLessThan(0.15 * rms(plain, RATE, RATE + RATE / 2));
    h.send({ type: 'set-filter', layer: 0, amount: 0 });
    const reopened = h.render(RATE).left;
    for (let n = RATE / 2; n < RATE; n++) expect(reopened[n]).toBe(plain[2 * RATE + n]);
  });

  it('mover el brazo en marcha no hace clics', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, CYCLES * 20, 0.5) });
    h.send({ type: 'play' });
    const before = h.render(RATE / 2).left;
    const own = maxJump(before, RATE / 4);
    for (let step = 1; step <= 10; step++) {
      h.send({ type: 'set-filter', layer: 0, amount: step / 10 });
      expect(maxJump(h.render(RATE / 20).left)).toBeLessThanOrEqual(own + 0.01);
    }
    h.send({ type: 'set-filter', layer: 0, amount: 0 });
    expect(maxJump(h.render(RATE / 2).left)).toBeLessThanOrEqual(own + 0.01);
  });

  it('el volumen general se suaviza y se aplica después del limitador', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.5) });
    h.send({ type: 'play' });
    h.render(RATE / 2);
    h.send({ type: 'set-volume', volume: 0.5 });
    const { left } = h.render(RATE / 2);
    expect(left[left.length - 1]).toBeCloseTo(0.25 * CENTER, 6);
    expect(maxJump(left)).toBeLessThanOrEqual(0.01);
  });
});

describe('limitador en el núcleo', () => {
  it('con 4 capas a tope y en fase, la salida nunca pasa de −0,3 dBFS', () => {
    const h = new Harness({ sampleRate: RATE });
    for (let layer = 0; layer < 4; layer++) {
      h.send({ type: 'set-sound', layer, sound: sineSound(RATE, CYCLES, 1) });
    }
    h.send({ type: 'play' });
    const { left, right } = h.render(4 * RATE);
    const ceiling = Math.fround(10 ** (-0.3 / 20));
    let peak = 0;
    for (let n = 0; n < left.length; n++)
      peak = Math.max(peak, Math.abs(left[n]!), Math.abs(right[n]!));
    expect(peak).toBeLessThanOrEqual(ceiling);
    expect(peak).toBeGreaterThan(0.9 * ceiling);
    // La ganancia mínima del limitador en el último estado (sin forzar uno nuevo).
    expect(h.core.status.limiterGain).toBeLessThan(0.5);
  });
});

describe('deriva y determinismo', () => {
  it('deriva 0 en 10 minutos: el bucle sigue cayendo en su muestra exacta (±1)', () => {
    const rate = 44_100;
    const bpm = 97;
    const h = new Harness({ sampleRate: rate });
    h.send({ type: 'set-sound', layer: 0, sound: rampSound(rate) });
    h.send({ type: 'set-tempo', bpm });
    h.core.playImmediately();
    const minutes = 10 * 60 * rate;
    h.render(minutes - 6 * rate);
    const start = h.frame;
    // 6 s: más de una vuelta del bucle (≈ 4,9 s a 97 BPM).
    const { left } = h.render(6 * rate);
    // El diente de sierra da la vuelta cuando la posición cruza k·N: en ceil(k · N / velocidad).
    const frames = loopFrames(8, rate);
    const speed = (bpm / 60 / rate) * (frames / 8);
    for (const n of wraps(left)) {
      const k = Math.round(((start + n - h.core.outputLatency) * speed) / frames);
      const exact = Math.ceil((k * frames) / speed) + h.core.outputLatency;
      expect(Math.abs(start + n - exact)).toBeLessThanOrEqual(1);
    }
    expect(wraps(left).length).toBeGreaterThan(0);
  }, 60_000);

  it('mismos comandos en las mismas muestras → mismos bytes, sea cual sea el tamaño de bloque', () => {
    const script = (block: number) => {
      const h = new Harness({ sampleRate: RATE });
      const random = seededRandom(11);
      const noise = sound('ruido', loopFrames(4, RATE), 4, () => (random() * 2 - 1) * 0.4);
      h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, CYCLES, 0.4) });
      h.send({ type: 'set-sound', layer: 1, sound: noise });
      h.send({ type: 'set-filter', layer: 1, amount: 0.6 });
      h.send({ type: 'set-tempo', bpm: 113 });
      h.send({ type: 'play' });
      const chunks: Float32Array[] = [];
      const step = (until: number) => chunks.push(h.render(until - h.frame, undefined, block).left);
      step(10_000);
      h.send({ type: 'set-pan', layer: 0, pan: -1 });
      h.send({ type: 'set-reverse', layer: 1, reversed: true });
      step(35_001);
      h.send({ type: 'set-sound', layer: 2, sound: constantSound(RATE, 0.3, 8) });
      h.send({ type: 'disc-hold', layer: 0 });
      step(45_000);
      h.send({ type: 'disc-move', turns: 0.3 });
      step(60_000);
      h.send({ type: 'disc-release' });
      h.send({ type: 'pause' });
      step(80_000);
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      const all = new Float32Array(total);
      let at = 0;
      for (const c of chunks) {
        all.set(c, at);
        at += c.length;
      }
      return Buffer.from(all.buffer);
    };
    const reference = script(128);
    expect(script(1)).toEqual(reference);
    expect(script(77)).toEqual(reference);
    expect(script(1 << 20)).toEqual(reference);
  }, 30_000);

  it('grabando, la misma entrada da los mismos bytes en la capa y en la salida', () => {
    const take = (block: number) => {
      const h = new Harness({ sampleRate: RATE });
      const input = (f: number) => 0.3 * Math.sin(f / 7) + 0.1 * Math.sin(f / 131);
      h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, CYCLES, 0.3) });
      h.send({ type: 'set-tempo', bpm: 117 });
      h.send({ type: 'set-latency', frames: 333 });
      h.send({ type: 'play' });
      h.render(10_001, input, block);
      // Sobregrabación a otro tempo (remuestreada) y una toma nueva en otra capa.
      h.send({ type: 'record', layer: 0, bars: 1, countIn: false, fitTempo: false });
      const out = h.render(200_000, input, block).left;
      h.send({ type: 'record', layer: 1, bars: 0, countIn: false, fitTempo: false });
      h.render(30_000, input, block);
      h.send({ type: 'record', layer: 1, bars: 0, countIn: false, fitTempo: false });
      h.render(10_000, input, block);
      const layer0 = h.core.layerContent(0)!;
      const layer1 = h.core.layerContent(1)!;
      return [out, layer0.data.slice(0, layer0.frames), layer1.data.slice(0, layer1.frames)].map(
        (a) => Buffer.from(a.buffer),
      );
    };
    const reference = take(128);
    expect(take(1)).toEqual(reference);
    expect(take(1000)).toEqual(reference);
  }, 30_000);
});
