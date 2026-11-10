/**
 * The exact mode: a step over finite fields, decided by sampling.
 */
import { P1, P2, GFpField } from '../fields/gfp.ts';
import { degreeOf, type TypeContext } from '../types.ts';
import type { Node } from '../ir.ts';
import { Sampler } from '../sample.ts';
import { rngFor, type Rng } from '../prng.ts';
import { makeEnv } from '../evaluate.ts';
import {
  collectDimVars,
  collectAssumptions,
  collectSymbols,
  freeVariables,
  sampleFor,
  buildCounterexample,
  settingKey,
  hasExpectation,
} from './shared.ts';
import { sizeSettings, cornerCount } from './plan.ts';
import { evaluateSides } from './sides.ts';
import {
  type Step,
  type StepOptions,
  type GuaranteeCard,
  type StepResult,
  type Counterexample,
} from './types.ts';

export function checkExact(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const primes: [number, number] = [P1, P2];

  // One corner per structured symbol: an orthogonal matrix is a rotation or
  // a reflection, so with k of them there are 2^k combinations and the trial
  // count has to rise until every combination is drawn (review 3.1). Below
  // the cap the exhaustiveness is what keeps the bound honest: a wrong step
  // hiding in a corner that was never drawn could not be priced.
  const corners = cornerCount(step, ctx, defs);
  if (corners > 7) {
    const message = 'this step has too many structured symbols to draw every corner of';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: step.relation,
      verdict: 'unchecked',
      card: { ...card, assumptions: collectAssumptions(ctx, step) },
      message,
      reason: message,
      annotation: step.annotation,
    };
  }
  // every corner is drawn the full trial count, up to a cap of 64 trials;
  // past the cap each corner still gets one, and the bound says so
  const trialsNeeded = Math.max(2 ** corners, Math.min(opts.trials * 2 ** corners, 64));
  const mask = corners > 0 ? (1 << corners) - 1 : 0;

  let worstBound = 0;
  let worstDegree = 0;
  const working: Array<{ setting: Map<string, number>; ranP1: number; ranP2: number }> = [];
  const sizes: Record<string, number>[] = [];
  const assumptions = collectAssumptions(ctx, step);

  for (const setting of settings) {
    // the trials that ran, per prime and per corner
    const perCorner = new Map<number, number[]>([
      [P1, new Array<number>(1 << corners).fill(0)],
      [P2, new Array<number>(1 << corners).fill(0)],
    ]);
    for (let trial = 0; trial < trialsNeeded; trial++) {
      for (const p of primes) {
        const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, p);
        const outcome = runExactTrial(step, ctx, defs, setting, p, rng, trial);
        if (outcome.kind === 'ok') {
          perCorner.get(p)![trial & mask]++;
          continue;
        }
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
          text: step.text,
          lhsSpan: step.lhs?.span,
          rhsSpan: step.rhs?.span,
          relation: step.relation,
          verdict: 'wrong',
          mode: 'exact',
          card: { ...card, sizes, primes, degree: worstDegree, bound: worstBound, assumptions },
          message: outcome.message,
          reason: outcome.message,
          counterexample: outcome.counterexample,
          layoutHint: outcome.layoutHint,
          annotation: step.annotation,
        };
      }
    }
    // A size carries evidence only when every corner was drawn at both
    // primes: a corner no trial evaluated is a place a wrong step can hide
    // (review 3.1), and trials that failed on a domain error earn nothing.
    // A wrong step may vanish on every corner but one, and a trial in
    // another corner cannot see it, so the evidence of a size is the trials
    // of its least drawn corner, not the sum (review 3.1, round 2).
    const ranP1 = Math.min(...perCorner.get(P1)!);
    const ranP2 = Math.min(...perCorner.get(P2)!);
    if (ranP1 > 0 && ranP2 > 0) {
      working.push({ setting, ranP1, ranP2 });
    }
  }

  if (!working.length) {
    const message = 'this step could not be evaluated at any size';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: 'unchecked',
      card: { ...card, sizes, primes, assumptions },
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  // The degree is read after sampling, which can leak shape errors of the
  // type inference into the next step, so the errors collected here are
  // dropped: they were emitted already.
  for (const { setting, ranP1, ranP2 } of working) {
    sizes.push(Object.fromEntries(setting) as Record<string, number>);
    const errorsAt = ctx.errors.length;
    const dl = degreeOf(ctx, step.lhs!, setting, defs);
    const dr = degreeOf(ctx, step.rhs!, setting, defs);
    ctx.errors.length = errorsAt;
    const d = Math.max(dl.n + dr.d, dr.n + dl.d);
    worstDegree = Math.max(worstDegree, d);
    // The bound counts only the trials that ran, at this size (review 3.3),
    // in the least drawn corner: a skipped trial catches nothing.
    const bound = Math.pow(d / P1, ranP1) * Math.pow(d / P2, ranP2);
    worstBound = Math.max(worstBound, bound);
  }

  // An exact checkmark with degree 0 over sampled symbols is an engine gap
  // (review 3.3): the bound would read "at most 0", which is no receipt at
  // all. It is downgraded to ? and said so, and nothing under 0 is ever
  // printed. A step over numbers alone has no sampled symbol to lie about:
  // the exact evaluation is a full verification, so the degree being 0 is
  // the truth there (review 4.3).
  const stepSymbols = new Set<string>();
  collectSymbols(step.lhs, stepSymbols);
  collectSymbols(step.rhs, stepSymbols);
  if (worstDegree === 0 && stepSymbols.size > 0) {
    const message =
      'the degree bound of this step came out as 0 although symbols were sampled, which is an engine gap; SAMOSA claims nothing here';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: 'inconclusive',
      card: { ...card, sizes, primes, assumptions },
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  return {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict: 'ok',
    mode: hasExpectation(step) ? 'quadrature' : 'exact',
    card: {
      ...card,
      trialsPerSize: trialsNeeded,
      sizes,
      primes,
      degree: worstDegree,
      bound: worstBound,
      assumptions,
    },
    message: 'holds at every size tested',
    annotation: step.annotation,
  };
}

/** How many structured symbols of this step have more than one corner. */

export type TrialOutcome =
  | { kind: 'ok' }
  | { kind: 'wrong'; message: string; counterexample: Counterexample; layoutHint?: string }
  | { kind: 'unknown'; message: string; domain?: boolean; shape?: boolean };


export function runExactTrial(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  setting: Map<string, number>,
  p: number,
  rng: Rng,
  trial: number,
): TrialOutcome {
  const field = new GFpField(p);
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  env.sizes = new Map(setting);

  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free, trial);
  if (sampled === 'unknown') {
    return { kind: 'unknown', message: 'SAMOSA could not sample an instance of these objects' };
  }
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);

  const sides = evaluateSides(field, step.lhs!, step.rhs!, env, sampler);
  if (sides.kind === 'unknown') {
    return { kind: 'unknown', message: sides.message, domain: sides.domain, shape: sides.shape };
  }
  if (sides.kind === 'equal') return { kind: 'ok' };

  return {
    kind: 'wrong',
    message: sides.message,
    layoutHint: sides.layoutHint,
    counterexample: buildCounterexample(ctx, step, setting, sampled.values, sides.lhs, sides.rhs, field),
  };
}
