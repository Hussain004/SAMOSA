/**
 * The implication mode: a claim of the form "if premise then conclusion".
 */
import type { Field } from '../fields/types.ts';
import { GFpField, P1, P2 } from '../fields/gfp.ts';
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

export function checkImplication(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const premise = step.premise;
  const conclusion = step.conclusion;
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
  | { kind: 'unknown'; message: string; domain?: boolean; shape?: boolean };

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
      message: 'the premise is not affine in the variable, so the implication is not checked in v1',
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

export function secondDirectional(
  field: GFpField,
  residual: (x: Mat<number>) => Mat<number> | null,
  x: Mat<number>,
  dir: Mat<number>,
): Mat<number> | null {
  const plus = residual(addMat(field, x, dir));
  const minus = residual(subMat(field, x, dir));
  const centre = residual(x);
  if (!plus || !minus || !centre) return null;
  const d = new Array<number>(plus.d.length);
  const two = field.fromRational(2, 1);
  for (let i = 0; i < d.length; i++) {
    // f(x + d) - 2 f(x) + f(x - d) is the second directional derivative
    d[i] = field.sub(field.add(plus.d[i], minus.d[i]), field.mul(two, centre.d[i]));
  }
  return { r: plus.r, c: plus.c, d };
}
