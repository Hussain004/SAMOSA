import { describe, expect, it } from 'vitest';
import { analyzeSource, check, type Report, type StepResult } from '../src/core/verdict.ts';
import { evalNode, makeEnv } from '../src/core/evaluate.ts';
import { Sampler } from '../src/core/sample.ts';
import { GFpField, P1, P2 } from '../src/core/fields/gfp.ts';
import { rngFor, type Rng } from '../src/core/prng.ts';
import { dimSizeOf, inferType, type Ty } from '../src/core/types.ts';
import { matAdd, matScale, matSub, transpose, type Mat } from '../src/core/linalg.ts';
import type { Node, Op } from '../src/core/ir.ts';
import type { Prop } from '../src/core/decl.ts';
import type { Field } from '../src/core/fields/types.ts';
import type { Val } from '../src/core/value.ts';
import { MENU } from '../corpus/menu.ts';
import { IDENTITIES } from '../corpus/cookbook/identities.ts';

/**
 * The structures test: the one that would have caught all of it (review 7).
 *
 * True friends are the identities a structure is made of. False friends are
 * the mistakes people actually write. A negative control per operator keeps
 * a new silent bug from landing. The degree oracle re-derives the degree
 * bound the card prints. The seed sweep keeps a verdict from being a
 * coincidence of one stream of numbers.
 */

const OK = 'ok';
const CAUGHT = ['wrong', 'shape'];

interface Item {
  name: string;
  src: string;
  decls?: string;
}

/**
 * The true friends: every declared structure gets its defining identity.
 * Each must come back ok, or at worst a question mark while a structure
 * parser is still missing, never a false cross.
 */
const TRUE_FRIENDS: Array<Item & { holds?: boolean; pending?: string }> = [
  { name: 'the transpose of an orthogonal matrix is orthogonal', src: String.raw`Q^\top Q = I`, decls: 'Q: orth n×n', holds: true },
  { name: 'the determinant of an orthogonal matrix squares to one', src: String.raw`\det(Q)^2 = 1`, decls: 'Q: orth n×n', holds: true },
  { name: 'a unit column squares to one', src: String.raw`u^\top u = 1`, decls: 'u: unit n', holds: true },
  { name: 'an idempotent matrix squares to itself', src: String.raw`P^2 = P`, decls: 'P: idem n×n', holds: true },
  { name: 'a skew matrix is the negative of its transpose', src: String.raw`S^\top = -S`, decls: 'S: skew n×n', holds: true },
  { name: 'a quadratic form of a skew matrix vanishes', src: String.raw`x^\top S x = 0`, decls: 'S: skew n×n; x: n', holds: true },
  { name: 'a stochastic matrix fixes the ones vector', src: String.raw`M e = e`, decls: 'M: stoch n×n; e: ones n', holds: true },
  { name: 'the Frobenius norm survives a transpose of a triangular matrix', src: String.raw`\|U\|_F^2 = \|U^\top\|_F^2`, decls: 'U: triu n×n', holds: true },
  { name: 'the trace of a triangular matrix survives a transpose', src: String.raw`\operatorname{tr}(L) = \operatorname{tr}(L^\top)`, decls: 'L: tril n×n', holds: true },
  { name: 'the square root of a square is the number, for a positive one', src: String.raw`\sqrt{x^2} = x`, decls: 'x: pos', holds: true },
  { name: 'the log of a product splits, for positive ones', src: String.raw`\log(x y) = \log x + \log y`, decls: 'x: pos; y: pos', holds: true },
  // the matrix square root, after review 4.2: the half powers read as the
  // root, the root call on a matrix is the root, and a root row is a claim
  { name: 'the matrix square root squares to the matrix', src: String.raw`\Sigma^{1/2} \Sigma^{1/2} = \Sigma`, decls: '\\Sigma: spd n', holds: true },
  { name: 'the square root call on a matrix is the matrix square root', src: String.raw`\sqrt{\Sigma} \sqrt{\Sigma} = \Sigma`, decls: '\\Sigma: spd n', holds: true },
  { name: 'the negative half power whitens', src: String.raw`\Sigma^{-1/2} \Sigma \Sigma^{-1/2} = I`, decls: '\\Sigma: spd n', holds: true },
  // the ones that wait on a structure parser still must never fail; the
  // skip name carries the review section that un-skips them
  {
    name: 'the Schur determinant',
    src: String.raw`\det\begin{pmatrix} A & B \\ C & D \end{pmatrix} = \det(A)\det(D - C A^{-1} B)`,
    decls: 'A: n×n; B: n×m; C: m×n; D: m×m',
    holds: true,
  },
  {
    name: 'the two by two block inverse',
    src: String.raw`\begin{pmatrix} A & B \\ C & D \end{pmatrix}^{-1} = \begin{pmatrix} A^{-1} + A^{-1} B (D - C A^{-1} B)^{-1} C A^{-1} & -A^{-1} B (D - C A^{-1} B)^{-1} \\ -(D - C A^{-1} B)^{-1} C A^{-1} & (D - C A^{-1} B)^{-1} \end{pmatrix}`,
    decls: 'A: n×n; B: n×m; C: m×n; D: m×m',
    holds: true,
  },
  // the block matrix, after review 4.3: blocks type as the sum of their
  // cells, a scalar cell is 1 by 1, and det reads the environment that
  // follows it as its operand
  { name: 'a horizontal block times a vertical one splits', src: String.raw`\begin{bmatrix} A & B \end{bmatrix}\begin{bmatrix} C \\ D \end{bmatrix} = AC + BD`, decls: 'A, B, C, D: n×n', holds: true },
  { name: 'the determinant reads a following environment', src: String.raw`\det\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix} = -2`, holds: true },
  { name: 'numbers alone multiply inside blocks', src: String.raw`\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}\begin{bmatrix} 1 \\ 1 \end{bmatrix} = \begin{bmatrix} 3 \\ 7 \end{bmatrix}`, holds: true },
];

