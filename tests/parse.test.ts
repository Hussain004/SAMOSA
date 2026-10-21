import { describe, expect, it } from 'vitest';
import { parseRow } from '../src/core/parse.ts';
import { splitRows } from '../src/core/steps.ts';

const LECTURE8 = String.raw`% samosa: x_t, \bar\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \bar\Sigma_t: spd n
\begin{align*}
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

describe('splitRows', () => {
  it('splits an align block into rows', () => {
    const rows = splitRows(LECTURE8);
    expect(rows.length).toBe(12);
    expect(rows[0].text).toContain('J_t');
    expect(rows[11].text).toContain('Sigma_t');
  });
});

describe('parseRow', () => {
  it('reads a definition', () => {
    const rows = splitRows(LECTURE8);
    const row = parseRow(LECTURE8, rows[0].text, rows[0].from, 0);
    expect(row.parts.length).toBe(1);
    expect(row.parts[0].relation).toBe(':=');
    expect(row.parts[0].lhs?.k).toBe('sym');
  });

  it('reads a proportionality with a subscript', () => {
    const rows = splitRows(LECTURE8);
    const row = parseRow(LECTURE8, rows[1].text, rows[1].from, 1);
    expect(row.parts[0].relation).toBe('propto');
  });

  it('reads a gradient claim', () => {
    const rows = splitRows(LECTURE8);
    const row = parseRow(LECTURE8, rows[2].text, rows[2].from, 2);
    expect(row.parts[0].relation).toBe('=');
    expect(row.parts[0].lhs?.k).toBe('deriv');
    const deriv = row.parts[0].lhs as { k: 'deriv'; wrt: unknown[] };
    expect(deriv.wrt.length).toBe(1);
  });

  it('reads the hessian claim', () => {
    const rows = splitRows(LECTURE8);
    const row = parseRow(LECTURE8, rows[3].text, rows[3].from, 3);
    const deriv = row.parts[0].lhs as { k: 'deriv'; order: number };
    expect(deriv.order).toBe(2);
  });

  it('reads an implication', () => {
    const rows = splitRows(LECTURE8);
    const row = parseRow(LECTURE8, rows[5].text, rows[5].from, 5);
    expect(row.parts[0].relation).toBe('=>');
    expect(row.parts[0].premise).toBeTruthy();
    expect(row.parts[0].conclusion).toBeTruthy();
  });
});
