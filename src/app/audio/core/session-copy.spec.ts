// Copia de la sesión por tramos (revisión de la fase 2, #6): se reserva entre dos bloques a partir
// de la instantánea del núcleo, se copia un tramo tras cada bloque y da exactamente lo mismo que la
// copia de golpe en el momento de pedirla, aunque la sesión cambie mientras tanto (el contenido
// confirmado no cambia nunca).
import { describe, expect, it } from 'vitest';
import { COPY_FIRST_SAMPLES, COPY_SAMPLES_PER_FRAME, SessionCopy } from './session-copy';
import type { SessionState } from './session';
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

function sameSession(a: SessionState, b: SessionState): void {
  expect(a.sampleRate).toBe(b.sampleRate);
  expect(a.bpm).toBe(b.bpm);
  a.layers.forEach((layer, i) => {
    const { pcm, ...rest } = layer;
    const { pcm: other, ...otherRest } = b.layers[i]!;
    expect(rest).toEqual(otherRest);
    expect(pcm ? Buffer.from(pcm.buffer) : null).toEqual(other ? Buffer.from(other.buffer) : null);
  });
}

function session(): Harness {
  const h = new Harness({ sampleRate: RATE });
  const random = seededRandom(4);
  h.send({
    type: 'set-sound',
    layer: 0,
    sound: sound('ruido', loopFrames(4, RATE), 4, () => random() * 2 - 1),
  });
  h.send({ type: 'set-sound', layer: 2, sound: sineSound(RATE, 220, 0.5) });
  h.send({ type: 'set-level', layer: 2, level: 0.7 });
  h.send({ type: 'set-pan', layer: 2, pan: -0.25 });
  h.send({ type: 'set-filter', layer: 2, amount: 0.4 });
  h.send({ type: 'set-tempo', bpm: 97 });
  h.send({ type: 'play' });
  h.render(1000);
  return h;
}

/** Renderiza bloques y copia un tramo tras cada uno, como el worklet; devuelve cuántos. */
function pumpWhileRendering(
  h: Harness,
  copy: SessionCopy,
  during?: (block: number) => void,
): number {
  let blocks = 0;
  while (!copy.done) {
    h.render(BLOCK);
    copy.pump(BLOCK * COPY_SAMPLES_PER_FRAME);
    blocks++;
    during?.(blocks);
  }
  return blocks;
}

describe('copia de la sesión por tramos', () => {
  it('sale igual que la copia de golpe al pedirla, aunque la sesión cambie mientras se copia', () => {
    const h = session();
    const expected = exportState(h.core);
    const copy = new SessionCopy(7, h.core.snapshot());
    // Mientras se copia: otro sonido en la capa 0 (en cola), otro nivel y otro tempo.
    h.send({ type: 'set-sound', layer: 0, sound: constantSound(RATE, 0.3) });
    h.send({ type: 'set-level', layer: 2, level: 0.2 });
    const blocks = pumpWhileRendering(h, copy, (block) => {
      if (block === 10) h.send({ type: 'set-tempo', bpm: 120 });
    });
    expect(copy.event.id).toBe(7);
    sameSession(copy.event.session, expected);
    // Tramos de 1024, 2048, 3072… muestras, hasta 128 × 256 por bloque.
    const samples = loopFrames(4, RATE) + loopFrames(8, RATE);
    let copied = 0;
    let expectedBlocks = 0;
    for (let ramp = COPY_FIRST_SAMPLES; copied < samples; ramp += COPY_FIRST_SAMPLES) {
      copied += Math.min(ramp, BLOCK * COPY_SAMPLES_PER_FRAME);
      expectedBlocks++;
    }
    expect(blocks).toBe(expectedBlocks);
    expect(copy.transfer).toEqual(
      copy.event.session.layers.filter((layer) => layer.pcm).map((layer) => layer.pcm!.buffer),
    );
  });

  it('una sesión vacía se copia de una vez; el calentamiento no deja nada', () => {
    SessionCopy.warmUp();
    const empty = new Harness({ sampleRate: RATE });
    const copy = new SessionCopy(3, empty.core.snapshot());
    expect(copy.done).toBe(true);
    expect(copy.transfer).toEqual([]);
    expect(copy.event.session.layers.every((layer) => !layer.pcm)).toBe(true);
  });
});
