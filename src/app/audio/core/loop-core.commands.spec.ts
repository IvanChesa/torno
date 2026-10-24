// Comandos de LoopCore: lo que llega por el puerto no es de fiar (validación campo a campo), las
// sesiones se exportan y se cargan sin perder nada, y ninguna secuencia de comandos lo rompe.
import { describe, expect, it } from 'vitest';
import { LIMITER_CEILING, NOTICE_CAPACITY } from './constants';
import { LoopCore } from './loop-core';
import { PROTOCOL_VERSION, type CoreCommand } from './protocol';
import {
  constantSound,
  Harness,
  rampSound,
  seededRandom,
  sineSound,
  type CommandBody,
} from './test-harness';

const RATE = 48_000;

describe('validación de comandos', () => {
  const invalid: CommandBody[] = [
    { type: 'set-level', layer: 0, level: 1.5 },
    { type: 'set-level', layer: -1, level: 0.5 },
    { type: 'set-level', layer: 0.5, level: 0.5 },
    { type: 'set-mute', layer: 0, muted: 'sí' as unknown as boolean },
    { type: 'set-pan', layer: 0, pan: Number.NaN },
    { type: 'set-reverse', layer: 4, reversed: true },
    { type: 'set-reverse', layer: 0, reversed: 0 as unknown as boolean },
    { type: 'set-filter', layer: 0, amount: -0.1 },
    { type: 'clear-layer', layer: 9 },
    { type: 'undo', layer: 9 },
    { type: 'redo', layer: 0 },
    { type: 'disc-hold', layer: 7 },
    { type: 'set-volume', volume: 2 },
    { type: 'set-input-gain', gain: 2.5 },
    { type: 'set-metronome', enabled: 'no' as unknown as boolean },
    { type: 'set-latency', frames: 12.5 },
    { type: 'set-latency', frames: 2 * RATE },
    { type: 'load-session', session: { sampleRate: 44_100, bpm: 90, layers: [] } },
    { type: 'borrar-todo' } as unknown as CommandBody,
  ];

  it.each(invalid)('ignora con un aviso: %o', (command) => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.25) });
    const before = JSON.stringify(h.status().layers);
    h.send(command);
    expect(h.noticesOf('rejected')).toHaveLength(1);
    expect(JSON.stringify(h.status().layers)).toBe(before);
  });

  it('rechaza una frecuencia de muestreo imposible', () => {
    expect(() => new LoopCore({ sampleRate: 0 })).toThrow(RangeError);
    expect(() => new LoopCore({ sampleRate: 1e6 })).toThrow(RangeError);
  });

  it('expone el tempo, el pulso y la muestra del transporte', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'play' });
    h.render(32_000);
    expect(h.core.bpm).toBe(90);
    expect(h.core.transportFrame).toBe(32_000);
    expect(h.core.beat).toBeCloseTo(1, 12);
  });

  it('si no caben más avisos entre dos estados, los cuenta como perdidos', () => {
    const h = new Harness({ sampleRate: RATE });
    for (let i = 0; i < NOTICE_CAPACITY + 5; i++) h.send({ type: 'set-volume', volume: 9 });
    const status = h.core.flushStatus();
    expect(status.noticeCount).toBe(NOTICE_CAPACITY);
    expect(status.noticesDropped).toBe(5);
  });
});

