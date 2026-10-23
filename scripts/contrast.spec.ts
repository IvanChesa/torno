// Contraste AA de cada combinación de color de docs/DISENO.md, con los valores de tokens.css.
import { describe, expect, it } from 'vitest';
import { PAIRS, contrastRatio, evaluatePairs, parseColorTokens, readTokens } from './contrast.mjs';

describe('contraste de la paleta (WCAG 2.1 AA)', () => {
  it('calcula el contraste como la WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    // Ejemplo conocido: gris #767676 sobre blanco, el límite de 4,5:1.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('lee los tokens de color de la hoja', () => {
    const tokens = parseColorTokens(
      ':root { --color-a: #ABCDEF; --space: 1rem; --color-b:#000000; }',
    );
    expect([...tokens]).toEqual([
      ['--color-a', '#abcdef'],
      ['--color-b', '#000000'],
    ]);
  });

  it.each(PAIRS.map(([fg, bg, min, use]) => [use, fg, bg, min] as const))(
    '%s (%s sobre %s) llega a %s:1',
    async (_use, fg, bg) => {
      const [row] = evaluatePairs(
        await readTokens(),
        PAIRS.filter((p) => p[0] === fg && p[1] === bg),
      );
      expect(row?.ratio).toBeGreaterThanOrEqual(row?.min ?? Infinity);
    },
  );
});
