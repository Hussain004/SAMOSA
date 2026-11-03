import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { analyzeSource, check, numericDelta } from '../src/core/index.ts';
import { F64Field } from '../src/core/fields/f64.ts';
import { rngFor } from '../src/core/prng.ts';

/**
 * The metamorphic tests, over matrices.
 *
 * The scalar generator in `property.test.ts` covers the arithmetic; this one
 * covers the matrix algebra: a random typed n×n expression, a true rewrite
 * applied to it, and the same rewrite broken in one place. The true rewrite
 * has to hold, the broken one has to be caught.
 *
 * The expressions are generated, not enumerated, so the coverage is not the
 * three examples that happen to be in the Cookbook.
 */

const DECLS = 'A, B, C: n×n';
const ATOMS = ['A', 'B', 'C', 'I'];

/** A random n×n expression of bounded depth, over +, -, product and transpose. */
function expressionAt(depth: number): fc.Arbitrary<string> {
  if (depth <= 0) return fc.constantFrom(...ATOMS);
  const sub = () => expressionAt(depth - 1);
  return fc.oneof(
    fc.constantFrom(...ATOMS),
    fc.tuple(sub(), sub()).map(([x, y]) => `(${x} + ${y})`),
    fc.tuple(sub(), sub()).map(([x, y]) => `(${x} - ${y})`),
    fc.tuple(sub(), sub()).map(([x, y]) => `${x} \\cdot ${y}`),
    fc.tuple(sub()).map(([x]) => `(${x})^\\top`),
  );
}

const expression = expressionAt(2);

/** A claim that holds over the matrices, and the mistake that goes with it. */
interface MatrixClaim {
  name: string;
  /** the true rewrite */
  correct: (e: string, f: string, g: string) => string;
  /** the same rewrite with one thing wrong */
  wrong: (e: string, f: string, g: string) => string;
}

const CLAIMS: MatrixClaim[] = [
  {
    name: 'the transpose of a product',
    correct: (e, f) => `(${e} \\cdot ${f})^\\top = (${f})^\\top \\cdot (${e})^\\top`,
    wrong: (e, f) => `(${e} \\cdot ${f})^\\top = (${e})^\\top \\cdot (${f})^\\top`,
  },
  {
    name: 'addition commutes',
    correct: (e, f) => `${e} + ${f} = ${f} + ${e}`,
    wrong: (e, f) => `${e} + ${f} = ${e} - ${f}`,
  },
  {
    name: 'the transpose of a sum',
    correct: (e, f) => `(${e} + ${f})^\\top = (${e})^\\top + (${f})^\\top`,
    wrong: (e, f) => `(${e} + ${f})^\\top = (${e})^\\top - (${f})^\\top`,
  },
  {
    name: 'the double transpose',
    correct: (e) => `((${e})^\\top)^\\top = ${e}`,
    wrong: (e) => `((${e})^\\top)^\\top = -${e}`,
  },
  {
    name: 'multiplication distributes',
    correct: (e, f, g) => `${e} \\cdot (${f} + ${g}) = ${e} \\cdot ${f} + ${e} \\cdot ${g}`,
    wrong: (e, f, g) => `${e} \\cdot (${f} + ${g}) = ${e} \\cdot ${f} - ${e} \\cdot ${g}`,
  },
  {
    name: 'the trace of a product is cyclic',
    correct: (e, f) => `\\operatorname{tr}(${e} \\cdot ${f}) = \\operatorname{tr}(${f} \\cdot ${e})`,
    wrong: (e, f) => `\\operatorname{tr}(${e} \\cdot ${f}) = 2 \\operatorname{tr}(${f} \\cdot ${e})`,
  },
  {
    name: 'the determinant of a product',
    correct: (e, f) => `\\det(${e} \\cdot ${f}) = \\det(${e}) \\det(${f})`,
    wrong: (e, f) => `\\det(${e} \\cdot ${f}) = \\det(${e}) + \\det(${f})`,
  },
];

describe('the metamorphic tests, over matrices', () => {
  for (const claim of CLAIMS) {
    it(`${claim.name} holds for generated expressions`, () => {
      fc.assert(
        fc.property(expression, expression, expression, fc.integer({ min: 1, max: 100000 }), (e, f, g, seed) => {
          const source = `\\begin{align*}\n${claim.correct(e, f, g)}\n\\end{align*}`;
          const report = check(source, { decls: DECLS, seed });
          const step = report.steps[0];
          expect(step.verdict).toBe('ok');
          // a checkmark always carries a guarantee
          expect(step.card.bound).toBeLessThan(1e-6);
          expect(step.card.sizes.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it(`${claim.name} is caught when it is broken`, () => {
      fc.assert(
        fc.property(expression, expression, expression, fc.integer({ min: 1, max: 100000 }), (e, f, g, seed) => {
          const source = `\\begin{align*}\n${claim.wrong(e, f, g)}\n\\end{align*}`;
          const report = check(source, { decls: DECLS, seed });
          const step = report.steps[0];
          if (step.verdict === 'ok') {
            // the generated expression can be identically zero, and a broken
            // rewrite can still hold there. the float64 oracle has to agree,
            // or the engine called it right by luck and this test must fail
            const parsed = analyzeSource(source, { decls: DECLS, seed });
            const parsedStep = parsed.steps[0];
            const run = numericDelta(
              parsed.ctx,
              parsed.defs,
              parsedStep,
              new Map([['n', 3]]),
              rngFor(seed, 'property-matrices', claim.name),
              0,
              new F64Field(),
            );
            if (run === null || run === 'domain') return;
            expect(run.shapeMessage, `the float64 oracle disagrees on the shapes for: ${claim.name}`).toBeUndefined();
            expect(run.delta, `the float64 oracle disagrees for: ${claim.name}`).toBeLessThanOrEqual(1e-9);
            return;
          }
          // the step is wrong, or the shapes do not fit: both are catches
          expect(['wrong', 'shape']).toContain(step.verdict);
        }),
        { numRuns: 100 },
      );
    });
  }
});