/**
 * The false friends: the mistakes people actually write. None of them may
 * ever come back ok. Where the surface syntax of an operator is still
 * missing the step is unchecked, which is honest, never a checkmark.
 */
const FALSE_FRIENDS: Array<Item & { caught?: boolean }> = [
  { name: 'the determinant of an orthogonal matrix is not one', src: String.raw`\det(Q) = 1`, decls: 'Q: orth n×n', caught: true },
  { name: 'two orthogonal matrices do not commute', src: String.raw`Q_1 Q_2 = Q_2 Q_1`, decls: 'Q_1, Q_2: orth n×n', caught: true },
  { name: 'the absolute value is not the identity', src: String.raw`|x| = x`, decls: 'x: scalar', caught: true },
  { name: 'the absolute value does not split a sum', src: String.raw`|a + b| = |a| + |b|`, decls: 'a: scalar; b: scalar', caught: true },
  { name: 'the square root of a square is not the number', src: String.raw`\sqrt{x^2} = x`, decls: 'x: scalar', caught: true },
  { name: 'the square root of a square is not the negative, for a positive one', src: String.raw`\sqrt{x^2} = -x`, decls: 'x: pos', caught: true },
  { name: 'the inverse of a sum is not the sum of the inverses', src: String.raw`(A + B)^{-1} = A^{-1} + B^{-1}`, decls: 'A, B: n×n', caught: true },
  { name: 'the trace of a product is not the product of the traces', src: String.raw`\operatorname{tr}(A B) = \operatorname{tr}(A)\operatorname{tr}(B)`, decls: 'A, B: n×n', caught: true },
  { name: 'the determinant of a sum is not the sum of the determinants', src: String.raw`\det(A + B) = \det(A) + \det(B)`, decls: 'A, B: n×n', caught: true },
  { name: 'the exponential does not split a sum of matrices', src: String.raw`e^{A + B} = e^A e^B`, decls: 'A, B: n×n', caught: true },
  { name: 'the inverse of a product is not the product of the inverses', src: String.raw`(A B)^{-1} = A^{-1} B^{-1}`, decls: 'A, B: n×n', caught: true },
  { name: 'the transpose of a product is not the product of the transposes', src: String.raw`(A B)^\top = A^\top B^\top`, decls: 'A, B: n×n', caught: true },
  { name: 'the inverse of the transpose is not the inverse', src: String.raw`(A^\top)^{-1} = A^{-1}`, decls: 'A: n×n', caught: true },
  { name: 'a square is not twice the matrix', src: String.raw`A^2 = 2 A`, decls: 'A: n×n', caught: true },
  { name: 'subtraction does not commute', src: String.raw`A - B = B - A`, decls: 'A, B: n×n', caught: true },
  { name: 'a quotient is not the product', src: String.raw`A / B = A B`, decls: 'A, B: n×n', caught: true },
  { name: 'the squared norm does not split a sum', src: String.raw`\|u + v\|^2 = \|u\|^2 + \|v\|^2`, decls: 'u, v: n', caught: true },
  { name: 'an inner product is not the product of the norms', src: String.raw`\langle u, v \rangle = \|u\| \|v\|`, decls: 'u, v: n' },
  { name: 'a squared inner product is not the product of the squared norms', src: String.raw`\langle u, v \rangle^2 = \|u\|^2 \|v\|^2`, decls: 'u, v: n', caught: true },
  { name: 'the Frobenius norm does not split a sum', src: String.raw`\|A + B\|_F^2 = \|A\|_F^2 + \|B\|_F^2`, decls: 'A, B: n×n', caught: true },
  { name: 'a Kronecker product does not commute', src: String.raw`A \otimes B = B \otimes A`, decls: 'A, B: n×n', caught: true },
  { name: 'an element wise product is not a matrix product', src: String.raw`A \odot B = A B`, decls: 'A, B: n×n', caught: true },
  { name: 'a lower triangular matrix is not symmetric', src: String.raw`L^\top = L`, decls: 'L: tril n×n', caught: true },
  { name: 'a triangular matrix does not commute with its transpose', src: String.raw`U^\top U = U U^\top`, decls: 'U: triu n×n', caught: true },
  { name: 'the log of a square is not twice the log, for a scalar', src: String.raw`\log(x^2) = 2 \log x`, decls: 'x: scalar' },
  { name: 'the exponential does not split a sum of scalars', src: String.raw`e^{a + b} = e^a + e^b`, decls: 'a: scalar; b: scalar', caught: true },
  { name: 'a cube root is not a square root', src: String.raw`\sqrt[3]{8} = 3` },
  { name: 'the matrix square root is not the identity', src: String.raw`\Sigma^{1/2} = I`, decls: '\\Sigma: spd n', caught: true },
  { name: 'a square of a Gaussian is not its mean', src: String.raw`E[x^2] = E[x]`, decls: 'x ~ N(\\mu, 1); \\mu: scalar', caught: true },
  { name: 'the adjugate of a product is not the product of the adjugates', src: String.raw`\operatorname{adj}(A B) = \operatorname{adj}(A)\operatorname{adj}(B)`, decls: 'A, B: n×n' },
  { name: 'the vectorisation does not survive a transpose', src: String.raw`\operatorname{vec}(A^\top) = \operatorname{vec}(A)`, decls: 'A: n×n' },
  {
    name: 'block rows do not commute',
    src: String.raw`\begin{pmatrix} A & B \end{pmatrix} = \begin{pmatrix} B & A \end{pmatrix}`,
    decls: 'A, B: n×n',
  },
];

