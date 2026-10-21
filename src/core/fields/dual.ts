import type { Field } from './types.ts';

/**
 * Dual numbers: a value plus its tangent in one direction.
 *
 * Every rule of forward mode automatic differentiation is one line here:
 *
 *   (AB)' = A'B + AB'
 *   (A^-1)' = -A^-1 A' A^-1
 *   (det A)' = det A * tr(A^-1 A')
 *
 * Because the arithmetic is generic over the field, a derivative can be
 * computed exactly over a finite field, not just over the reals. That is what
 * lets a gradient claim be verified exactly.
 */
export interface DualValue<F = any> {
  v: F;
  t: F;
}

export class DualField<F extends Field<any>> implements Field<DualValue> {
  readonly name: string;
  readonly zero: DualValue;
  readonly one: DualValue;

  constructor(readonly base: F) {
    this.name = `dual(${base.name})`;
    this.zero = { v: base.zero, t: base.zero };
    this.one = { v: base.one, t: base.zero };
  }

  add(a: DualValue, b: DualValue): DualValue {
    return { v: this.base.add(a.v, b.v), t: this.base.add(a.t, b.t) };
  }
  sub(a: DualValue, b: DualValue): DualValue {
    return { v: this.base.sub(a.v, b.v), t: this.base.sub(a.t, b.t) };
  }
  mul(a: DualValue, b: DualValue): DualValue {
    return {
      v: this.base.mul(a.v, b.v),
      t: this.base.add(this.base.mul(a.t, b.v), this.base.mul(a.v, b.t)),
    };
  }
  div(a: DualValue, b: DualValue): DualValue {
    const inv = this.base.inv(b.v);
    return {
      v: this.base.mul(a.v, inv),
      t: this.base.mul(this.base.sub(a.t, this.base.mul(a.v, this.base.div(b.t, b.v))), inv),
    };
  }
  neg(a: DualValue): DualValue {
    return { v: this.base.neg(a.v), t: this.base.neg(a.t) };
  }
  inv(a: DualValue): DualValue {
    const inv = this.base.inv(a.v);
    return {
      v: inv,
      t: this.base.mul(this.base.neg(a.t), this.base.mul(inv, inv)),
    };
  }
  fromRational(n: number, d: number): DualValue {
    return { v: this.base.fromRational(n, d), t: this.base.zero };
  }
  isZero(a: DualValue): boolean {
    return this.base.isZero(a.v) && this.base.isZero(a.t);
  }
  eq(a: DualValue, b: DualValue): boolean {
    return this.base.eq(a.v, b.v) && this.base.eq(a.t, b.t);
  }
  cmp(a: DualValue, b: DualValue): number {
    return this.base.cmp(a.v, b.v);
  }
  abs(a: DualValue): DualValue {
    return { v: this.base.abs(a.v), t: this.base.mul(a.t, this.base.cmp(a.v, this.base.zero) < 0 ? this.base.neg(this.base.one) : this.base.one) };
  }
  sqrt(a: DualValue): DualValue {
    const s = this.base.sqrt(a.v);
    return { v: s, t: this.base.div(a.t, this.base.mul(this.base.one, s).mul(2)) };
  }
  exp(a: DualValue): DualValue {
    const e = this.base.exp(a.v);
    return { v: e, t: this.base.mul(a.t, e) };
  }
  log(a: DualValue): DualValue {
    return { v: this.base.log(a.v), t: this.base.div(a.t, a.v) };
  }
  sin(a: DualValue): DualValue {
    return { v: this.base.sin(a.v), t: this.base.mul(a.t, this.base.cos(a.v)) };
  }
  cos(a: DualValue): DualValue {
    return { v: this.base.cos(a.v), t: this.base.mul(a.t, this.base.neg(this.base.sin(a.v))) };
  }
  tanh(a: DualValue): DualValue {
    const t = this.base.tanh(a.v);
    const d = this.base.sub(this.base.one, this.base.mul(t, t));
    return { v: t, t: this.base.div(a.t, d) };
  }
  toNumber(a: DualValue): number {
    return this.base.toNumber(a.v);
  }

  random(rng: () => number): DualValue {
    return { v: this.base.random(rng), t: this.base.zero };
  }

  normal(rng: () => number): DualValue {
    return { v: this.base.normal(rng), t: this.base.zero };
  }
}
