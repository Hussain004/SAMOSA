import { describe, expect, it } from 'vitest';
import { check } from '../src/core/verdict.ts';
import { explain } from '../src/core/index.ts';

/**
 * The planted bugs of Appendix A.
 *
 * Every one of them has to be caught on the right row, with a useful
 * message. A false checkmark is the worst thing that can happen, so these
 * tests are as important as the golden one.
 */

const DECLS = String.raw`x_t, \bar\mu_t, \mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \bar\Sigma_t, \Sigma_t: spd n`;
const DECLS_NO_SPD = String.raw`x_t, \bar\mu_t, \mu_t: n; z_t: m; C_t: m×n; Q_t: m×m; \bar\Sigma_t, \Sigma_t: spd n`;

const LECTURE8 = String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
\frac{\partial^2 J_t}{\partial x_t^2} &= C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1} \\
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
\frac{\partial J_t}{\partial x_t} = 0 &\implies x_t = \bar\mu_t + \Sigma_t C_t^\top Q_t^{-1}(z_t - C_t \bar\mu_t) \\
\mu_t &:= \bar\mu_t + \Sigma_t C_t^\top Q_t^{-1}(z_t - C_t \bar\mu_t) \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\mu_t &= \bar\mu_t + K_t (z_t - C_t \bar\mu_t) \\
K_t &= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t
\end{align*}
`;

/** B1: the noise term is inverted on row 11. */
const B1 = LECTURE8.replace(
  String.raw`C_t \bar\Sigma_t C_t^\top + Q_t`,
  String.raw`C_t \bar\Sigma_t C_t^\top + Q_t^{-1}`,
);

/** B2: the Joseph form is missing the noise term on row 12. */
const B2 = LECTURE8.replace(
  String.raw`\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t`,
  String.raw`\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top`,
);

/** B3: the transpose is missing on row 11. */
const B3 = LECTURE8.replace('K_t &= \\bar\\Sigma_t C_t^\\top', 'K_t &= \\bar\\Sigma_t C_t');

describe('the planted bugs', () => {
  it('B1 catches the inverted noise term on row 11', () => {
    const report = check(B1, { decls: DECLS });
    const step = report.steps[9];
    expect(step.verdict).toBe('wrong');
    expect(step.row).toBe(10);
  });
  it('B2 catches the Joseph form on row 12', () => {
    const report = check(B2, { decls: DECLS });
    const step = report.steps[10];
    expect(step.verdict).toBe('wrong');
    expect(step.row).toBe(11);
  });

  it('B3 catches the missing transpose on row 11', () => {
    const report = check(B3, { decls: DECLS });
    const step = report.steps[9];
    expect(step.verdict).toBe('shape');
    expect(step.row).toBe(10);
  });

  it('B4 catches the missing assumption on the calculus rows', () => {
    const report = check(LECTURE8, { decls: DECLS_NO_SPD });
    // the gradient, the Hessian and the stationarity all need Q to be symmetric
    expect(report.steps[1].verdict).toBe('wrong');
    expect(report.steps[2].verdict).toBe('wrong');
    expect(report.steps[4].verdict).toBe('wrong');
    // the push-through and the Woodbury identity do not need symmetry
    expect(report.steps[8].verdict).toBe('ok');
    expect(report.steps[9].verdict).toBe('ok');
  });
});

describe('the repairs of the planted bugs', () => {
  /** The fixes of the step that is wrong, in the order they are offered. */
  const fixesOf = (src: string, row: number, decls: string): string[] => {
    const report = check(src, { decls });
    const step = report.steps.find((s) => s.row === row);
    if (!step) return [];
    const explanation = explain(src, step.id, { decls });
    return explanation.fixes.map((f) => f.title);
  };

  it('B1 offers the inverse that should not be there', () => {
    const fixes = fixesOf(B1, 10, DECLS);
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes[0]).toContain('inverse');
  });

  it('B2 names the term that is missing', () => {
    const fixes = fixesOf(B2, 11, DECLS);
    expect(fixes.some((f) => f.includes('off by exactly'))).toBe(true);
    expect(fixes.some((f) => f.includes('K_t Q_t'))).toBe(true);
  });

  it('B3 offers the missing transpose first', () => {
    const fixes = fixesOf(B3, 10, DECLS);
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes[0]).toContain('transpose');
    // a matrix that is not square cannot be symmetric
    expect(fixes.some((f) => f.includes('symmetric'))).toBe(false);
  });

  it('B4 offers the missing assumption', () => {
    const fixes = fixesOf(LECTURE8, 2, DECLS_NO_SPD);
    expect(fixes.some((f) => f.includes('Q_t is symmetric'))).toBe(true);
  });
});

describe('the counterexamples', () => {
  const counterexampleOf = (src: string, row: number, decls: string) => {
    const report = check(src, { decls });
    const step = report.steps.find((s) => s.row === row);
    if (!step) throw new Error(`no step on row ${row}`);
    const explanation = explain(src, step.id, { decls });
    if (!explanation.counterexample) throw new Error('no counterexample');
    return explanation.counterexample;
  };

  it('computes the defined symbols instead of sampling them', () => {
    const counterexample = counterexampleOf(B2, 11, DECLS);
    // a symbol the derivation defines is not an input
    expect(Object.keys(counterexample.values)).not.toContain('\\Sigma_t');
    expect(Object.keys(counterexample.values)).not.toContain('K_t');
    // it is computed from the definitions, and reported as derived
    expect(Object.keys(counterexample.derived)).toContain('\\Sigma_t');
    expect(Object.keys(counterexample.derived)).toContain('K_t');
  });

  it('samples a free scalar as an input', () => {
    // The step uses a symbol the derivation never defines, and its type is a
    // scalar. It is still an input of the counterexample.
    const source = String.raw`\begin{align*}
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1}
\end{align*}`;
    const counterexample = counterexampleOf(source, 2, DECLS);
    expect(Object.keys(counterexample.values)).toContain('\\Sigma_t');
    // and every value has the shape a reader needs to draw it
    expect(counterexample.shapes['C_t']).toEqual([1, 1]);
    expect(counterexample.lhsShape).toEqual([1, 1]);
  });

  it('reports the sizes the step uses, and no internal names', () => {
    const counterexample = counterexampleOf(B2, 11, DECLS);
    expect(counterexample.dims.n).toBeGreaterThanOrEqual(1);
    expect(counterexample.dims.m).toBeGreaterThanOrEqual(1);
    for (const name of Object.keys(counterexample.dims)) {
      expect(name.startsWith('#')).toBe(false);
    }
  });

  it('shows a positive definite matrix for a positive definite one', () => {
    const counterexample = counterexampleOf(B2, 11, DECLS);
    const q = counterexample.values['Q_t'];
    expect(Array.isArray(q)).toBe(true);
    const entries = q as number[];
    const n = Math.round(Math.sqrt(entries.length));
    // symmetric
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        expect(entries[i * n + j]).toBe(entries[j * n + i]);
      }
    }
    // the leading principal minors are positive, so it really is positive
    // definite over the reals
    for (let k = 1; k <= n; k++) {
      expect(leadingMinor(entries, n, k)).toBeGreaterThan(0);
    }
  });
});

/** The determinant of the leading k by k block of a square matrix. */
function leadingMinor(entries: number[], n: number, k: number): number {
  const block: number[] = [];
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) block.push(entries[i * n + j]);
  // the determinant by the Leibniz formula, which is fine for the small sizes
  // a counterexample uses
  let det = 0;
  const permutations = permutationsOf(k);
  for (const permutation of permutations) {
    let sign = 1;
    let product = 1;
    for (let i = 0; i < k; i++) {
      sign *= i % 2 === permutation[i] % 2 ? 1 : -1;
      product *= block[i * k + permutation[i]];
    }
    det += sign * product;
  }
  return det;
}

function permutationsOf(k: number): number[][] {
  if (k <= 1) return [[0]];
  const out: number[][] = [];
  const rest = permutationsOf(k - 1);
  for (let i = 0; i < k; i++) {
    for (const permutation of rest) {
      const copy = permutation.slice();
      copy.splice(i, 0, copy.pop()!);
      out.push(copy);
    }
  }
  return out;
}

describe('the layout of a gradient', () => {
  const GRADIENT = String.raw`\begin{align*}
J &:= a^\top X b \\
\frac{\partial J}{\partial X} &= b a^\top
\end{align*}`;
  const DECLS_X = 'X: m×n; a: m; b: n';

  it('says the right side is in the numerator layout', () => {
    const report = check(GRADIENT, { decls: DECLS_X });
    const step = report.steps[1];
    expect(step.verdict).toBe('shape');
    expect(step.message).toContain('numerator layout');
  });

  it('holds the denominator layout', () => {
    // the denominator layout of the gradient of a^top X b is a b^top
    const ok = check(GRADIENT.replace(String.raw`b a^\top`, String.raw`a b^\top`), {
      decls: DECLS_X,
    });
    expect(ok.steps[1].verdict).toBe('ok');
  });
});
