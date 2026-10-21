import type { Field } from './fields/types.ts';
import { rat, type Rational } from './rational.ts';
import type { Node } from './ir.ts';
import { isMatrixVal, isScalarVal, scalar, type Val } from './value.ts';
import { matAdd, matMul, matScale, matSub, type Mat } from './linalg.ts';

/**
 * Exact expectations, by rational quadrature.
 *
 * The trick of this module: a distribution on rational atoms that matches the
 * moments of the normal distribution integrates polynomials *exactly*. The
 * five point rule matches E z^2 = 1 and E z^4 = 3, so it is exact up to
 * degree five; the seven point rule also matches E z^6 = 15, so it is exact
 * up to degree seven.
 *
 * Because the atoms and the weights are rational, the whole thing runs over a
 * finite field, and the check is exact rather than approximate.
 */

export interface Rule {
  /** the atoms, in the units of the standard normal */
  atoms: Rational[];
  /** the weights, they add up to one */
  weights: Rational[];
  /** the highest degree the rule integrates exactly */
  degree: number;
}

/** The five point rule for the standard normal: exact up to degree five. */
export const GAUSS5: Rule = {
  atoms: [rat(0), rat(1), rat(-1), rat(2), rat(-2)],
  weights: [rat(1, 2), rat(1, 6), rat(1, 6), rat(1, 12), rat(1, 12)],
  degree: 5,
};

/** The seven point rule for the standard normal: exact up to degree seven. */
export const GAUSS7: Rule = {
  atoms: [rat(0), rat(1), rat(-1), rat(2), rat(-2), rat(3), rat(-3)],
  weights: [rat(7, 18), rat(1, 4), rat(1, 4), rat(1, 20), rat(1, 20), rat(1, 180), rat(1, 180)],
  degree: 7,
};

/** Simpson, for a uniform variable: exact up to degree three. */
export const SIMPSON: Rule = {
  atoms: [rat(0), rat(1, 2), rat(1)],
  weights: [rat(1, 6), rat(2, 3), rat(1, 6)],
  degree: 3,
};

/** Boole, for a uniform variable: exact up to degree five. */
export const BOOLE: Rule = {
  atoms: [rat(0), rat(1, 4), rat(1, 2), rat(3, 4), rat(1)],
  weights: [rat(7, 90), rat(32, 90), rat(12, 90), rat(32, 90), rat(7, 90)],
  degree: 5,
};

/** The two point rule for a Bernoulli variable. */
export const BERNOULLI: Rule = {
  atoms: [rat(0), rat(1)],
  weights: [rat(1), rat(0)],
  degree: 0,
};

/** The budget of quadrature nodes. Past this the answer is a question mark. */
export const NODE_BUDGET = 100_000;

/** How many nodes the rules would need. */
export function nodeCount(rules: Rule[]): number {
  return rules.reduce((n, r) => n * r.atoms.length, 1);
}

/**
 * The degree of an expression in one variable.
 *
 * If the expression is not a polynomial in that variable, the answer is
 * Infinity, and the expectation cannot be computed exactly.
 */
export function degreeInVar(node: Node, name: string): number {
  switch (node.k) {
    case 'num':
      return 0;
    case 'sym':
      return node.name === name ? 1 : 0;
    case 'op': {
      switch (node.op) {
        case 'add':
        case 'sub':
          return Math.max(degreeInVar(node.args[0], name), degreeInVar(node.args[1], name));
        case 'neg':
          return degreeInVar(node.args[0], name);
        case 'mul':
        case 'kron':
        case 'had':
          return degreeInVar(node.args[0], name) + degreeInVar(node.args[1], name);
        case 'div':
          return Infinity;
        case 'pow': {
          const k = node.args[1]?.k === 'num' ? node.args[1].value.n : 2;
          return degreeInVar(node.args[0], name) * k;
        }
        case 'T':
        case 'tr':
        case 'vec':
        case 'diag':
        case 'adj':
          return degreeInVar(node.args[0], name);
        case 'det':
          return Infinity;
        case 'inner':
          return degreeInVar(node.args[0], name) + degreeInVar(node.args[1], name);
        default:
          return Infinity;
      }
    }
    case 'call':
      return Infinity;
    case 'deriv':
      return Infinity;
    case 'expect':
      return Infinity;
    case 'bigop':
      return degreeInVar(node.body, name);
    case 'block':
      return Infinity;
    case 'raw':
      return Infinity;
  }
}

