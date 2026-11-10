/**
 * The proportionality mode: `p(x) ∝ g(x)`.
 */
import { F64Field } from '../fields/f64.ts';
import type { Node } from '../ir.ts';
import type { TypeContext } from '../types.ts';
import { Sampler } from '../sample.ts';
import { rngFor } from '../prng.ts';
import { evalNode, makeEnv } from '../evaluate.ts';
import { dimSizeOf } from '../types.ts';
import { isScalarVal, scalar, type Val } from '../value.ts';
import {
  collectDimVars,
  collectAssumptions,
  collectSymbols,
  sampleFor,
  settingKey,
} from './shared.ts';
import { sizeSettings } from './plan.ts';
import {
  type Step,
  type StepOptions,
  type GuaranteeCard,
  type StepResult,
} from './types.ts';

export function checkProportionality(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const assumptions = collectAssumptions(ctx, step);
  const sizes: Record<string, number>[] = [];
  const variable = step.proportionalTo;

  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting) as Record<string, number>);
    const rng = rngFor(opts.seed, step.id, settingKey(setting), 'propto');
    const field = new F64Field();
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = defs;
    const sampled = sampleFor(ctx, step, defs, setting, sampler);
    if (sampled === 'unknown') {
      const message = 'could not sample an instance';
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: 'unchecked',
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation,
      };
    }
    for (const [name, value] of sampled.values.entries()) env.values.set(name, value);

    // the variable the proportionality is taken in
    const name = variable ?? guessProportionalityVariable(step, ctx);
    if (!name) {
      const message =
        'SAMOSA does not know which variable this proportionality is taken in. Write \\propto_x.';
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: 'unchecked',
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation,
      };
    }
    const info = ctx.symbols.get(name);
    if (!info) {
      const message = `SAMOSA does not know the shape of ${name}`;
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: 'unchecked',
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation,
      };
    }

    const differences: number[] = [];
    for (let point = 0; point < 3; point++) {
      const trialEnv = { ...env, values: new Map(env.values), memo: new Map() };
      if (info.ty.t === 'mat') {
        const r = dimSizeOf(ctx, info.ty.r, setting);
        const c = dimSizeOf(ctx, info.ty.c, setting);
        trialEnv.values.set(name, { k: 'm', m: sampler.sampleGeneral(r, c) });
      } else {
        trialEnv.values.set(name, scalar(sampler.sampleScalar()));
      }
      let left: number;
      let right: number;
      try {
        const l = evalNode(field, step.lhs!, trialEnv);
        const r = evalNode(field, step.rhs!, trialEnv);
        left = asNumber(l);
        right = asNumber(r);
      } catch {
        const message = 'SAMOSA could not evaluate this proportionality over the reals';
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          relation: step.relation,
          verdict: 'unchecked',
          card: { ...card, sizes, assumptions },
          message,
          reason: message,
          annotation: step.annotation,
        };
      }
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        const message = 'this proportionality was not defined at one of the points';
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          relation: step.relation,
          verdict: 'unchecked',
          card: { ...card, sizes, assumptions },
          message,
          reason: message,
          annotation: step.annotation,
        };
      }
      differences.push(Math.log(Math.abs(left)) - Math.log(Math.abs(right)));
    }

    const spread = Math.max(...differences) - Math.min(...differences);
    const scale = Math.max(1, ...differences.map((d) => Math.abs(d)));
    if (spread > 1e-8 * scale) {
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: 'wrong',
        mode: 'numeric',
        card: { ...card, sizes, assumptions },
        message: `the ratio of the two sides depends on ${name}, so they are not proportional`,
        reason: `the ratio of the two sides depends on ${name}, so they are not proportional`,
        annotation: step.annotation,
      };
    }
  }

  return {
    id: step.id,
    row: step.row,
    span: step.span,
    relation: step.relation,
    verdict: 'ok',
    mode: 'numeric',
    card: { ...card, sizes, assumptions },
    message: 'the ratio of the two sides does not depend on the variable',
    annotation: step.annotation,
  };
}

/** The value of a number, whether it is a scalar or a one by one matrix. */

export function asNumber<T>(val: Val<T>): number {
  if (isScalarVal(val)) return Number(val.v);
  return Number(val.m.d[0]);
}

/** Guesses the variable of a proportionality: the first free symbol of the left. */

export function guessProportionalityVariable(step: Step, ctx: TypeContext): string | undefined {
  const names = new Set<string>();
  collectSymbols(step.lhs, names);
  for (const name of names) {
    const info = ctx.symbols.get(name);
    if (info && info.ty.t === 'mat') return name;
  }
  return undefined;
}

// ------------------------------------------------------------- numeric mode

/** Eight instances per size at each precision, so signs and magnitudes both get covered (review 3.4). */