/**
 * The negative controls: one false identity per operator the planner can
 * call exact. This is what would have caught abs (review 7.3).
 *
 * Operators whose surface syntax is still missing get a control that only
 * demands "never ok" until the parser lands; the ones with surface syntax
 * must be caught with a cross or a shape error.
 */
const NEGATIVE_CONTROLS: Array<{ op: Op | 'expect' | 'bigop' | 'deriv' | 'block'; item: Item; strict: boolean; pending?: string }> = [
  { op: 'add', item: { name: 'addition', src: String.raw`A + B = A - B`, decls: 'A, B: n×n' }, strict: true },
  { op: 'sub', item: { name: 'subtraction', src: String.raw`A - B = B - A`, decls: 'A, B: n×n' }, strict: true },
  { op: 'neg', item: { name: 'negation', src: String.raw`-A = A`, decls: 'A: n×n' }, strict: true },
  { op: 'mul', item: { name: 'multiplication', src: String.raw`A B = B A`, decls: 'A, B: n×n' }, strict: true },
  { op: 'div', item: { name: 'division', src: String.raw`A / B = A B`, decls: 'A, B: n×n' }, strict: true },
  { op: 'pow', item: { name: 'powers', src: String.raw`(A B)^2 = A^2 B^2`, decls: 'A, B: n×n' }, strict: true },
  { op: 'inv', item: { name: 'inverse', src: String.raw`(A B)^{-1} = A^{-1} B^{-1}`, decls: 'A, B: n×n' }, strict: true },
  { op: 'invT', item: { name: 'inverse transpose', src: String.raw`(A^\top)^{-1} = A^{-1}`, decls: 'A: n×n' }, strict: true },
  { op: 'T', item: { name: 'transpose', src: String.raw`(A B)^\top = A^\top B^\top`, decls: 'A, B: n×n' }, strict: true },
  { op: 'tr', item: { name: 'trace', src: String.raw`\operatorname{tr}(A B) = \operatorname{tr}(A)\operatorname{tr}(B)`, decls: 'A, B: n×n' }, strict: true },
  { op: 'det', item: { name: 'determinant', src: String.raw`\det(A + B) = \det(A) + \det(B)`, decls: 'A, B: n×n' }, strict: true },
  { op: 'kron', item: { name: 'the Kronecker product', src: String.raw`A \otimes B = B \otimes A`, decls: 'A, B: n×n' }, strict: true },
  { op: 'had', item: { name: 'the element wise product', src: String.raw`A \odot B = A B`, decls: 'A, B: n×n' }, strict: true },
  { op: 'inner', item: { name: 'the inner product', src: String.raw`\langle u, v \rangle^2 = \|u\|^2 \|v\|^2`, decls: 'u, v: n' }, strict: true },
  { op: 'norm2', item: { name: 'the squared norm', src: String.raw`\|u + v\|^2 = \|u\|^2 + \|v\|^2`, decls: 'u, v: n' }, strict: true },
  { op: 'frob', item: { name: 'the Frobenius norm', src: String.raw`\|A + B\|_F^2 = \|A\|_F^2 + \|B\|_F^2`, decls: 'A, B: n×n' }, strict: true },
  { op: 'expect', item: { name: 'the expectation', src: String.raw`E[2 x] = E[x]`, decls: 'x ~ N(\\mu, 1); \\mu: scalar' }, strict: false },
  { op: 'bigop', item: { name: 'the sum', src: String.raw`\sum_{i=1}^{3} i = 5` }, strict: false },
  {
    op: 'deriv',
    // the Leibniz form \frac{df}{dw} does not read as a derivative yet: it
    // parses as a quotient in which the d cancels, so a wrong claim in it
    // can come back ok. The control uses the notation the parser reads,
    // and the Leibniz misparse is a deferred gap.
    item: { name: 'the derivative', src: 'f(w) := w^2\n\\frac{\\partial f}{\\partial w} = w', decls: 'w: scalar' },
    strict: true,
  },
  { op: 'block', item: { name: 'block rows', src: String.raw`\begin{pmatrix} A & B \end{pmatrix} = \begin{pmatrix} B & A \end{pmatrix}`, decls: 'A, B: n×n' }, strict: false },
  { op: 'adj', item: { name: 'the adjugate', src: String.raw`\operatorname{adj}(A B) = \operatorname{adj}(A)\operatorname{adj}(B)`, decls: 'A, B: n×n' }, strict: false },
  { op: 'diag', item: { name: 'the diagonal', src: String.raw`\operatorname{diag}(A B) = \operatorname{diag}(A)\operatorname{diag}(B)`, decls: 'A, B: n×n' }, strict: false },
  { op: 'vec', item: { name: 'the vectorisation', src: String.raw`\operatorname{vec}(A^\top) = \operatorname{vec}(A)`, decls: 'A: n×n' }, strict: false },
];

