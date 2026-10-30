import { describe, expect, it } from 'vitest';
import { isHtmlOnlyMode } from './html-only-mode';

describe('isHtmlOnlyMode', () => {
  it('solo con ?sin3d=1', () => {
    expect(isHtmlOnlyMode('?sin3d=1')).toBe(true);
    expect(isHtmlOnlyMode('?captura=1&sin3d=1')).toBe(true);
    expect(isHtmlOnlyMode('')).toBe(false);
    expect(isHtmlOnlyMode('?sin3d=0')).toBe(false);
  });
});
