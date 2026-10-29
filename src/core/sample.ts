import type { Field } from './fields/types.ts';
import { GFpField } from './fields/gfp.ts';
import { identity, matAdd, matInv, matMul, matScale, matSub, transpose, zeros, type Mat } from './linalg.ts';
import type { Prop } from './decl.ts';
import type { Rng } from './prng.ts';
import { randField } from './prng.ts';
import { scalar, type Val } from './value.ts';

/**
 * Instance generation.
 *
 * SAMOSA never rewrites symbols. It samples real objects with the shapes and
 * the structure the declarations describe, and evaluates both sides of a
 * step on those objects. Non-commutativity, structure and shape all come for
 * free from evaluating actual matrices.
 *
 * The recipes are the ones of section 3.3. Over a finite field only the
 * algebraic structure matters: a symmetric matrix is a mirrored one, and a
 * positive definite matrix is sampled the same way, because an identity that
 * holds on the positive definite cone holds on the whole symmetric cone.
 */

export interface SampleSpec {
  name: string;
  r: number;
  c: number;
  props: Prop[];
  /**
   * The corner the recipe draws from.
   *
   * Some recipes have more than one kind of instance: an orthogonal matrix is
   * a rotation or a reflection, an idempotent is full rank or rank deficient.
   * The verdict engine pegs one corner per structure symbol to a bit of the
   * trial index, so every combination of corners is evaluated and no false
   * verdict can hide in the corner nobody drew.
   */
  variety: number;
}

export class Sampler<T> {
  readonly field: Field<T>;
  readonly rng: Rng;

  constructor(field: Field<T>, rng: Rng) {
    this.field = field;
    this.rng = rng;
  }

  /** Samples one symbol. Returns null when the constraints cannot be met. */
  sample(spec: SampleSpec): Val<T> | null {
    const { r, c, props } = spec;
    const has = (p: string) => props.some((x) => (typeof x === 'string' ? x === p : false));

    if (has('ident')) return { k: 'm', m: identity<T>(r, this.field.one, this.field.zero) };
    if (has('zero')) return { k: 'm', m: zeros<T>(r, c, this.field.zero) };
    if (has('ones')) return { k: 'm', m: this.mat(r, c, () => this.field.one) };
    // a rotation is an orthogonal matrix of determinant one, so it has no
    // corners: every rotation is caught by the same recipe
    if (has('rot')) return { k: 'm', m: this.sampleOrthogonal(r, false) };
    if (has('orth')) return { k: 'm', m: this.sampleOrthogonal(r, (spec.variety & 1) === 1) };
    if (has('idem') || has('proj')) {
      const rank = (spec.variety & 1) === 0 ? Math.min(r, c) : Math.max(1, Math.min(r, c) - 1);
      return { k: 'm', m: this.sampleIdempotent(r, c, rank) };
    }
    if (has('unit')) return { k: 'm', m: this.sampleUnit(r, c) };
    if (has('stoch')) return { k: 'm', m: this.sampleStochastic(r, c) };
    if (has('diag')) return { k: 'm', m: this.sampleDiagonal(r, c) };
    if (has('triu')) return { k: 'm', m: this.sampleTriangular(r, c, true) };
    if (has('tril')) return { k: 'm', m: this.sampleTriangular(r, c, false) };
    if (has('skew')) return { k: 'm', m: this.sampleSkew(r, c) };
    if (has('spd') && !(this.field instanceof GFpField)) {
      // over the reals a positive definite matrix is sampled as B B' + r I, so
      // that the densities and the square roots are well defined
      const f = this.field;
      const b = this.sampleGeneral(r, r);
      const bb = matMul(f, b, transpose(b));
      const eye = identity<T>(r, f.one, f.zero);
      const scaled = matScale(f, f.fromRational(r, 1), eye);
      return { k: 'm', m: matAdd(f, bb, scaled) };
    }
    if (has('sym') || has('spd') || has('psd')) return { k: 'm', m: this.sampleSymmetric(r, c) };
    return { k: 'm', m: this.sampleGeneral(r, c) };
  }