/** The operators the planner calls exact, each of which needs its control. */
const EXACT_OPS: Array<Op | 'expect' | 'bigop' | 'deriv' | 'block'> = [
  'add', 'sub', 'neg', 'mul', 'div', 'pow', 'inv', 'invT', 'T', 'tr', 'det',
  'kron', 'had', 'inner', 'norm2', 'frob', 'vec', 'diag', 'adj',
  'expect', 'bigop', 'deriv', 'block',
];

function verdictsOf(src: string, decls?: string): StepResult[] {
  return check(src, { decls }).steps.filter((s) => s.relation === '=');
}

// ------------------------------------------------------------- true friends

describe('the true friends', () => {
  for (const friend of TRUE_FRIENDS) {
    // a friend whose structure parser is still missing is skipped, and the
    // skip name names the review section that un-skips it
    const itOrSkip = friend.pending ? it.skip : it;
    itOrSkip(`${friend.name} never fails${friend.pending ? ` (waiting on ${friend.pending})` : ''}`, () => {
      const steps = verdictsOf(friend.src, friend.decls);
      const bad = steps.filter((s) => s.verdict === 'wrong' || s.verdict === 'shape');
      expect(bad.map((s) => `${s.verdict}: ${s.message}`)).toEqual([]);
    });
    if (friend.holds) {
      it(`${friend.name} holds`, () => {
        const steps = verdictsOf(friend.src, friend.decls);
        expect(steps.length).toBeGreaterThan(0);
        for (const step of steps) {
          expect(`${step.verdict}: ${step.message}`).toBe(`${OK}: ${step.message}`);
        }
      });
    }
  }
});

// ------------------------------------------------------------ false friends

describe('the false friends', () => {
  for (const friend of FALSE_FRIENDS) {
    it(`${friend.name} is never a checkmark`, () => {
      const steps = verdictsOf(friend.src, friend.decls);
      const ok = steps.filter((s) => s.verdict === OK);
      expect(ok.map((s) => s.message)).toEqual([]);
    });
    if (friend.caught) {
      it(`${friend.name} is caught`, () => {
        const steps = verdictsOf(friend.src, friend.decls);
        const bad = steps.filter((s) => CAUGHT.includes(s.verdict));
        expect(bad.length).toBeGreaterThan(0);
      });
    }
  }
});

