import type { Mat } from './linalg.ts';

/**
 * The values the evaluator produces.
 *
 * A value is either a scalar or a matrix. Keeping the two apart matters:
 * a 1 by 1 matrix and a scalar behave differently when a step adds them.
 */
export type Val<T> = { k: 's'; v: T } | { k: 'm'; m: Mat<T> };

export function scalar<T>(v: T): Val<T> {
  return { k: 's', v };
}

export function matrix<T>(m: Mat<T>): Val<T> {
  return { k: 'm', m };
}

export function isScalarVal<T>(val: Val<T>): val is { k: 's'; v: T } {
  return val.k === 's';
}

export function isMatrixVal<T>(val: Val<T>): val is { k: 'm'; m: Mat<T> } {
  return val.k === 'm';
}

/** The shape of a value, as text. */
export function valShape<T>(val: Val<T>): string {
  if (val.k === 's') return 'a scalar';
  return `${val.m.r} by ${val.m.c}`;
}