  private mat(r: number, c: number, f: (i: number, j: number) => T): Mat<T> {
    const d: T[] = new Array(r * c);
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) d[i * c + j] = f(i, j);
    return { r, c, d };
  }

  /** One random element of the field. */
  private element(): T {
    const f = this.field;
    if (f instanceof GFpField) return randField(this.rng, f.p) as T;
    return f.normal(this.rng);
  }

  private norm(): T {
    return this.field.normal(this.rng) as T;
  }

  /** iid entries. */
  sampleGeneral(r: number, c: number): Mat<T> {
    return this.mat(r, c, () => this.element());
  }

  /** The upper triangle is mirrored. */
  sampleSymmetric(r: number, c: number): Mat<T> {
    const upper = this.sampleGeneral(r, c);
    return this.mat(r, c, (i, j) => (i <= j ? upper.d[i * c + j] : upper.d[j * c + i]));
  }

  /** A diagonal matrix. */
  sampleDiagonal(r: number, c: number): Mat<T> {
    return this.mat(r, c, (i, j) => (i === j ? this.element() : this.field.zero));
  }

  /** Upper or lower triangular. */
  sampleTriangular(r: number, c: number, upper: boolean): Mat<T> {
    return this.mat(r, c, (i, j) => {
      if (i === j) return this.element();
      const inUpper = i < j;
      return inUpper === upper ? this.element() : this.field.zero;
    });
  }

  /** Skew symmetric: the transpose is the negative. */
  sampleSkew(r: number, c: number): Mat<T> {
    const f = this.field;
    const upper = this.sampleGeneral(r, c);
    return this.mat(r, c, (i, j) => (i === j ? f.zero : i < j ? upper.d[i * c + j] : f.neg(upper.d[j * c + i])));
  }

  /**
   * An orthogonal matrix.
   *
   * Over a finite field the Cayley transform is exact: Q = (I - S)(I + S)^-1
   * with S skew gives Q^T Q = I as an identity, not as an approximation.
   *
   * The component is a corner (section 3.1 of the review): with the
   * reflection flag false this is a rotation and its determinant is one,
   * with it true ONE column is negated, which flips the determinant and
   * keeps the orthogonality. Both corners of O(n) have to be drawn, or an
   * identity about det(Q) is decided by half the truth.
   */
  sampleOrthogonal(n: number, reflect = false): Mat<T> {
    const f = this.field;
    if (f instanceof GFpField) {
      const g = f as unknown as Field<T>;
      const s = this.sampleSkew(n, n);
      const eye = identity<T>(n, g.one, g.zero);
      const plus = matAdd(g, eye, s);
      const minus = matSub(g, eye, s);
      const inv = matInv(g, plus);
      const q = matMul(g, minus, inv);
      if (!reflect) return q;
      // negate the first column: det flips, the orthogonality does not
      return this.mat(n, n, (i, j) => (j === 0 ? g.neg(q.d[i * n]) : q.d[i * n + j]));
    }
    // over the reals: a QR factorisation with the sign fixed, so it is Haar
    const q = this.qrHaar(this.sampleGeneral(n, n));
    if (!reflect) return q;
    return this.mat(n, n, (i, j) => (j === 0 ? f.neg(q.d[i * n]) : q.d[i * n + j]));
  }

  /** Gram-Schmidt with the sign correction, which gives a Haar measure. */
  private qrHaar(a: Mat<T>): Mat<T> {
    const f = this.field;
    const n = a.r;
    let cols: Mat<T>[] = [];
    for (let j = 0; j < n; j++) {
      const v: Mat<T> = { r: n, c: 1, d: new Array<T>(n) };
      for (let i = 0; i < n; i++) v.d[i] = a.d[i * n + j];
      cols.push(v);
    }
    // Two passes of Gram-Schmidt: the second squares the rounding error of
    // the first, so the columns are orthonormal to the precision the field
    // itself affords the square root. The normalisation uses the field's own
    // root, not a decimal rounding, so a numeric check against Q'Q = I can
    // actually pass.
    for (let pass = 0; pass < 2; pass++) {
      const next: Mat<T>[] = [];
      for (let j = 0; j < n; j++) {
        const v: Mat<T> = { r: n, c: 1, d: [...cols[j].d] };
        for (const q of next) {
          let proj = f.zero;
          for (let i = 0; i < n; i++) proj = f.add(proj, f.mul(q.d[i], v.d[i]));
          for (let i = 0; i < n; i++) v.d[i] = f.sub(v.d[i], f.mul(proj, q.d[i]));
        }
        let norm = f.zero;
        for (let i = 0; i < n; i++) norm = f.add(norm, f.mul(v.d[i], v.d[i]));
        let scale = f.sqrt(norm);
        if (f.toNumber(scale) < 1e-9) scale = f.one;
        if (f.toNumber(v.d[n - 1]) < 0) scale = f.neg(scale);
        for (let i = 0; i < n; i++) v.d[i] = f.div(v.d[i], scale);
        next.push(v);
      }
      cols = next;
    }
    return this.mat(n, n, (i, j) => cols[j].d[i]);
  }

  /** An idempotent matrix of the given rank: U (V^T U)^-1 V^T. */
  sampleIdempotent(r: number, c: number, rank: number): Mat<T> {
    const f = this.field;
    const k = rank;
    const u = this.sampleGeneral(r, k);
    const v = this.sampleGeneral(c, k);
    const vtu = matMul(f, transpose(v), u);
    const inv = matInv(f, vtu);
    return matMul(f, matMul(f, u, inv), transpose(v));
  }

  /** A unit vector: a normalized Gaussian, or a stereographic point. */
  sampleUnit(r: number, c: number): Mat<T> {
    const f = this.field;
    if (f instanceof GFpField) {
      // stereographic: (2t, ||t||^2 - 1) / (||t||^2 + 1) on the unit sphere
      // (review 4.1). A column vector is stereographed down the rows: t has
      // length r - 1 and the last entry takes the pole. Every column of a
      // matrix is stereographed over its own tangent vector, so each one is
      // exactly unit over GF(p):
      // ||u||^2 = (4||t||^2 + (||t||^2 - 1)^2) / (||t||^2 + 1)^2 = 1.
      const k = Math.max(r - 1, 0);
      const t = this.sampleGeneral(k, c);
      const sq: T[] = new Array(c).fill(f.zero);
      const inv: T[] = new Array(c);
      for (let j = 0; j < c; j++) {
        let s: T = f.zero as T;
        for (let i = 0; i < k; i++) s = f.add(s, f.mul(t.d[i * c + j], t.d[i * c + j]));
        sq[j] = s;
        inv[j] = f.inv(f.add(s, f.one));
      }
      return this.mat(r, c, (i, j) => {
        if (i === r - 1) return f.mul(f.sub(sq[j], f.one), inv[j]);
        return f.mul(f.mul(f.fromRational(2, 1), t.d[i * c + j]), inv[j]);
      });
    }
    const v = this.sampleGeneral(r, c);
    let norm = f.zero;
    for (const x of v.d) norm = f.add(norm, f.mul(x, x));
    const s = Math.sqrt(f.toNumber(norm)) || 1;
    const scale = f.fromRational(Math.round(s * 1e9), 1e9);
    return this.mat(r, c, (i, j) => f.div(v.d[i * c + j], scale));
  }

  /** Row stochastic: the rows are positive and sum to one. */
  sampleStochastic(r: number, c: number): Mat<T> {
    const f = this.field;
    const raw = this.sampleGeneral(r, c);
    return this.mat(r, c, (i, j) => {
      let sum = f.zero;
      for (let k = 0; k < c; k++) sum = f.add(sum, raw.d[i * c + k]);
      if (f.isZero(sum)) return f.zero;
      return f.div(raw.d[i * c + j], sum);
    });
  }

  /**
   * A scalar drawn from the field.
   *
   * Over a finite field every element is as good as any other. Over the
   * reals the samples have to span what the step distinguishes: the sign
   * comes from a bit of the trial index, and the magnitude cycles through a
   * tiny, a unit and a large class, so the samples cover the line without
   * being random about the coverage (section 3.4 of the review). A sign
   * that never turns negative is how |x| = x used to look true.
   */
  sampleScalar(variety = 0, index = 0): T {
    const f = this.field;
    if (f instanceof GFpField) return randField(this.rng, f.p) as T;
    const z = this.norm();
    const sign = ((variety >> index) & 1) === 1 ? -1 : 1;
    const cls = (variety + index) % 3;
    const magnitude =
      cls === 0
        ? f.mul(f.abs(z), f.fromRational(1, 10))
        : cls === 1
          ? f.abs(z)
          : f.mul(f.abs(z), f.fromRational(5, 1));
    return sign < 0 ? f.neg(magnitude) : magnitude;
  }

  /** A strictly positive scalar over the reals; the pos property is a real order, so GF(p) cannot have it. */
  samplePositiveScalar(): T {
    const f = this.field;
    if (f instanceof GFpField) return randField(this.rng, f.p) as T;
    return f.add(f.abs(this.norm()), f.fromRational(5, 100));
  }
}

/** The scalar value of a sampled object. */
export function scalarVal<T>(v: T): Val<T> {
  return scalar(v);
}

/** Multiplies a matrix by a scalar. */
export function scaleMat<T>(f: Field<T>, s: T, m: Mat<T>): Mat<T> {
  return matScale(f, s, m);
}
