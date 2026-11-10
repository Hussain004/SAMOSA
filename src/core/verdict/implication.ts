/**
 * The implication mode: a claim of the form "if premise then conclusion".
 */
import type { Field } from '../fields/types.ts';
import Decimal from 'decimal.js';
import { DecField } from '../fields/dec.ts';
import { GFpField, P1, P2 } from '../fields/gfp.ts';
import { matrixEntries } from './montecarlo.ts';
import { inferType, unifyDim } from '../types.ts';
import type { Dim } from '../decl.ts';
import {
  directionalDerivative,
  evalNode,
  makeEnv,
} from '../evaluate.ts';
import type { Node, Assertion } from '../ir.ts';
import type { TypeContext } from '../types.ts';
import { Sampler } from '../sample.ts';
import { rngFor, type Rng } from '../prng.ts';
import { matInv, matMul, matSub, zeros, type Mat } from '../linalg.ts';
import { scalar, type Val } from '../value.ts';
import {
  collectDimVars,
  collectAssumptions,
  sampleFor,
  asScalar,
  settingKey,
  valuesEqual,
  buildCounterexample,
} from './shared.ts';
import { sizeSettings } from './plan.ts';
import {
  type Step,
  type StepOptions,
  type GuaranteeCard,
  type StepResult,
  type Counterexample,
} from './types.ts';

/** The identity's dimensions unify with the shape they meet in. */
function unifyShapes(
  ctx: TypeContext,
  a: { r: Dim; c: Dim },
  b: { r: Dim; c: Dim },
  span: import('../ir.ts').Span,
): void {
  unifyDim(ctx, a.r, b.r, 'in this equality', span);
  unifyDim(ctx, a.c, b.c, 'in this equality', span);
}

export function checkImplication(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const premise = step.premise;
  const conclusion = step.conclusion;
  // the implication row carries its nodes in the premise and the conclusion,
  // so the inference pass has to see their sides, or the sampler finds no
  // registry at all and every implication comes back unevaluated
  if (premise?.lhs) inferType(ctx, premise.lhs);
  if (premise?.rhs) inferType(ctx, premise.rhs);
  if (conclusion?.lhs) inferType(ctx, conclusion.lhs);
  if (conclusion?.rhs) inferType(ctx, conclusion.rhs);
  for (const def of defs.values()) inferType(ctx, def);
  // the identity and the zero matrix are polymorphic, so their dimensions
  // unify with the shapes they meet in, both sides of the premise and of
  // the conclusion
  if (premise?.lhs && premise?.rhs) {
    const a = inferType(ctx, premise.lhs);
    const b = inferType(ctx, premise.rhs);
    if (a.t === 'mat' && b.t === 'mat') unifyShapes(ctx, a, b, premise.lhs.span);
  }
  if (conclusion?.lhs && conclusion?.rhs) {
    const a = inferType(ctx, conclusion.lhs);
    const b = inferType(ctx, conclusion.rhs);
    if (a.t === 'mat' && b.t === 'mat') unifyShapes(ctx, a, b, conclusion.lhs.span);
  }
  if (!premise || !conclusion || !conclusion.lhs || !conclusion.rhs) {
    const message = 'this implication has no conclusion to check';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: 'unchecked',
      card,
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  const conclusionLhs = conclusion.lhs;
  const pivot = conclusionLhs && conclusionLhs.k === 'sym' ? conclusionLhs.name : undefined;
  if (!pivot) {
    const message = 'the conclusion of this implication is not a single variable';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: 'unchecked',
      card,
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const primes: [number, number] = [P1, P2];
  const sizes: Record<string, number>[] = [];
  const assumptions = collectAssumptions(ctx, step);

  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting) as Record<string, number>);
    for (let trial = 0; trial < opts.trials; trial++) {
      for (const p of primes) {
        const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, p);
        const outcome = runImplicationTrial(step, ctx, defs, setting, p, rng);
        if (outcome.kind === 'ok') continue;
        if (outcome.kind === 'unknown') {
          if (outcome.domain) {
            // this size cannot work (a singular matrix, say), so it is skipped
            continue;
          }
          if (
            outcome.newton ||
            outcome.message === 'could not evaluate the premise'
          ) {
            // the premise is not affine, or GF cannot evaluate it (a Gauss
            // exponential, say): try Newton at the reals instead
            const newton = newtonImplication(
              step,
              ctx,
              defs,
              opts,
              card,
              setting,
              assumptions,
              sizes,
            );
            if (newton) return newton;
          }
          return {
            id: step.id,
            row: step.row,
            span: step.span,
            text: step.text,
            lhsSpan: step.lhs?.span,
            rhsSpan: step.rhs?.span,
            relation: step.relation,
            verdict: outcome.shape ? 'shape' : 'unchecked',
            card: { ...card, sizes, primes, assumptions },
            message: outcome.message,
            reason: outcome.message,
            annotation: step.annotation,
          };
        }
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          lhsSpan: conclusion.lhs.span,
          rhsSpan: conclusion.rhs.span,
          relation: step.relation,
          verdict: 'wrong',
          mode: 'exact',
          card: { ...card, sizes, primes, assumptions },
          message: outcome.message,
          reason: outcome.message,
          counterexample: outcome.counterexample,
          annotation: step.annotation,
        };
      }
    }
  }

  return {
    id: step.id,
    row: step.row,
    span: step.span,
    lhsSpan: conclusion.lhs!.span,
    rhsSpan: conclusion.rhs!.span,
    relation: step.relation,
    verdict: 'ok',
    mode: 'exact',
    card: { ...card, sizes, primes, assumptions },
    message: 'the implication holds at every size tested',
    annotation: step.annotation,
  };
}


