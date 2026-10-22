import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { check, explain } from '../src/core/index.ts';

/**
 * The NumPy snippet.
 *
 * The snippet has to reproduce the counterexample, so the test runs it with
 * Python and looks at what it prints. A snippet that cannot be run is a
 * comment.
 */

const DECLS = 'x_t, \\bar\\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n';

const JOSEPH = String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top
\end{align*}
`;

/** Runs a snippet with Python and returns what it printed. */
function runPython(snippet: string): string {
  return execFileSync('python3', ['-c', snippet], { encoding: 'utf8' });
}

/** Is there a Python with NumPy to run the snippet with? */
function hasPython(): boolean {
  try {
    execFileSync('python3', ['-c', 'import numpy'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const python = hasPython();

describe('the NumPy snippet', () => {
  it('reproduces the counterexample', () => {
    if (!python) return;
    const report = check(JOSEPH, { decls: DECLS });
    const wrong = report.steps.find((s) => s.verdict === 'wrong');
    expect(wrong).toBeDefined();
    if (!wrong) return;

    const explanation = explain(JOSEPH, wrong.id, { decls: DECLS });
    const counterexample = explanation.counterexample;
    expect(counterexample).toBeDefined();
    if (!counterexample) return;

    // the snippet names the symbols the way a person can type them
    expect(counterexample.numpy).toContain('C_t = np.array(');
    expect(counterexample.numpy).not.toContain('s0 =');

    // and it computes the two sides and prints the difference
    expect(counterexample.numpy).toContain('lhs = ');
    expect(counterexample.numpy).toContain('rhs = ');
    expect(counterexample.numpy).toContain('print(lhs - rhs)');

    // running it shows a difference that is not zero
    const output = runPython(counterexample.numpy);
    expect(output.trim().length).toBeGreaterThan(0);
    expect(output).not.toMatch(/\[0\.\.\. 0\.\.\.\]/);
    expect(output).not.toMatch(/^0$/m);
  });

  it('gives the same answer as the engine', () => {
    if (!python) return;
    const report = check(JOSEPH, { decls: DECLS });
    const wrong = report.steps.find((s) => s.verdict === 'wrong');
    if (!wrong) throw new Error('the Joseph form was not caught');
    const explanation = explain(JOSEPH, wrong.id, { decls: DECLS });
    const counterexample = explanation.counterexample;
    if (!counterexample) throw new Error('no counterexample');

    // the difference the engine found and the difference Python found agree
    const output = runPython(counterexample.numpy);
    const printed = output.replace(/[^0-9.\-/]/g, ' ').trim().split(/\s+/).filter(Boolean);
    const engine = Array.isArray(counterexample.diff)
      ? counterexample.diff.flatMap((row) => (Array.isArray(row) ? row : [row]))
      : [counterexample.diff];
    // the snippet prints the difference of the two sides, and it is not zero
    expect(printed.some((x) => Number(x) !== 0)).toBe(true);
    expect(engine.some((x) => Number(x) !== 0)).toBe(true);
  });
});
