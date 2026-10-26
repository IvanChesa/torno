// Memoria del audio (PLAN §4.4 y §5): contabilidad, presupuesto, peor caso y la prueba de que
// `process()` no reserva memoria (heap estable durante 60 s simulados con todo en marcha).
import { Session } from 'node:inspector/promises';
import { describe, expect, it } from 'vitest';
import { LAYER_COUNT } from './constants';
import { MEMORY_BUDGET_BYTES, worstCaseMemory } from './memory';
import { COPY_SAMPLES_PER_FRAME, SessionCopy } from './session-copy';
import { PROTOCOL_VERSION, type CoreCommand } from './protocol';
import {
  BLOCK,
  constantSound,
  Harness,
  loopFrames,
  seededRandom,
  sineSound,
  sound,
  exportState,
} from './test-harness';

const RATE = 48_000;
const MB = 1_000_000;

describe('contabilidad de memoria', () => {
  it('cuenta cada búfer vivo una vez: actual, deshacer y cola', () => {
    const h = new Harness({ sampleRate: RATE });
    const fixed = h.core.memoryInUse;
    expect(fixed).toBeLessThan(0.2 * MB);
    const bytes = loopFrames(8, RATE) * 4; // 1,024 MB
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.1) });
    expect(h.core.memoryInUse - fixed).toBe(bytes);
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.2) });
    expect(h.core.memoryInUse - fixed).toBe(2 * bytes);
    // Deshacer no copia nada.
    h.send({ type: 'undo', layer: 0 });
    expect(h.core.memoryInUse - fixed).toBe(2 * bytes);
    // Un sonido en cola también cuenta.
    h.send({ type: 'play' });
    h.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.3) });
    expect(h.core.memoryInUse - fixed).toBe(3 * bytes);
    expect(h.status().memoryBytes).toBe(h.core.memoryInUse);
  });

  it('una edición que no cabe en el presupuesto suelta el deshacer más antiguo', () => {
    const bytes = loopFrames(8, RATE) * 4;
    const h = new Harness({ sampleRate: RATE, memoryBudgetBytes: 3.5 * bytes });
    for (let i = 1; i <= 6; i++) {
      h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, i / 10) });
      expect(h.core.memoryInUse).toBeLessThanOrEqual(3.5 * bytes);
    }
    // Caben 3 estados (y la memoria fija): el actual y 2 para deshacer.
    expect(h.status().layers[0]!.undo).toBe(2);
    expect(h.core.layerContent(0)?.data[0]).toBeCloseTo(0.6, 6);
  });

  it('cargar una sesión suelta ya el deshacer y cuenta la sesión que espera al fundido', () => {
    const bytes = loopFrames(8, RATE) * 4;
    const h = new Harness({ sampleRate: RATE });
    const fixed = h.core.memoryInUse;
    for (let layer = 0; layer < LAYER_COUNT; layer++) {
      for (let i = 1; i <= 4; i++) {
        h.send({ type: 'set-sound', layer, sound: constantSound(RATE, i / 10) });
      }
    }
    // Historial lleno: 4 capas × (el actual + 3 para deshacer).
    expect(h.core.memoryInUse - fixed).toBe(16 * bytes);
    const other = new Harness({ sampleRate: RATE });
    for (let layer = 0; layer < LAYER_COUNT; layer++) {
      other.send({ type: 'set-sound', layer, sound: constantSound(RATE, 0.5) });
    }
    const session = exportState(other.core);
    h.send({ type: 'play' });
    h.render(1000);
    h.send({ type: 'load-session', session });
    // Mientras se apaga la salida conviven lo que suena (sin deshacer) y la sesión que llega.
    expect(h.core.memoryInUse - fixed).toBe(8 * bytes);
    expect(h.status().memoryBytes).toBe(h.core.memoryInUse);
    h.render(RATE / 10);
    expect(h.core.memoryInUse - fixed).toBe(4 * bytes);
    expect(h.status().layers.every((layer) => layer.undo === 0 && layer.redo === 0)).toBe(true);
  });

  it('si ni soltando el deshacer cabe, la toma se rechaza', () => {
    const h = new Harness({ sampleRate: RATE, memoryBudgetBytes: 2 * MB });
    h.send({ type: 'record', layer: 0, bars: 0, countIn: false, fitTempo: false });
    expect(h.noticesOf('rejected')[0]).toMatchObject({ command: 'record', reason: 'no-memory' });
    expect(h.status().recording).toBe('idle');
  });

  it('el peor caso (4 capas de 60 s con 3 deshacer y una toma de 60 s) cabe en §5 a 44,1 y 48 kHz', () => {
    const at48 = worstCaseMemory(48_000);
    expect(at48.layerBytes).toBe(11_520_000);
    expect(at48.totalBytes).toBe(4 * 4 * 11_520_000 + 11_520_000);
    expect(at48.totalBytes).toBeLessThanOrEqual(MEMORY_BUDGET_BYTES);
    expect(worstCaseMemory(44_100).withinBudget).toBe(true);
    // A 96 kHz no cabe: ahí manda el presupuesto (se pierde deshacer antes que pasar de 220 MB).
    expect(worstCaseMemory(96_000).withinBudget).toBe(false);
  });
});

/** Nodo del perfil de muestreo del heap de V8 (HeapProfiler.SamplingHeapProfileNode). */
interface ProfileNode {
  readonly callFrame: { readonly functionName: string; readonly url: string };
  readonly selfSize: number;
  readonly children: readonly ProfileNode[];
}

/**
 * Bytes muestreados cuya pila pasa por `LoopCore.process` o por `SessionCopy.pump` (lo que
 * reserva el hilo de audio).
 */