export type ImpOutcome =
  | { kind: 'ok' }
  | { kind: 'wrong'; message: string; counterexample: Counterexample }
  | { kind: 'unknown'; message: string; domain?: boolean; shape?: boolean; newton?: boolean };

/**
 * Checks "premise => conclusion" with constraint completion.
 *
 * The residual of the premise has to be affine in the pivot variable. If it
 * is, the premise is solved for that variable and the conclusion is checked
 * on the solution.
 */

export function runImplicationTrial(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  setting: Map<string, number>,
  p: number,
  rng: Rng,
): ImpOutcome {
  const premise = step.premise!;
  const conclusion = step.conclusion!;
  const field = new GFpField(p);
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  env.sizes = new Map(setting);

  const sampled = sampleFor(ctx, step, defs, setting, sampler);
  if (sampled === 'unknown') return { kind: 'unknown', message: 'could not sample an instance' };
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);

  const conclusionLhs = conclusion.lhs;
  const pivot = conclusionLhs && conclusionLhs.k === 'sym' ? conclusionLhs.name : undefined;
  if (!pivot) return { kind: 'unknown', message: 'the conclusion is not about a single variable' };
  // a scalar pivot is a 1 by 1 matrix here, everywhere downstream of this
  const pivotRaw = env.values.get(pivot);
  if (pivotRaw && pivotRaw.k === 's') {
    env.values.set(pivot, { k: 'm', m: { r: 1, c: 1, d: [field.mul(pivotRaw.v, field.one)] } });
  }
  const pivotValue = env.values.get(pivot);
  if (!pivotValue || pivotValue.k !== 'm') return { kind: 'unknown', message: `no value for ${pivot}` };

  const n = pivotValue.m.r;
  const dim = pivotValue.m.c;

  const residual = (x: Mat<number>): Mat<number> | null => {
    const trialEnv = { ...env, values: new Map(env.values), memo: new Map() };
    trialEnv.values.set(pivot, { k: 'm', m: x });
    try {
      if (premise.lhs?.k === 'deriv') {
        const grad = gradientAt(field, premise.lhs, trialEnv, pivot, x, n);
        if (!grad) return null;
        const rhs = premise.rhs ? evalNode(field, premise.rhs, trialEnv) : scalar(field.zero);
        const rhsScalar = asScalar(field, rhs);
        if (rhsScalar === null) return null;
        return {
          r: grad.r,
          c: grad.c,
          d: grad.d.map((x) => field.sub(x, rhsScalar)),
        };
      }
      const l = evalResidual(field, premise, trialEnv);
      if (!l) return null;
      return l;
    } catch {
      return null;
    }
  };

  const dir = sampler.sampleGeneral(n, dim);
  const second = secondDirectional(field, residual, pivotValue.m, dir);
  if (second === null) return { kind: 'unknown', message: 'could not evaluate the premise' };
  if (!second.d.every((x) => field.isZero(x))) {
    return {
      kind: 'unknown',
      message: 'the premise is not affine in the variable',
      newton: true,
    };
  }

  const r0 = residual(pivotValue.m);
  if (!r0) return { kind: 'unknown', message: 'could not evaluate the premise' };
  const rows = r0.r;
  const cols = r0.c;
  const jac = { r: rows, c: n, d: new Array<number>(rows * n).fill(field.zero) };
  for (let j = 0; j < n; j++) {
    const e = { r: n, c: dim, d: new Array<number>(n * dim).fill(field.zero) };
    e.d[j * dim + (dim - 1)] = field.one;
    const rj = residual(addMat(field, pivotValue.m, e));
    if (!rj) return { kind: 'unknown', message: 'could not evaluate the premise' };
    // the column is the difference, not the value: r(x + e_j) - r(x)
    for (let i = 0; i < rows; i++) jac.d[i * n + j] = field.sub(rj.d[i * cols], r0.d[i * cols]);
  }

  let stepVec: Mat<number>;
  try {
    const inv = matInv(field, jac);
    stepVec = matMul(field, inv, r0);
  } catch {
    return { kind: 'unknown', message: 'the premise could not be solved for that variable' };
  }

  const solved = subMat(field, pivotValue.m, stepVec);
  const solvedEnv = { ...env, values: new Map(env.values), memo: new Map() };
  solvedEnv.values.set(pivot, { k: 'm', m: solved });

  let cl: Val<number>;
  let cr: Val<number>;
  try {
    cl = evalNode(field, conclusion.lhs!, solvedEnv);
    cr = evalNode(field, conclusion.rhs!, solvedEnv);
  } catch {
    return { kind: 'unknown', message: 'could not evaluate the conclusion' };
  }
  if (valuesEqual(field, cl, cr)) return { kind: 'ok' };
  // a matrix compared with a scalar is not a wrong claim, it is one that
  // cannot be read (review 4.4). A zero names the zero matrix (review 5.5).
  const realMatrix = (v: Val<number>): boolean => v.k === 'm' && !(v.m.r === 1 && v.m.c === 1);
  const zeroScalar = (v: Val<number>): boolean => v.k === 's' && field.eq(v.v, field.zero);
  if (realMatrix(cl) && cr.k === 's' && zeroScalar(cr) && cl.k === 'm') {
    cr = { k: 'm', m: zeros(cl.m.r, cl.m.c, field.zero) };
  }
  if (cl.k === 's' && realMatrix(cr) && zeroScalar(cl) && cr.k === 'm') {
    cl = { k: 'm', m: zeros(cr.m.r, cr.m.c, field.zero) };
  }
  // the broadcasts made the two sides comparable; the comparison decides,
  // not the shape
  if (valuesEqual(field, cl, cr)) return { kind: 'ok' };
  if ((realMatrix(cl) && cr.k === 's') || (cl.k === 's' && realMatrix(cr))) {
    return {
      kind: 'unknown',
      message:
        cl.k === 'm' ? 'a matrix on the left, a scalar on the right' : 'a scalar on the left, a matrix on the right',
    };
  }

  return {
    kind: 'wrong',
    message: 'the implication does not follow',
    counterexample: buildCounterexample(ctx, step, setting, sampled.values, cl, cr, field),
  };
}

