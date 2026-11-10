import { describe, expect, it } from 'vitest';
import { harvestProseDeclsDetailed } from '../src/core/steps.ts';
import { check } from '../src/core/index.ts';

/**
 * The declarations are in the prose, not in the code.
 *
 * Real papers write "Let $A \in \mathbb{R}^{n×n}$" and expect the reader to
 * pick it up. The sentences below are taken from the 36 papers the coverage
 * measurement reads, with line numbers where the engine would read them.
 * Every one of these has to give the declaration it says, or someone's
 * derivation will come back unchecked for a notation the engine can infer.
 */

const CASES: Array<{ line: number; sentence: string; expected: string[] }> = [
  { line: 12, sentence: 'Let $\\mathbf{v} = (v_1,\\dots,v_M)^\\top \\in \\mathbb{R}^M$ be an arbitrary vector in $\\mathbb{R}^M$', expected: ['\\mathbf{v}: M'] },
  { line: 27, sentence: 'Let $\\Sigma \\succ 0$ denote the covariance', expected: ['\\Sigma: spd n'] },
  { line: 31, sentence: 'given $x \\sim \\mathcal{N}(\\mu, \\Sigma)$ a draw from the prior', expected: ['x ~ N(\\mu, \\Sigma)'] },
  { line: 44, sentence: 'suppose $A$ is symmetric positive definite', expected: ['A: spd n'] },
  { line: 58, sentence: 'with $Q$ orthogonal', expected: ['Q: orth n'] },
  { line: 71, sentence: 'let $D$ be diagonal', expected: ['D: diag n'] },
  { line: 95, sentence: 'for a symmetric positive semidefinite $T$', expected: ['T: psd n'] },
  { line: 103, sentence: 'Let $\\mathbf{w}_{t+1}$ be the proximal QP update', expected: [] },
  { line: 112, sentence: 'Let $X$ be a random input drawn from the class-conditional distribution', expected: [] },
  { line: 120, sentence: 'where $C \\in \\mathbb{R}^{n\\times n}$ and $y \\in \\mathbb{R}^n$', expected: ['C: n×n', 'y: n'] },
];

describe('the declarations in the prose', () => {
  for (const { line, sentence, expected } of CASES) {
    it(`reads line ${line}: "${sentence.slice(0, 48)}…"`, () => {
      const harvested = harvestProseDeclsDetailed([{ line, text: sentence }]);
      expect(harvested.map((h) => h.decl)).toEqual(expected);
    });
  }

  it('attaches the origin line to every harvested declaration', () => {
    const harvested = harvestProseDeclsDetailed([{ line: 27, text: 'Let $\\Sigma \\succ 0$ denote the covariance' }]);
    expect(harvested[0].line).toBe(27);
  });

  it('checks a derivation whose declarations came from the prose', () => {
    const source = String.raw`Where $A \\in \\mathbb{R}^{n\\times n}$ and $x \\in \\mathbb{R}^n$.

\\begin{align*}
A x &= A x \\
\\end{align*}
`;
    const report = check(source, {});
    const holds = report.steps.filter((s) => s.verdict === 'ok');
    expect(holds.length).toBeGreaterThan(0);
  });
});
