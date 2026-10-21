import { describe, expect, it } from 'vitest';
import { check } from '../src/core/verdict.ts';

/**
 * A proportionality is not an equality.
 *
 * `p(x) \propto g(x)` says that the ratio of the two does not depend on x, so
 * the check is that the difference of the logs is the same at three points.
 */

const DECLS = 'x_t, \\bar\\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n';

const CORRECT = String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\mathcal{N}(z_t; C_t x_t, Q_t)\,\mathcal{N}(x_t; \bar\mu_t, \bar\Sigma_t) &\propto_{x_t} \exp\{-J_t\}
\end{align*}`;

const WRONG = String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\mathcal{N}(z_t; C_t x_t, Q_t)\,\mathcal{N}(x_t; \bar\mu_t, \bar\Sigma_t) &\propto_{x_t} \exp\{-2J_t\}
\end{align*}`;

describe('a proportionality', () => {
  it('holds when the ratio does not depend on the variable', () => {
    const report = check(CORRECT, { decls: DECLS });
    expect(report.steps[1].verdict).toBe('ok');
    expect(report.steps[1].mode).toBe('numeric');
  });

  it('does not hold when the ratio does depend on it', () => {
    const report = check(WRONG, { decls: DECLS });
    expect(report.steps[1].verdict).toBe('wrong');
    expect(report.steps[1].message).toContain('not proportional');
  });

  it('says what it needs when the variable is unknown', () => {
    const report = check(
      String.raw`\begin{align*}
\exp(a) &\propto \exp(b)
\end{align*}`,
      { decls: 'a: scalar; b: scalar' },
    );
    expect(report.steps[0].verdict).toBe('unchecked');
    expect(report.steps[0].message).toContain('propto');
  });
});
