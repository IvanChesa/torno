import { applyCaptureMode, isCaptureMode } from './capture-mode';

describe('modo captura (?captura=1)', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-captura');
    history.replaceState(null, '', '/');
  });

  it.each([
    ['?captura=1', true],
    ['?sin3d=1&captura=1', true],
    ['?captura=0', false],
    ['?captura', false],
    ['', false],
  ])('%s → %s', (search, expected) => {
    expect(isCaptureMode(search)).toBe(expected);
  });

  it('marca el documento con ?captura=1', () => {
    history.replaceState(null, '', '/?captura=1');
    applyCaptureMode(document);
    expect(document.documentElement.hasAttribute('data-captura')).toBe(true);
  });

  it('no lo marca sin el parámetro', () => {
    history.replaceState(null, '', '/?otra=1');
    applyCaptureMode(document);
    expect(document.documentElement.hasAttribute('data-captura')).toBe(false);
  });
});
