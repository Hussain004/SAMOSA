import type { Field } from './types.ts';
import { GFpField } from './gfp.ts';

/**
 * Arithmetic in GF(p^2) = GF(p)[i], for p congruent to 3 modulo 4.
 *
 * Over such a p, -1 has no square root modulo p, so i is new: a single
 * element of the field is a pair (a, b) meaning a + bi. The pair arithmetic
 * is the usual complex arithmetic done modulo p, and every field operation
 * (add, sub, mul, div, neg) is exact. The base field does the hard work:
 * the pair arithmetic delegates to a GFpField, which is spiked and fuzzed.
 *
 * A nonzero element has a nonzero norm a^2 + b^2, because a zero of
 * a^2 + b^2 would be a square root of -1. The inverse of a + bi is
 * (a - bi) / (a^2 + b^2).
 *
 * The two primes used by SAMOSA qualify: 2^31 - 1 is congruent to 3 modulo
 * 4, and 2147483587 is prime and congruent to 3 modulo 4 (verified).
 *
 * No order, no square root, no exponential: this field cannot compare
 * elements, and anything needing an order (abs, norms, sorting) stays
 * unchecked.
 */
export interface GFp2 {
  /** the real part, reduced modulo p */
  a: number;
  /** the imaginary part, reduced modulo p */
  b: number;
}

export class GFp2Field implements Field<GFp2> {
  readonly name = 'GF(p^2)';
  readonly eps = 1e-9;
  /** the base field, doing the exact arithmetic */
  readonly base: GFpField;
  readonly p: number;
  readonly zero: GFp2;
  readonly one: GFp2;
  /** the element i */
  readonly i: GFp2;
  /** a rational image of pi, as the field can represent one */
  readonly pi: GFp2;

  /** structural discriminator, so a field is recognized even across a duplicate instance of this class */
  readonly isGFp2 = true;

  constructor(p: number) {
    this.base = new GFpField(p);
    this.p = p;
    this.zero = { a: this.base.zero, b: this.base.zero };
    this.one = { a: this.base.one, b: this.base.zero };
    this.i = { a: this.base.zero, b: this.base.one };
    this.pi = { a: this.base.fromRational(314159265, 100000000), b: this.base.zero };
  }

  add(x: GFp2, y: GFp2): GFp2 {
    return { a: this.base.add(x.a, y.a), b: this.base.add(x.b, y.b) };
  }

  sub(x: GFp2, y: GFp2): GFp2 {
    return { a: this.base.sub(x.a, y.a), b: this.base.sub(x.b, y.b) };
  }

  neg(x: GFp2): GFp2 {
    return { a: this.base.neg(x.a), b: this.base.neg(x.b) };
  }

  mul(x: GFp2, y: GFp2): GFp2 {
    const ac = this.base.mul(x.a, y.a);
    const bd = this.base.mul(x.b, y.b);
    const ad = this.base.mul(x.a, y.b);
    const bc = this.base.mul(x.b, y.a);
    return { a: this.base.sub(ac, bd), b: this.base.add(ad, bc) };
  }

  /** The complex conjugate: a + bi becomes a - bi. */
  conj(x: GFp2): GFp2 {
    return { a: x.a, b: this.base.neg(x.b) };
  }

  /** The norm a^2 + b^2, as a base field element. */
  norm(x: GFp2): GFp2 {
    const aa = this.base.mul(x.a, x.a);
    const bb = this.base.mul(x.b, x.b);
    return { a: this.base.add(aa, bb), b: this.base.zero };
  }

  inv(x: GFp2): GFp2 {
    if (this.isZero(x)) throw new Error('inverse of zero in GF(p^2)');
    // x^{-1} = conj(x) / norm(x); the norm is a nonzero element of GF(p)
    const n = this.norm(x);
    const invNorm = this.base.inv(n.a);
    const c = this.conj(x);
    return { a: this.base.mul(c.a, invNorm), b: this.base.mul(c.b, invNorm) };
  }

  div(x: GFp2, y: GFp2): GFp2 {
    return this.mul(x, this.inv(y));
  }

  fromRational(n: number, d: number): GFp2 {
    return { a: this.base.fromRational(n, d), b: this.base.zero };
  }

  isZero(x: GFp2): boolean {
    return this.base.isZero(x.a) && this.base.isZero(x.b);
  }

  eq(x: GFp2, y: GFp2): boolean {
    return this.base.eq(x.a, y.a) && this.base.eq(x.b, y.b);
  }

  /** A consistent but arbitrary order; this field has none. Used where a stable pivot is needed. */
  cmp(x: GFp2, y: GFp2): number {
    if (this.base.cmp(x.a, y.a) !== 0) return this.base.cmp(x.a, y.a);
    return this.base.cmp(x.b, y.b);
  }

  abs(_x: GFp2): GFp2 {
    throw new Error('abs is not available in GF(p^2); this step needs an ordered field');
  }

  sqrt(_x: GFp2): GFp2 {
    throw new Error('sqrt is not available in GF(p^2)');
  }

  exp(_x: GFp2): GFp2 {
    throw new Error('exp is not available in GF(p^2)');
  }

  log(_x: GFp2): GFp2 {
    throw new Error('log is not available in GF(p^2)');
  }

  sin(_x: GFp2): GFp2 {
    throw new Error('sin is not available in GF(p^2)');
  }

  cos(_x: GFp2): GFp2 {
    throw new Error('cos is not available in GF(p^2)');
  }

  tanh(_x: GFp2): GFp2 {
    throw new Error('tanh is not available in GF(p^2)');
  }

  toNumber(x: GFp2): number {
    return this.base.toNumber(x.a);
  }

  random(rng: () => number): GFp2 {
    return { a: this.base.random(rng), b: this.base.random(rng) };
  }

  normal(_rng: () => number): GFp2 {
    throw new Error('GF(p^2) has no normal distribution');
  }

  pow(x: GFp2, k: number): GFp2 {
    let acc = this.one;
    let base = x;
    let e = k;
    while (e > 0) {
      if (e & 1) acc = this.mul(acc, base);
      base = this.mul(base, base);
      e = Math.floor(e / 2);
    }
    return acc;
  }
}

/** The two primes used by the complex exact mode. Both were verified prime and congruent to 3 modulo 4. */
export const P1_2 = 2147483647;
export const P2_2 = 2147483587;

/** True for GF(p^2), structurally, so a duplicate instance of the class does not hide it. */
export function isGFp2Field(f: unknown): f is GFp2Field {
  return typeof (f as GFp2Field | undefined)?.isGFp2 === 'boolean' && (f as GFp2Field).isGFp2 === true;
}
