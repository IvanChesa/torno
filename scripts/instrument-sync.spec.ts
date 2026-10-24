// El modelo del instrumento (src/app/instrument) no puede importar el núcleo de audio (PLAN §4.2):
// repite unos pocos límites. Este test, fuera de las capas, comprueba que no se separan, y que los
// sonidos del menú son los que sabe renderizar el worker de síntesis.
import { describe, expect, it } from 'vitest';
import * as core from '../src/app/audio/core/constants';
import { MAX_REPEATS as EXPORT_MAX_REPEATS } from '../src/app/audio/files/export';
import { MAX_MANUAL_LATENCY_MS as ENGINE_MAX_LATENCY } from '../src/app/audio/engine/latency';
import { TEST_SOUND_IDS } from '../src/app/audio/synth/test-loop';
import * as instrument from '../src/app/instrument/constants';
import { SOUNDS } from '../src/app/instrument/sounds';

describe('el instrumento y el audio usan los mismos límites', () => {
  it('capas, tempo, duraciones de toma, ganancia, vueltas, latencia y disco', () => {
    expect(instrument.LAYER_COUNT).toBe(core.LAYER_COUNT);
    expect(instrument.MIN_BPM).toBe(core.MIN_BPM);
    expect(instrument.MAX_BPM).toBe(core.MAX_BPM);
    expect(instrument.DEFAULT_BPM).toBe(core.DEFAULT_BPM);
    expect([...instrument.TAKE_BARS]).toEqual([...core.TAKE_BARS]);
    expect(instrument.MAX_INPUT_GAIN).toBe(core.MAX_INPUT_GAIN);
    expect(instrument.MAX_REPEATS).toBe(EXPORT_MAX_REPEATS);
    expect(instrument.MAX_MANUAL_LATENCY_MS).toBe(ENGINE_MAX_LATENCY);
    expect(instrument.BEATS_PER_TURN).toBe(core.DISC_BEATS_PER_TURN);
  });

  it('cada sonido del menú lo sabe renderizar el worker de síntesis', () => {
    expect(SOUNDS.map((sound) => sound.id).sort()).toEqual([...TEST_SOUND_IDS].sort());
  });
});
