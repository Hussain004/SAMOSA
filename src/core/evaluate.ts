import type { Field } from './fields/types.ts';
import { DualField, type DualValue } from './fields/dual.ts';
import { HyperDualField, type HyperDualValue } from './fields/hyperdual.ts';
import {
  block,
  diag as matDiag,
  hadamard,
  identity,
  inner,
  kron,
  matAdd,
  matDet,
  matInv,
  matMul,
  matPow,
  matScale,
  matSub,
  matTrace,
  norm2,
  transpose,
  vec,
  zeros,
  matSqrtm,
  type Mat,
} from './linalg.ts';
import type { Node } from './ir.ts';
import { degreeInVar, evaluateExpectation, type QuadVar } from './quadrature.ts';
import { isMatrixVal, isScalarVal, scalar, type Val } from './value.ts';
import type { Rng } from './prng.ts';

/**
 * The evaluation kernels.
 *
 * The IR compiles to a closure tree over a field, so the same expression can
 * be evaluated in a finite field, in float64 or at 50 digits. Common
 * subexpressions are memoized per instance by their structural hash, and a
 * definition is evaluated once per instance.
 */

export class EvalError extends Error {
  readonly where?: string;

  constructor(message: string, where?: string) {
    super(message);
    this.where = where;
  }
}

export interface EvalEnv<T> {
  field: Field<T>;
  /** the sampled values of the free symbols */
  values: Map<string, Val<T>>;
  /** the definitions, as the IR of their right hand side */
  defs: Map<string, Node>;
  /** the memoized definitions, per instance */
  memo: Map<string, Val<T>>;
  /** the random variables, with the roots of their covariances */
  quad: Map<string, QuadVar<any>>;
  random: Rng;
}

export function makeEnv<T>(field: Field<T>, random: Rng): EvalEnv<T> {
  return { field, values: new Map(), defs: new Map(), memo: new Map(), quad: new Map(), random };
}

function requireMatrix<T>(val: Val<T>, what: string): Mat<T> {
  if (isMatrixVal(val)) return val.m;
  throw new EvalError(`${what} needs a matrix, but got a scalar`);
}

function requireScalar<T>(val: Val<T>, what: string): T {
  if (isScalarVal(val)) return val.v;
  throw new EvalError(`${what} needs a scalar, but got a ${val.m.r} by ${val.m.c} matrix`);
}

/** A scalar cell of a block matrix is a 1 by 1 matrix (review 4.3). */
function cellMatrix<T>(val: Val<T>): Mat<T> {
  if (isScalarVal(val)) return { r: 1, c: 1, d: [val.v] };
  return requireMatrix(val, 'a matrix entry');
}

/** Evaluates an expression. */
export function evalNode<T>(f: Field<T>, node: Node, env: EvalEnv<T>): Val<T> {
  switch (node.k) {
    case 'num':
      return scalar(f.fromRational(node.value.n, node.value.d));
    case 'sym': {
      const direct = env.values.get(node.name);
      if (direct) return direct;
      const def = env.defs.get(node.name);
      if (def) {
        const cached = env.memo.get(node.name);
        if (cached) return cached;
        const value = evalNode(f, def, env);
        env.memo.set(node.name, value);
        return value;
      }
      throw new EvalError(`no value for ${node.name}`);
    }
    case 'op':
      return evalOp(f, node.op, node.args.map((a) => evalNode(f, a, env)), env);
    case 'call': {
      if (node.fn === 'var' || node.fn === 'cov') {
        // the variance and the covariance are expectations
        const over = node.args[0]?.k === 'sym' ? [node.args[0].name] : [];
        return evalExpect(f, { k: 'expect', op: node.fn === 'var' ? 'Var' : 'Cov', args: node.args, over, span: node.span }, env);
      }
      return evalCall(f, node.fn, node.args.map((a) => evalNode(f, a, env)), env);
    }
    case 'deriv':
      throw new EvalError('a derivative is checked by the verdict engine, not evaluated directly');
    case 'expect':
      return evalExpect(f, node, env);
    case 'bigop': {
      const lo = node.lo ? Math.round(f.toNumber(requireScalar(evalNode(f, node.lo, env), 'a sum bound'))) : 1;
      const hi = node.hi ? Math.round(f.toNumber(requireScalar(evalNode(f, node.hi, env), 'a sum bound'))) : lo;
      let acc: Val<T> | null = null;
      for (let i = lo; i <= hi; i++) {
        const saved = env.values.get(node.idx);
        env.values.set(node.idx, scalar(f.fromRational(i, 1)));
        env.memo.delete(node.idx);
        const term = evalNode(f, node.body, env);
        env.memo.delete(node.idx);
        if (saved) env.values.set(node.idx, saved);
        else env.values.delete(node.idx);
        acc = acc === null ? term : evalOp(f, 'add', [acc, term], env);
      }
      if (!acc) return scalar(f.zero);
      return acc;
    }
    case 'block': {
      const rows = node.rows.map((row) => row.map((cell) => evalNode(f, cell, env)));
      const mats = rows.map((row) => row.map((cell) => cellMatrix(cell)));
      return { k: 'm', m: block(mats) };
    }
    case 'raw':
      throw new EvalError(`unsupported construct: ${node.text}`);
  }
}

