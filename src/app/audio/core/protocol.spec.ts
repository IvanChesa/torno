import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, isCurrentMessage } from './protocol';

describe('protocolo', () => {
  it('acepta los mensajes de su versión', () => {
    expect(isCurrentMessage({ v: PROTOCOL_VERSION, type: 'play' })).toBe(true);
  });

  it.each([
    ['otra versión', { v: PROTOCOL_VERSION + 1, type: 'play' }],
    ['sin versión', { type: 'play' }],
    ['sin tipo', { v: PROTOCOL_VERSION }],
    ['tipo que no es texto', { v: PROTOCOL_VERSION, type: 3 }],
    ['null', null],
    ['un número', 1],
    ['un texto', 'play'],
  ])('ignora %s', (_name, data) => {
    expect(isCurrentMessage(data)).toBe(false);
  });
});
