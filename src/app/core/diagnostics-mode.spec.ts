import { isDiagnosticsMode } from './diagnostics-mode';

describe('modo diagnóstico (?diagnostico=1)', () => {
  it.each([
    ['?diagnostico=1', true],
    ['?sin3d=1&diagnostico=1', true],
    ['?diagnostico=0', false],
    ['?diagnostico', false],
    ['', false],
  ])('%s → %s', (search, expected) => {
    expect(isDiagnosticsMode(search)).toBe(expected);
  });
});