describe('sesiones', () => {
  it('exportar y cargar da la misma sesión (también sonando y en otro núcleo)', () => {
    const a = new Harness({ sampleRate: RATE });
    a.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 220, 0.4) });
    a.send({ type: 'set-sound', layer: 2, sound: rampSound(RATE, 4) });
    a.send({ type: 'set-level', layer: 0, level: 0.7 });
    a.send({ type: 'set-mute', layer: 2, muted: true });
    a.send({ type: 'set-pan', layer: 2, pan: -0.4 });
    a.send({ type: 'set-reverse', layer: 0, reversed: true });
    a.send({ type: 'set-filter', layer: 0, amount: 0.3 });
    a.send({ type: 'set-tempo', bpm: 123 });
    const state = a.core.exportState();
    expect(state.layers[0]!.pcm).not.toBe(a.core.layerContent(0)!.data);

    const b = new Harness({ sampleRate: RATE });
    b.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.5) });
    b.send({ type: 'play' });
    b.render(RATE / 2);
    // Sonando: primero se apaga la salida y vuelve al pulso 0; después se carga.
    b.send({ type: 'load-session', session: state });
    expect(b.core.layerContent(1)).not.toBeNull();
    b.render(RATE / 10);
    expect(b.core.transportState).toBe('stopped');
    expect(b.core.beat).toBe(0);
    expect(b.core.layerContent(1)).toBeNull();
    const reloaded = b.core.exportState();
    expect(reloaded.bpm).toBe(123);
    for (let i = 0; i < 4; i++) {
      const { pcm, ...rest } = state.layers[i]!;
      const { pcm: again, ...restAgain } = reloaded.layers[i]!;
      expect(restAgain).toEqual(rest);
      expect(again ? Buffer.from(again.buffer) : null).toEqual(
        pcm ? Buffer.from(pcm.buffer) : null,
      );
    }
    // Cargar deja la capa sin historial.
    expect(b.status().layers[0]!.undo).toBe(0);
  });

  it('sesión nueva: todo vacío y 90 BPM', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.5) });
    h.send({ type: 'set-tempo', bpm: 150 });
    h.send({ type: 'reset' });
    expect(h.core.bpm).toBe(90);
    expect(h.core.layerContent(0)).toBeNull();
    expect(h.status().layers.every((layer) => !layer.hasContent && layer.undo === 0)).toBe(true);
  });

  it('borrar capa se puede deshacer', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.5) });
    h.send({ type: 'clear-layer', layer: 0 });
    expect(h.core.layerContent(0)).toBeNull();
    h.send({ type: 'undo', layer: 0 });
    expect(h.core.layerContent(0)?.data[0]).toBe(0.5);
    // APAGADO sobre una capa vacía no es una edición.
    h.send({ type: 'set-sound', layer: 1, sound: null });
    expect(h.status().layers[1]!.undo).toBe(0);
  });

  it('el reposo sin toma solo pausa', () => {
    const h = new Harness({ sampleRate: RATE });
    h.send({ type: 'play' });
    h.render(1000);
    h.send({ type: 'standby' });
    h.render(1000);
    expect(h.core.transportState).toBe('stopped');
    expect(h.noticesOf('take-cancelled')).toHaveLength(0);
    // Parar ya parado vuelve al principio.
    h.send({ type: 'stop' });
    expect(h.core.beat).toBe(0);
  });
});

describe('robustez', () => {
  it('ninguna secuencia de 3000 comandos al azar lo rompe: salida finita y bajo el techo', () => {
    const random = seededRandom(42);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
    const values = [
      -1,
      0,
      0.25,
      0.5,
      1,
      2,
      7,
      1.5,
      Number.NaN,
      Infinity,
      -Infinity,
      'x',
      null,
      true,
    ];
    const sounds = [
      sineSound(RATE, 220, 0.9),
      constantSound(RATE, 0.9, 4),
      rampSound(RATE, 2),
      null,
    ];
    const types: CoreCommand['type'][] = [
      'play',
      'pause',
      'stop',
      'set-tempo',
      'set-level',
      'set-mute',
      'set-pan',
      'set-reverse',
      'set-filter',
      'set-sound',
      'clear-layer',
      'undo',
      'redo',
      'disc-hold',
      'disc-move',
      'disc-release',
      'record',
      'cancel-recording',
      'set-volume',
      'set-input-gain',
      'set-metronome',
      'set-latency',
      'reset',
      'standby',
    ];
    const core = new LoopCore({ sampleRate: RATE });
    const outL = new Float32Array(256);
    const outR = new Float32Array(256);
    const input = new Float32Array(256);
    let worst = 0;
    for (let step = 0; step < 3000; step++) {
      const type = pick(types);
      const command = {
        v: PROTOCOL_VERSION,
        type,
        layer: pick([0, 1, 2, 3, 3, 5, -1, 0.5]),
        bpm: pick([40, 90, 133, 240, ...values]),
        level: pick(values),
        muted: pick([true, false, 'x']),
        pan: pick(values),
        reversed: pick([true, false]),
        amount: pick(values),
        sound: type === 'set-sound' ? pick(sounds) : null,
        turns: pick([0.1, -0.5, 2, Number.NaN]),
        bars: pick([0, 1, 2, 4, 3]),
        countIn: pick([true, false]),
        fitTempo: pick([true, false]),
        volume: pick(values),
        gain: pick(values),
        enabled: pick([true, false]),
        frames: pick([0, 480, 1.5, -3]),
      } as unknown as CoreCommand;
      expect(() => core.handle(command)).not.toThrow();
      for (let i = 0; i < 256; i++) input[i] = Math.sin(step + i / 10);
      const blocks = 1 + Math.floor(random() * 40);
      for (let b = 0; b < blocks; b++) {
        core.process(input, outL, outR, 256);
        for (let i = 0; i < 256; i++) {
          if (!Number.isFinite(outL[i]!) || !Number.isFinite(outR[i]!))
            throw new Error('no finito');
          worst = Math.max(worst, Math.abs(outL[i]!), Math.abs(outR[i]!));
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(Math.fround(LIMITER_CEILING));
    expect(core.memoryInUse).toBeLessThan(220_000_000);
  }, 120_000);
});
