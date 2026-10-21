import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { check } from '../src/core/verdict.ts';

/**
 * The metamorphic tests.
 *
 * A random expression, written in two ways that mean the same thing, has to
 * be seen as holding, every time. The same expression written with one thing
 * wrong has to be caught, every time.
 *
 * The generator makes the expressions, so the test covers thousands of them
 * and not the three that happen to be in the corpus.
 */

/**
 * A random expression over three scalars.
 *
 * Only sums and products, so an expression is never identically zero and a
 * mistake in it is always a mistake.
 */
function expressionAt(depth: number): fc.Arbitrary<string> {
  if (depth <= 0) return fc.constantFrom('a', 'b', 'c');
  const atom = fc.constantFrom('a', 'b', 'c');
  return fc.oneof(
    atom,
    expressionAt(depth - 1).chain((x) => expressionAt(depth - 1).map((y) => `(${x} + ${y})`)),
    expressionAt(depth - 1).chain((x) => expressionAt(depth - 1).map((y) => `(${x} * ${y})`)),
  );
}

const expression = expressionAt(3);

/** A claim that holds, and the mistake that goes with it. */
interface Claim {
  name: string;
  correct: (e: string) => string;
  wrong: (e: string) => string;
}

const CLAIMS: Claim[] = [
  {
    name: 'a sum of two equal things',
    correct: (e) => `${e} + ${e} = 2 ${e}`,
    wrong: (e) => `${e} + ${e} = 3 ${e}`,
  },
  {
    name: 'a difference of two equal things',
    correct: (e) => `${e} - ${e} = 0`,
    wrong: (e) => `${e} - ${e} = 1`,
  },
  {
    name: 'twice a thing',
    correct: (e) => `2 ${e} = ${e} + ${e}`,
    wrong: (e) => `2 ${e} = ${e} + ${e} + ${e}`,
  },
  {
    name: 'a thing and nothing',
    correct: (e) => `${e} + 0 = ${e}`,
    wrong: (e) => `${e} + 0 = 2 ${e}`,
  },
  {
    name: 'a product with one',
    correct: (e) => `1 ${e} = ${e}`,
    wrong: (e) => `1 ${e} = 2 ${e}`,
  },
];

const DECLS = 'a, b, c: scalar';

describe('the metamorphic tests', () => {
  for (const claim of CLAIMS) {
    it(`${claim.name} holds for every expression`, () => {
      fc.assert(
        fc.property(expression, fc.integer({ min: 1, max: 100000 }), (e, seed) => {
          const source = `\\begin{align*}\n${claim.correct(e)}\n\\end{align*}`;
          const report = check(source, { decls: DECLS, seed });
          const step = report.steps[0];
          expect(step.verdict).toBe('ok');
          // a checkmark always carries a guarantee
          expect(step.card.bound).toBeLessThan(1e-6);
          expect(step.card.sizes.length).toBeGreaterThan(0);
        }),
        { numRuns: 25 },
      );
    });

    it(`${claim.name} is caught when it is wrong`, () => {
      fc.assert(
        fc.property(expression, fc.integer({ min: 1, max: 100000 }), (e, seed) => {
          const source = `\\begin{align*}\n${claim.wrong(e)}\n\\end{align*}`;
          const report = check(source, { decls: DECLS, seed });
          const step = report.steps[0];
          // the step is wrong, or the shapes do not fit: both are catches
          expect(['wrong', 'shape']).toContain(step.verdict);
          // and never a checkmark
          expect(step.verdict).not.toBe('ok');
        }),
        { numRuns: 25 },
      );
    });
  }

  it('the same derivation always gives the same verdict', () => {
    fc.assert(
      fc.property(expression, (e) => {
        const source = `\\begin{align*}\n${e} + ${e} = 2 ${e}\n\\end{align*}`;
        const first = check(source, { decls: DECLS, seed: 7 });
        const second = check(source, { decls: DECLS, seed: 7 });
        expect(first.steps[0].verdict).toBe(second.steps[0].verdict);
        expect(first.steps[0].card.bound).toBe(second.steps[0].card.bound);
      }),
      { numRuns: 20 },
    );
  });

  it('a different seed does not change a verdict that holds', () => {
    fc.assert(
      fc.property(expression, fc.integer({ min: 1, max: 100000 }), (e, seed) => {
        const source = `\\begin{align*}\n${e} + ${e} = 2 ${e}\n\\end{align*}`;
        const report = check(source, { decls: DECLS, seed });
        expect(report.steps[0].verdict).toBe('ok');
      }),
      { numRuns: 20 },
    );
  });
});
