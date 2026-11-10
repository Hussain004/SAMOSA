/**
 * The numeric mode: a step over the reals, screened at float64 and confirmed
 * at 50 digits.
 */
import type { Field } from '../fields/types.ts';
import { F64Field } from '../fields/f64.ts';
import { DecField } from '../fields/dec.ts';
import { type TypeContext } from '../types.ts';
import type { Node } from '../ir.ts';
import { Sampler } from '../sample.ts';
import { rngFor, type Rng } from '../prng.ts';
import { makeEnv } from '../evaluate.ts';
import type { Val } from '../value.ts';
import {
  collectDimVars,
  collectAssumptions,
  freeVariables,
  sampleFor,
  settingKey,
} from './shared.ts';
import { sizeSettings } from './plan.ts';
import { evaluateSides } from './sides.ts';
import {
  type Step,
  type StepOptions,
  type GuaranteeCard,
  type StepResult,
} from './types.ts';


export const NUMERIC_TRIALS = 8;


export function checkNumeric(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const sizes: Record<string, number>[] = [];
  const assumptions = collectAssumptions(ctx, step);
  let f64Max = 0;
  let decMax = 0;
  const dec = new DecField(50);

  const domainResult = (message: string): StepResult => {
    const text =
      `this step was not defined at a sampled point (${message}), for instance the log or the square root of a negative number; ` +
      'declaring the symbols it depends on positive may be what it needs';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: 'inconclusive',
      mode: 'numeric',
      card: { ...card, sizes, assumptions },
      message: text,
      reason: text,
      annotation: step.annotation,
    };
  };
  const unevaluable = (message: string): StepResult => ({
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    relation: step.relation,
    verdict: 'unchecked',
    card: { ...card, sizes, assumptions },
    message,
    reason: message,
    annotation: step.annotation,
  });
  // the two sides do not fit together at all, so no instance would help:
  // this is the shape verdict, met through the numbers (review 4.4)
  const shapeResult = (message: string): StepResult => ({
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict: 'shape',
    card: { ...card, sizes, assumptions },
    message,
    reason: message,
    annotation: step.annotation,
  });

  // First pass, float64: it screens only. Eight instances per size, with the
  // signs and the magnitudes spread by the trial index (review 3.4), so a
  // sign dependent identity cannot survive the screening by luck.
  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting) as Record<string, number>);
    for (let trial = 0; trial < NUMERIC_TRIALS; trial++) {
      const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, 'f64');
      const run = numericDelta(ctx, defs, step, setting, rng, trial, new F64Field());
      if (run === null) {
        return unevaluable('SAMOSA could not evaluate this step over the reals');
      }
      if (run === 'domain') {
        return domainResult('a sampled instance was outside the domain');
      }
      if (run.unreadable) return unevaluable(run.unreadable);
      if (run.shapeMessage) {
        return shapeResult(run.shapeMessage);
      }
      f64Max = Math.max(f64Max, run.delta);
      if (run.delta > 1e-6) {
        let confirmed = false;
        for (let k = 0; k < NUMERIC_TRIALS && !confirmed; k++) {
          const rng2 = rngFor(opts.seed, step.id, settingKey(setting), k, 'dec', 1);
          const run2 = numericDelta(ctx, defs, step, setting, rng2, k, dec);
          if (run2 === null) continue;
          if (run2 === 'domain') {
            return domainResult('a 50 digit instance was outside the domain');
          }
          if (run2.delta > 1e-20) confirmed = true;
        }
        const message = confirmed
          ? 'the two sides differ'
          : 'the two sides differ, but not enough to call it wrong';
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          text: step.text,
          lhsSpan: step.lhs?.span,
          rhsSpan: step.rhs?.span,
          relation: step.relation,
          verdict: confirmed ? 'wrong' : 'inconclusive',
          mode: 'numeric',
          card: { ...card, sizes, maxDelta: Math.max(f64Max, decMax), assumptions },
          message,
          reason: message,
          annotation: step.annotation,
        };
      }
    }
  }

  // Second pass, 50 digits: it decides. The float64 maximum never enters the
  // verdict (review 4.6), because a transcendental identity that is not
  // bit-exact in float64 can still be exactly true at 50 digits.
  for (const setting of settings) {
    for (let trial = 0; trial < NUMERIC_TRIALS; trial++) {
      const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, 'dec');
      const run = numericDelta(ctx, defs, step, setting, rng, trial, dec);
      if (run === null) {
        return unevaluable('SAMOSA could not evaluate this step at 50 digits');
      }
      if (run === 'domain') {
        return domainResult('a 50 digit instance was outside the domain');
      }
      if (run.unreadable) return unevaluable(run.unreadable);
      if (run.shapeMessage) {
        return shapeResult(run.shapeMessage);
      }
      decMax = Math.max(decMax, run.delta);
    }
  }

  if (decMax < 1e-35) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: 'ok',
      mode: 'numeric',
      card: {
        ...card,
        trialsPerSize: NUMERIC_TRIALS,
        sizes,
        maxDelta: decMax,
        assumptions: [
          ...assumptions,
          `numeric: ${NUMERIC_TRIALS} instances at each of ${sizes.length} sizes, max relative difference ${decMax === 0 ? '0' : decMax.toExponential(1)}, no probability bound`,
        ],
      },
      message: 'the two sides agree to 50 digits',
      annotation: step.annotation,
    };
  }
  const message = 'the two sides agree, but not to 50 digits';
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict: 'inconclusive',
    mode: 'numeric',
    card: { ...card, sizes, maxDelta: decMax, assumptions },
    message,
    reason: message,
    annotation: step.annotation,
  };
}


