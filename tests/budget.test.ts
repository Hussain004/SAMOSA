import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { check, explain } from '../src/core/index.ts';
import { analyzeSource } from '../src/core/verdict/index.ts';
import { shrinkCounterexample } from '../src/core/shrink.ts';
import { collectDimVarsFor } from '../src/core/dims.ts';
import { inferType } from '../src/core/types.ts';

/**
 * The evidence may not depend on the speed of the machine (review 5.8).
 *
 * The budgets of the repair engine and of the counterexample search are
 * counts of evaluations, and never milliseconds: a slow runner has to print
 * the same fixes and the same counterexample a laptop prints, because the
 * evidence a card shows is part of the verdict.
 */

describe('the budgets are counts, not wall clocks', () => {
  it('no millisecond budget is left in the evidence paths', () => {
    for (const file of ['src/core/repair.ts', 'src/core/shrink.ts', 'src/core/index.ts']) {
      const text = readFileSync(file, 'utf8');
      expect(text.includes('Date.now'), `${file} reads no clock`).toBe(false);
      expect(/budgetMs/.test(text), `${file} names no millisecond budget`).toBe(false);
    }
  });

  it('the same input and seed give the same fixes and the same counterexample', () => {
    const src = '\\begin{align*} A^\\top A &= A A^\\top \\end{align*}';
    const opts = { decls: 'A: n×n' };
    const first = explain(src, check(src, opts).steps[0].id, opts);
    const second = explain(src, check(src, opts).steps[0].id, opts);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    // the search really did run, so the comparison is not of two empties
    expect(first.counterexample).toBeDefined();
  });

  it('a smaller budget changes the evidence by the count, and only by the count', () => {
    const src = '\\begin{align*} L^\\top &= L \\end{align*}';
    const parsed = analyzeSource(src, { decls: 'L: tril n' });
    const step = parsed.steps.find((s) => s.lhs && s.rhs);
    expect(step).toBeDefined();
    // the sizes are keyed by the root of the dimension variable, the way the
    // evaluator looks them up
    inferType(parsed.ctx, step!.lhs!);
    inferType(parsed.ctx, step!.rhs!);
    const dimVars = collectDimVarsFor(parsed.ctx, step!.lhs!, step!.rhs!, parsed.defs);
    const sizes = new Map<string, number>();
    for (const v of dimVars) sizes.set(parsed.ctx.dims.find(v), 2);
    expect(sizes.size, 'the step names the dimension n').toBe(1);
    const run = (maxAttempts: number) =>
      JSON.stringify(shrinkCounterexample(parsed.ctx, step!.lhs!, step!.rhs!, parsed.defs, sizes, 0, maxAttempts));
    // one attempt is too few for the small integers, so the residue of the
    // finite field answers instead; the answer is the same every time
    const small = run(1);
    expect(small).toBe(run(1));
    // with the full budget the small integers are found, and they are found
    // the same way every time
    const full = run(160);
    expect(full).toBe(run(160));
    expect(full).not.toBe('null');
    const values = JSON.parse(full).values['L'] as number[];
    expect(values.length).toBe(4);
    expect(values.every((x) => Number.isInteger(x))).toBe(true);
  });
});