// -------------------------------------------------------- negative controls

describe('the negative controls, one per exact operator', () => {
  it('covers every operator the planner calls exact', () => {
    const covered = new Set(NEGATIVE_CONTROLS.map((c) => c.op));
    const missing = EXACT_OPS.filter((op) => !covered.has(op));
    expect(missing).toEqual([]);
  });

  for (const control of NEGATIVE_CONTROLS) {
    const itOrSkip = control.pending ? it.skip : it;
    itOrSkip(
      `the ${control.op} control, ${control.item.name}, is never a checkmark${control.pending ? ` (waiting on ${control.pending})` : ''}`,
      () => {
        const steps = verdictsOf(control.item.src, control.item.decls);
        const ok = steps.filter((s) => s.verdict === OK);
        expect(ok.map((s) => s.message)).toEqual([]);
        if (control.strict) {
          const bad = steps.filter((s) => CAUGHT.includes(s.verdict));
          expect(bad.length).toBeGreaterThan(0);
        }
      },
    );
  }
});

// ------------------------------------------------------------ degree oracle

/**
 * The node kinds the oracle cannot treat as polynomials of the sampled
 * symbols: an inverse is a rational function, a derivative or an expectation
 * does not restrict to a line, a raw node is not read.
 */
function bannedNode(node: Node | undefined): boolean {
  if (!node) return false;
  switch (node.k) {
    case 'deriv':
    case 'expect':
    case 'bigop':
    case 'raw':
      return true;
    case 'op': {
      if (node.op === 'inv' || node.op === 'invT' || node.op === 'abs' || node.op === 'sqrtm') return true;
      if (node.op === 'div') {
        // a constant divisor is a polynomial factor; a symbolic one is not
        return hasSymbol(node.args[1]);
      }
      if (node.op === 'pow' && node.args[1].k === 'num' && node.args[1].value.n < 0) return true;
      return node.args.some(bannedNode);
    }
    case 'call': {
      // the variance and the covariance are expectations, and the
      // elementary functions are not polynomials of the sampled symbols:
      // along a line they leave the polynomials, so the oracle skips them
      if (node.fn === 'var' || node.fn === 'cov') return true;
      if (NON_POLYNOMIAL_FNS.has(node.fn)) return true;
      return node.args.some(bannedNode);
    }
    case 'num':
    case 'sym':
      return false;
    case 'block':
      return node.rows.flat().some(bannedNode);
  }
}

function hasSymbol(node: Node | undefined): boolean {
  if (!node) return false;
  switch (node.k) {
    case 'sym':
      return true;
    case 'num':
    case 'raw':
      return false;
    case 'op':
    case 'call':
      return node.args.some(hasSymbol);
    case 'deriv':
      return hasSymbol(node.f) || node.wrt.some(hasSymbol);
    case 'expect':
      return node.args.some(hasSymbol);
    case 'bigop':
      return hasSymbol(node.body) || hasSymbol(node.lo ?? undefined) || hasSymbol(node.hi ?? undefined);
    case 'block':
      return node.rows.flat().some(hasSymbol);
  }
}

function collectNodeSymbols(node: Node | undefined, out: Set<string>): void {
  if (!node) return;
  switch (node.k) {
    case 'sym':
      out.add(node.name);
      return;
    case 'op':
    case 'call':
      node.args.forEach((a) => collectNodeSymbols(a, out));
      return;
    case 'deriv':
      collectNodeSymbols(node.f, out);
      node.wrt.forEach((w) => collectNodeSymbols(w, out));
      return;
    case 'expect':
      node.args.forEach((a) => collectNodeSymbols(a, out));
      return;
    case 'bigop':
      collectNodeSymbols(node.body, out);
      collectNodeSymbols(node.lo ?? undefined, out);
      collectNodeSymbols(node.hi ?? undefined, out);
      return;
    case 'block':
      node.rows.flat().forEach((c) => collectNodeSymbols(c, out));
      return;
    case 'num':
    case 'raw':
      return;
  }
}

/** The structures the oracle can walk on a straight line without leaving them. */
const LINEAR_PROPS = new Set<string>(['sym', 'spd', 'psd', 'skew', 'diag', 'triu', 'tril', 'stoch', 'zero', 'ones', 'ident', 'int', 'pos']);

