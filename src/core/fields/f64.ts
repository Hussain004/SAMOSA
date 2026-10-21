import type { Field } from './types.ts';

/** Plain float64 arithmetic. Fast, and the first pass of every numeric check. */
export class F64Field implements Field<number> {
  readonly name = 'f64';
  readonly zero = 0;
  readonly one = 1;

  add(a: number, b: number): number {
    return a + b;
  }
  sub(a: number, b: number): number {
    return a - b;
  }
  mul(a: number, b: number): number {
    return a * b;
  }
  div(a: number, b: number): number {
    return a / b;
  }
  neg(a: number): number {
    return -a;
  }
  inv(a: number): number {
    return 1 / a;
  }
  fromRational(n: number, d: number): number {
    return n / d;
  }
  isZero(a: number): boolean {
    return a === 0;
  }
  eq(a: number, b: number): boolean {
    return a === b;
  }
  cmp(a: number, b: number): number {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  abs(a: number): number {
    return Math.abs(a);
  }
  sqrt(a: number): number {
    return Math.sqrt(a);
  }
  exp(a: number): number {
    return Math.exp(a);
  }
  log(a: number): number {
    return Math.log(a);
  }
  sin(a: number): number {
    return Math.sin(a);
  }
  cos(a: number): number {
    return Math.cos(a);
  }
  tanh(a: number): number {
    return Math.tanh(a);
  }
  toNumber(a: number): number {
    return a;
  }

  random(rng: () => number): number {
    return rng() * 2 - 1;
  }

  normal(rng: () => number): number {
    // Box-Muller
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