/** A variable of the quadrature: where it comes from and how it is sampled. */
export interface QuadVar<T = number> {
  /** the name of the symbol */
  name: string;
  /** the mean of the variable */
  mean: Val<T>;
  /** the root of the covariance, so that the covariance is root root^T */
  root: Mat<T>;
  /** how many scalar components the variable has */
  dim: number;
  /** the rule to use */
  rule: Rule;
  /** the bounds of a uniform variable */
  bounds?: [Rational, Rational];
  /** the probability of a Bernoulli variable */
  probability?: number;
}

/**
 * Evaluates an expectation with the rational quadrature.
 *
 * The sum over the nodes is exact, because the weights and the atoms are
 * rational and the arithmetic happens in the field.
 */
export function evaluateExpectation<T>(
  f: Field<T>,
  body: Node,
  vars: QuadVar<T>[],
  evaluate: (node: Node, values: Map<string, Val<T>>) => Val<T>,
): Val<T> {
  const perVar = vars.map((v) => Math.pow(v.rule.atoms.length, Math.max(1, v.dim)));
  const total = perVar.reduce((n, k) => n * k, 1);
  if (total > NODE_BUDGET) {
    throw new Error('the quadrature would need too many nodes');
  }

  let acc: Val<T> | null = null;

  for (let index = 0; index < total; index++) {
    const values = new Map<string, Val<T>>();
    let weight = f.one;
    let rest = index;
    for (let v = 0; v < vars.length; v++) {
      const local = rest % perVar[v];
      rest = Math.floor(rest / perVar[v]);
      // the local index picks one atom per component of the variable
      const rule = vars[v].rule;
      const k = rule.atoms.length;
      const dim = Math.max(1, vars[v].dim);
      const atoms: Rational[] = [];
      let local2 = local;
      for (let d = 0; d < dim; d++) {
        const i = local2 % k;
        local2 = Math.floor(local2 / k);
        atoms.push(rule.atoms[i]);
        weight = f.mul(weight, f.fromRational(rule.weights[i].n, rule.weights[i].d));
      }
      values.set(vars[v].name, atomValue(f, vars[v], atoms));
    }
    const value = evaluate(body, values);
    const scaled = isScalarVal(value)
      ? scalar(f.mul(value.v, weight))
      : { k: 'm' as const, m: matScale(f, weight, value.m) };
    acc = acc === null ? scaled : addValues(f, acc, scaled);
  }
  if (!acc) return scalar(f.zero);
  return acc;
}

/** The value of a variable at one of the quadrature nodes. */
function atomValue<T>(f: Field<T>, v: QuadVar<T>, atoms: Rational[]): Val<T> {
  const z = { r: atoms.length, c: 1, d: atoms.map((a) => f.fromRational(a.n, a.d)) };
  if (v.root) {
    // x = mean + root z
    const product = matMul(f, v.root, z);
    if (isScalarVal(v.mean)) {
      return { k: 'm', m: matAdd(f, product, { r: product.r, c: 1, d: [v.mean.v] }) };
    }
    return { k: 'm', m: matAdd(f, product, v.mean.m) };
  }
  if (v.bounds) {
    const [a, b] = v.bounds;
    const value = f.fromRational(atoms[0].n, atoms[0].d);
    const lo = f.fromRational(a.n, a.d);
    const hi = f.fromRational(b.n, b.d);
    const scaled = f.add(f.mul(lo, f.sub(f.one, value)), f.mul(hi, value));
    return isScalarVal(v.mean) ? scalar(scaled) : { k: 'm', m: matScale(f, scaled, v.mean.m) };
  }
  return isScalarVal(v.mean) ? scalar(f.mul(v.mean.v, z.d[0])) : v.mean;
}

function addValues<T>(f: Field<T>, a: Val<T>, b: Val<T>): Val<T> {
  if (isScalarVal(a) && isScalarVal(b)) return scalar(f.add(a.v, b.v));
  if (isMatrixVal(a) && isMatrixVal(b)) return { k: 'm', m: matAdd(f, a.m, b.m) };
  if (isMatrixVal(a) && isScalarVal(b)) return { k: 'm', m: matAdd(f, a.m, matScale(f, b.v, a.m)) };
  if (isScalarVal(a) && isMatrixVal(b)) return { k: 'm', m: matAdd(f, matScale(f, a.v, b.m), b.m) };
  return a;
}

function subValues<T>(f: Field<T>, a: Val<T>, b: Val<T>): Val<T> {
  if (isScalarVal(a) && isScalarVal(b)) return scalar(f.sub(a.v, b.v));
  if (isMatrixVal(a) && isMatrixVal(b)) return { k: 'm', m: matSub(f, a.m, b.m) };
  return a;
}

export { rat, subValues };
