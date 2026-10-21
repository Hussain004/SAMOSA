import type { Field } from './types.ts';

/**
 * Arithmetic modulo a prime, in plain float64.
 *
 * The trick that keeps this exact: a product of two numbers below p is up to
 * 2^62, which float64 cannot hold. So one operand is split into 16 bit limbs
 * and the multiplication is done in pieces:
 *
 *   a * b = (a * (b >>> 16)) * 65536 + a * (b & 0xffff)
 *
 * Every intermediate stays below 2^53 and is therefore exact. The spike
 * `spikes/gfp_probe.mjs` validates this against BigInt on 10^5 random pairs.
 */
export class GFpField implements Field<number> {
  readonly name = 'GF(p)';
  readonly zero = 0;
  readonly one = 1;

  constructor(readonly p: number) {}

  /** Reduce to the canonical representative in [0, p). */
  mod(a: number): number {
    const r = a % this.p;
    return r < 0 ? r + this.p : r;
  }

  add(a: number, b: number): number {
    const r = a + b;
    return r >= this.p ? r - this.p : r;
  }

  sub(a: number, b: number): number {
    const r = a - b;
    return r < 0 ? r + this.p : r;
  }

  neg(a: number): number {
    return a === 0 ? 0 : this.p - a;
  }

  mul(a: number, b: number): number {
    const p = this.p;
    const hi = (b >>> 16) & 0xffff;
    const lo = b & 0xffff;
    const t = ((a * hi) % p) * 65536 + a * lo;
    return this.mod(t);
  }

  inv(a: number): number {
    if (a === 0) throw new Error('inverse of zero in GF(p)');
    // Fermat: a^(p-2) mod p.
    let result = 1;
    let base = a;
    let e = this.p - 2;
    while (e > 0) {
      if (e & 1) result = this.mul(result, base);
      base = this.mul(base, base);
      e = Math.floor(e / 2);
    }
    return result;
  }

  div(a: number, b: number): number {
    return this.mul(a, this.inv(b));
  }

  fromRational(n: number, d: number): number {
    const nn = this.mod(n);
    if (d === 1) return nn;
    const dd = this.mod(d);
    if (dd === 0) throw new Error('rational with denominator 0 mod p');
    return this.mul(nn, this.inv(dd));
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
    return a;
  }

  private transcendental(op: string): never {
    throw new Error(`${op} is not available in GF(p); this step needs numeric mode`);
  }

  sqrt(_a: number): number {
    return this.transcendental('sqrt');
  }
  exp(_a: number): number {
    return this.transcendental('exp');
  }
  log(_a: number): number {
    return this.transcendental('log');
  }
  sin(_a: number): number {
    return this.transcendental('sin');
  }
  cos(_a: number): number {
    return this.transcendental('cos');
  }
  tanh(_a: number): number {
    return this.transcendental('tanh');
  }

  toNumber(a: number): number {
    return a;
  }
}

/** The two primes used for exact checking. Both were verified prime. */
export const P1 = 2147483647; // 2^31 - 1
export const P2 = 2147483629;
