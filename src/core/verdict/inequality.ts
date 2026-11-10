/**
 * Inequalities, by counterexample search.
 *
 * A claim like a ≤ b is never certified: SAMOSA cannot give ✓ to an
 * inequality, and it never will. What it can do is find an instance where
 * the claim breaks, and say so. This turns a question mark into a cross
 * when the claim is false, and stays honest when no violation is found.
 *
 * Scalar claims compare the two sides directly. Matrix claims are Loewner:
 * A ⪰ B is refuted by a vector v with vᵀ(B−A)v < 0. A zero scalar on one
 * side means the zero matrix, so `Σ ⪰ 0` is checked as it is written.
 */

import { inferType } from '../types.ts';
import { collectDimVarsFor } from '../dims.ts';
import { sizeSettings } from './plan.ts';
import { settingKey } from './shared.ts';
import Decimal from 'decimal.js';
import { sampleFor } from './shared.ts';
import type { Val } from '../value.ts';
import { rngFor } from '../prng.ts';
import { Sampler } from '../sample.ts';
import { DecField } from '../fields/dec.ts';
import { evalNode, makeEnv } from '../evaluate.ts';
import { matMul, matSub, inner, identity, zeros } from '../linalg.ts';
import { describe, derivedValues } from '../shrink.ts';
import type { TypeContext } from '../types.ts';
import type { Step } from './types.ts';
import type { StepResult, GuaranteeCard } from './types.ts';
import type { Node } from '../ir.ts';
import type { Field } from '../fields/types.ts';

const TRIALS_PER_SIZE = 6;
const VECTOR_PROBES = 8;

const CMP = {
  le: (cmp: number) => cmp > 0,   // lhs ≤ rhs breaks when lhs > rhs
  lt: (cmp: number) => cmp >= 0,  // lhs < rhs breaks when lhs ≥ rhs
  ge: (cmp: number) => cmp < 0,   // lhs ≥ rhs breaks when lhs < rhs
  gt: (cmp: number) => cmp <= 0,  // lhs > rhs breaks when lhs ≤ rhs
} as const;

/** The zero matrix of a shape, broadcast from a scalar zero on one side. */
const isScalarZero = (node: Node | undefined): node is Extract<Node, { k: 'num' }> =>
  !!node && node.k === 'num' && node.value.n === 0 && node.value.d === 1;

/** The comparison shape of the two sides, with zero-scalar broadcasting. */
/** A 1×1 matrix side is a scalar, however it got there. */
const isOneByOne = (ty: ReturnType<typeof inferType>): boolean =>
  ty.t === 'mat' && typeof ty.r === 'number' && typeof ty.c === 'number' && ty.r === 1 && ty.c === 1;

function comparisonShape(
  lhsTy: ReturnType<typeof inferType>,
  rhsTy: ReturnType<typeof inferType>,
  lhs: Node,
  rhs: Node,
): 'scalar' | 'matrix' | 'invalid-shape' | 'matrix-broadcast' {
  const scalarLike = (ty: ReturnType<typeof inferType>) => ty.t === 'scalar' || isOneByOne(ty);
  if (scalarLike(lhsTy) && scalarLike(rhsTy)) return 'scalar';
  if (lhsTy.t === 'mat' && rhsTy.t === 'mat') return 'matrix';
  if (lhsTy.t === 'mat' && rhsTy.t === 'scalar' && isScalarZero(rhs)) return 'matrix-broadcast';
  if (rhsTy.t === 'mat' && lhsTy.t === 'scalar' && isScalarZero(lhs)) return 'matrix-broadcast';
  return 'invalid-shape';
}

/** One instance, sampled with the identity plan's structures, over 50 digits. */
function sampleInstance<T>(
  ctx: TypeContext,
  step: Step,
  defs: Map<string, Node>,
  setting: Map<string, number>,
  sampler: Sampler<T>,
  trial: number,
): ReturnType<typeof makeEnv<T>> | null {
  const env = makeEnv<T>(sampler.field, sampler.rng);
  env.defs = defs;
  env.sizes = new Map(setting);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, new Set(), trial);
  if (sampled === 'unknown') return null;
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quad] of sampled.quad.entries()) env.quad.set(name, quad);
  return env;
}

/** A scalar from a scalar or a 1×1 matrix; null otherwise. */
function asScalar<T>(v: Val<T>): T | null {
  if (v.k === 's') return v.v;
  if (v.k === 'm' && v.m.r === 1 && v.m.c === 1) return v.m.d[0];
  return null;
}