function bytesUnderProcess(node: ProfileNode, inside = false): number {
  const { functionName, url } = node.callFrame;
  const here =
    inside ||
    (functionName === 'process' && url.endsWith('loop-core.ts')) ||
    (functionName === 'pump' && url.endsWith('session-copy.ts'));
  let total = here ? node.selfSize : 0;
  for (const child of node.children) total += bytesUnderProcess(child, here);
  return total;
}

describe('process() no reserva memoria', () => {
  it('reserva < 16 KiB por minuto simulado con todo en marcha (perfil del heap de V8)', async () => {
    const h = new Harness({ sampleRate: RATE });
    const random = seededRandom(9);
    const noise = sound('ruido', loopFrames(4, RATE), 4, () => (random() * 2 - 1) * 0.3);
    for (let layer = 0; layer < LAYER_COUNT - 1; layer++) {
      h.send({ type: 'set-sound', layer, sound: sineSound(RATE, 200 + 50 * layer, 0.4) });
      h.send({ type: 'set-filter', layer, amount: 0.2 * layer });
      h.send({ type: 'set-pan', layer, pan: 0.3 * layer - 0.3 });
    }
    h.send({ type: 'set-metronome', enabled: true });
    h.send({ type: 'set-tempo', bpm: 101 });
    h.send({ type: 'play' });
    h.send({ type: 'record', layer: 3, bars: 1, countIn: false, fitTempo: false });
    h.render(6 * RATE, (f) => 0.2 * Math.sin(f / 30));

    const core = h.core;
    const input = new Float32Array(BLOCK);
    const outL = new Float32Array(BLOCK);
    const outR = new Float32Array(BLOCK);
    const blocks = Math.round((60 * RATE) / BLOCK);
    const second = Math.round(RATE / BLOCK);
    // Los comandos se crean antes: en la ventana solo se llama a `handle` y a `process`.
    const command = (body: object) => ({ v: PROTOCOL_VERSION, ...body }) as CoreCommand;
    const hold = command({ type: 'disc-hold', layer: 2 });
    const release = command({ type: 'disc-release' });
    // Del 20 al 30, a 240 BPM: el filtro contra el aliasing se enciende, se rediseña y se apaga.
    const fast = [200, 220, 240].map((bpm) => command({ type: 'set-tempo', bpm }));
    const back = command({ type: 'set-tempo', bpm: 101 });
    const moves = Array.from({ length: 40 }, (_, i) =>
      command({ type: 'disc-move', turns: Math.sin(i / 3) }),
    );
    /**
     * Un minuto de sesión: una sobregrabación que se confirma, un cambio en cola que entra en un
     * compás, una copia de la sesión por tramos, el metrónomo, cuatro capas con filtro y varispeed
     * (diez segundos a 200–240 BPM, con el filtro contra el aliasing), y el disco de otra capa agarrado y movido a saltos entre los segundos 10 y 50. Lo que reserva
     * (la toma, el sonido y la copia) se pide antes de cada pasada, como en el worklet (en el
     * manejador de mensajes, no en `process()`).
     */
    const minute = () => {
      for (let b = 0; b < blocks; b++) {
        for (let i = 0; i < BLOCK; i++) input[i] = 0.2 * Math.sin((b * BLOCK + i) / 30);
        if (b === 10 * second) core.handle(hold);
        if (b > 10 * second && b < 50 * second && b % second === 0) {
          core.handle(moves[(b / second) % moves.length]!);
        }
        if (b === 50 * second) core.handle(release);
        if (b === 20 * second) core.handle(fast[0]!);
        if (b === 22 * second) core.handle(fast[1]!);
        if (b === 24 * second) core.handle(fast[2]!);
        if (b === 30 * second) core.handle(back);
        core.process(input, outL, outR, BLOCK);
        core.statusReady = false;
        // Lo que hace el worklet tras cada bloque mientras hay una copia de la sesión pedida.
        if (!copy.done) copy.pump(BLOCK * COPY_SAMPLES_PER_FRAME);
      }
    };
    let copy = new SessionCopy(0, core.snapshot());
    const prepare = () => {
      h.send({ type: 'set-sound', layer: 1, sound: noise });
      h.send({ type: 'record', layer: 3, bars: 2, countIn: false, fitTempo: false });
      // Una copia de la sesión (autoguardado): se reserva aquí y se copia por tramos en la pasada.
      copy = new SessionCopy(1, core.snapshot());
    };
    // Primera pasada: calienta el JIT con todos los caminos (también confirmar y aplicar la cola).
    prepare();
    minute();
    prepare();
    const recorded = core.layerContent(3);
    const session = new Session();
    session.connect();
    await session.post('HeapProfiler.startSampling', { samplingInterval: 64 });
    minute();
    const { profile } = (await session.post('HeapProfiler.stopSampling')) as unknown as {
      profile: { head: ProfileNode };
    };
    session.disconnect();
    const bytes = bytesUnderProcess(profile.head);
    console.warn(`process(): ${(bytes / 1024).toFixed(1)} KiB reservados en 60 s simulados`);
    // La sobregrabación, el cambio en cola y la copia de la sesión se hicieron dentro de la ventana.
    expect(core.layerContent(3)).not.toBe(recorded);
    expect(copy.done).toBe(true);
    expect(core.layerContent(1)?.source).toEqual({ kind: 'library', id: 'ruido' });
    // En V8, un número con decimales que cruza una llamada no integrada se empaqueta: unos pocos
    // bytes por segundo. A ese ritmo, el heap joven tardaría horas en llenarse una vez.
    expect(bytes).toBeLessThan(16 * 1024);
  }, 60_000);
});