/** A 1 by 1 matrix behaves like a scalar in the arithmetic operations. */
function scalarOf<T>(val: Val<T>): T | null {
  if (isScalarVal(val)) return val.v;
  if (val.m.r === 1 && val.m.c === 1) return val.m.d[0];
  return null;
}

/**
 * The expectation of an expression, by the rational quadrature.
 *
 * The body has to be a polynomial in the random variable, and the rule has
 * to be exact for that degree. Otherwise the answer would be an
 * approximation, and SAMOSA does not hand out approximations.
 */
function evalExpect<T>(f: Field<T>, node: Extract<Node, { k: 'expect' }>, env: EvalEnv<T>): Val<T> {
  const names = node.over.length ? node.over : [...env.quad.keys()];
  const vars: QuadVar<T>[] = [];
  for (const name of names) {
    const v = env.quad.get(name);
    if (!v) throw new EvalError(`the distribution of ${name} is not known`);
    vars.push(v);
  }
  if (!vars.length) throw new EvalError('an expectation needs a random variable');

  const body = expectationBody(node, env);
  for (const v of vars) {
    const degree = degreeInVar(body, v.name);
    if (!Number.isFinite(degree) || degree > v.rule.degree) {
      throw new EvalError(
        `the expectation of ${v.name} is not a polynomial of degree at most ${v.rule.degree}`,
      );
    }
  }

  return evaluateExpectation(f, body, vars, (n, values) => {
    const merged = new Map(env.values);
    for (const [name, value] of values) merged.set(name, value);
    return evalNode(f, n, { ...env, values: merged, memo: new Map() });
  });
}

/** The expression an expectation really averages over. */
function expectationBody(node: Extract<Node, { k: 'expect' }>, env: EvalEnv<any>): Node {
  const arg = node.args[0];
  if (!arg) throw new EvalError('an expectation needs something to average');
  if (node.op === 'E') return arg;
  if (node.op === 'Var') {
    // Var[x] = E[(x - E x)^T (x - E x)] for a scalar
    // and E[(x - E x)(x - E x)^T] for a vector
    const value = arg.k === 'sym' ? env.values.get(arg.name) : undefined;
    const vector = value?.k === 'm';
    const centred = centredCopy(arg);
    if (!vector) {
      return { k: 'op', op: 'inner', args: [centred, centredCopy(arg)], span: arg.span };
    }
    return {
      k: 'op',
      op: 'mul',
      args: [centred, { k: 'op', op: 'T', args: [centredCopy(arg)], span: arg.span }],
      span: arg.span,
    };
  }
  // Cov[x, y] = E[(x - E x)(y - E y)^T]
  const second = node.args[1];
  if (!second) throw new EvalError('a covariance needs two variables');
  return {
    k: 'op',
    op: 'mul',
    args: [centredCopy(arg), { k: 'op', op: 'T', args: [centredCopy(second)], span: second.span }],
    span: arg.span,
  };
}

