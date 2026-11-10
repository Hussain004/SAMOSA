/**
 * Both sides of a step, evaluated on one instance, and compared.
 */
import type { Field } from '../fields/types.ts';
import { zeros, DomainError } from '../linalg.ts';
import { evalNode, makeEnv, EvalError } from '../evaluate.ts';
import type { Node } from '../ir.ts';
import type { Val } from '../value.ts';
import { compareDerivative } from './derivative.ts';
import { valuesEqual } from './shared.ts';
import type { Sampler } from '../sample.ts';

export type Sides<T> =
  | { kind: 'equal' }
  | { kind: 'different'; lhs: Val<T>; rhs: Val<T>; message: string; layoutHint?: string }
  | { kind: 'unknown'; message: string; domain?: boolean; shape?: boolean };

/**
 * Compares two sides of a step.
 *
 * The repair engine uses it as well, because a fix for a gradient row has to
 * be checked the way the verdict was: with a directional derivative.
 */

export function compareSides<T>(
  field: Field<T>,
  lhs: Node,
  rhs: Node,
  env: ReturnType<typeof makeEnv<T>>,
  sampler: Sampler<T>,
): Sides<T> {
  return evaluateSides(field, lhs, rhs, env, sampler);
}

/**
 * Evaluates both sides of a step and compares them.
 *
 * A derivative on the left is special: the claim is about a gradient or a
 * Hessian, so the comparison uses a random direction and the inner product.
 */

export function evaluateSides<T>(
  field: Field<T>,
  lhsNode: Node,
  rhsNode: Node,
  env: ReturnType<typeof makeEnv<T>>,
  sampler: Sampler<T>,
): Sides<T> {
  const derivNode = lhsNode.k === 'deriv' ? lhsNode : undefined;
  try {
    if (derivNode) {
      return compareDerivative(field, derivNode, rhsNode, env, sampler);
    }
    const lhs = evalNode(field, lhsNode, env);
    const rhs = evalNode(field, rhsNode, env);
    // a matrix compared with a scalar is not a claim about equality: it is
    // the shapes that do not fit (review 4.4). A zero is the exception the
    // papers rely on: `(P - I) P = 0` names the zero matrix (review 5.5).
    const realMatrix = (v: Val<T>): boolean => v.k === 'm' && !(v.m.r === 1 && v.m.c === 1);
    const zeroScalar = (v: Val<T>): boolean => v.k === 's' && field.eq(v.v, field.zero);
    if (realMatrix(lhs) && rhs.k === 's') {
      if (zeroScalar(rhs) && lhs.k === 'm') {
        const zero = { k: 'm' as const, m: zeros<T>(lhs.m.r, lhs.m.c, field.zero) };
        if (valuesEqual(field, lhs, zero)) return { kind: 'equal' };
        return { kind: 'different', lhs, rhs: zero, message: 'the two sides are not equal' };
      }
      return { kind: 'unknown', message: 'a matrix on the left, a scalar on the right', shape: true };
    }
    if (lhs.k === 's' && realMatrix(rhs)) {
      if (zeroScalar(lhs) && rhs.k === 'm') {
        const zero = { k: 'm' as const, m: zeros<T>(rhs.m.r, rhs.m.c, field.zero) };
        if (valuesEqual(field, zero, rhs)) return { kind: 'equal' };
        return { kind: 'different', lhs: zero, rhs, message: 'the two sides are not equal' };
      }
      return { kind: 'unknown', message: 'a scalar on the left, a matrix on the right', shape: true };
    }
    if (valuesEqual(field, lhs, rhs)) return { kind: 'equal' };
    return { kind: 'different', lhs, rhs, message: 'the two sides are not equal' };
  } catch (error) {
    if (error instanceof EvalError) {
      const domain = /singular|non square|domain/i.test(error.message);
      // the shapes of the two sides do not fit: that is a shape error, and
      // the repair engine has something to say about it
      const shape = /shape mismatch|not square|non square/i.test(error.message);
      return { kind: 'unknown', message: error.message, domain, shape };
    }
    if (error instanceof DomainError) {
      return { kind: 'unknown', message: error.message, domain: true };
    }
    // A crash is a gap in the engine, and it is said in words a person can
    // read, not as a stack trace.
    const detail = error instanceof Error ? error.message : String(error);
    return { kind: 'unknown', message: `SAMOSA could not evaluate this step: ${detail}` };
  }
}
