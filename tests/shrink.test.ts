import { describe, expect, it } from 'vitest';
import { check, explain } from '../src/core/index.ts';
import type { ShrunkInstance } from '../src/core/shrink.ts';

/**
 * A counterexample a person reads has to be one (review 5.7).
 *
 * The shrinker looks for small integers, and small integers that break the
 * declared structure prove nothing: an L that is not lower triangular does
 * not show that the transpose of a lower triangular matrix differs from it.
 * The property: whatever the shrinker shows satisfies the structure the
 * declaration named, and a step that holds at a size is never "countered"
 * by an instance at that size.
 */

const SEEDS = [0, 1, 2, 3, 0x5a305a];
const TOL = 1e-9;

const close = (a: number, b: number): boolean => Math.abs(a - b) < TOL;

function grid(ex: ShrunkInstance, name: string): number[][] {
  const flat = ex.values[name];
  const [r, c] = ex.shapes[name];
  expect(Array.isArray(flat), `${name} is a matrix`).toBe(true);
  const arr = flat as number[];
  expect(arr.length, `${name} has ${r} rows of ${c}`).toBe(r * c);
  return Array.from({ length: r }, (_, i) => arr.slice(i * c, (i + 1) * c));
}

interface Case {
  name: string;
  src: string;
  decls: string;
  holds: (ex: ShrunkInstance) => boolean;
}

const CASES: Case[] = [
  {
    name: 'tril',
    src: '\\begin{align*} L^\\top &= L \\end{align*}',
    decls: 'L: tril n',
    holds: (ex) => grid(ex, 'L').every((row, i) => row.every((x, j) => (j > i ? close(x, 0) : true))),
  },
  {
    name: 'triu',
    src: '\\begin{align*} T^\\top &= T \\end{align*}',
    decls: 'T: triu n',
    holds: (ex) => grid(ex, 'T').every((row, i) => row.every((x, j) => (j < i ? close(x, 0) : true))),
  },
  {
    name: 'stoch',
    src: '\\begin{align*} P^\\top &= P \\end{align*}',
    decls: 'P: stoch n',
    holds: (ex) => grid(ex, 'P').every((row) => close(row.reduce((a, b) => a + b, 0), 1)),
  },
  {
    name: 'unit',
    src: '\\begin{align*} u u^\\top &= E \\end{align*}',
    decls: 'u: unit n; E: ident n',
    holds: (ex) => {
      // every column of a unit symbol is a unit vector
      const g = grid(ex, 'u');
      const [r, c] = ex.shapes['u'];
      for (let j = 0; j < c; j++) {
        let s = 0;
        for (let i = 0; i < r; i++) s += g[i][j] * g[i][j];
        if (!close(s, 1)) return false;
      }
      return true;
    },
  },
  {
    name: 'pos',
    src: '\\begin{align*} x^2 &= x \\end{align*}',
    decls: 'x: positive scalar',
    holds: (ex) => typeof ex.values['x'] === 'number' && (ex.values['x'] as number) > 0,
  },
  {
    name: 'sym',
    src: '\\begin{align*} A B &= B A \\end{align*}',
    decls: 'A: sym n; B: sym n',
    holds: (ex) =>
      ['A', 'B'].every((nm) => {
        const g = grid(ex, nm);
        return g.every((row, i) => row.every((x, j) => close(x, g[j][i])));
      }),
  },
];

describe('a shrunk counterexample keeps the declared structure (review 5.7)', () => {
  for (const c of CASES) {
    it(`${c.name}: every counterexample satisfies the structure it claims`, () => {
      for (const seed of SEEDS) {
        const opts = { decls: c.decls, seed };
        const report = check(c.src, opts);
        expect(['wrong', 'shape'], `the step is wrong at seed ${seed}`).toContain(report.steps[0].verdict);
        const ex = explain(c.src, report.steps[0].id, opts).counterexample;
        expect(ex, `a counterexample at seed ${seed}`).toBeDefined();
        const shown = JSON.stringify(ex?.values);
        expect(c.holds(ex as ShrunkInstance), `the structure holds at seed ${seed}: ${shown}`).toBe(true);
      }
    });
  }

  it('a step that holds has no counterexample, so none can break the structure', () => {
    // the third example of the review: u^T u = 1 for a unit u is true, and
    // u = [2] is not a counterexample, it is a u the declaration rules out
    for (const seed of SEEDS) {
      const opts = { decls: 'u: unit n', seed };
      const report = check('\\begin{align*} u^\\top u &= 1 \\end{align*}', opts);
      expect(report.steps[0].verdict).toBe('ok');
      const ex = explain('\\begin{align*} u^\\top u &= 1 \\end{align*}', report.steps[0].id, opts).counterexample;
      expect(ex, `no counterexample at seed ${seed}`).toBeUndefined();
    }
  });
});