/** A copy of a symbol, centred on its mean. */
function centredCopy(node: Node): Node {
  if (node.k !== 'sym') return node;
  return {
    k: 'op',
    op: 'sub',
    args: [node, { k: 'sym', name: `__mean_${node.name}`, display: node.display, span: node.span }],
    span: node.span,
  };
}

function evalOp<T>(f: Field<T>, op: string, args: Val<T>[], _env: EvalEnv<T>): Val<T> {
  switch (op) {
    case 'add':
    case 'sub': {
      const a = args[0];
      const b = args[1];
      const sa = scalarOf(a);
      const sb = scalarOf(b);
      const bothTiny = isMatrixVal(a) && isMatrixVal(b) && a.m.r === 1 && b.m.r === 1;
      if (sa !== null && sb !== null && (isScalarVal(a) || isScalarVal(b) || bothTiny)) {
        return scalar(op === 'add' ? f.add(sa, sb) : f.sub(sa, sb));
      }
      if (sa !== null && isMatrixVal(b)) {
        const scaled = matScale(f, sa, b.m);
        return { k: 'm', m: op === 'add' ? matAdd(f, scaled, b.m) : matSub(f, scaled, b.m) };
      }
      if (sb !== null && isMatrixVal(a)) {
        const scaled = matScale(f, sb, a.m);
        return { k: 'm', m: op === 'add' ? matAdd(f, a.m, scaled) : matSub(f, a.m, scaled) };
      }
      const ma = requireMatrix(a, 'a sum');
      const mb = requireMatrix(b, 'a sum');
      if (ma.r !== mb.r || ma.c !== mb.c) {
        throw new EvalError(`shape mismatch in a sum: ${ma.r} by ${ma.c} and ${mb.r} by ${mb.c}`);
      }
      return { k: 'm', m: op === 'add' ? matAdd(f, ma, mb) : matSub(f, ma, mb) };
    }
    case 'neg': {
      const a = args[0];
      if (isScalarVal(a)) return scalar(f.neg(a.v));
      return { k: 'm', m: matScale(f, f.neg(f.one), requireMatrix(a, 'a negation')) };
    }
    case 'mul': {
      const a = args[0];
      const b = args[1];
      const sa = scalarOf(a);
      const sb = scalarOf(b);
      const bothTiny = isMatrixVal(a) && isMatrixVal(b) && a.m.r === 1 && b.m.r === 1;
      if (sa !== null && sb !== null && (isScalarVal(a) || isScalarVal(b) || bothTiny)) {
        return scalar(f.mul(sa, sb));
      }
      if (sa !== null && isMatrixVal(b)) return { k: 'm', m: matScale(f, sa, b.m) };
      if (sb !== null && isMatrixVal(a)) return { k: 'm', m: matScale(f, sb, a.m) };
      const ma = requireMatrix(a, 'a product');
      const mb = requireMatrix(b, 'a product');
      if (ma.c !== mb.r) {
        throw new EvalError(`shape mismatch in a product: ${ma.r} by ${ma.c} times ${mb.r} by ${mb.c}`);
      }
      return { k: 'm', m: matMul(f, ma, mb) };
    }
    case 'div': {
      const a = args[0];
      const b = args[1];
      const sa = scalarOf(a);
      const sb = scalarOf(b);
      const bothTiny = isMatrixVal(a) && isMatrixVal(b) && a.m.r === 1 && b.m.r === 1;
      if (sa !== null && sb !== null && (isScalarVal(a) || isScalarVal(b) || bothTiny)) {
        return scalar(f.div(sa, sb));
      }
      if (isMatrixVal(a) && sb !== null) {
        return { k: 'm', m: matScale(f, f.inv(sb), a.m) };
      }
      const ma = requireMatrix(a, 'a quotient');
      const mb = requireMatrix(b, 'a quotient');
      const inv = matInv(f, mb);
      return { k: 'm', m: matMul(f, ma, inv) };
    }
    case 'pow': {
      const a = args[0];
      const k = nodeExponent(f, args[1]);
      if (isScalarVal(a)) {
        let acc = f.one;
        for (let i = 0; i < k; i++) acc = f.mul(acc, a.v);
        return scalar(acc);
      }
      return { k: 'm', m: matPow(f, requireMatrix(a, 'a power'), k) };
    }
    case 'inv': {
      const a = args[0];
      if (isScalarVal(a)) return scalar(f.inv(a.v));
      return { k: 'm', m: matInv(f, requireMatrix(a, 'an inverse')) };
    }
    case 'invT': {
      const a = requireMatrix(args[0], 'an inverse transpose');
      return { k: 'm', m: matInv(f, transpose(a)) };
    }
    case 'T': {
      const a = args[0];
      if (isScalarVal(a)) return scalar(a.v);
      return { k: 'm', m: transpose(a.m) };
    }
    case 'tr':
      return scalar(matTrace(f, requireMatrix(args[0], 'a trace')));
    case 'det':
      return scalar(matDet(f, requireMatrix(args[0], 'a determinant')));
    case 'adj': {
      const a = requireMatrix(args[0], 'an adjugate');
      const n = a.r;
      const cofactors = zeros<T>(n, n, f.zero);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const minor = zeros<T>(n - 1, n - 1, f.zero);
          for (let r = 0; r < n - 1; r++) {
            for (let c = 0; c < n - 1; c++) {
              const sr = r < i ? r : r + 1;
              const sc = c < j ? c : c + 1;
              minor.d[r * (n - 1) + c] = a.d[sr * n + sc];
            }
          }
          const det = n === 1 ? f.one : matDet(f, minor);
          cofactors.d[j * n + i] = (i + j) % 2 === 0 ? det : f.neg(det);
        }
      }
      return { k: 'm', m: cofactors };
    }
    case 'kron':
      return { k: 'm', m: kron(f, requireMatrix(args[0], 'a Kronecker product'), requireMatrix(args[1], 'a Kronecker product')) };
    case 'had':
      return { k: 'm', m: hadamard(f, requireMatrix(args[0], 'an element wise product'), requireMatrix(args[1], 'an element wise product')) };
    case 'inner':
      return scalar(inner(f, requireMatrix(args[0], 'an inner product'), requireMatrix(args[1], 'an inner product')));
    case 'norm2':
      return scalar(norm2(f, requireMatrix(args[0], 'a squared norm')));
    case 'frob':
      return scalar(norm2(f, requireMatrix(args[0], 'a Frobenius norm')));
    case 'vec':
      return { k: 'm', m: vec(requireMatrix(args[0], 'a vectorisation')) };
    case 'diag':
      return { k: 'm', m: matDiag(f, requireMatrix(args[0], 'a diagonal')) };
    case 'abs': {
      const a = args[0];
      if (isScalarVal(a)) return scalar(f.abs(a.v));
      return { k: 'm', m: requireMatrix(a, 'an absolute value') };
    }
    case 'sqrtm': {
      // a scalar square root is exact element wise. A matrix square root is
      // the Denman-Beavers iteration (review 4.2), never again the identity
      // that the old matPow(f, a, 0) returned.
      const a = args[0];
      if (isScalarVal(a)) return scalar(f.sqrt(a.v));
      return { k: 'm', m: matSqrtm(f, requireMatrix(a, 'a matrix square root')) };
    }
    default:
      throw new EvalError(`unknown operation ${op}`);
  }
}

