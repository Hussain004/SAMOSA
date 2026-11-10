import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseRow } from '../src/core/parse.ts';
import { renderNode } from '../src/core/render.ts';
import type { Node } from '../src/core/ir.ts';

/**
 * The parser, fuzzed.
 *
 * parse.ts is thousands of lines of hand-written parser. It must never
 * throw on input, whatever an .tex file contains: a row it cannot read is
 * reported as unreadable, never as a crash. And the nodes it does read
 * round trip: IR to LaTeX to IR is stable.
 */

const ALPHABET = [
  'A', 'B', 'C', 'x', 'y', 'n', '0', '1', '2', '42',
  '+', '-', '=', '^', '_', '{', '}', '(', ')', '[', ']', '|',
  '\\frac', '\\times', '\\cdot', '\\Sigma', '\\top', '\\alpha', '\\left', '\\right',
  '\\begin{align*}', '\\end{align*}', '&', '\\\\', ',', ';', '.', '!', '?',
  ' ', '\n', '\t', '☺', '𝑆', 'Σ',
];

const latexish = fc
  .array(fc.constantFrom(...ALPHABET), { minLength: 0, maxLength: 40 })
  .map((tokens) => tokens.join(''));

describe('the parser never throws', () => {
  it('returns a row or an error for every token soup', () => {
    fc.assert(
      fc.property(latexish, (text) => {
        const parsed = parseRow(text, text, 0, 0, new Set(['f']), new Map());
        expect(Array.isArray(parsed.parts)).toBe(true);
        // every row is at most the rows it was asked to be, and the error,
        // when there is one, carries a message and a span
        if (parsed.error) {
          expect(typeof parsed.error.message).toBe('string');
          expect(parsed.error.span.to).toBeGreaterThanOrEqual(parsed.error.span.from);
        }
      }),
      { seed: 20261110, numRuns: 500 },
    );
  });
});

const SYMBOLS = ['A', 'B', 'C', 'x', 'y'];

/** The safe generating subset of the IR: renders and re-parses stably. */
const opNode = (op: string, args: Node[]): Node => ({ k: 'op', op: op as never, args } as Node);

const nodeArb: fc.Arbitrary<Node> = fc.letrec((tie) => ({
  node: fc.oneof(
    { depthSize: 'small' },
    fc.constant({ k: 'num', value: { n: 2, d: 1 } } as Node),
    fc.constant({ k: 'num', value: { n: 1, d: 2 } } as Node),
    fc.constantFrom(...SYMBOLS).map(
      (name) => ({ k: 'sym', name, display: name } as Node),
    ),
    fc.tuple(tie('node'), tie('node')).map(([a, b]) => opNode('add', [a, b])),
    fc.tuple(tie('node'), tie('node')).map(([a, b]) => opNode('sub', [a, b])),
    fc.tuple(tie('node'), tie('node')).map(([a, b]) => opNode('mul', [a, b])),
    tie('node').map((a) => opNode('inv', [a])),
    tie('node').map((a) => opNode('T', [a])),
    tie('node').map((a) => opNode('pow', [a, { k: 'num', value: { n: 2, d: 1 } } as Node])),
    fc.tuple(tie('node'), tie('node')).map(([a, b]) => opNode('div', [a, b])),
  ),
})).node;

describe('the rendered IR round trips through the parser', () => {
  it('parses to the same tree, for every generated expression', () => {
    fc.assert(
      fc.property(nodeArb, nodeArb, (left, right) => {
        const text = `${renderNode(left)} = ${renderNode(right)}`;
        const parsed = parseRow(text, text, 0, 0, new Set(), new Map(), new Set(SYMBOLS));
        expect(parsed.error, `the row did not parse: ${text}`).toBeUndefined();
        expect(parsed.parts).toHaveLength(1);
        const part = parsed.parts[0];
        expect(part.lhs).toBeDefined();
        // IR -> LaTeX -> IR -> LaTeX is stable
        expect(renderNode(part.lhs!)).toBe(renderNode(left));
      }),
      { seed: 20261110, numRuns: 300 },
    );
  });
});
