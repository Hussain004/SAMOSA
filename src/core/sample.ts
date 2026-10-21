import type { Field } from './fields/types.ts';
import { GFpField } from './fields/gfp.ts';
import {
  identity,
  matAdd,
  matInv,
  matMul,
  matSub,
  matTranspose,
  matScale,
  zeros,
  type Mat,
} from './linalg.ts';
import type { Prop } from './decl.ts';
import type { Rng } from './prng.ts';
import { scalar, type Val } from './value.ts';
import { randField } from './prng.ts';

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
}

export class Sampler<T> {
  constructor(
    readonly field: Field<T>,
    readonly rng: Rng,
  ) {}

  /** Samples one symbol. Returns null when the constraints cannot be met. */
  sample(spec: SampleSpec): Val<T> | null {
    const { r, c, props } = spec;
    const has = (p: string) => props.some((x) => (typeof x === 'string' ? x === p : false));

    if (has('ident')) return { k: 'm', m: identity<T>(r, this.field.one, this.field.zero) };
    if (has('zero')) return { k: 'm', m: zeros<T>(r, c, this.field.zero) };
    if (has('ones')) {
      return { k: 'm', m: this.mat(r, c, () => this.field.one) };
    }
    if (has('orth')) return { k: 'm', m: this.sampleOrthogonal(r) };
    if (has('idem') || has('proj')) return { k: 'm', m: this.sampleIdempotent(r, c) };
    if (has('unit')) return { k: 'm', m: this.sampleUnit(r, c) };
    if (has('stoch')) return { k: 'm', m: this.sampleStochastic(r, c) };
    if (has('diag')) return { k: 'm', m: this.sampleDiagonal(r, c) };
    if (has('triu')) return { k: 'm', m: this.sampleTriangular(r, c, true) };
    if (has('tril')) return { k: 'm', m: this.sampleTriangular(r, c, false) };
    if (has('skew')) return { k: 'm', m: this.sampleSkew(r, c) };
    if (has('sym') || has('spd') || has('psd')) return { k: 'm', m: this.sampleSymmetric(r, c) };
    return { k: 'm', m: this.sampleGeneral(r, c) };
  }