function nodeExponent<T>(field: Field<T>, val: Val<T>): number {
  if (isScalarVal(val)) {
    // over a field whose values are plain numbers the direct read works;
    // over the dual and hyperdual fields the value is an object, and the
    // field's own toNumber reads the base value (review 7: the NaN made
    // every power evaluate to one, which zeroed every tangent through it)
    const direct = Number(val.v);
    if (Number.isFinite(direct)) return Math.max(0, Math.round(direct));
    return Math.max(0, Math.round(field.toNumber(val.v)));
  }
  return 2;
}

function evalCall<T>(f: Field<T>, fn: string, args: Val<T>[], _env: EvalEnv<T>): Val<T> {
  const a0 = args[0];
  switch (fn) {
    case 'sqrt': {
      // the square root of a matrix is the matrix square root, not the
      // entrywise root (review 4.2): the Gaussian and Mahalanobis reading
      // of sqrt(Sigma) sqrt(Sigma) = Sigma is the one people write
      if (isMatrixVal(a0)) return { k: 'm', m: matSqrtm(f, a0.m) };
      return scalar(f.sqrt(requireScalar(a0, 'a square root')));
    }
    case 'exp':
    case 'log':
    case 'ln':
    case 'sin':
    case 'cos':
    case 'tan':
    case 'tanh':
    case 'sigmoid':
    case 'relu': {
      // these act element wise, on a scalar or on a matrix
      const unary = (x: T): T => {
        if (fn === 'exp') return f.exp(x);
        if (fn === 'log' || fn === 'ln') return f.log(x);
        if (fn === 'sin') return f.sin(x);
        if (fn === 'cos') return f.cos(x);
        if (fn === 'tan') return f.div(f.sin(x), f.cos(x));
        if (fn === 'tanh') return f.tanh(x);
        if (fn === 'sigmoid') return f.div(f.one, f.add(f.one, f.exp(f.neg(x))));
        return f.cmp(x, f.zero) > 0 ? x : f.zero;
      };
      if (isScalarVal(a0)) return scalar(unary(a0.v));
      const m = a0.m;
      return { k: 'm', m: { r: m.r, c: m.c, d: m.d.map(unary) } };
    }
    case 'softmax': {
      const m = requireMatrix(a0, 'a softmax');
      const max = m.d.reduce((acc, v) => (f.cmp(v, acc) > 0 ? v : acc), f.neg(f.one));
      let sum = f.zero;
      const exps = m.d.map((v) => f.exp(f.sub(v, max)));
      for (const e of exps) sum = f.add(sum, e);
      return { k: 'm', m: { r: m.r, c: m.c, d: exps.map((e) => f.div(e, sum)) } };
    }
    case 'det':
      return scalar(matDet(f, requireMatrix(a0, 'a determinant')));
    case 'tr':
    case 'trace':
      return scalar(matTrace(f, requireMatrix(a0, 'a trace')));
    case 'logdet': {
      const m = requireMatrix(a0, 'a log determinant');
      return scalar(f.log(matDet(f, m)));
    }
    case 'normalDensity': {
      // N(x; mu, Sigma)
      const x = requireMatrix(args[0], 'a density');
      const mu = requireMatrix(args[1], 'a density');
      const sigma = requireMatrix(args[2], 'a density');
      const diff = matSub(f, x, mu);
      const inv = matInv(f, sigma);
      const quad = inner(f, diff, matMul(f, inv, diff));
      const n = x.c;
      const logNorm = f.mul(f.fromRational(-1, 2), f.log(matDet(f, sigma)));
      const logTwoPi = f.mul(f.fromRational(-1, 2), f.mul(f.fromRational(n, 1), f.log(f.mul(f.fromRational(2, 1), f.log(f.exp(f.one))))));
      return scalar(f.exp(f.add(f.add(logNorm, logTwoPi), f.mul(f.fromRational(-1, 2), quad))));
    }
    case 'uniformDensity':
      return scalar(f.one);
    default:
      throw new EvalError(`unknown function ${fn}`);
  }
}

