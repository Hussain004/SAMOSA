import { describe, expect, it } from 'vitest';
import { check, explain } from '../src/core/index.ts';

/**
 * What a fix writes into the source has to draw as the formula that was
 * checked. Braces group for the parser and draw nothing, so a sum that is a
 * factor, or a product that is transposed, must be in parentheses.
 */

const DECLS = String.raw`C_t: m×n; Q_t: spd m; \bar\Sigma_t, \Sigma_t: spd n; K_t: n×m`;
const JOSEPH_BUG = String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top
\end{align*}`;

describe('a fix, written back as LaTeX', () => {
  it('keeps the parentheses of a sum that is a factor, and of a transposed sum', () => {
    const report = check(JOSEPH_BUG, { decls: DECLS });
    const wrong = report.steps.find((s) => s.verdict === 'wrong');
    expect(wrong).toBeDefined();
    const fix = explain(JOSEPH_BUG, wrong!.id, { decls: DECLS }).fixes[0];
    expect(fix.edit.insert).toContain(String.raw`\left(I - {K_t C_t}\right) \bar\Sigma_t`);
    expect(fix.edit.insert).toContain(String.raw`\left(I - {K_t C_t}\right)^\top`);
    // the old text, where the sum was in braces and the formula changed
    expect(fix.edit.insert).not.toMatch(/\{I - /);
  });

  it('keeps the parentheses of a transposed product', () => {
    const src = String.raw`\begin{align*}(A B)^\top &= A^\top B^\top\end{align*}`;
    const report = check(src, { decls: 'A: n×n; B: n×n' });
    const fixes = explain(src, report.steps[0].id, { decls: 'A: n×n; B: n×n' }).fixes;
    expect(fixes.length).toBeGreaterThan(0);
    // no fix may write a product in a brace with a power on it
    for (const fix of fixes) expect(fix.edit.insert).not.toMatch(/\{[A-Z] [A-Z]\}\^\\top/);
  });
});