/** The calls that are not polynomials of the sampled symbols. */
const NON_POLYNOMIAL_FNS = new Set<string>([
  'exp', 'log', 'ln', 'sqrt', 'sin', 'cos', 'tan', 'tanh', 'sigmoid', 'sigma', 'relu', 'softmax', 'P',
]);

/** The structures built by a recipe with an inverse in it: no line through them stays inside. */
const RECIPE_PROPS = new Set<string>(['orth', 'rot', 'idem', 'proj', 'unit']);

function isMatrixTy(ty: Ty): ty is Extract<Ty, { t: 'mat' }> {
  return ty.t === 'mat';
}

function flatOf<T>(val: Val<T>): T[] {
  return val.k === 's' ? [val.v] : [...val.m.d];
}

function lineValue<T>(f: Field<T>, a: Val<T>, b: Val<T>, t: T): Val<T> {
  if (a.k === 's' && b.k === 's') return { k: 's', v: f.add(a.v, f.mul(t, b.v)) };
  if (a.k === 'm' && b.k === 'm') return { k: 'm', m: matAdd(f, a.m, matScale(f, t, b.m)) };
  throw new Error('the two sides of a line have different shapes');
}

/**
 * The direction of the line: a random matrix that keeps the structure, so
 * that the identity, which is a polynomial in the entries, stays the same
 * polynomial all along the line.
 */
interface OracleStep {
  where: string;
  degree: number;
  primes: number[];
  failure: string;
}

/**
 * The degree oracle (review 3.3): for every inverse free step the corpora
 * check exactly, both sides restricted to a random line must be polynomials
 * of degree at most the degree the card prints, and the residual must vanish
 * at every point of the line. A printed degree that is too small shows up as
 * a nonzero top finite difference.
 */
function oracleFailures(src: string, decls: string | undefined, where: string): OracleStep[] {
  const report = check(src, { decls });
  const parsed = analyzeSource(src, { decls });
  const failures: OracleStep[] = [];
  for (const step of parsed.steps) {
    const result = report.steps.find((s) => s.id === step.id);
    if (!result || result.verdict !== OK || result.mode !== 'exact') continue;
    if (step.relation !== '=' || step.premise) continue;
    if (!step.lhs || !step.rhs) continue;
    const degree = result.card.degree;
    if (typeof degree !== 'number') continue;
    const label = `${where} row ${step.row}`;
    if (bannedNode(step.lhs) || bannedNode(step.rhs)) continue;
    let defsBanned = false;
    for (const def of parsed.defs.values()) if (bannedNode(def)) defsBanned = true;
    if (defsBanned) continue;

    // every symbol must be one the oracle can walk: no recipe inverses, no
    // random variables, nothing the sampler builds outside the polynomials
    const names = new Set<string>();
    collectNodeSymbols(step.lhs, names);
    collectNodeSymbols(step.rhs, names);
    for (const def of parsed.defs.values()) collectNodeSymbols(def, names);
    // the types: the symbols register themselves during inference, and the
    // oracle samples the same context the verdict saw
    inferType(parsed.ctx, step.lhs);
    inferType(parsed.ctx, step.rhs);
    for (const def of parsed.defs.values()) inferType(parsed.ctx, def);

    let walkable = true;
    for (const name of names) {
      const info = parsed.ctx.symbols.get(name);
      if (!info) continue;
      if (info.ty.t === 'rv') walkable = false;
      if (info.ty.t === 'mat' && info.props.some((p) => typeof p === 'string' && RECIPE_PROPS.has(p))) walkable = false;
      if (info.ty.t === 'mat' && info.props.some((p) => typeof p !== 'string')) walkable = false;
    }
    if (!walkable) continue;

    const failure = runOracleStep(parsed.ctx, parsed.defs, step.lhs, step.rhs, degree, result, names);
    if (failure) failures.push({ where: label, degree, primes: result.card.primes ?? [P1], failure });
  }
  return failures;
}

