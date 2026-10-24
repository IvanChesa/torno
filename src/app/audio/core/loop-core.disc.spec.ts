// El disco (PLAN §4.4): mantener congela la capa, arrastrar mueve su cabeza (1 vuelta = 1 compás,
// adelante o atrás) y soltar la devuelve a la línea de tiempo con un fundido de ~15 ms. La voz del
// disco pasa por un filtro de continua: un disco quieto no suena. La posición de la cabeza se lee
// del estado (`positionBeats`), que da la del disco mientras se mantiene.
import { describe, expect, it } from 'vitest';
import {
  constantSound,
  Harness,
  loopFrames,
  maxJump,
  peak,
  rampSound,
  sineSound,
} from './test-harness';

const RATE = 48_000;
const CENTER = Math.SQRT1_2;
const BEAT = 32_000; // a 90 BPM
const LOOP = loopFrames(8, RATE); // 256.000 muestras: 8 pulsos

/** Posición (en muestras del bucle) que dice el diente de sierra en la salida izquierda. */
const positionOf = (value: number) => (value / CENTER) * LOOP;

function playingRamp(): Harness {
  const h = new Harness({ sampleRate: RATE });
  h.send({ type: 'set-sound', layer: 0, sound: rampSound(RATE) });
  h.send({ type: 'play' });
  return h;
}

/** Arrastra el disco a 60 actualizaciones por segundo, como el puntero: `turnsPerSecond`. */
function drag(h: Harness, from: number, turnsPerSecond: number, seconds: number): Float32Array {
  const steps = Math.round(seconds * 60);
  const out = new Float32Array(steps * (RATE / 60));
  for (let i = 1; i <= steps; i++) {
    h.send({ type: 'disc-move', turns: from + (i * turnsPerSecond) / 60 });
    out.set(h.render(RATE / 60).left, (i - 1) * (RATE / 60));
  }
  return out;
}

describe('disco', () => {
  it('mantener congela la cabeza donde estaba y, quieto, el disco no suena', () => {
    const h = playingRamp();
    h.renderUntil(100_000);
    h.send({ type: 'disc-hold', layer: 0 });
    const { left } = h.render(RATE);
    const status = h.status();
    expect(status.layers[0]!.discHeld).toBe(true);
    // La cabeza está en la muestra 100.000 (pulso 3,125) aunque el transporte haya seguido.
    expect(status.layers[0]!.positionBeats).toBeCloseTo(100_000 / BEAT, 9);
    expect(status.beat).toBeCloseTo((100_000 + RATE) / BEAT, 9);
    // La cabeza congelada daría una continua: el filtro de 10 Hz la apaga en unas decenas de ms.
    expect(Math.abs(left[left.length - 1]!)).toBeLessThan(1e-6);
    expect(maxJump(left)).toBeLessThan(0.01);
  });

  it('1 vuelta = 1 compás hacia delante, y hacia atrás con vueltas negativas', () => {
    const h = playingRamp();
    h.renderUntil(100_000);
    h.send({ type: 'disc-hold', layer: 0 });
    h.render(RATE / 10);
    h.send({ type: 'disc-move', turns: 1 });
    h.render(RATE / 2);
    // 3,125 + 4 pulsos.
    expect(h.status().layers[0]!.positionBeats).toBeCloseTo(7.125, 9);
    h.send({ type: 'disc-move', turns: -0.5 });
    h.render(RATE / 2);
    // 3,125 − 2 pulsos.
    expect(h.status().layers[0]!.positionBeats).toBeCloseTo(1.125, 9);
    // Hacia atrás más allá del principio, da la vuelta al bucle: 3,125 − 8 = −4,875 → 3,125.
    h.send({ type: 'disc-move', turns: -2 });
    h.render(RATE / 2);
    expect(h.status().layers[0]!.positionBeats).toBeCloseTo(3.125, 9);
  });

  it('arrastrar a la velocidad del transporte suena como la capa (salvo la continua)', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 1760, 0.5) }); // 330 Hz
    h.send({ type: 'play' });
    h.render(RATE / 2);
    h.send({ type: 'disc-hold', layer: 0 });
    // 90 BPM = 1,5 pulsos/s = 0,375 vueltas/s.
    const dragged = drag(h, 0, 0.375, 1);
    const reference = new Harness({ sampleRate: RATE });
    reference.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 1760, 0.5) });
    reference.send({ type: 'play' });
    const playing = reference.render(RATE).left;
    // Misma energía que la capa en marcha (±2 %): el disco no la deforma ni la apaga.
    const energy = (x: Float32Array) => {
      let sum = 0;
      for (let i = RATE / 4; i < x.length; i++) sum += x[i]! * x[i]!;
      return sum;
    };
    expect(energy(dragged) / energy(playing)).toBeGreaterThan(0.96);
    expect(energy(dragged) / energy(playing)).toBeLessThan(1.04);
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
    const status = h.status();
    expect(status.layers[0]!.discHeld).toBe(false);
    expect(status.layers[0]!.positionBeats).toBeCloseTo(status.beat % 8, 9);
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
    const dragged = drag(h, 0, 0.5, 0.5);
    expect(maxJump(dragged)).toBeLessThanOrEqual(own + 0.01);
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
    // Medio compás en medio segundo (2 pulsos/s ≈ ×1,33): el seno de 41 Hz no pasa de ≈ 0,0036.
    expect(maxJump(drag(h, 0, 1, 0.5))).toBeLessThan(0.02);
  });

  it('con el transporte parado, el disco hace sonar la capa mientras se arrastra', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 1760, 0.5) });
    h.send({ type: 'disc-hold', layer: 0 });
    const dragged = drag(h, 0, 0.5, 1);
    // La cabeza llega a su objetivo (½ vuelta = 2 pulsos) con el suavizado de 10 ms.
    h.render(RATE / 5);
    expect(h.status().layers[0]!.positionBeats).toBeCloseTo(2, 6);
    expect(h.status().transport).toBe('stopped');
    expect(peak(dragged)).toBeGreaterThan(0.2);
    expect(maxJump(dragged, 1, 20)).toBeLessThan(0.01);
    h.send({ type: 'disc-release' });
    const after = h.render(RATE / 2).left;
    expect(after[after.length - 1]).toBe(0);
    expect(maxJump(after)).toBeLessThan(0.01 + maxJump(dragged));
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

  it('rechaza vueltas desmesuradas: la cabeza sigue siendo finita y las capas suenan', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 220, 0.5) });
    h.send({ type: 'set-sound', layer: 1, sound: sineSound(RATE, 1760, 0.5) });
    h.send({ type: 'play' });
    h.render(RATE / 4);
    h.send({ type: 'disc-hold', layer: 0 });
    h.send({ type: 'disc-move', turns: 1e308 });
    h.send({ type: 'disc-move', turns: -2e6 });
    const { left } = h.render(RATE / 4);
    expect(h.noticesOf('rejected').map((n) => `${n.command}: ${n.reason}`)).toEqual([
      'disc-move: range',
      'disc-move: range',
    ]);
    expect(Number.isFinite(h.status().layers[0]!.positionBeats)).toBe(true);
    // La capa 1 sigue sonando: el limitador no ha recibido ningún NaN.
    expect(peak(left)).toBeGreaterThan(0.2);
  });
});

