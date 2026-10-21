import { describe, expect, it } from 'vitest';
import { check } from '../src/core/verdict.ts';

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
