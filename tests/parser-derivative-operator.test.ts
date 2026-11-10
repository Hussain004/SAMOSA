import { describe, expect, it } from 'vitest';
import { parseRow } from '../src/core/parse.ts';
import type { Node } from '../src/core/ir.ts';

/**
 * The derivative rows people write with `\frac{\partial}{\partial x}`.
 *
 * A bare `\partial` in the numerator is an operator whose operand is the
 * expression that follows, the way `\nabla` works: `\frac{\partial}{\partial
 * \beta} J`. And a Greek symbol in the denominator is a symbol the engine
 * can differentiate with respect to, named the way the row parser names it,
 * so `\frac{\partial J}{\partial \beta}` differentiates by `\beta`.
 *
 * These used to fail (the first with "unexpected end of input", the second
 * by silently producing a symbol with an empty name), which is why the
 * least-squares identity of the Cookbook could never be checked.
 */

function derivOf(text: string): Extract<Node, { k: 'deriv' }> {
  const parsed = parseRow(text, text, 0, 0, new Set(), new Map());
  const lhs = parsed.parts[0]?.lhs;
  if (!lhs || lhs.k !== 'deriv') {
    throw new Error(`the row does not read as a derivative: ${parsed.error?.message ?? 'unknown'}`);
  }
  return lhs;
}

describe('the derivative operator written with a bare partial', () => {
  it('reads the bare numerator as an operator whose operand follows', () => {
    const d = derivOf(String.raw`\frac{\partial}{\partial \beta} J &= 0`);
    expect(d.f).toMatchObject({ k: 'sym', name: 'J' });
    expect(d.wrt.map((w) => w.name)).toEqual(['\\beta']);
    expect(d.order).toBe(1);
    expect(d.form).toBe('grad');
  });

  it('reads a fraction operand', () => {
    const d = derivOf(String.raw`\frac{\partial}{\partial \beta} \frac{1}{2}\|y - X\beta\|^2 &= X^\top(X\beta - y)`);
    expect(d.f.k).toBe('op');
    expect(d.wrt.map((w) => w.name)).toEqual(['\\beta']);
  });

  it('reads the second order from the numerator', () => {
    const d = derivOf(String.raw`\frac{\partial^2}{\partial \beta} J &= 0`);
    expect(d.order).toBe(2);
    expect(d.form).toBe('hess');
  });

  it('reads the second order from the denominator symbol', () => {
    const d = derivOf(String.raw`\frac{\partial}{\partial \beta^2} J &= 0`);
    expect(d.order).toBe(2);
  });
});

describe('the symbol a derivative is taken with respect to', () => {
  it('names a Greek denominator symbol the way the row parser names it', () => {
    for (const [den, symbol] of [
      ['\\beta', '\\beta'],
      ['\\Sigma', '\\Sigma'],
      ['\\mu', '\\mu'],
      ['\\beta_k', '\\beta_k'],
      ['x', 'x'],
    ] as Array<[string, string]>) {
      const d = derivOf(`\\frac{\\partial J}{\\partial ${den}} &= 0`);
      expect(d.wrt.map((w) => w.name), den).toEqual([symbol]);
    }
  });

  it('reads the second order of a Greek denominator symbol', () => {
    const d = derivOf(String.raw`\frac{\partial^2 J}{\partial \beta^2} &= 0`);
    expect(d.order).toBe(2);
    expect(d.wrt.map((w) => w.name)).toEqual(['\\beta']);
  });
});
