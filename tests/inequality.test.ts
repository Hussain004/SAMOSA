import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';

/**
 * Inequalities, by counterexample search.
 *
 * SAMOSA cannot certify an inequality, and it never will: a row with a
 * relation in {≤, <, ⪰, ⪯, ≥, >} can come back as a violation (wrong) or
 * as "no violation found" (unchecked), and never as ok. These tests pin
 * that contract down.
 */

const CASES: Array<{ name: string; decls: string; source: string; expected: string }> = [
  {
    name: 'cauchy-schwarz, which is true',
    decls: 'u: n; v: n',
    source: String.raw`\begin{align*}
u^\top v &\le \|u\| \|v\|
\end{align*}`,
    expected: 'unchecked',
  },
  {
    name: '|a+b| ≥ |a|+|b|, which is false',
    decls: 'a, b: scalar',
    source: String.raw`\begin{align*}
|a + b| &\ge |a| + |b|
\end{align*}`,
    expected: 'wrong',
  },
  {
    name: 'am-gm with a wrong constant, which is false',
    decls: 'a, b: pos',
    source: String.raw`\begin{align*}
\frac{a + b}{2} &\ge 2 \sqrt{a b}
\end{align*}`,
    expected: 'wrong',
  },
  {
    name: 'am-gm, which is true',
    decls: 'a, b: pos',
    source: String.raw`\begin{align*}
\frac{a + b}{2} &\ge \sqrt{a b}
\end{align*}`,
    expected: 'unchecked',
  },
  {
    name: 'an spd matrix is PSD, which is true',
    decls: '\\Sigma: spd n',
    source: String.raw`\begin{align*}
\Sigma &\succeq 0
\end{align*}`,
    expected: 'unchecked',
  },
  {
    name: 'a general symmetric matrix is not PSD, which is false',
    decls: 'A: sym n',
    source: String.raw`\begin{align*}
A &\succeq 0
\end{align*}`,
    expected: 'wrong',
  },
  {
    name: 'two independent spd matrices are not ordered, in general',
    decls: 'A: spd n; B: spd n',
    source: String.raw`\begin{align*}
A &\succeq B
\end{align*}`,
    expected: 'wrong',
  },
  {
    name: 'log concavity, which is true',
    decls: 'a, b: pos',
    source: String.raw`\begin{align*}
\log\frac{a + b}{2} &\ge \frac{\log a + \log b}{2}
\end{align*}`,
    expected: 'unchecked',
  },
];

describe('the inequality mode', () => {
  for (const { name, decls, source, expected } of CASES) {
    it(name, () => {
      const report = check(source, { decls });
      for (const step of report.steps) {
        expect(step.verdict, `${name} row ${step.row}`).not.toBe('ok');
        if (step.relation !== ':=') {
          expect(step.verdict, `${name} row ${step.row}`).toBe(expected);
        }
      }
    });
  }

  it('never returns ok for an inequality, even one that should hold', () => {
    for (const { decls, source } of CASES) {
      const report = check(source, { decls });
      for (const step of report.steps) {
        expect(step.verdict, `${step.text}`).not.toBe('ok');
      }
    }
  });

  it('says inequalities are never certified in the message', () => {
    const report = check(String.raw`\begin{align*}
\frac{a + b}{2} &\ge \sqrt{a b}
\end{align*}`, { decls: 'a, b: pos' });
    const unchecked = report.steps.find((s) => s.verdict === 'unchecked');
    expect(unchecked).toBeDefined();
    expect(unchecked!.message).toContain('inequalities are never certified');
  });

  it('reports the counterexample for a false inequality', () => {
    const report = check(String.raw`\begin{align*}
|a + b| &\ge |a| + |b|
\end{align*}`, { decls: 'a, b: scalar' });
    const wrong = report.steps.find((s) => s.verdict === 'wrong');
    expect(wrong).toBeDefined();
    expect(wrong!.counterexample).toBeDefined();
  });

  it('treats a zero scalar as the zero matrix for ⪯', () => {
    const report = check(String.raw`\begin{align*}
A &\succeq 0
\end{align*}`, { decls: 'A: spd n' });
    const step = report.steps[0];
    // the spd case proves the broadcast: the claim holds, so nothing is
    // found, and the relation is never ok
    expect(step.verdict).not.toBe('ok');
  });

  it('is a shape error for a matrix against a nonzero scalar', () => {
    const report = check(String.raw`\begin{align*}
A &\succeq 3
\end{align*}`, { decls: 'A: spd n' });
    const step = report.steps[0];
    expect(step.verdict).toBe('shape');
  });
});
