/**
 * The field interface every numeric kernel is generic over.
 *
 * A field provides the handful of operations the evaluation kernels need.
 * Transcendental operations are part of the interface so that the same IR
 * tree can be evaluated in a finite field or over the reals; the finite field
 * implementation throws for them, and the mode planner guarantees they are
 * never reached in exact mode.
 */
export interface Field<T> {
  readonly name: string;
  readonly zero: T;
  readonly one: T;
  add(a: T, b: T): T;
  sub(a: T, b: T): T;
  mul(a: T, b: T): T;
  div(a: T, b: T): T;
  neg(a: T): T;
  /** Multiplicative inverse. Throws when the element is not invertible. */
  inv(a: T): T;
  /** Exact rational literal. */
  fromRational(n: number, d: number): T;
  isZero(a: T): boolean;
  eq(a: T, b: T): boolean;
  /** Ordering helper for the real fields; finite fields have no order. */
  cmp(a: T, b: T): number;
  abs(a: T): T;
  sqrt(a: T): T;
  exp(a: T): T;
  log(a: T): T;
  sin(a: T): T;
  cos(a: T): T;
  tanh(a: T): T;
  /** Converts back to a plain number, for reporting and for the real fields. */
  toNumber(a: T): number;
  /** The best available image of pi, for the normalising constants. */
  readonly pi: T;
  /** A uniformly random element of the field. */
  random(rng: () => number): T;
  /** A random element from the standard normal distribution. */
  normal(rng: () => number): T;
}

/** A scalar of an arbitrary field, used by the dual number wrappers. */
export type AnyScalar = any;