describe('disco, reposo y carga', () => {
  /** Capa 0 sonando a la izquierda con el disco agarrado y moviéndose. */
  function heldAndDragging(playing: boolean): { h: Harness; own: number } {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 1760, 0.8) });
    h.send({ type: 'set-pan', layer: 0, pan: -1 });
    if (playing) h.send({ type: 'play' });
    h.render(RATE / 4);
    h.send({ type: 'disc-hold', layer: 0 });
    const dragged = drag(h, 0, 0.5, 0.5);
    return { h, own: maxJump(dragged, RATE / 10) };
  }

  it.each([true, false])(
    'el reposo con el disco agarrado (en marcha: %s) suelta el disco y calla sin clic',
    (playing) => {
      const { h, own } = heldAndDragging(playing);
      h.send({ type: 'standby' });
      const { left } = h.render(RATE / 10);
      expect(h.status().layers[0]!.discHeld).toBe(false);
      expect(h.core.transportState).toBe('stopped');
      expect(maxJump(left)).toBeLessThanOrEqual(own + 0.01);
      // Pasados los fundidos (15 ms), silencio exacto.
      expect(left.subarray(RATE / 20).every((x) => x === 0)).toBe(true);
      // El reposo conserva las capas.
      expect(h.core.layerContent(0)).not.toBeNull();
    },
  );

  it.each([
    ['sesión nueva', true],
    ['sesión nueva', false],
    ['cargar', true],
    ['cargar', false],
  ] as const)('%s con el disco agarrado (en marcha: %s) no hace clic', (what, playing) => {
    const { h, own } = heldAndDragging(playing);
    const other = new Harness({ sampleRate: RATE });
    other.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.9) });
    other.send({ type: 'set-pan', layer: 0, pan: -1 });
    const session = other.core.exportState();
    if (what === 'cargar') h.send({ type: 'load-session', session });
    else h.send({ type: 'reset' });
    const { left } = h.render(RATE / 10);
    expect(maxJump(left)).toBeLessThanOrEqual(own + 0.01);
    const status = h.status();
    expect(status.layers[0]!.discHeld).toBe(false);
    expect(status.transport).toBe('stopped');
    expect(status.beat).toBe(0);
    expect(left.subarray(RATE / 20).every((x) => x === 0)).toBe(true);
    // La sesión nueva queda aplicada: al reproducir suena lo cargado (o nada), sin clic.
    h.send({ type: 'play' });
    const after = h.render(RATE / 10).left;
    expect(after[after.length - 1]).toBe(what === 'cargar' ? Math.fround(0.9) : 0);
    expect(maxJump(after)).toBeLessThanOrEqual(0.9 * (Math.PI / 2 / 480) + 1e-6);
  });
});
