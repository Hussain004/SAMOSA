import { describe, expect, it } from 'vitest';
import { check } from '../src/core/verdict.ts';

/**
 * The golden derivation: the Kalman measurement update from Mobile Robotics
 * Lecture 8, with the planted bugs of Appendix A.
 */

const DECLS = String.raw`x_t, \bar\mu_t, \mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \bar\Sigma_t, \Sigma_t: spd n`;

const LECTURE8 = String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\mathcal{N}(z_t; C_t x_t, Q_t)\,\mathcal{N}(x_t; \bar\mu_t, \bar\Sigma_t) &\propto_{x_t} \exp\{-J_t\} \\
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

describe('the golden derivation', () => {
  const report = check(LECTURE8, { decls: DECLS });

  it('finds every row', () => {
    expect(report.steps.length).toBe(12);
  });

  it('reads the definitions', () => {
    // rows 1, 5, 7 and 8 are definitions
    expect(report.steps[0].verdict).toBe('defined');
    expect(report.steps[4].verdict).toBe('defined');
    expect(report.steps[6].verdict).toBe('defined');
    expect(report.steps[7].verdict).toBe('defined');
  });

  it('checks the gradient claim exactly', () => {
    const step = report.steps[2];
    expect(step.verdict).toBe('ok');
    expect(step.mode).toBe('exact');
  });

  it('checks the Hessian claim exactly', () => {
    expect(report.steps[3].verdict).toBe('ok');
    expect(report.steps[3].mode).toBe('exact');
  });

  it('checks the push-through identity', () => {
    const step = report.steps[10];
    expect(step.verdict).toBe('ok');
    expect(step.mode).toBe('exact');
    expect(step.card.degree).toBeGreaterThan(0);
    expect(step.card.bound).toBeLessThan(1e-40);
  });

  it('puts a guarantee on every checkmark', () => {
    for (const step of report.steps) {
      if (step.verdict !== 'ok') continue;
      expect(step.card.trialsPerSize).toBeGreaterThan(0);
      expect(step.card.sizes.length).toBeGreaterThan(0);
      expect(step.card.assumptions.length).toBeGreaterThan(0);
    }
  });
});
