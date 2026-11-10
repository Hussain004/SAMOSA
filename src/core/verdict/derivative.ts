/**
 * The derivative mode: a step about a gradient or a Hessian.
 */
import type { Field } from '../fields/types.ts';
import {
  directionalDerivative,
  mixedSecondDerivative,
  evalNode,
} from '../evaluate.ts';
import type { Node } from '../ir.ts';
import { matMul, type Mat } from '../linalg.ts';
import type { Val } from '../value.ts';
import { isMatrixVal, isScalarVal, scalar } from '../value.ts';
import { type Sides } from './sides.ts';
import { asScalar, fieldClose } from './shared.ts';
import type { makeEnv } from '../evaluate.ts';
import type { Sampler } from '../sample.ts';

export function compareDerivative<T>(
  field: Field<T>,
  deriv: Extract<Node, { k: 'deriv' }>,
  claimed: Node,
  env: ReturnType<typeof makeEnv<T>>,
  sampler: Sampler<T>,
): Sides<T> {
  const wrt = deriv.wrt[0];
  if (!wrt || wrt.k !== 'sym') return { kind: 'unknown', message: 'SAMOSA does not know what to differentiate with respect to' };
  const pivotName = wrt.name;
  const pivot = env.values.get(pivotName);
  if (!pivot) {
    return { kind: 'unknown', message: `no value for ${pivotName}` };
  }
  const fnNode = deriv.f;
  if (fnNode.k !== 'sym') {
    return { kind: 'unknown', message: 'SAMOSA can only differentiate a named function' };
  }
  const def = env.defs.get(fnNode.name);
  if (!def) {
    return { kind: 'unknown', message: `${fnNode.name} is not defined, so its derivative cannot be computed` };
  }

  const isScalarPivot = isScalarVal(pivot);
  const n = isScalarPivot ? 1 : pivot.m.r;
  const c = isScalarPivot ? 1 : pivot.m.c;
  const direction: Val<T> = isScalarPivot
    ? scalar(sampler.sampleScalar())
    : { k: 'm', m: sampler.sampleGeneral(n, c) };

  if (deriv.order === 2) {
    const w: Val<T> = isScalarPivot
      ? scalar(sampler.sampleScalar())
      : { k: 'm', m: sampler.sampleGeneral(n, c) };
    const mixed = mixedSecondDerivative(field, def, env, pivotName, pivot, direction, w);
    const claimedVal = evalNode(field, claimed, env);
    if (isMatrixVal(claimedVal)) {
      const value = isScalarPivot
        ? field.mul(
            field.mul(
              (direction as { k: 's'; v: T }).v,
              claimedVal.m.d[0],
            ),
            (w as { k: 's'; v: T }).v,
          )
        : quadraticForm(field, (direction as { k: 'm'; m: Mat<T> }).m, claimedVal.m, (w as { k: 'm'; m: Mat<T> }).m);
      const mixedScalar = asScalar(field, mixed);
      if (mixedScalar === null) {
        return {
          kind: 'different',
          lhs: mixed,
          rhs: claimedVal,
          message: 'the claimed Hessian is not the Hessian of that function',
        };
      }
      if (field.eq(value, mixedScalar)) return { kind: 'equal' };
      // the evidence is the pair of scalars the comparison used: the mixed
      // second derivative along d and w, and the quadratic form of the claim
      return {
        kind: 'different',
        lhs: scalar(mixedScalar),
        rhs: scalar(value),
        message: 'the claimed Hessian is not the Hessian of that function',
      };
    }
    return { kind: 'unknown', message: 'the right hand side of a Hessian claim has to be a matrix' };
  }

  const tangent = directionalDerivative(field, def, env, pivotName, pivot, direction);
  const claimedVal = evalNode(field, claimed, env);
  const tangentScalar = asScalar(field, tangent);

  if (tangentScalar !== null && isMatrixVal(claimedVal) && !isScalarPivot) {
    const inner = innerProduct(field, claimedVal.m, (direction as { k: 'm'; m: Mat<T> }).m);
    if (fieldClose(field, inner, tangentScalar)) return { kind: 'equal' };
    // the layout diagnosis: the claimed gradient has the transposed shape
    const dirMat = (direction as { k: 'm'; m: Mat<T> }).m;
    if (claimedVal.m.r === dirMat.c && claimedVal.m.c === dirMat.r) {
      const flipped = innerProduct(field, transposeMat(claimedVal.m), dirMat);
      if (field.eq(flipped, tangentScalar)) {
        return {
          kind: 'different',
          lhs: scalar(tangentScalar),
          rhs: scalar(flipped),
          message: 'this is the numerator layout gradient; SAMOSA uses the denominator layout',
          layoutHint: 'The gradient has the shape of the variable it is taken with respect to. Transpose it.',
        };
      }
    }
    // the evidence is the pair of scalars the comparison used: the
    // directional derivative of the function along d, and the component of
    // the claimed gradient along d. Reporting those keeps the delta
    // computable, where the raw pair (a derivative value and a gradient)
    // have shapes that cannot be subtracted.
    return {
      kind: 'different',
      lhs: scalar(tangentScalar),
      rhs: scalar(inner),
      message: 'the claimed gradient is not the gradient of that function',
    };
  }

  if (tangentScalar !== null && isScalarVal(claimedVal) && isScalarPivot) {
    const expected = field.mul(claimedVal.v, (direction as { k: 's'; v: T }).v);
    if (fieldClose(field, tangentScalar, expected)) return { kind: 'equal' };
    return {
      kind: 'different',
      lhs: tangent,
      rhs: claimedVal,
      message: 'the claimed derivative is not the derivative of that function',
    };
  }

  if (isMatrixVal(tangent) && isMatrixVal(claimedVal) && isMatrixVal(direction)) {
    const product = matMul(field, claimedVal.m, direction.m);
    if (product.r === tangent.m.r && product.c === tangent.m.c) {
      let same = true;
      for (let i = 0; i < product.d.length; i++) {
        if (!fieldClose(field, product.d[i], tangent.m.d[i])) {
          same = false;
          break;
        }
      }
      if (same) return { kind: 'equal' };
    }
    return {
      kind: 'different',
      lhs: tangent,
      rhs: claimedVal,
      message: 'the claimed Jacobian is not the Jacobian of that function',
    };
  }

  return { kind: 'unknown', message: 'the two sides of this derivative claim do not have comparable shapes' };
}

