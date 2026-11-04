import type { Node } from './ir.ts';
import type { TypeContext } from './types.ts';

/**
 * The NumPy printer.
 *
 * The counterexample has to be reproducible by hand, so the snippet that goes
 * with it computes the two sides and prints the difference. This is the
 * printer that turns the tree into that code.
 */

/** The commands that decorate a symbol without changing what it is. */
const ACCENTS = new Set([
  'bar',
  'hat',
  'overline',
  'tilde',
  'widetilde',
  'check',
  'dot',
  'ddot',
  'vec',
  'mathbf',
  'boldsymbol',
  'bm',
  'mathcal',
  'mathrm',
  'mathsf',
  'mathtt',
]);

/** A name a person can type: `\bar\Sigma_t` becomes `Sigma_bar_t`. */
export function sanitizeName(name: string): string {
  // the accents come first, then the base, then the subscript
  const accents: string[] = [];
  let rest = name;
  while (rest.startsWith('\\')) {
    const command = rest.slice(1).match(/^[A-Za-z]+/)?.[0] ?? '';
    if (!command || !ACCENTS.has(command)) break;
    accents.push(command);
    rest = rest.slice(1 + command.length);
  }
  const cut = rest.search(/[_^]/);
  const base = (cut < 0 ? rest : rest.slice(0, cut)).replace(/[^A-Za-z0-9]/g, '') || 'x';
  const suffix = cut < 0 ? '' : rest.slice(cut);
  return accents.length ? `${base}_${accents.join('_')}${suffix}` : `${base}${suffix}`;
}

/** The names of the symbols in a snippet, in the order they are used. */
export interface NumpyNames {
  /** the LaTeX name to the name of the variable */
  map: Map<string, string>;
  /** the variables, in the order they are declared */
  order: string[];
}

/** The variable names for a set of symbols. */
export function numpyNames(symbols: string[]): NumpyNames {
  const map = new Map<string, string>();
  const order: string[] = [];
  const used = new Set<string>();
  for (const symbol of symbols) {
    let name = sanitizeName(symbol);
    let n = 2;
    while (used.has(name)) name = `${sanitizeName(symbol)}_${n++}`;
    used.add(name);
    map.set(symbol, name);
    order.push(symbol);
  }
  return { map, order };
}

/** Is the expression a matrix? */
function isMatrixType(ctx: TypeContext, node: Node): boolean {
  if (node.k === 'sym') {
    const info = ctx.symbols.get(node.name);
    return info?.ty.t === 'mat';
  }
  if (node.k === 'num') return false;
  if (node.k === 'op') {
    switch (node.op) {
      case 'add':
      case 'sub':
      case 'mul':
      case 'cross':
      case 'T':
      case 'inv':
      case 'invT':
        return isMatrixType(ctx, node.args[0]);
      default:
        return false;
    }
  }
  if (node.k === 'call') {
    if (node.fn === 'det' || node.fn === 'tr') return false;
    return isMatrixType(ctx, node.args[0]);
  }
  return false;
}

/**
 * The NumPy code for an expression.
 *
 * The matrix product is `@` and the scalar product is `*`, so the printer
 * has to know which is which. Everything else is the same in Python.
 */