export type NumericRun = { delta: number; shapeMessage?: string; unreadable?: string } | 'domain' | null;


export interface AbsDeltaRun {
  /** the largest entry of lhs minus rhs, in absolute value */
  diff: number;
}

/**
 * The absolute distance between the two sides of a step.
 *
 * This is for the audit of the Cookbook: the same sampling as numericDelta,
 * but the answer is max|lhs - rhs|, not a relative delta, so a claim whose
 * sides are both zero to machine precision is not called a lie. Used to
 * confirm that a mutant the engine called harmless really changes nothing.
 */
export function numericAbsDelta<T>(
  ctx: TypeContext,
  defs: Map<string, Node>,
  step: Step,
  setting: Map<string, number>,
  rng: Rng,
  trial: number,
  field: Field<T>,
): AbsDeltaRun | null | 'domain' | { shapeMessage: string } | { unreadable: string } {
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  env.sizes = new Map(setting);
  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free, trial);
  if (sampled === 'unknown') return null;
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);

  const sides = evaluateSides(field, step.lhs!, step.rhs!, env, sampler);
  if (sides.kind === 'unknown') {
    if (sides.shape) return { shapeMessage: sides.message };
    if (!sides.domain && /not read/.test(sides.message)) return { unreadable: sides.message };
    return 'domain';
  }
  if (sides.kind === 'equal') return { diff: 0 };
  const flat = (v: Val<T>): number[] =>
    v.k === 's' ? [field.toNumber(v.v)] : v.m.d.map((x) => field.toNumber(x));
  const fa = flat(sides.lhs);
  const fb = flat(sides.rhs);
  if (fa.length !== fb.length) return { shapeMessage: 'the two sides have different numbers of entries' };
  let diff = 0;
  for (let i = 0; i < fa.length; i++) {
    diff = Math.max(diff, Math.abs(fa[i] - fb[i]));
  }
  return { diff };
}

export function numericDelta<T>(
  ctx: TypeContext,
  defs: Map<string, Node>,
  step: Step,
  setting: Map<string, number>,
  rng: Rng,
  trial: number,
  field: Field<T>,
): NumericRun {
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  env.sizes = new Map(setting);
  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free, trial);
  if (sampled === 'unknown') return null;
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);

  const sides = evaluateSides(field, step.lhs!, step.rhs!, env, sampler);
  if (sides.kind === 'unknown') {
    // a shape mismatch is not a domain miss: it is a claim about two sides
    // that cannot be compared at all (review 4.4)
    if (sides.shape) return { delta: Number.NaN, shapeMessage: sides.message };
    // a construct the evaluator does not read is a question, never a domain
    // miss: no positivity would make \Sigma^{1/3} readable
    if (!sides.domain && /not read/.test(sides.message)) return { delta: Number.NaN, unreadable: sides.message };
    return 'domain';
  }
  if (sides.kind === 'equal') return { delta: 0 };
  const delta = relativeDelta(field, sides.lhs, sides.rhs);
  // A NaN or an infinity is not a delta: the step was not defined, or the
  // two sides have incomparable shapes. Both are domain (review 3.4).
  return Number.isFinite(delta) ? { delta } : 'domain';
}


export function relativeDelta<T>(field: Field<T>, a: Val<T>, b: Val<T>): number {
  const flat = (v: Val<T>): number[] => (v.k === 's' ? [field.toNumber(v.v)] : v.m.d.map((x) => field.toNumber(x)));
  const fa = flat(a);
  const fb = flat(b);
  if (fa.length !== fb.length) return Number.POSITIVE_INFINITY;
  let diff = 0;
  let scale = 0;
  for (let i = 0; i < fa.length; i++) {
    diff = Math.max(diff, Math.abs(fa[i] - fb[i]));
    scale = Math.max(scale, Math.abs(fa[i]), Math.abs(fb[i]));
  }
  if (scale === 0) return diff === 0 ? 0 : Number.POSITIVE_INFINITY;
  return diff / scale;
}

// ---------------------------------------------------------- the dimensions
