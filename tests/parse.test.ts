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

describe('conditioning and the long delimiters', () => {
  it('reads a conditional call, and names what it cannot check', () => {
    const row = parseRow('', String.raw`p(x \mid y) = p(x)`, 0, 0);
    expect(row.error).toBeUndefined();
    expect(row.parts[0].lhs).toMatchObject({ k: 'raw', text: 'a conditional distribution' });
  });

  it('reads a conditional expectation, and names what it cannot check', () => {
    const row = parseRow('', String.raw`\mathbb{E}[X \mid Y] = \mu`, 0, 0);
    expect(row.error).toBeUndefined();
    expect(row.parts[0].lhs).toMatchObject({ k: 'raw', text: 'a conditional expectation' });
  });

  it('reads the long norm delimiters', () => {
    const row = parseRow('', String.raw`\lVert x \rVert = 1`, 0, 0);
    expect(row.parts[0].lhs).toMatchObject({ k: 'raw', text: String.raw`the unsquared norm \|2\|` });
  });

  it('checks a squared long norm', () => {
    const row = parseRow('', String.raw`\lVert A \rVert_F^2 = \operatorname{tr}(A^\top A)`, 0, 0);
    expect(row.parts[0].lhs).toMatchObject({ k: 'op', op: 'frob' });
  });

  it('reads the double bar of a divergence', () => {
    const row = parseRow('', String.raw`D(p \Vert q) \le 1`, 0, 0);
    expect(row.parts[0].lhs).toMatchObject({ k: 'call', fn: 'D' });
    const call = row.parts[0].lhs as { k: 'call'; args: unknown[] };
    expect(call.args.length).toBe(2);
  });
});

describe('the end of the row and the shape of a clause', () => {
  it('strips the punctuation before the end of file token', () => {
    for (const row of ['a = b,', 'a = b.', 'a = b;']) {
      const parsed = parseRow('', row, 0, 0);
      expect(parsed.error).toBeUndefined();
      expect(parsed.parts.length).toBe(1);
    }
  });

  it('reads two claims separated by a comma', () => {
    const parsed = parseRow('', 'a = b, c = d', 0, 0);
    expect(parsed.error).toBeUndefined();
    expect(parsed.parts.map((part) => part.relation)).toEqual(['=', '=']);
  });

  it('reads two claims separated by a period or a semicolon', () => {
    for (const row of ['a = b. c = d', 'a = b; c = d']) {
      const parsed = parseRow('', row, 0, 0);
      expect(parsed.error).toBeUndefined();
      expect(parsed.parts.length).toBe(2);
    }
  });

  it('leaves the row unchecked when one clause cannot be read', () => {
    const parsed = parseRow('', 'a = b, c = d +', 0, 0);
    expect(parsed.error).toBeTruthy();
  });

  it('names a relation inside a group instead of failing', () => {
    const rows = [
      String.raw`P(X \neq Y) = 0.5`,
      String.raw`\mathbb{I}\{x_j = 1\} = 1`,
      String.raw`a(b > c) = d`,
    ];
    for (const row of rows) {
      const parsed = parseRow('', row, 0, 0);
      expect(parsed.error).toBeUndefined();
      expect(JSON.stringify(parsed.parts[0].lhs)).toContain('a relation inside a group');
    }
  });

  it('reads an accented lowercase name as a call', () => {
    const parsed = parseRow('', String.raw`\hat{l}(f_j(x), y) = z`, 0, 0);
    expect(parsed.error).toBeUndefined();
    expect(parsed.parts[0].lhs).toMatchObject({ k: 'call' });
  });


  it('splits a claim after a text group, not at its comma', () => {
    const parsed = parseRow('', String.raw`a = b \text{ x, y}, c = d`, 0, 0);
    expect(parsed.error).toBeUndefined();
    expect(parsed.parts.length).toBe(2);
  });

  it('keeps a trailing text group as an annotation', () => {
    const parsed = parseRow('', String.raw`a = b \text{ for all x}`, 0, 0);
    expect(parsed.error).toBeUndefined();
    expect(parsed.parts.length).toBe(1);
    expect(parsed.annotation).toBe('for all x');
  });

  it('does not drop a claim that follows a text group', () => {
    const parsed = parseRow('', String.raw`x = 1 \text{ and } x = 2`, 0, 0);
    expect(parsed.error || parsed.parts.length > 1).toBeTruthy();
  });

  it('keeps an accented capital name as a matrix product', () => {
    const parsed = parseRow('', String.raw`X \hat{A}(B) = D`, 0, 0);
    expect(parsed.error).toBeUndefined();
    expect(parsed.parts[0].lhs).toMatchObject({ k: 'op', op: 'mul' });
  });
});
