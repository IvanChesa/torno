// La pose del aparato (PLAN §4.6): lo que enseña el 3D de cada pieza, sacado del estado del
// instrumento, del audio y de la pantalla.
import { describe, expect, it } from 'vitest';
import { displayModel, type DisplayContext } from './display';
import {
  initialState,
  type InstrumentLayerStatus,
  type InstrumentState,
  type InstrumentStatus,
} from './instrument';
import { instrumentPose, pilotLight, samePose } from './pose';

const EMPTY: InstrumentLayerStatus = {
  hasContent: false,
  source: 'empty',
  soundId: '',
  pending: false,
  undo: 0,
  redo: 0,
  lengthBeats: 0,
  positionBeats: 0,
};
const SOUND: InstrumentLayerStatus = {
  ...EMPTY,
  hasContent: true,
  source: 'library',
  soundId: 'alfar',
  lengthBeats: 8,
};
const CONTEXT: DisplayContext = {
  recordSeconds: 0,
  countInBeats: 0,
  mic: 'off',
  autoLatencyMs: 0,
  message: '',
};

function status(change: Partial<InstrumentStatus> = {}): InstrumentStatus {
  return {
    transport: 'stopped',
    recording: 'idle',
    recordLayer: -1,
    standby: false,
    layers: [SOUND, EMPTY, EMPTY, EMPTY],
    ...change,
  };
}

function pose(state: InstrumentState, audio: InstrumentStatus) {
  return instrumentPose(state, audio, displayModel(state, audio, CONTEXT));
}

describe('instrumentPose', () => {
  it('en reposo: diales al nivel, tempo en su rango, brazo fuera y nada hundido', () => {
    const result = pose(initialState(), status());
    expect(result.layers.map((layer) => layer.level)).toEqual([1, 1, 1, 1]);
    expect(result.layers.map((layer) => layer.pilot)).toEqual(['content', 'off', 'off', 'off']);
    expect(result.selected).toBe(0);
    // 90 BPM en 40–240: un cuarto del recorrido.
    expect(result.main).toBeCloseTo(0.25, 10);
    expect(result.arm).toBe(0);
    expect(result.volume).toBe(1);
    expect(result.pressed).toEqual({ play: false, record: false, standby: false });
    expect(result.recordLight).toBe('off');
    expect(result.display.lines[0]).toContain('90 BPM');
  });

  it('sigue a los controles: nivel, silencio, filtro de la capa elegida y volumen', () => {
    const base = initialState();
    const layers = base.controls.layers.map((layer, i) =>
      i === 2 ? { ...layer, level: 0.4, muted: true, filter: 0.7 } : layer,
    );
    const state: InstrumentState = {
      ...base,
      selected: 2,
      controls: { ...base.controls, layers, volume: 0.25, bpm: 240 },
    };
    const result = pose(state, status());
    expect(result.layers[2]).toEqual({ level: 0.4, muted: true, pilot: 'off' });
    expect(result.selected).toBe(2);
    expect(result.arm).toBe(0.7);
    expect(result.volume).toBe(0.25);
    expect(result.main).toBe(1);
  });

  it('teclas hundidas y piloto de grabar según el audio', () => {
    const playing = pose(initialState(), status({ transport: 'playing' }));
    expect(playing.pressed.play).toBe(true);
    const countIn = pose(initialState(), status({ recording: 'count-in', recordLayer: 1 }));
    expect(countIn.pressed.record).toBe(true);
    expect(countIn.recordLight).toBe('count-in');
    const taking = pose(
      initialState(),
      status({ recording: 'recording', recordLayer: 1, transport: 'playing' }),
    );
    expect(taking.recordLight).toBe('on');
    expect(taking.layers[1]!.pilot).toBe('recording');
    expect(pose(initialState(), status({ standby: true })).pressed.standby).toBe(true);
  });

  it('el piloto: grabar manda sobre la cola, y la cola sobre tener sonido', () => {
    const pilot = { hasContent: true, muted: false, selected: false, recording: false };
    expect(pilotLight({ ...pilot, pending: false })).toBe('content');
    expect(pilotLight({ ...pilot, pending: true })).toBe('pending');
    expect(pilotLight({ ...pilot, pending: true, recording: true })).toBe('recording');
    expect(pilotLight({ ...pilot, hasContent: false, pending: false })).toBe('off');
    expect(pilotLight(undefined)).toBe('off');
  });

  it('samePose: el mismo aspecto aunque llegue otro estado del audio; distinto si algo se ve', () => {
    const a = pose(initialState(), status({ transport: 'playing' }));
    const b = pose(initialState(), status({ transport: 'playing' }));
    expect(a).not.toBe(b);
    expect(samePose(a, b)).toBe(true);
    const base = initialState();
    const louder: InstrumentState = {
      ...base,
      controls: { ...base.controls, volume: 0.5 },
    };
    expect(samePose(a, pose(louder, status({ transport: 'playing' })))).toBe(false);
    expect(samePose(a, pose(initialState(), status()))).toBe(false);
    const menu = pose({ ...base, menu: { ...base.menu, open: true } }, status());
    expect(samePose(pose(initialState(), status()), menu)).toBe(false);
  });

  it('los valores fuera de rango se quedan en el recorrido de la pieza', () => {
    const base = initialState();
    const state: InstrumentState = {
      ...base,
      controls: { ...base.controls, volume: 1.4, bpm: 20 },
    };
    const result = pose(state, status());
    expect(result.volume).toBe(1);
    expect(result.main).toBe(0);
  });
});
