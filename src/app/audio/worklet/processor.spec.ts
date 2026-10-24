// El adaptador del worklet en Node: se simula el AudioWorkletGlobalScope (la clase base con su
// puerto, `registerProcessor` y `sampleRate`) y se le pasan bloques de 128 muestras como haría el
// navegador. Comprueba el sonido, el ritmo de los estados, la copia de la sesión y la calibración.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PROCESSOR_NAME, PROTOCOL_VERSION, type WorkletEvent } from '../core/protocol';

const RATE = 48_000;

interface Sent {
  readonly message: unknown;
  readonly transfer: readonly ArrayBuffer[];
}

class FakePort {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  readonly sent: Sent[] = [];
  closed = false;
  postMessage(message: unknown, transfer: ArrayBuffer[] = []): void {
    this.sent.push({ message, transfer: [...transfer] });
  }
  close(): void {
    this.closed = true;
  }
  receive(data: unknown): void {
    this.onmessage?.({ data });
  }
}

class FakeProcessorBase {
  readonly port = new FakePort();
}

type Processor = FakeProcessorBase & {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
};
let Registered: new () => Processor;

beforeAll(async () => {
  vi.stubGlobal('AudioWorkletProcessor', FakeProcessorBase);
  vi.stubGlobal('sampleRate', RATE);
  vi.stubGlobal('registerProcessor', (name: string, ctor: new () => Processor) => {
    expect(name).toBe(PROCESSOR_NAME);
    Registered = ctor;
  });
  await import('./processor');
});

/** Procesa `blocks` bloques de 128 con la entrada dada; devuelve la salida izquierda. */
function run(processor: Processor, blocks: number, input?: (frame: number) => number): number[] {
  const left: number[] = [];
  for (let b = 0; b < blocks; b++) {
    const outL = new Float32Array(128);
    const outR = new Float32Array(128);
    const mic = input ? Float32Array.from({ length: 128 }, (_, i) => input(b * 128 + i)) : null;
    const alive = processor.process(mic ? [[mic]] : [[]], [[outL, outR]]);
    expect(alive).toBe(true);
    left.push(...outL);
  }
  return left;
}

const command = (body: object) => ({ v: PROTOCOL_VERSION, ...body });
const events = (processor: Processor) =>
  processor.port.sent.map((sent) => sent.message as WorkletEvent);

describe('worklet', () => {
  it('suena lo que manda el núcleo y envía el estado como mucho 30 veces por segundo', () => {
    const processor = new Registered();
    const pcm = new Float32Array(256_000).fill(0.5);
    processor.port.receive(
      command({ type: 'set-sound', layer: 0, sound: { id: 'x', pcm, lengthBeats: 8 } }),
    );
    processor.port.receive(command({ type: 'play' }));
    const left = run(processor, 375); // 1 s
    expect(left[left.length - 1]).toBeCloseTo(0.5 * Math.SQRT1_2, 6);
    const statuses = events(processor).filter((event) => event.type === 'status');
    expect(statuses.length).toBeGreaterThanOrEqual(29);
    expect(statuses.length).toBeLessThanOrEqual(30);
    // Siempre el mismo objeto (el clonado lo hace postMessage).
    expect(new Set(statuses).size).toBe(1);
  });

  it('ignora lo que no es del protocolo y rechaza (con aviso) los comandos no válidos', () => {
    const processor = new Registered();
    processor.port.receive('hola');
    processor.port.receive({ v: 1, type: 'play' });
    processor.port.receive(command({ type: 'set-level', layer: 0, level: 9 }));
    processor.port.receive(command({ type: 'copy-session', id: 'x' }));
    run(processor, 20);
    const status = events(processor).find((event) => event.type === 'status');
    expect(status?.type === 'status' && status.notices[0]).toMatchObject({
      code: 'rejected',
      command: 'set-level',
      reason: 'range',
    });
    expect(events(processor).filter((event) => event.type === 'session')).toHaveLength(0);
  });

  it('copia la sesión y transfiere su PCM', () => {
    const processor = new Registered();
    const pcm = new Float32Array(256_000).fill(0.25);
    processor.port.receive(
      command({ type: 'set-sound', layer: 2, sound: { id: 'y', pcm, lengthBeats: 8 } }),
    );
    processor.port.receive(command({ type: 'copy-session', id: 7 }));
    const sent = processor.port.sent.find((s) => (s.message as WorkletEvent).type === 'session')!;
    const event = sent.message as Extract<WorkletEvent, { type: 'session' }>;
    expect(event.id).toBe(7);
    expect(event.session.layers[2]!.pcm).not.toBe(pcm);
    expect(event.session.layers[2]!.pcm?.[0]).toBe(0.25);
    expect(sent.transfer).toEqual([event.session.layers[2]!.pcm!.buffer]);
  });

  it('entrega la grabación de la calibración transferida, una sola vez', () => {
    const processor = new Registered();
    processor.port.receive(command({ type: 'calibrate' }));
    run(processor, Math.ceil((4.3 * RATE) / 128) + 2, (frame) => Math.sin(frame / 10) * 0.1);
    const sent = processor.port.sent.filter(
      (s) => (s.message as WorkletEvent).type === 'calibration',
    );
    expect(sent).toHaveLength(1);
    const event = sent[0]!.message as Extract<WorkletEvent, { type: 'calibration' }>;
    expect(event.pcm).toHaveLength(4.3 * RATE);
    expect(event.clickFrames).toHaveLength(8);
    expect(sent[0]!.transfer).toEqual([event.pcm.buffer]);
  });

  it('al cerrarlo deja de pedir bloques y cierra el puerto', () => {
    const processor = new Registered();
    processor.port.receive(command({ type: 'dispose' }));
    expect(processor.process([[]], [[new Float32Array(128), new Float32Array(128)]])).toBe(false);
    expect(processor.port.closed).toBe(true);
  });
});
