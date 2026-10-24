// El disco (PLAN §4.4): mantener congela la capa, arrastrar mueve su cabeza (1 vuelta = 1 compás,
// adelante o atrás) y soltar la devuelve a la línea de tiempo con un fundido de ~15 ms.
import { describe, expect, it } from 'vitest';
import { constantSound, Harness, loopFrames, maxJump, rampSound, sineSound } from './test-harness';

const RATE = 48_000;
const CENTER = Math.SQRT1_2;
const LOOP = loopFrames(8, RATE); // 256.000 muestras: 32.000 por pulso a 90 BPM

/** Posición (en muestras del bucle) que dice el diente de sierra en la salida izquierda. */
const positionOf = (value: number) => (value / CENTER) * LOOP;

function playingRamp(): Harness {
  const h = new Harness({ sampleRate: RATE });
  h.send({ type: 'set-sound', layer: 0, sound: rampSound(RATE) });
  h.send({ type: 'play' });
  return h;
}

describe('disco', () => {
  it('mantener congela la capa donde estaba', () => {
    const h = playingRamp();
    h.renderUntil(100_000);
    h.send({ type: 'disc-hold', layer: 0 });
    expect(h.status().layers[0]!.discHeld).toBe(true);
    const { left } = h.render(RATE);
    // Pasado el fundido, la cabeza no se mueve: la salida es constante y está en la muestra 100.000.
    const frozen = left[left.length - 1]!;
    expect(left[left.length - 5000]).toBe(frozen);
    expect(positionOf(frozen)).toBeCloseTo(100_000, 0);
  });

  it('1 vuelta = 1 compás hacia delante, y hacia atrás con vueltas negativas', () => {
    const h = playingRamp();
    h.renderUntil(100_000);
    h.send({ type: 'disc-hold', layer: 0 });
    h.render(RATE / 10);
    h.send({ type: 'disc-move', turns: 1 });
    let { left } = h.render(RATE / 2);
    // 4 pulsos × 32.000 muestras por pulso.
    expect(positionOf(left[left.length - 1]!)).toBeCloseTo(100_000 + 128_000, 0);
    h.send({ type: 'disc-move', turns: -0.5 });
    ({ left } = h.render(RATE / 2));
    expect(positionOf(left[left.length - 1]!)).toBeCloseTo(100_000 - 64_000, 0);
  });

  it('al soltar vuelve a su sitio en la línea de tiempo común', () => {
    const h = playingRamp();
    h.renderUntil(100_000);
    h.send({ type: 'disc-hold', layer: 0 });
    h.render(RATE / 2);
    h.send({ type: 'disc-move', turns: 0.25 });
    h.render(RATE / 2);
    h.send({ type: 'disc-release' });
    const release = h.frame;
    const { left } = h.render(RATE / 2);
    expect(h.status().layers[0]!.discHeld).toBe(false);
    // Pasados los 15 ms, suena la posición de la línea de tiempo, que siguió avanzando.
    const n = 2000;
    expect(positionOf(left[n]!)).toBeCloseTo(release + n - h.core.outputLatency, 0);
  });

  it('agarrar y soltar no hacen clic; las demás capas siguen sonando', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 220, 0.5) });
    h.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.2) });
    h.send({ type: 'set-pan', layer: 1, pan: 1 });
    h.send({ type: 'set-pan', layer: 0, pan: -1 });
    h.send({ type: 'play' });
    const own = maxJump(h.render(RATE).left, RATE / 2);
    h.send({ type: 'disc-hold', layer: 0 });
    const held = h.render(RATE / 4);
    expect(maxJump(held.left)).toBeLessThanOrEqual(own + 0.01);
    // La capa 1 (a la derecha) no se ha enterado.
    expect(held.right.every((x) => x === Math.fround(0.2))).toBe(true);
    h.send({ type: 'disc-release' });
    const released = h.render(RATE / 4);
    expect(maxJump(released.left)).toBeLessThanOrEqual(own + 0.01);
  });

  it('arrastrar a saltos no da escalones: la cabeza sigue al ángulo suavizada', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 220, 0.5) });
    h.send({ type: 'play' });
    h.render(RATE / 2);
    h.send({ type: 'disc-hold', layer: 0 });
    h.render(RATE / 10);
    // 60 actualizaciones por segundo, como el puntero: medio compás en medio segundo.
    let worst = 0;
    for (let i = 1; i <= 30; i++) {
      h.send({ type: 'disc-move', turns: i / 60 });
      worst = Math.max(worst, maxJump(h.render(RATE / 60).left));
    }
    // A esa velocidad (2 pulsos/s ≈ ×1,33), el seno de 41 Hz no pasa de ≈ 0,0036 por muestra.
    expect(worst).toBeLessThan(0.02);
  });

  it('con el transporte parado, el disco hace sonar la capa (arrastrar un disco parado)', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: rampSound(RATE) });
    h.send({ type: 'disc-hold', layer: 0 });
    h.send({ type: 'disc-move', turns: 0.5 });
    const { left } = h.render(RATE / 2);
    expect(positionOf(left[left.length - 1]!)).toBeCloseTo(64_000, 0);
    expect(maxJump(left, 1, 20)).toBeLessThan(0.01);
    h.send({ type: 'disc-release' });
    const after = h.render(RATE / 2).left;
    expect(after[after.length - 1]).toBe(0);
  });

  it('mantener otra capa suelta la primera; los comandos sin disco no hacen nada', () => {
    const h = playingRamp();
    h.send({ type: 'disc-move', turns: 3 });
    h.send({ type: 'disc-release' });
    h.send({ type: 'set-sound', layer: 1, sound: rampSound(RATE) });
    h.send({ type: 'disc-hold', layer: 0 });
    h.send({ type: 'disc-hold', layer: 1 });
    const status = h.status();
    expect(status.layers[0]!.discHeld).toBe(false);
    expect(status.layers[1]!.discHeld).toBe(true);
    h.send({ type: 'disc-move', turns: Number.NaN });
    h.flush();
    expect(h.noticesOf('rejected')).toHaveLength(1);
  });
});