/** A 1 by 1 matrix is a scalar in disguise. */

export function innerProduct<T>(field: Field<T>, g: Mat<T>, v: Mat<T>): T {
  // tr(G^T V)
  let sum = field.zero;
  for (let i = 0; i < g.r; i++) {
    for (let j = 0; j < g.c; j++) {
      sum = field.add(sum, field.mul(g.d[i * g.c + j], v.d[i * v.c + j]));
    }
  }
  return sum;
}


export function quadraticForm<T>(field: Field<T>, v: Mat<T>, h: Mat<T>, w: Mat<T>): T {
  let sum = field.zero;
  for (let i = 0; i < v.r; i++) {
    for (let j = 0; j < h.c; j++) {
      sum = field.add(
        sum,
        field.mul(field.mul(v.d[i * v.c], h.d[i * h.c + j]), w.d[j * w.c]),
      );
    }
  }
  return sum;
}


export function transposeMat<T>(m: Mat<T>): Mat<T> {
  const d = new Array<T>(m.r * m.c);
  for (let i = 0; i < m.r; i++) for (let j = 0; j < m.c; j++) d[j * m.r + i] = m.d[i * m.c + j];
  return { r: m.c, c: m.r, d };
}

/** Is this name a declared function? Those are never defined by an equation. */
