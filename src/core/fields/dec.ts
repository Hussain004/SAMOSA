import Decimal from 'decimal.js';
import type { Field } from './types.ts';

/**
 * High precision arithmetic, 50 digits by default.
 *
 * Numeric checks first run in float64; when the two sides agree to more than
 * 12 digits the step is re-evaluated here so that a cancellation artefact can
 * never be reported as a false equality.
 */
export class DecField implements Field<Decimal> {
  readonly name = 'decimal(50)';
  readonly zero: Decimal;
  readonly one: Decimal;

  readonly precision: number;

  constructor(precision = 50) {
    this.precision = precision;
    Decimal.set({ precision, rounding: Decimal.ROUND_HALF_EVEN });
    this.zero = new Decimal(0);
    this.one = new Decimal(1);
  }

  add(a: Decimal, b: Decimal): Decimal {
    return a.plus(b);
  }
  sub(a: Decimal, b: Decimal): Decimal {
    return a.minus(b);
  }
  mul(a: Decimal, b: Decimal): Decimal {
    return a.times(b);
  }
  div(a: Decimal, b: Decimal): Decimal {
    return a.div(b);
  }
  neg(a: Decimal): Decimal {
    return a.negated();
  }
  inv(a: Decimal): Decimal {
    return a.isZero() ? new Decimal(Infinity) : new Decimal(1).div(a);
  }
  fromRational(n: number, d: number): Decimal {
    return new Decimal(n).div(d);
  }
  isZero(a: Decimal): boolean {
    return a.isZero();
  }
  eq(a: Decimal, b: Decimal): boolean {
    return a.eq(b);
  }
  cmp(a: Decimal, b: Decimal): number {
    return a.comparedTo(b);
  }
  abs(a: Decimal): Decimal {
    return a.abs();
  }
  sqrt(a: Decimal): Decimal {
    return a.sqrt();
  }
  exp(a: Decimal): Decimal {
    return a.exp();
  }
  log(a: Decimal): Decimal {
    return a.ln();
  }
  sin(a: Decimal): Decimal {
    return a.sin();
  }
  cos(a: Decimal): Decimal {
    return a.cos();
  }
  tanh(a: Decimal): Decimal {
    return a.tanh();
  }
  toNumber(a: Decimal): number {
    return a.toNumber();
  }

  random(rng: () => number): Decimal {
    return new Decimal(rng() * 2 - 1);
  }

  normal(rng: () => number): Decimal {
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    return new Decimal(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
}
