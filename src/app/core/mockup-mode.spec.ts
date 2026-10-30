import { isMockupMode } from './mockup-mode';

describe('modo maqueta (?maqueta=1)', () => {
  it.each([
    ['?maqueta=1', true],
    ['?captura=1&maqueta=1&vista=cenital', true],
    ['?maqueta=0', false],
    ['?maqueta', false],
    ['', false],
  ])('%s → %s', (search, expected) => {
    expect(isMockupMode(search)).toBe(expected);
  });
});
