import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { check, explain } from '../src/core/index.ts';
import { rationalize } from '../src/core/numpy.ts';

/**
 * The counterexample, in three languages.
 *
 * The NumPy snippet is run by the other test. Julia and MATLAB are not
 * installed on the machine that runs the suite, so theirs are checked by
 * construction: the prelude, the literals, the operators and the print
 * statement have to be what the languages expect, and the Python bits have
 * to be gone.
 */

const DECLS = 'x_t, \\bar\\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n';

const JOSEPH = String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top
\end{align*}
`;

function counterexampleOf(source: string, decls: string) {
  const report = check(source, { decls });
  const wrong = report.steps.find((s) => s.verdict === 'wrong');
  expect(wrong).toBeDefined();
  if (!wrong) throw new Error('the Joseph form was not caught');
  const explanation = explain(source, wrong.id, { decls });
  expect(explanation.counterexample).toBeDefined();
  if (!explanation.counterexample) throw new Error('no counterexample');
  return explanation.counterexample;
}

function hasJulia(): boolean {
  try {
    execFileSync('julia', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const julia = hasJulia();

describe('the Julia snippet', () => {
  it('is Julia, not Python with different spelling', () => {
    const counterexample = counterexampleOf(JOSEPH, DECLS);
    const text = counterexample.julia;
    expect(text).toContain('using LinearAlgebra');
    expect(text).toContain('lhs = ');
    expect(text).toContain('rhs = ');
    expect(text).toContain('println(lhs - rhs)');
    expect(text).not.toContain('np.');
    expect(text).not.toContain('Fraction');
    expect(text).not.toContain('print(');
    // exact rationals, not floats
    expect(text).toMatch(/\d+\/\/\d+|\[\d+/);
  });

  it('computes the same thing the NumPy snippet computes', () => {
    const counterexample = counterexampleOf(JOSEPH, DECLS);
    expect(counterexample.julia).toContain('inv(');
    expect(counterexample.julia).toContain('lhs = Sigma_t');
  });

  it('runs and shows a nonzero difference, if Julia is on the machine', () => {
    if (!julia) return;
    const counterexample = counterexampleOf(JOSEPH, DECLS);
    const output = execFileSync('julia', ['-e', counterexample.julia], { encoding: 'utf8' });
    expect(output.trim()).not.toMatch(/^0\s*$/m);
  });
});

describe('the MATLAB snippet', () => {
  it('is MATLAB, not Python with different spelling', () => {
    const counterexample = counterexampleOf(JOSEPH, DECLS);
    const text = counterexample.matlab;
    expect(text).toContain('lhs = ');
    expect(text).toContain('rhs = ');
    expect(text).toContain('disp(lhs - rhs)');
    expect(text).toContain('sym(');
    expect(text).not.toContain('np.');
    expect(text).not.toContain('Fraction');
    expect(text).not.toContain('println(');
    expect(text).not.toContain('print(');
  });

  it('uses the sym constructors, so the arithmetic is exact', () => {
    const counterexample = counterexampleOf(JOSEPH, DECLS);
    expect(counterexample.matlab).toContain("eye(1, 'sym')");
  });

  it('says the symbolic toolbox is needed in the header comment', () => {
    const counterexample = counterexampleOf(JOSEPH, DECLS);
    expect(counterexample.matlab).toContain('Symbolic Math Toolbox');
  });
});

describe('the rational literals', () => {
  it('prints dyadics and thirds as small rationals', () => {
    expect(rationalize(0.5)).toEqual([1, 2]);
    expect(rationalize(2 / 3)).toEqual([2, 3]);
    expect(rationalize(0.125)).toEqual([1, 8]);
    expect(rationalize(-3 / 7)).toEqual([-3, 7]);
    expect(rationalize(0.1)).toEqual([1, 10]);
    expect(rationalize(1)).toEqual([1, 1]);
  });
});

describe('the snippet for a claim with a trace', () => {
  it('writes trace in Julia and MATLAB', () => {
    const src = String.raw`\begin{align*}
\operatorname{tr}(A B) &= \operatorname{tr}(A) \operatorname{tr}(B)
\end{align*}`;
    const counterexample = counterexampleOf(src, 'A, B: n×n');
    expect(counterexample.julia).toContain('tr(');
    expect(counterexample.matlab).toContain('trace(');
    expect(counterexample.numpy).toContain('_tr(');
  });
});