  private mat(r: number, c: number, f: (i: number, j: number) => T): Mat<T> {
    const d: T[] = new Array(r * c);
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) d[i * c + j] = f(i, j);
    return { r, c, d };
  }

  /** iid entries. */
  sampleGeneral(r: number, c: number): Mat<T> {
    const f = this.field;
    if (f instanceof GFpField) {
      return this.mat(r, c, () => randField(this.rng, f.p));
    }
    return this.mat(r, c, () => f.normal(this.rng));
  }

  /** The upper triangle is mirrored. */
  sampleSymmetric(r: number, c: number): Mat<T> {
    const f = this.field;
    const upper = this.mat(r, c, () => (f instanceof GFpField ? randField(this.rng, f.p) : f.normal(this.rng)));
    return this.mat(r, c, (i, j) => (i <= j ? upper.d[i * c + j] : upper.d[j * c + i]));
  }

  /** A diagonal matrix. */
  sampleDiagonal(r: number, c: number): Mat<T> {
    const f = this.field;
    return this.mat(r, c, (i, j) => (i === j ? (f instanceof GFpField ? randField(this.rng, f.p) : f.normal(this.rng)) : f.zero));
  }

  /** Upper or lower triangular. */
  sampleTriangular(r: number, c: number, upper: boolean): Mat<T> {
    const f = this.field;
    return this.mat(r, c, (i, j) => {
      if (i === j) return f instanceof GFpField ? randField(this.rng, f.p) : f.normal(this.rng);
      const inUpper = i < j;
      return inUpper === upper ? (f instanceof GFpField ? randField(this.rng, f.p) : f.normal(this.rng)) : f.zero;
    });
  }

  /** Skew symmetric: the transpose is the negative. */
  sampleSkew(r: number, c: number): Mat<T> {
    const f = this.field;
    const upper = this.mat(r, c, () => (f instanceof GFpField ? randField(this.rng, f.p) : f.normal(this.rng)));
    return this.mat(r, c, (i, j) => (i === j ? f.zero : i < j ? upper.d[i * c + j] : f.neg(upper.d[j * c + i])));
  }

  /**
   * An orthogonal matrix.
   *
   * Over a finite field the Cayley transform is exact: Q = (I - S)(I + S)^-1
   * with S skew gives Q^T Q = I as an identity, not as an approximation.
   */
  sampleOrthogonal(n: number): Mat<T> {
    const f = this.field;
    if (f instanceof GFpField) {
      const s = this.sampleSkew(n, n);
      const eye = identity<T>(n, f.one, f.zero);
      const plus = matAdd(f, eye, s);
      const minus = matSub(f, eye, s);
      const inv = matInv(f, plus);
      return matMul(f, minus, inv);
    }
    // over the reals: a QR factorisation with the sign fixed, so it is Haar
    const a = this.sampleGeneral(n, n);
    const q = this.qrHaar(a);
    return q;
  }

  /** Gram-Schmidt with the sign correction, which gives a Haar measure. */
  private qrHaar(a: Mat<T>): Mat<T> {
    const f = this.field;
    const n = a.r;
    const cols: Mat<T>[] = [];
    for (let j = 0; j < n; j++) {
      let v = zeros<T>(n, 1, f.zero);
      for (let i = 0; i < n; i++) v.d[i] = a.d[i * n + j];
      for (const q of cols) {
        const proj = q.d.reduce((acc, val, i) => acc + val * v.d[i], f.zero);
        for (let i = 0; i < n; i++) v.d[i] = f.sub(v.d[i], f.mul(proj, q.d[i]));
      }
      let norm = f.zero;
      for (let i = 0; i < n; i++) norm = f.add(norm, f.mul(v.d[i], v.d[i]));
      let normNum = Math.sqrt(f.toNumber(norm));
      if (normNum < 1e-9) normNum = 1;
      if (f.toNumber(v.d[n - 1]) < 0) normNum = -normNum;
      for (let i = 0; i < n; i++) v.d[i] = f.div(v.d[i], f.fromRational(Math.round(normNum * 1e6), 1e6));
      cols.push(v);
    }
    // assemble the columns
    return this.mat(n, n, (i, j) => cols[j].d[i]);
  }

  /** An idempotent matrix of rank r: A (B A)^-1 B. */
  sampleIdempotent(r: number, c: number): Mat<T> {
    const f = this.field;
    const k = Math.max(1, Math.min(r, c) - 1);
    const u = this.sampleGeneral(r, k);
    const v = this.sampleGeneral(c, k);
    // A = U V^T, then A (V U)^-1 V ... keep it simple: U (V^T U)^-1 V^T
    const vtu = matMul(f, matTranspose(v), u);
    const inv = matInv(f, vtu);
    const out = matMul(f, matMul(f, u, inv), matTranspose(v));
    return out;
  }

  /** A unit vector: a normalized Gaussian, or a stereographic point. */
  sampleUnit(r: number, c: number): Mat<T> {
    const f = this.field;
    if (f instanceof GFpField) {
      // stereographic: (2t, ||t||^2 - 1) / (||t||^2 + 1) on the unit sphere
      const t = this.sampleGeneral(c - 1, 1);
      let sq = f.zero;
      for (const x of t.d) sq = f.add(sq, f.mul(x, x));
      const den = f.add(sq, f.one);
      const inv = f.inv(den);
      return this.mat(r, c, (i, j) => {
        if (c === 1) return f.one;
        if (j === c - 1) return f.mul(f.sub(sq, f.one), inv);
        return f.mul(f.mul(f.fromRational(2, 1), t.d[i * t.c + j]), inv);
      });
    }
    const v = this.sampleGeneral(r, c);
    let norm = f.zero;
    for (const x of v.d) norm = f.add(norm, f.mul(x, x));
    const n = f.toNumber(norm);
    const s = Math.sqrt(n) || 1;
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

  /** A scalar drawn from the field. */
  sampleScalar(): T {
    const f = this.field;
    if (f instanceof GFpField) return randField(this.rng, f.p);
    return f.normal(this.rng);
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
