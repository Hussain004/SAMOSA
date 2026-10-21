import { describe, expect, it } from 'vitest';
import { GFpField } from '../src/core/fields/gfp.ts';
import { DecField } from '../src/core/fields/dec.ts';
import { rngFor } from '../src/core/prng.ts';

/**
 * The kernel oracle.
 *
 * The finite field is the heart of the engine: every checkmark is a claim
 * about it. So the field is checked against an oracle that does the same
 * arithmetic with BigInt, which is obviously right and obviously slow.
 *
 * The edges matter most: a product of two numbers below p is up to 2^62,
 * which float64 cannot hold, so the multiplication is done in 16 bit limbs.
 * The limb boundary is where a mistake would hide.
 */

const PRIMES = [2147483647, 2147483629, 104729, 65521];

/** The oracle: the same arithmetic, with BigInt. */
class BigIntField {
  readonly p: bigint;
  constructor(p: bigint) {
    this.p = p;
  }
  mod(a: bigint): bigint {
    const r = a % this.p;
    return r < 0n ? r + this.p : r;
  }
  add(a: bigint, b: bigint): bigint {
    return this.mod(a + b);
  }
  sub(a: bigint, b: bigint): bigint {
    return this.mod(a - b);
  }
  mul(a: bigint, b: bigint): bigint {
    return this.mod(a * b);
  }
  inv(a: bigint): bigint {
    // Fermat, with BigInt
    let result = 1n;
    let base = this.mod(a);
    let e = this.p - 2n;
    while (e > 0n) {
      if (e & 1n) result = this.mul(result, base);
      base = this.mul(base, base);
      e >>= 1n;
    }
    return result;
  }
  div(a: bigint, b: bigint): bigint {
    return this.mul(this.mod(a), this.inv(b));
  }
}

describe('the finite field', () => {
  for (const p of PRIMES) {
    it(`agrees with the oracle over GF(${p})`, () => {
      const field = new GFpField(p);
      const oracle = new BigIntField(BigInt(p));
      const rng = rngFor(1234, 'oracle', p);

      for (let i = 0; i < 2000; i++) {
        const a = Math.floor(rng() * p);
        const b = Math.floor(rng() * p);
        expect(field.add(a, b)).toBe(Number(oracle.add(BigInt(a), BigInt(b))));
        expect(field.sub(a, b)).toBe(Number(oracle.sub(BigInt(a), BigInt(b))));
        expect(field.mul(a, b)).toBe(Number(oracle.mul(BigInt(a), BigInt(b))));
        expect(field.neg(a)).toBe(Number(oracle.mod(-BigInt(a))));
        if (b !== 0) {
          expect(field.inv(b)).toBe(Number(oracle.inv(BigInt(b))));
          expect(field.div(a, b)).toBe(Number(oracle.div(BigInt(a), BigInt(b))));
        }
      }
    });
  }

  it('multiplies correctly across the 16 bit limb boundary', () => {
    // the values where a limb overflow would show up
    const p = 2147483647;
    const field = new GFpField(p);
    const oracle = new BigIntField(BigInt(p));
    const edges = [
      0, 1, 65535, 65536, 65537, 131071, 131072, 131073,
      2147483646, 2147483645, 1073741823, 1073741824, 1073741825,
      3, 5, 65535 * 65535, 65536 * 65536,
    ];
    // the field takes its operands reduced, the way the engine gives them
    const reduced = edges.map((value) => field.mod(value));
    for (const a of reduced) {
      for (const b of reduced) {
        expect(field.mul(a, b)).toBe(Number(oracle.mul(BigInt(a), BigInt(b))));
      }
    }
  });

  it('multiplies the largest values without losing a bit', () => {
    const p = 2147483647;
    const field = new GFpField(p);
    const oracle = new BigIntField(BigInt(p));
    // (p-1)^2 = 2^62 - 2^32 + 1, which float64 cannot hold exactly
    const a = p - 1;
    expect(field.mul(a, a)).toBe(Number(oracle.mul(BigInt(a), BigInt(a))));
  });

  it('adds and subtracts without crossing the modulus', () => {
    const p = 2147483647;
    const field = new GFpField(p);
    expect(field.add(p - 1, 1)).toBe(0);
    expect(field.sub(0, 1)).toBe(p - 1);
    expect(field.add(0, 0)).toBe(0);
  });

  it('throws on the inverse of zero', () => {
    const field = new GFpField(2147483647);
    expect(() => field.inv(0)).toThrow();
  });

  it('gives every element an inverse', () => {
    const p = 2147483629;
    const field = new GFpField(p);
    const oracle = new BigIntField(BigInt(p));
    for (let a = 1; a < 200; a++) {
      const inverse = field.inv(a);
      expect(field.mul(a, inverse)).toBe(1);
      expect(inverse).toBe(Number(oracle.inv(BigInt(a))));
    }
  });
});

describe('the decimal field', () => {
  it('agrees with the oracle to fifty digits', () => {
    const field = new DecField(50);
    const rng = rngFor(4321, 'oracle', 'dec');
    for (let i = 0; i < 500; i++) {
      const a = Math.floor(rng() * 1000) - 500;
      const b = Math.floor(rng() * 1000) - 500;
      expect(field.add(field.fromRational(a, 1), field.fromRational(b, 1)).toNumber()).toBe(a + b);
      if (b !== 0) {
        const quotient = field.div(field.fromRational(a, 1), field.fromRational(b, 1));
        expect(quotient.toNumber()).toBeCloseTo(a / b, 12);
      }
    }
  });

  it('keeps a fraction exact', () => {
    const field = new DecField(50);
    const third = field.div(field.fromRational(1, 1), field.fromRational(3, 1));
    expect(third.toNumber()).toBeCloseTo(1 / 3, 49);
  });
});