/** The identity matrix of a size, for the polymorphic symbols. */
export function eyeMatrix<T>(f: Field<T>, n: number): Mat<T> {
  return identity<T>(n, f.one, f.zero);
}

// ---------------------------------------------------------------- derivatives

function toDual<T>(f: Field<T>, m: Mat<T>): Mat<DualValue> {
  return { r: m.r, c: m.c, d: m.d.map((x) => ({ v: x, t: f.zero })) };
}

function toHyperDual<T>(f: Field<T>, m: Mat<T>): Mat<HyperDualValue> {
  return {
    r: m.r,
    c: m.c,
    d: m.d.map((x) => ({ v: x, e1: f.zero, e2: f.zero, e12: f.zero })),
  };
}

function dualEnv<T>(env: EvalEnv<T>, dual: DualField<Field<T>>): EvalEnv<DualValue> {
  const values = new Map<string, Val<DualValue>>();
  for (const [name, val] of env.values) {
    if (isScalarVal(val)) values.set(name, scalar({ v: val.v, t: dual.base.zero }));
    else values.set(name, { k: 'm', m: toDual(dual.base, val.m) });
  }
  return { field: dual, values, defs: env.defs, memo: new Map(), quad: new Map(), random: env.random };
}

function hyperEnv<T>(env: EvalEnv<T>, hyper: HyperDualField<Field<T>>): EvalEnv<HyperDualValue> {
  const values = new Map<string, Val<HyperDualValue>>();
  for (const [name, val] of env.values) {
    if (isScalarVal(val)) {
      values.set(name, scalar({ v: val.v, e1: hyper.base.zero, e2: hyper.base.zero, e12: hyper.base.zero }));
    } else {
      values.set(name, { k: 'm', m: toHyperDual(hyper.base, val.m) });
    }
  }
  return { field: hyper, values, defs: env.defs, memo: new Map(), quad: new Map(), random: env.random };
}

