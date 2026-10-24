import { describe, expect, it } from 'vitest';
import { renderOffline } from './offline';
import { EMPTY_LAYER, type SessionState } from './session';
import {
  constantSound,
  Harness,
  loopFrames,
  maxJump,
  rampSound,
  sineSound,
  exportState,
} from './test-harness';

const RATE = 48_000;
const CENTER = Math.SQRT1_2;

describe('renderOffline', () => {
  it('empieza exactamente en el pulso 0, sin fundido y sin la latencia del limitador', () => {
    const ramp = rampSound(RATE);
    const state: SessionState = {
      sampleRate: RATE,
      bpm: 90,
      layers: [
        { ...EMPTY_LAYER, pcm: ramp.pcm, lengthBeats: 8, source: { kind: 'library', id: 'rampa' } },
        EMPTY_LAYER,
        EMPTY_LAYER,
        EMPTY_LAYER,
      ],
    };
    const { left, right } = renderOffline(state, 10_000);
    expect(left).toHaveLength(10_000);
    const frames = loopFrames(8, RATE);
    for (const n of [0, 1, 100, 9999]) {
      expect(left[n]).toBeCloseTo((n / frames) * CENTER, 6);
      expect(right[n]).toBeCloseTo((n / frames) * CENTER, 6);
    }
  });

  it('lo que se exporta es lo que suena en directo, salvo el metrónomo', () => {
    const setup = new Harness({ sampleRate: RATE });
    setup.send({ type: 'set-sound', layer: 0, sound: sineSound(RATE, 220, 0.4) });
    setup.send({ type: 'set-sound', layer: 1, sound: constantSound(RATE, 0.1, 4) });
    setup.send({ type: 'set-filter', layer: 0, amount: 0.5 });
    setup.send({ type: 'set-pan', layer: 1, pan: 0.7 });
    setup.send({ type: 'set-level', layer: 1, level: 0.6 });
    setup.send({ type: 'set-tempo', bpm: 113 });
    const state = exportState(setup.core);
    const offline = renderOffline(state, 3 * RATE);
    /** El núcleo en directo con la misma sesión, arrancado sin fundido, sin la latencia. */
    const live = (metronome: boolean) => {
      const h = new Harness({ sampleRate: RATE });
      h.send({ type: 'load-session', session: state });
      h.send({ type: 'set-metronome', enabled: metronome });
      h.core.playImmediately();
      h.render(h.core.outputLatency);
      return h.render(3 * RATE);
    };
    const quiet = live(false);
    expect(Buffer.from(offline.left.buffer)).toEqual(Buffer.from(quiet.left.buffer));
    expect(Buffer.from(offline.right.buffer)).toEqual(Buffer.from(quiet.right.buffer));
    // Con el metrónomo, el directo lleva clics; la exportación nunca.
    const clicks = live(true);
    expect(Buffer.from(offline.left.buffer)).not.toEqual(Buffer.from(clicks.left.buffer));
    expect(maxJump(offline.left)).toBeLessThan(0.05);
  });

  it('rechaza una sesión o una duración no válidas', () => {
    const state = { sampleRate: RATE, bpm: 90, layers: [] } as unknown as SessionState;
    expect(() => renderOffline(state, 100)).toThrow(RangeError);
    const empty: SessionState = {
      sampleRate: RATE,
      bpm: 90,
      layers: [EMPTY_LAYER, EMPTY_LAYER, EMPTY_LAYER, EMPTY_LAYER],
    };
    expect(() => renderOffline(empty, -1)).toThrow(RangeError);
    expect(() => renderOffline(empty, 1.5)).toThrow(RangeError);
    expect(renderOffline(empty, 0).left).toHaveLength(0);
  });
});
