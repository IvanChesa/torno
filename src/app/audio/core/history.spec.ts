import { describe, expect, it } from 'vitest';
import { RECORDING_SOURCE, type LayerContent } from './content';
import { LayerHistory } from './history';

function content(label: number): LayerContent {
  return {
    data: new Float32Array([label]),
    frames: 1,
    lengthBeats: 4,
    offsetBeats: 0,
    source: RECORDING_SOURCE,
  };
}

const label = (state: LayerContent | null) => (state ? state.data[0] : null);

describe('LayerHistory', () => {
  it('deshace y rehace hasta 3 estados (más el actual)', () => {
    const history = new LayerHistory();
    expect(history.capacity).toBe(4);
    for (let i = 1; i <= 5; i++) history.push(content(i));
    expect(label(history.current)).toBe(5);
    expect(history.undoCount).toBe(3);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(label(history.current)).toBe(2);
    // El cuarto deshacer ya no existe: el estado 1 se perdió al entrar el 5.
    expect(history.undo()).toBe(false);
    expect(history.redoCount).toBe(3);
    expect(history.redo()).toBe(true);
    expect(label(history.current)).toBe(3);
  });

  it('una edición nueva invalida el rehacer', () => {
    const history = new LayerHistory();
    history.push(content(1));
    history.push(content(2));
    history.undo();
    expect(history.redoCount).toBe(1);
    history.push(content(3));
    expect(history.redoCount).toBe(0);
    expect(history.redo()).toBe(false);
    expect(label(history.current)).toBe(3);
    history.undo();
    expect(label(history.current)).toBe(1);
  });

  it('la capa vacía también es un estado (deshacer un «borrar capa»)', () => {
    const history = new LayerHistory();
    expect(history.current).toBeNull();
    history.push(content(1));
    history.push(null);
    expect(history.current).toBeNull();
    history.undo();
    expect(label(history.current)).toBe(1);
    history.undo();
    expect(history.current).toBeNull();
  });

  it('dropOldest suelta el deshacer más antiguo (o el rehacer más lejano)', () => {
    const history = new LayerHistory();
    history.push(content(1));
    history.push(content(2));
    expect(history.size).toBe(3);
    expect(history.dropOldest()).toBe(true);
    expect(history.undoCount).toBe(1);
    expect(label(history.at(0))).toBe(1);
    history.undo();
    expect(history.dropOldest()).toBe(true);
    expect(history.redoCount).toBe(0);
    expect(label(history.current)).toBe(1);
    expect(history.dropOldest()).toBe(false);
  });

  it('reset deja un único estado', () => {
    const history = new LayerHistory();
    history.push(content(1));
    history.push(content(2));
    history.reset(content(9));
    expect(history.size).toBe(1);
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(0);
    expect(label(history.current)).toBe(9);
    expect(history.at(1)).toBeNull();
  });
});