/**
 * The directional derivative of a function, computed with dual numbers.
 *
 * The direction is a random vector with the shape of the variable, so the
 * result is the tangent of f at the sampled point, in that direction.
 */
export function directionalDerivative<T>(
  base: Field<T>,
  fnNode: Node,
  env: EvalEnv<T>,
  wrtName: string,
  baseValue: Val<T>,
  direction: Val<T>,
): Val<T> {
  const dual = new DualField(base);
  const dEnv = dualEnv(env, dual);
  if (isScalarVal(baseValue) && isScalarVal(direction)) {
    dEnv.values.set(wrtName, scalar({ v: baseValue.v, t: direction.v }));
  } else {
    const bm = isMatrixVal(baseValue) ? baseValue.m : { r: 1, c: 1, d: [baseValue.v] };
    const dm = isMatrixVal(direction) ? direction.m : { r: 1, c: 1, d: [direction.v] };
    const dMat = toDual(base, bm);
    for (let i = 0; i < dMat.d.length; i++) dMat.d[i] = { v: dMat.d[i].v, t: dm.d[i] };
    dEnv.values.set(wrtName, { k: 'm', m: dMat });
  }
  const result = evalNode(dual, fnNode, dEnv);
  if (isScalarVal(result)) return scalar(result.v.t);
  return { k: 'm', m: { r: result.m.r, c: result.m.c, d: result.m.d.map((x) => x.t) } };
}

/**
 * The mixed second directional derivative, computed with hyper-dual numbers.
 *
 * f12 is the value of v' H w, the mixed second derivative of f in the two
 * directions.
 */
export function mixedSecondDerivative<T>(
  base: Field<T>,
  fnNode: Node,
  env: EvalEnv<T>,
  wrtName: string,
  baseValue: Val<T>,
  v: Val<T>,
  w: Val<T>,
): Val<T> {
  const hyper = new HyperDualField(base);
  const hEnv = hyperEnv(env, hyper);
  if (isScalarVal(baseValue) && isScalarVal(v) && isScalarVal(w)) {
    hEnv.values.set(
      wrtName,
      scalar({ v: baseValue.v, e1: v.v, e2: w.v, e12: base.zero }),
    );
  } else {
    const bm = isMatrixVal(baseValue) ? baseValue.m : { r: 1, c: 1, d: [baseValue.v] };
    const vm = isMatrixVal(v) ? v.m : { r: 1, c: 1, d: [v.v] };
    const wm = isMatrixVal(w) ? w.m : { r: 1, c: 1, d: [w.v] };
    const hMat = toHyperDual(base, bm);
    for (let i = 0; i < hMat.d.length; i++) {
      hMat.d[i] = { v: hMat.d[i].v, e1: vm.d[i], e2: wm.d[i], e12: base.zero };
    }
    hEnv.values.set(wrtName, { k: 'm', m: hMat });
  }
  const result = evalNode(hyper, fnNode, hEnv);
  if (isScalarVal(result)) return scalar(result.v.e12);
  return { k: 'm', m: { r: result.m.r, c: result.m.c, d: result.m.d.map((x) => x.e12) } };
}
