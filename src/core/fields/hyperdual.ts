import type { Field } from './types.ts';

/**
 * Hyper-dual numbers: a value with three extra components, so that a second
 * derivative can be read off directly.
 *
 * The number is
 *
 *   f(x0 + e1*v + e2*w)
 *     = f0 + e1*f1 + e2*f2 + e1*e2*f12
 *
 * where f0 = f(x0), f1 = Df[v], f2 = Df[w] and f12 = v' H w is the mixed
 * second directional derivative. That last component is what a Hessian claim
 * is compared against.
 */
export interface HyperDualValue<F = any> {
  v: F;
  e1: F;
  e2: F;
  e12: F;
}

export class HyperDualField<F extends Field<any>> implements Field<HyperDualValue> {
  readonly name: string;
  readonly zero: HyperDualValue;
  readonly one: HyperDualValue;

  constructor(readonly base: F) {
    this.name = `hyperdual(${base.name})`;
    this.zero = { v: base.zero, e1: base.zero, e2: base.zero, e12: base.zero };
    this.one = { v: base.one, e1: base.zero, e2: base.zero, e12: base.zero };
  }

  add(a: HyperDualValue, b: HyperDualValue): HyperDualValue {
    return {
      v: this.base.add(a.v, b.v),
      e1: this.base.add(a.e1, b.e1),
      e2: this.base.add(a.e2, b.e2),
      e12: this.base.add(a.e12, b.e12),
    };
  }
  sub(a: HyperDualValue, b: HyperDualValue): HyperDualValue {
    return {
      v: this.base.sub(a.v, b.v),
      e1: this.base.sub(a.e1, b.e1),
      e2: this.base.sub(a.e2, b.e2),
      e12: this.base.sub(a.e12, b.e12),
    };
  }
  mul(a: HyperDualValue, b: HyperDualValue): HyperDualValue {
    return {
      v: this.base.mul(a.v, b.v),
      e1: this.base.add(this.base.mul(a.e1, b.v), this.base.mul(a.v, b.e1)),
      e2: this.base.add(this.base.mul(a.e2, b.v), this.base.mul(a.v, b.e2)),
      e12: this.base.add(
        this.base.add(this.base.mul(a.e12, b.v), this.base.mul(a.v, b.e12)),
        this.base.add(this.base.mul(a.e1, b.e2), this.base.mul(a.e2, b.e1)),
      ),
    };
  }
  div(a: HyperDualValue, b: HyperDualValue): HyperDualValue {
    const inv = this.base.inv(b.v);
    const q = this.base.mul(a.v, inv);
    return {
      v: q,
      e1: this.base.mul(this.base.sub(a.e1, this.base.mul(q, b.e1)), inv),
      e2: this.base.mul(this.base.sub(a.e2, this.base.mul(q, b.e2)), inv),
      e12: this.base.mul(
        this.base.sub(
          this.base.sub(a.e12, this.base.mul(q, b.e12)),
          this.base.add(this.base.mul(a.e1, b.e2), this.base.mul(a.e2, b.e1)),
        ),
        inv,
      ),
    };
  }
  neg(a: HyperDualValue): HyperDualValue {
    return {
      v: this.base.neg(a.v),
      e1: this.base.neg(a.e1),
      e2: this.base.neg(a.e2),
      e12: this.base.neg(a.e12),
    };
  }
  inv(a: HyperDualValue): HyperDualValue {
    const inv = this.base.inv(a.v);
    const inv2 = this.base.mul(inv, inv);
    return {
      v: inv,
      e1: this.base.mul(this.base.neg(a.e1), inv2),
      e2: this.base.mul(this.base.neg(a.e2), inv2),
      e12: this.base.mul(this.base.neg(a.e12), inv2),
    };
  }
  fromRational(n: number, d: number): HyperDualValue {
    return { v: this.base.fromRational(n, d), e1: this.base.zero, e2: this.base.zero, e12: this.base.zero };
  }
  isZero(a: HyperDualValue): boolean {
    return (
      this.base.isZero(a.v) &&
      this.base.isZero(a.e1) &&
      this.base.isZero(a.e2) &&
      this.base.isZero(a.e12)
    );
  }
  eq(a: HyperDualValue, b: HyperDualValue): boolean {
    return (
      this.base.eq(a.v, b.v) &&
      this.base.eq(a.e1, b.e1) &&
      this.base.eq(a.e2, b.e2) &&
      this.base.eq(a.e12, b.e12)
    );
  }
  cmp(a: HyperDualValue, b: HyperDualValue): number {
    return this.base.cmp(a.v, b.v);
  }
  abs(a: HyperDualValue): HyperDualValue {
    const sign = this.base.cmp(a.v, this.base.zero) < 0 ? this.base.neg(this.base.one) : this.base.one;
    return {
      v: this.base.abs(a.v),
      e1: this.base.mul(a.e1, sign),
      e2: this.base.mul(a.e2, sign),
      e12: this.base.mul(a.e12, sign),
    };
  }
  sqrt(a: HyperDualValue): HyperDualValue {
    const s = this.base.sqrt(a.v);
    const twoS = this.base.mul(this.base.fromRational(2, 1), s);
    return {
      v: s,
      e1: this.base.div(a.e1, twoS),
      e2: this.base.div(a.e2, twoS),
      e12: this.base.div(this.base.sub(a.e12, this.base.mul(this.base.div(a.e1, twoS), this.base.div(a.e2, twoS))), twoS),
    };
  }
  exp(a: HyperDualValue): HyperDualValue {
    const e = this.base.exp(a.v);
    return {
      v: e,
      e1: this.base.mul(a.e1, e),
      e2: this.base.mul(a.e2, e),
      e12: this.base.add(this.base.mul(a.e12, e), this.base.mul(a.e1, this.base.mul(a.e2, e))),
    };
  }
  log(a: HyperDualValue): HyperDualValue {
    const inv = this.base.inv(a.v);
    return {
      v: this.base.log(a.v),
      e1: this.base.mul(a.e1, inv),
      e2: this.base.mul(a.e2, inv),
      e12: this.base.mul(this.base.sub(a.e12, this.base.mul(a.e1, this.base.mul(a.e2, inv))), inv),
    };
  }
  sin(a: HyperDualValue): HyperDualValue {
    const c = this.base.cos(a.v);
    return {
      v: this.base.sin(a.v),
      e1: this.base.mul(a.e1, c),
      e2: this.base.mul(a.e2, c),
      e12: this.base.add(this.base.mul(a.e12, c), this.base.mul(this.base.mul(a.e1, this.base.neg(this.base.sin(a.v))), a.e2)),
    };
  }
  cos(a: HyperDualValue): HyperDualValue {
    const s = this.base.sin(a.v);
    return {
      v: this.base.cos(a.v),
      e1: this.base.mul(a.e1, this.base.neg(s)),
      e2: this.base.mul(a.e2, this.base.neg(s)),
      e12: this.base.add(this.base.mul(a.e12, this.base.neg(s)), this.base.mul(this.base.mul(a.e1, this.base.neg(s)), a.e2)),
    };
  }
  tanh(a: HyperDualValue): HyperDualValue {
    const t = this.base.tanh(a.v);
    const d = this.base.sub(this.base.one, this.base.mul(t, t));
    const d2 = this.base.mul(d, d);
    return {
      v: t,
      e1: this.base.div(a.e1, d),
      e2: this.base.div(a.e2, d),
      e12: this.base.div(this.base.sub(a.e12, this.base.mul(this.base.div(a.e1, d), this.base.div(a.e2, d))), d),
    };
  }
  toNumber(a: HyperDualValue): number {
    return this.base.toNumber(a.v);
  }

  random(rng: () => number): HyperDualValue {
    return { v: this.base.random(rng), e1: this.base.zero, e2: this.base.zero, e12: this.base.zero };
  }

  normal(rng: () => number): HyperDualValue {
    return { v: this.base.normal(rng), e1: this.base.zero, e2: this.base.zero, e12: this.base.zero };
  }
}
