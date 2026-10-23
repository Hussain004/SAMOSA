import { describe, expect, it } from 'vitest';
import { parseRow } from '../src/core/parse.ts';
import { renderNode } from '../src/core/render.ts';
import { IDENTITIES } from '../corpus/cookbook/identities.ts';

/**
 * The round trip.
 *
 * The engine renders the IR back to LaTeX when it offers a fix, so the
 * rendering has to mean the same thing as the tree it came from. A product of
 * a sum, written without the braces, means something else, and the fix would
 * then be a different step.
 */

const EXPRESSIONS = [
  'A + B',
  'A - B',
  'A B',
  '(A - B) C',
  'A (B - C)',
  '(A B) C',
  'A (B C)',
  '- A',
  '- (A + B)',
  '(A + B)(C + D)',
  'A^{-1}',
  '(A B)^{-1}',
  'A^\\top',
  '(A B)^\\top',
  '{A^\\top}^\\top',
  'A + B + C',
  '(A + B) + C',
  '\\frac{1}{2} x^\\top A x',
  '\\left(C_t^\\top Q_t^{-1} C_t + \\bar\\Sigma_t^{-1}\\right)^{-1}',
  '(I - K_t C_t)\\, \\bar\\Sigma_t (I - K_t C_t)^\\top',
  '\\operatorname{tr}(A B)',
  '\\det(A + U C V)',
  '\\mathbb{E}[x x^\\top]',
  'a^\\top X b',
];

/** The IR of an expression, as a stable string. */
function shape(expression: string): string | null {
  const source = `x = ${expression}`;
  try {
    const parsed = parseRow(source, source, 0, 0);
    const part = parsed.parts[0];
    if (!part?.rhs) return null;
    // a raw node is a piece of notation SAMOSA does not know, and it is kept
    // as it was written, so there is nothing to round trip
    if (hasRaw(part.rhs)) return null;
    return renderNode(part.rhs);
  } catch {
    return null;
  }
}

/** Does the tree have a piece of unknown notation in it? */
function hasRaw(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const any = node as {
    k?: string;
    args?: unknown[];
    f?: unknown;
    wrt?: unknown[];
    body?: unknown;
    rows?: unknown[][];
  };
  if (any.k === 'raw') return true;
  if (any.k === 'deriv') return hasRaw(any.f) || (any.wrt ?? []).some(hasRaw);
  if (any.k === 'bigop') return hasRaw(any.body);
  if (any.k === 'block') return (any.rows ?? []).some((row) => row.some(hasRaw));
  for (const arg of any.args ?? []) if (hasRaw(arg)) return true;
  return false;
}

describe('the round trip', () => {
  for (const expression of EXPRESSIONS) {
    it(`${expression} means the same thing after the trip`, () => {
      const first = shape(expression);
      expect(first).not.toBeNull();
      const second = shape(first!);
      expect(second).not.toBeNull();
      expect(second).toBe(first);
    });
  }

  it('holds for the cookbook', () => {
    const broken: string[] = [];
    for (const identity of IDENTITIES) {
      for (const row of identity.source.split('\\\\')) {
        const right = row.includes('=') ? row.slice(row.indexOf('=') + 1) : row;
        const first = shape(right);
        if (!first) continue;
        const second = shape(first);
        if (second !== first) broken.push(`${identity.id}: ${row.trim()} -> ${first}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