export function numpyExpression(node: Node, ctx: TypeContext, names: NumpyNames): string {
  switch (node.k) {
    case 'num': {
      const v = node.value;
      if (v.d === 1) return `Fraction(${v.n})`;
      return `Fraction(${v.n}, ${v.d})`;
    }
    case 'sym': {
      const name = names.map.get(node.name);
      // the printer refuses what it cannot name, it never invents a number
      // the engine did not compute (review 3.1 of the second audit)
      if (!name) throw new Error(`no snippet for \\${node.name}`);
      return name;
    }
    case 'op': {
      const args = node.args.map((a) => numpyExpression(a, ctx, names));
      switch (node.op) {
        case 'add':
          return `(${args[0]} + ${args[1]})`;
        case 'sub':
          return `(${args[0]} - ${args[1]})`;
        case 'neg':
          return `(-${args[0]})`;
        case 'mul': {
          // the product of two matrices is a matrix product, and everything
          // else is a scalar product
          const bothMatrices = node.args.every((a) => isMatrixType(ctx, a));
          return bothMatrices ? `(${args[0]} @ ${args[1]})` : `(${args[0]} * ${args[1]})`;
        }
        case 'cross':
          // the types left a cross only between two vectors of size 3
          return `np.cross((${args[0]}).reshape(3), (${args[1]}).reshape(3)).reshape(3, 1)`;
        case 'div':
          return `(${args[0]} / ${args[1]})`;
        case 'inv':
          return `_inv(${args[0]})`;
        case 'invT':
          return `_inv(${args[0]}).T`;
        case 'T':
          return `(${args[0]}).T`;
        case 'pow':
          return `(${args[0]}) ** ${args[1]}`;
        case 'tr':
          return `_tr(${args[0]})`;
        case 'det':
          return `_det(${args[0]})`;
        case 'frob':
          return `_frob(${args[0]})`;
        case 'norm2':
          return `(${args[0]}) * (${args[0]})`;
        case 'inner':
          return `_inner(${args[0]}, ${args[1]})`;
        case 'diag':
          return `_diag(${args[0]})`;
        case 'abs':
          return `_abs(${args[0]})`;
        case 'sqrtm': {
          // the matrix square root is a matrix thing, and a matrix the
          // printer cannot name is refused rather than squared here
          if (isMatrixType(ctx, node.args[0])) {
            throw new Error(`no snippet for the matrix square root of \\${node.args[0].k === 'sym' ? node.args[0].name : node.op}`);
          }
          return `_sqrtm(${args[0]})`;
        }
        default:
          throw new Error(`no snippet for the operator ${node.op}`);
      }
    }
    case 'call': {
      const args = node.args.map((a) => numpyExpression(a, ctx, names));
      if (node.fn === 'tr') return `_tr(${args[0]})`;
      if (node.fn === 'det') return `_det(${args[0]})`;
      if (node.fn === 'frob') return `_frob(${args[0]})`;
      if (node.fn === 'norm2') return `(${args[0]}) * (${args[0]})`;
      if (node.fn === 'sqrtm') {
        if (isMatrixType(ctx, node.args[0])) {
          throw new Error(`no snippet for the matrix square root of \\${node.args[0].k === 'sym' ? node.args[0].name : node.fn}`);
        }
        return `_sqrtm(${args[0]})`;
      }
      if (node.fn === 'exp') return `(_exp(${args[0]}))`;
      throw new Error(`no snippet for \\${node.fn}`);
    }
    default:
      throw new Error('no snippet for this kind of expression');
  }
}

/** The symbols an expression mentions. */
export function symbolsOf(node: Node | undefined, into: Set<string> = new Set()): Set<string> {
  if (!node) return into;
  switch (node.k) {
    case 'sym':
      into.add(node.name);
      return into;
    case 'op':
    case 'call':
      for (const arg of node.args) symbolsOf(arg, into);
      return into;
    case 'deriv':
      symbolsOf(node.f, into);
      for (const w of node.wrt) symbolsOf(w, into);
      return into;
    case 'expect':
      for (const arg of node.args) symbolsOf(arg, into);
      return into;
    case 'bigop':
      symbolsOf(node.body, into);
      return into;
    case 'block':
      for (const row of node.rows) for (const cell of row) symbolsOf(cell, into);
      return into;
    default:
      return into;
  }
}

/**
 * The helpers the snippet needs.
 *
 * The matrices are of objects, so the operations NumPy does not do for them
 * are written out: the inverse by Gauss-Jordan, the determinant by the
 * cofactors, the trace by the diagonal. Everything is a Fraction, so the
 * numbers are exact.
 */
export const NUMPY_PRELUDE = `from fractions import Fraction
import math
import numpy as np


def _inv(a):
    n = len(a)
    m = [list(a[i]) + [Fraction(int(i == j)) for j in range(n)] for i in range(n)]
    for c in range(n):
        p = next((r for r in range(c, n) if m[r][c] != 0), None)
        if p is None:
            raise ZeroDivisionError("the matrix is singular")
        m[c], m[p] = m[p], m[c]
        d = m[c][c]
        m[c] = [x / d for x in m[c]]
        for r in range(n):
            if r != c and m[r][c] != 0:
                f = m[r][c]
                m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return np.array([row[n:] for row in m], dtype=object)


def _tr(a):
    return sum((a[i][i] for i in range(len(a))), Fraction(0))


def _det(a):
    n = len(a)
    if n == 1:
        return a[0][0]
    if n == 2:
        return a[0][0] * a[1][1] - a[0][1] * a[1][0]
    total = Fraction(0)
    for j in range(n):
        minor = np.array([[a[i][k] for k in range(n) if k != j] for i in range(1, n)], dtype=object)
        sign = 1 if j % 2 == 0 else -1
        total += sign * a[0][j] * _det(minor)
    return total


def _frob(a):
    return sum((x * x for row in a for x in row), Fraction(0))


def _inner(a, b):
    return sum((x * y for ra, rb in zip(a, b) for x, y in zip(ra, rb)), Fraction(0))


def _diag(a):
    n = len(a)
    return np.array([[a[i][i] if i == j else Fraction(0) for j in range(n)] for i in range(n)], dtype=object)


def _abs(a):
    return abs(a)


def _sqrtm(a):
    if len(a) == 1:
        return np.array([[math.sqrt(float(a[0][0]))]], dtype=object)
    raise ValueError("the matrix square root of a bigger matrix is not written here")


def _exp(a):
    values = np.atleast_1d(a)
    return np.array([math.exp(float(x)) for x in values], dtype=object)
`;
