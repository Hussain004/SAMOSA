import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';

/**
 * Non-polynomial expectations, by Monte Carlo sampling.
 *
 * The claim is evaluated against a seeded estimate of the expectation. The
 * verdict is never ok: a Monte Carlo estimate can refute and it can fail
 * to refute, and it says so.
 */

const source = (row: string, decls = 'x ~ N(0, 1)'): string => `% samosa: ${decls}
\\begin{align*}
${row}
\\end{align*}`;

describe('the Monte Carlo expectation mode', () => {
  it('is inconclusive for a true non-polynomial claim, and never ok', () => {
    const report = check(source(String.raw`\mathbb{E}[\sin(x)] = 0`), {});
    const step = report.steps[0];
    expect(step.verdict).toBe('inconclusive');
    expect(step.message).toContain('never certified');
    expect(step.card.assumptions.join(' ')).toContain('Monte Carlo');
  });

  it('is wrong when the estimate is far from the claim', () => {
    const report = check(source(String.raw`\mathbb{E}[\sin(x)] = 1`), {});
    expect(report.steps[0].verdict).toBe('wrong');
  });

  it('is wrong for a false exponential claim with a small variance', () => {
    const report = check(source(String.raw`\mathbb{E}[e^{x}] = 1`), {});
    expect(report.steps[0].verdict).toBe('wrong');
  });

  it('never returns ok for an expectation the quadrature cannot integrate', () => {
    const rows = [
      String.raw`\mathbb{E}[\sin(x)] = 0`,
      String.raw`\mathbb{E}[\sin(x)] = 1`,
      String.raw`\mathbb{E}[\cos(x)] = 0`,
      String.raw`\mathbb{E}[e^{x}] = 1`,
      String.raw`\mathbb{E}[1/x^2] = 1`,
    ];
    for (const row of rows) {
      const report = check(source(row), {});
      for (const step of report.steps) {
        expect(step.verdict, row).not.toBe('ok');
      }
    }
  });

  it('is unchecked for a non-Gaussian expectation', () => {
    const report = check(source(String.raw`\mathbb{E}[\sin(x)] = 0`, 'x ~ U(0, 1)'), {});
    expect(report.steps[0].verdict).toBe('unchecked');
  });

  it('is stable with the seed, on the reported row', () => {
    const a = check(source(String.raw`\mathbb{E}[\sin(x)] = 0`), { seed: 7 });
    const b = check(source(String.raw`\mathbb{E}[\sin(x)] = 0`), { seed: 7 });
    expect(b.steps.map((s) => s.verdict)).toEqual(a.steps.map((s) => s.verdict));
  });

  it('works for a claim to the expectation of a function of a matrix', () => {
    const src = source(
      String.raw`\mathbb{E}[\sin(x y)] = 0`,
      'x ~ N(0, 1); y ~ N(0, 1)',
    );
    const report = check(src, {});
    expect(report.steps[0].verdict).not.toBe('ok');
  });
});