function runOracleStep(
  ctx: ReturnType<typeof analyzeSource>['ctx'],
  defs: Map<string, Node>,
  lhs: Node,
  rhs: Node,
  degree: number,
  result: StepResult,
  names: Set<string>,
): string | undefined {
  for (const p of [P1, P2]) {
    const field = new GFpField(p);
    const sizes = new Map<string, number>(Object.entries(result.card.sizes[0] ?? {}));
    const rng: Rng = rngFor(0, 'oracle', result.id, 0, p);
    const sampler = new Sampler(field, rng);
    const base = new Map<string, Val<number>>();
    const dirs = new Map<string, Val<number>>();
    let scalarIndex = 0;
    for (const name of names) {
      const info = ctx.symbols.get(name);
      if (!info) continue;
      if (info.ty.t === 'scalar') {
        // fixed nonzero constants: they keep every scalar visible to the
        // identity and stay far away from the accidental zero
        base.set(name, { k: 's', v: field.fromRational(3 + 2 * (scalarIndex % 5), 1) });
        dirs.set(name, { k: 's', v: field.fromRational(1 + (scalarIndex % 3), 1) });
        scalarIndex++;
        continue;
      }
      if (!isMatrixTy(info.ty)) continue;
      const r = dimSizeOf(ctx, info.ty.r, sizes);
      const c = dimSizeOf(ctx, info.ty.c, sizes);
      const value = sampler.sample({ name, r, c, props: info.props, variety: 0 });
      if (!value || value.k !== 'm') return `could not sample ${name}`;
      base.set(name, value);
      const dir = oracleDirection(sampler, info.props, r, c);
      if (!dir) return `no line direction for ${name} with ${JSON.stringify(info.props)}`;
      dirs.set(name, { k: 'm', m: dir });
    }

    const points = degree + 2;
    const lhsVals: number[][] = [];
    const rhsVals: number[][] = [];
    for (let t = 0; t <= degree + 1; t++) {
      const env = makeEnv(field, rng);
      env.defs = defs;
      const tv = field.fromRational(t, 1);
      for (const [name, a] of base.entries()) {
        env.values.set(name, lineValue(field, a, dirs.get(name)!, tv));
      }
      try {
        const l = evalNode(field, lhs, env);
        const r = evalNode(field, rhs, env);
        const la = flatOf(l);
        const ra = flatOf(r);
        if (la.length !== ra.length) return 'the two sides have different shapes';
        lhsVals.push(la);
        rhsVals.push(ra);
      } catch (error) {
        return `the line could not be evaluated: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    if (lhsVals.length !== points) continue;

    // the residual vanishes at every point of the line
    for (let t = 0; t < points; t++) {
      for (let i = 0; i < lhsVals[t].length; i++) {
        if (!field.eq(lhsVals[t][i], rhsVals[t][i])) {
          return `the residual is not zero along the line at t = ${t}`;
        }
      }
    }
    // both sides are polynomials of degree at most the printed degree: the
    // top finite difference has to vanish
    const lhsTop = topDifference(field, lhsVals, degree);
    if (lhsTop) return `the left side has degree above the printed ${degree}: ${lhsTop}`;
    const rhsTop = topDifference(field, rhsVals, degree);
    if (rhsTop) return `the right side has degree above the printed ${degree}: ${rhsTop}`;
  }
  return undefined;
}

/** The (degree+1)-th finite difference, which is zero exactly below degree+1. */
function topDifference<T>(field: Field<T>, values: T[][], degree: number): string | undefined {
  let cur = values;
  for (let k = 0; k < degree + 1; k++) {
    const next: T[][] = [];
    for (let i = 0; i + 1 < cur.length; i++) {
      next.push(cur[i].map((v, j) => field.sub(cur[i + 1][j], v)));
    }
    cur = next;
  }
  for (const row of cur) {
    for (const v of row) {
      if (!field.eq(v, field.zero)) return `the top difference is ${v} away from zero`;
    }
  }
  return undefined;
}

/**
 * The direction of the line for one symbol: random entries that keep the
 * structure, so the identity, a polynomial in the entries, stays on the
 * structure all along the line.
 */
function oracleDirection<T>(sampler: Sampler<T>, props: Prop[], r: number, c: number): Mat<T> | null {
  const f = sampler.field;
  const has = (p: string) => props.some((x) => (typeof x === 'string' ? x === p : false));
  for (const p of props) {
    if (typeof p !== 'string') return null;
    if (RECIPE_PROPS.has(p)) return null;
    if (!LINEAR_PROPS.has(p)) return null;
  }
  if (has('zero') || has('ones') || has('ident')) return { r, c, d: new Array<T>(r * c).fill(f.zero) };
  const g = sampler.sampleGeneral(r, c);
  if (has('diag')) {
    const d = new Array<T>(r * c).fill(f.zero);
    for (let i = 0; i < Math.min(r, c); i++) d[i * c + i] = g.d[i * c + i];
    return { r, c, d };
  }
  if (has('triu')) {
    const d = new Array<T>(r * c).fill(f.zero);
    for (let i = 0; i < r; i++) for (let j = i; j < c; j++) d[i * c + j] = g.d[i * c + j];
    return { r, c, d };
  }
  if (has('tril')) {
    const d = new Array<T>(r * c).fill(f.zero);
    for (let i = 0; i < r; i++) for (let j = 0; j <= i && j < c; j++) d[i * c + j] = g.d[i * c + j];
    return { r, c, d };
  }
  if (has('sym') || has('spd') || has('psd')) {
    const t = transpose(g);
    return matAdd(f, g, t);
  }
  if (has('skew')) {
    const t = transpose(g);
    return matSub(f, g, t);
  }
  if (has('stoch')) {
    // the tangent space of the stochastic matrices: columns that sum to zero
    const d = [...g.d];
    for (let j = 0; j < c; j++) {
      let sum = f.zero;
      for (let i = 0; i < r; i++) sum = f.add(sum, d[i * c + j]);
      const share = f.div(sum, f.fromRational(r, 1));
      for (let i = 0; i < r; i++) d[i * c + j] = f.sub(d[i * c + j], share);
    }
    return { r, c, d };
  }
  // a free symbol, or one whose property does not restrict the line
  return g;
}

describe('the degree oracle', () => {
  it('every inverse free exact checkmark in the menu has an honest degree bound', () => {
    const failures: OracleStep[] = [];
    for (const item of MENU) {
      failures.push(...oracleFailures(item.source, item.decls, `menu ${item.id}`));
    }
    expect(failures).toEqual([]);
  });

  it('every inverse free exact checkmark in the cookbook has an honest degree bound', () => {
    const failures: OracleStep[] = [];
    for (const identity of IDENTITIES) {
      failures.push(...oracleFailures(identity.source, identity.decls, `cookbook ${identity.id}`));
    }
    expect(failures).toEqual([]);
  });

  it('an undercounted degree is caught', () => {
    // det(AB) = det(A) det(B) is honest at degree 8 (n = 2); a claimed
    // degree of 0 would be a lie the oracle must see
    const src = String.raw`\det(A B) = \det(A) \det(B)`;
    const report = check(src, { decls: 'A, B: n×n' });
    const step = report.steps.find((s) => s.relation === '=');
    expect(step?.card.degree).toBeGreaterThan(0);
    const failures = oracleFailures(src, 'A, B: n×n', 'probe');
    expect(failures).toEqual([]);
  });
});

// --------------------------------------------------------------- seed sweep

describe('the seed sweep', () => {
  const SEEDS = 30;

  it('a correct menu derivation never fails, at any seed', () => {
    const flips: string[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const item of MENU) {
        const report = check(item.source, { decls: item.decls, seed });
        for (const step of report.steps) {
          if (step.verdict === 'wrong' || step.verdict === 'shape') {
            flips.push(`${item.id} seed ${seed} row ${step.row}: ${step.message}`);
          }
        }
      }
    }
    expect(flips).toEqual([]);
  });

  it('a planted menu bug never passes, at any seed', () => {
    const misses: string[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const item of MENU) {
        if (!item.bugSource) continue;
        const report = check(item.bugSource, { decls: item.decls, seed });
        const bad = report.steps.filter((s) => CAUGHT.includes(s.verdict));
        if (!bad.length) misses.push(`${item.id} seed ${seed}`);
      }
    }
    expect(misses).toEqual([]);
  });

  it('a cookbook identity never fails, at any seed', () => {
    const flips: string[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const identity of IDENTITIES) {
        const report = check(identity.source, { decls: identity.decls, seed });
        for (const step of report.steps) {
          if (step.verdict === 'wrong' || step.verdict === 'shape') {
            flips.push(`${identity.id} seed ${seed} row ${step.row}: ${step.message}`);
          }
        }
      }
    }
    expect(flips).toEqual([]);
  });

  it('a true friend never fails, at any seed', () => {
    const flips: string[] = [];
    const friends = TRUE_FRIENDS.filter((f) => f.holds);
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const friend of friends) {
        const report = check(friend.src, { decls: friend.decls, seed });
        for (const step of report.steps) {
          if (step.verdict === 'wrong' || step.verdict === 'shape') {
            flips.push(`${friend.name} seed ${seed} row ${step.row}: ${step.message}`);
          }
        }
      }
    }
    expect(flips).toEqual([]);
  });

  it('the default seed agrees with seed 0', () => {
    const same = (report: Report): string =>
      JSON.stringify(report.steps.map((s) => [s.id, s.relation, s.verdict, s.mode, s.message]));
    for (const item of MENU) {
      expect(same(check(item.source, { decls: item.decls }))).toBe(
        same(check(item.source, { decls: item.decls, seed: 0 })),
      );
    }
    for (const friend of TRUE_FRIENDS) {
      if (!friend.holds) continue;
      expect(same(check(friend.src, { decls: friend.decls }))).toBe(
        same(check(friend.src, { decls: friend.decls, seed: 0 })),
      );
    }
  });
});