/**
 * The gradient of a function, one basis direction at a time.
 *
 * This is what a stationarity premise needs: the residual of "the gradient
 * is zero" is the gradient itself, as a vector.
 */

export function gradientAt<T>(
  field: Field<T>,
  deriv: Extract<Node, { k: 'deriv' }>,
  env: ReturnType<typeof makeEnv<T>>,
  pivotName: string,
  baseValue: Mat<T>,
  n: number,
): Mat<T> | null {
  const fnNode = deriv.f;
  if (fnNode.k !== 'sym') return null;
  const def = env.defs.get(fnNode.name);
  if (!def) return null;
  const g: Mat<T> = { r: n, c: 1, d: new Array<T>(n).fill(field.zero) };
  for (let i = 0; i < n; i++) {
    const e: Mat<T> = { r: n, c: 1, d: new Array<T>(n).fill(field.zero) };
    e.d[i] = field.one;
    const tangent = directionalDerivative(field, def, env, pivotName, { k: 'm', m: baseValue }, { k: 'm', m: e });
    const value = asScalar(field, tangent);
    if (value === null) return null;
    g.d[i] = value;
  }
  return g;
}

/** The residual of a premise: the left hand side minus the right hand side. */

export function evalResidual<T>(field: Field<T>, premise: Assertion, env: ReturnType<typeof makeEnv<T>>): Mat<T> | null {
  const l = evalNode(field, premise.lhs!, env);
  const r = premise.rhs ? evalNode(field, premise.rhs, env) : scalar(field.zero);
  if (l.k === 'm' && r.k === 'm') return matSub(field, l.m, r.m);
  if (l.k === 's' && r.k === 's') return { r: 1, c: 1, d: [field.sub(l.v, r.v)] };
  return null;
}