/** Checks an inequality by looking for a violation. */
export function checkInequality(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: { seed: number; trials: number },
  card: GuaranteeCard,
): StepResult {
  const base: GuaranteeCard = {
    ...card,
    sizes: [],
    assumptions: [],
  };
  const relation = step.relation as 'le' | 'lt' | 'ge' | 'gt';
  const relText = step.relation;
  const unsigned = (span: StepResult['span']): StepResult => ({
    id: step.id,
    row: step.row,
    span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: relText,
    verdict: 'shape',
    card: { ...base, assumptions: ['the shapes do not fit'] },
    message: 'the two sides of this inequality have incomparable shapes',
    reason: 'the two sides of this inequality have incomparable shapes',
    annotation: step.annotation,
  });

  if (!step.lhs || !step.rhs) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: relText,
      verdict: 'unchecked',
      card: base,
      message: 'this row has no claim to compare',
      reason: 'this row has no claim to compare',
    };
  }
  const lhsTy = inferType(ctx, step.lhs);
  const rhsTy = inferType(ctx, step.rhs);
  const shape = comparisonShape(lhsTy, rhsTy, step.lhs, step.rhs);
  if (shape === 'invalid-shape') return unsigned(step.span);

  const dimVars = collectDimVarsFor(ctx, step.lhs, step.rhs, defs);
  const settings = sizeSettings(dimVars).slice(0, 2);

  // every instance is checked at 50 digits, from the start: a violation
  // found at float64 could be an artifact, a violation found at 50 digits
  // is a fact
  const field = new DecField(50);
  const spent = { n: 0 };
  let comparisons = 0;
  const tried: Array<Record<string, number>> = [];
  let found: { values: Map<string, Val<Decimal>>; l: Val<Decimal>; r: Val<Decimal>; setting: Map<string, number>; env: ReturnType<typeof makeEnv<Decimal>> } | null = null;

  const compareScalars = (cmp: number): boolean => CMP[relation](cmp);

  for (const setting of settings) {
    tried.push(Object.fromEntries(setting));
    for (let trial = 0; trial < TRIALS_PER_SIZE; trial++) {
      const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, 'ineq');
      const sampler = new Sampler(field, rng);
      const env = sampleInstance(ctx, step, defs, setting, sampler, trial);
      if (!env) continue;
      try {
        const l = evalNode(field, step.lhs, env);
        const r = evalNode(field, step.rhs, env);
        // a 1×1 matrix is a scalar, the way the rest of the engine treats it
        const ls = asScalar(l);
        const rs = asScalar(r);
        if (shape === 'scalar' || (ls !== null && rs !== null)) {
          if (ls === null || rs === null) continue;
          comparisons++;
          const d = field.sub(ls, rs);
          if (compareScalars(field.cmp(d, field.zero))) {
            found = { values: env.values, l, r, setting, env };
            break;
          }
          continue;
        }
        // Loewner: compare vᵀ S v for S = lhs − rhs (with the zero of one side
        // broadcast to a zero matrix of the other's shape)
        const Smat = broadcastDifference(field, l, r);
        if (!Smat) continue;
        for (let probe = 0; probe < VECTOR_PROBES + Smat.r; probe++) {
          spent.n++;
          const v = probe < VECTOR_PROBES
            ? sampler.sampleGeneral(Smat.r, 1)
            : identity(Smat.r, field.one, field.zero);
          const col = probe < VECTOR_PROBES ? v : { r: Smat.r, c: 1, d: Array.from({ length: Smat.r }, (_, i) => (i === probe - VECTOR_PROBES ? field.one : field.zero)) };
          comparisons++;
          const t = inner(field, col, matMul(field, Smat, col));
          if (compareScalars(field.cmp(t, field.zero))) {
            found = { values: env.values, l, r, setting, env };
            break;
          }
        }
        if (found) break;
      } catch {
        continue;
      }
    }
    if (found) break;
  }

  if (found) {
    // the counterexample is shrunk towards small rationals where it can,
    // so a person reads one
    let counterexample;
    try {
      counterexample = describe(
        ctx,
        found.setting,
        found.values,
        derivedValues(field, found.env, defs),
        (name) => ctx.symbols.get(name)?.props ?? [],
        step.lhs!,
        step.rhs!,
        defs,
        found.l,
        found.r,
        field as unknown as Field<Decimal>,
        false,
      );
    } catch {
      counterexample = undefined;
    }
    spent.n += 1;
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: relText,
      verdict: 'wrong',
      mode: 'numeric',
      card: {
        ...base,
        sizes: tried,
        assumptions: ['inequalities are never certified; a violation was found'],
        maxDelta: 0,
      },
      message: 'this inequality does not hold',
      reason: 'this inequality does not hold',
      counterexample,
      annotation: step.annotation,
    };
  }

  const sizes = tried;
  const sizeText =
    sizes.length === 0 || sizes.every((s) => Object.keys(s).length === 0)
      ? 'scalars'
      : sizes.map((s) => Object.entries(s).map(([k, v]) => `${k}=${v}`).join(' ')).join('; ');
  const instances = comparisons;
  const message = `no violation found in ${instances} instances at sizes ${sizeText}; inequalities are never certified`;
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: relText,
    verdict: 'unchecked',
    mode: 'numeric',
    card: {
      ...base,
      sizes,
      assumptions: ['inequalities are never certified'],
    },
    message,
    reason: message,
    annotation: step.annotation,
  };
}

/** lhs − rhs with a zero scalar broadcast to the other side's matrix shape. */
function broadcastDifference<T>(field: Field<T>, l: Val<T>, r: Val<T>): import('../linalg.ts').Mat<T> | null {
  if (l.k === 'm' && r.k === 'm') {
    if (l.m.r !== r.m.r || l.m.c !== r.m.c) return null;
    return matSub(field, l.m, r.m);
  }
  if (l.k === 'm' && r.k === 's') {
    // a zero on the right is the zero matrix of the left's shape
    return l.m;
  }
  if (r.k === 'm' && l.k === 's') {
    // a zero on the left: the difference is negated
    return matSub(field, zeros(r.m.r, r.m.c, field.zero), r.m);
  }
  return null;
}