export function addMat<T>(field: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = field.add(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}


export function subMat<T>(field: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = field.sub(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}

/**
 * The second directional derivative of a residual, by a central difference.
 *
 * Over a finite field the central difference is exact, because 2 is
 * invertible and the residual is a polynomial.
 */

export function secondDirectional<T>(
  field: Field<T>,
  residual: (x: Mat<T>) => Mat<T> | null,
  x: Mat<T>,
  dir: Mat<T>,
): Mat<T> | null {
  const plus = residual(addMat(field, x, dir));
  const minus = residual(subMat(field, x, dir));
  const centre = residual(x);
  if (!plus || !minus || !centre) return null;
  const d = new Array<T>(plus.d.length);
  const two = field.fromRational(2, 1);
  for (let i = 0; i < d.length; i++) {
    // f(x + d) - 2 f(x) + f(x - d) is the second directional derivative
    d[i] = field.sub(field.add(plus.d[i], minus.d[i]), field.mul(two, centre.d[i]));
  }
  return { r: plus.r, c: plus.c, d };
}

/**
 * A non-affine premise, checked by Newton's method over the reals.
 *
 * The residual is not affine, so the premise cannot be solved in one step.
 * Newton's method solves it from the sampled point: iterate the residual's
 * Jacobian against the residual until the point settles. The conclusion is
 * then checked at the root.
 *
 * The verdicts are honest about the method:
 *   wrong         the implication fails at the root found;
 *   inconclusive  the implication holds at the root found; never a checkmark,
 *                 because a root is a witness, not a proof.
 * Newton that does not converge comes back as the unchecked the caller
 * already prints.
 */

function newtonImplication(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
  setting: Map<string, number>,
  assumptions: string[],
  sizes: Record<string, number>[],
): StepResult | null {
  const field = new DecField(50);
  const rng = rngFor(opts.seed, step.id, settingKey(setting), 'newton');
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rngFor(opts.seed, step.id, settingKey(setting), 'env'));
  env.defs = defs;
  env.sizes = new Map(setting);

  const sampled = sampleFor(ctx, step, defs, setting, sampler);
  if (sampled === 'unknown') return null;
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);

  const conclusion = step.conclusion!;
  const pivot = conclusion.lhs && conclusion.lhs.k === 'sym' ? conclusion.lhs.name : undefined;
  if (!pivot) return null;
  // a scalar pivot is a 1 by 1 matrix here, everywhere downstream of this
  const pivotRaw = env.values.get(pivot);
  if (pivotRaw && pivotRaw.k === 's') {
    env.values.set(pivot, { k: 'm', m: { r: 1, c: 1, d: [field.mul(pivotRaw.v, field.one)] } });
  }
  const pivotValue = env.values.get(pivot);
  if (!pivotValue || pivotValue.k !== 'm') return null;
  const { r: n, c: dim } = pivotValue.m;
  const total = n * dim;
  if (total > 36) return null; // the Newton system is too big to honestly solve

  const residual = (x: Mat<Decimal>): Mat<Decimal> | null => {
    const trialEnv = { ...env, values: new Map(env.values), memo: new Map() };
    trialEnv.values.set(pivot, { k: 'm', m: x });
    try {
      const deriv = premiseDeriv(step);
      if (deriv?.k === 'deriv' && dim === 1) {
        const grad = gradientAt(
          field,
          deriv as Extract<Node, { k: 'deriv' }>,
          trialEnv,
          pivot,
          x,
          n,
        );
        if (!grad) return null;
        const rhs = step.premise!.rhs ? evalNode(field, step.premise!.rhs, trialEnv) : { k: 's' as const, v: field.zero };
        const rhsScalar = asScalar(field, rhs);
        if (rhsScalar === null) return null;
        return {
          r: grad.r,
          c: grad.c,
          d: grad.d.map((y) => field.sub(y, rhsScalar)),
        };
      }
      return evalResidual(field, step.premise!, trialEnv);
    } catch {
      return null;
    }
  };
  const premiseDeriv = (s: Step): Node | undefined =>
    s.premise?.lhs?.k === 'deriv' ? (s.premise.lhs as Node) : undefined;

  let x = pivotValue.m;
  for (let iteration = 0; iteration < 60; iteration++) {
    const f = residual(x);
    if (!f) return null;
    const fsize = f.d.length;
    const fx = Math.max(...f.d.map((y) => Math.abs(y.toNumber())));
    if (fx < 1e-36) break;
    // the Jacobian of the flattened variable, one entry at a time
    const jac: Mat<Decimal> = { r: fsize, c: total, d: new Array<Decimal>(fsize * total).fill(field.zero) };
    for (let j = 0; j < total; j++) {
      const e: Mat<Decimal> = { r: n, c: dim, d: new Array<Decimal>(total).fill(field.zero) };
      e.d[j] = field.one;
      const rj = residual(addMat(field, x, e));
      if (!rj) return null;
      for (let i = 0; i < fsize; i++) jac.d[i * total + j] = rj.d[i].sub(f.d[i]);
    }
    if (jac.r !== jac.c) return null; // not a square system; the affine path or nothing
    let stepFlat: Mat<Decimal>;
    try {
      const inv = matInv(field, jac);
      stepFlat = matMul(field, inv, { r: fsize, c: 1, d: f.d });
    } catch {
      return null;
    }
    // the flattened step, back into the matrix shape
    const stepMatrix: Mat<Decimal> = { r: n, c: dim, d: stepFlat.d };
    x = subMat(field, x, stepMatrix);
    const stepNorm = Math.max(...stepFlat.d.map((v) => Math.abs(v.toNumber())));
    if (stepNorm < 1e-30) {
      const fCheck = residual(x);
      if (fCheck && Math.max(...fCheck.d.map((y) => Math.abs(y.toNumber()))) < 1e-20) break;
    }
  }

  // the conclusion at the root
  const solvedEnv = { ...env, values: new Map(env.values), memo: new Map() };
  solvedEnv.values.set(pivot, { k: 'm', m: x });
  let cl: Val<Decimal>, cr: Val<Decimal>;
  try {
    cl = evalNode(field, conclusion.lhs!, solvedEnv);
    cr = evalNode(field, conclusion.rhs!, solvedEnv);
  } catch {
    return null;
  }
  const realMatrix = (v: Val<Decimal>): boolean => v.k === 'm' && !(v.m.r === 1 && v.m.c === 1);
  const zeroScalar = (v: Val<Decimal>): boolean => v.k === 's' && v.v.eq(field.zero);
  if (realMatrix(cl) && cr.k === 's' && zeroScalar(cr) && cl.k === 'm') {
    cr = { k: 'm', m: zeros(cl.m.r, cl.m.c, field.zero) };
  }
  if (cl.k === 's' && realMatrix(cr) && zeroScalar(cl) && cr.k === 'm') {
    cl = { k: 'm', m: zeros(cr.m.r, cr.m.c, field.zero) };
  }
  // a Newton root is a witness, never a proof: no ok path here
  if ((realMatrix(cl) && cr.k === 's') || (cl.k === 's' && realMatrix(cr))) {
    return null; // the shape says nothing; the unchecked the caller prints says it better
  }
  const entries = matrixEntries(field, cl, cr);
  if (entries === null) return null;
  const maxDiff = entries.reduce((acc, v) => (v.abs().gt(acc) ? v.abs() : acc), new Decimal(0));

  const newtonCard: GuaranteeCard = {
    ...card,
    sizes,
    assumptions: [
      'the premise is not affine; the conclusion was checked at the Newton root of the premise, not everywhere',
      ...assumptions,
    ],
  };
  const common = {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: conclusion.lhs?.span,
    rhsSpan: conclusion.rhs?.span,
    relation: step.relation,
    annotation: step.annotation,
  };
  if (maxDiff.gt(new Decimal('1e-20'))) {
    return {
      ...common,
      verdict: 'wrong',
      mode: 'numeric',
      card: newtonCard,
      message: 'the implication does not follow at the root of the premise',
      reason: 'the implication does not follow at the root of the premise',
      counterexample: buildCounterexample(ctx, step, setting, sampled.values, cl, cr, field),
    };
  }
  return {
    ...common,
    verdict: 'inconclusive',
    mode: 'numeric',
    card: newtonCard,
    message: 'the implication holds at the root found by Newton; SAMOSA does not certify it',
    reason: 'the implication holds at the root found by Newton; SAMOSA does not certify it',
  };
}
