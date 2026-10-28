import type { Field } from './fields/types.ts';

/**
 * Dense linear algebra, generic over the field.
 *
 * Sizes are at most 8 by 8, so plain O(n^3) code is fast enough. There is no
 * BLAS and no WebAssembly anywhere in the core.
 */
/** A failure that comes from the domain, not from the maths being wrong. */
export class DomainError extends Error {}

export interface Mat<T> {
  r: number;
  c: number;
  /** row major data */
  d: T[];
}

export function mat<T>(r: number, c: number, fill: (i: number, j: number) => T): Mat<T> {
  const d: T[] = new Array(r * c);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) d[i * c + j] = fill(i, j);
  return { r, c, d };
}

export function zeros<T>(r: number, c: number, z: T): Mat<T> {
  return mat(r, c, () => z);
}

export function identity<T>(n: number, one: T, zero: T): Mat<T> {
  return mat(n, n, (i, j) => (i === j ? one : zero));
}

export function matAdd<T>(f: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  if (a.r !== b.r || a.c !== b.c) throw new Error(`shape mismatch in add: ${a.r}x${a.c} vs ${b.r}x${b.c}`);
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = f.add(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}

export function matSub<T>(f: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  if (a.r !== b.r || a.c !== b.c) throw new Error(`shape mismatch in sub: ${a.r}x${a.c} vs ${b.r}x${b.c}`);
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = f.sub(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}

export function matScale<T>(f: Field<T>, s: T, a: Mat<T>): Mat<T> {
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = f.mul(s, a.d[i]);
  return { r: a.r, c: a.c, d };
}

export function matMul<T>(f: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  if (a.c !== b.r) throw new Error(`shape mismatch in mul: ${a.r}x${a.c} times ${b.r}x${b.c}`);
  const out = new Array<T>(a.r * b.c).fill(f.zero);
  for (let i = 0; i < a.r; i++) {
    for (let k = 0; k < a.c; k++) {
      const aik = a.d[i * a.c + k];
      if (f.isZero(aik)) continue;
      for (let j = 0; j < b.c; j++) {
        out[i * b.c + j] = f.add(out[i * b.c + j], f.mul(aik, b.d[k * b.c + j]));
      }
    }
  }
  return { r: a.r, c: b.c, d: out };
}

export function transpose<T>(a: Mat<T>): Mat<T> {
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < a.r; i++) for (let j = 0; j < a.c; j++) d[j * a.r + i] = a.d[i * a.c + j];
  return { r: a.c, c: a.r, d };
}

export function trace<T>(f: Field<T>, a: Mat<T>): T {
  if (a.r !== a.c) throw new Error('trace of a non square matrix');
  let s = f.zero;
  for (let i = 0; i < a.r; i++) s = f.add(s, a.d[i * a.c + i]);
  return s;
}

export function matTrace<T>(f: Field<T>, a: Mat<T>): T {
  return trace(f, a);
}

/** Gauss-Jordan inversion. Throws when the matrix is singular. */
export function matInv<T>(f: Field<T>, a: Mat<T>): Mat<T> {
  const n = a.r;
  if (n !== a.c) throw new DomainError('inverse of a non square matrix');
  const m = mat(n, 2 * n, (i, j) => (j < n ? a.d[i * n + j] : i === j - n ? f.one : f.zero));
  for (let c = 0; c < n; c++) {
    let pivot = -1;
    for (let r = c; r < n; r++) {
      if (!f.isZero(m.d[r * 2 * n + c])) {
        pivot = r;
        break;
      }
    }
    if (pivot < 0) throw new DomainError('singular matrix');
    if (pivot !== c) {
      for (let j = 0; j < 2 * n; j++) {
        const tmp = m.d[c * 2 * n + j];
        m.d[c * 2 * n + j] = m.d[pivot * 2 * n + j];
        m.d[pivot * 2 * n + j] = tmp;
      }
    }
    const piv = m.d[c * 2 * n + c];
    const inv = f.inv(piv);
    for (let j = 0; j < 2 * n; j++) m.d[c * 2 * n + j] = f.mul(m.d[c * 2 * n + j], inv);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const factor = m.d[r * 2 * n + c];
      if (f.isZero(factor)) continue;
      for (let j = 0; j < 2 * n; j++) {
        m.d[r * 2 * n + j] = f.sub(m.d[r * 2 * n + j], f.mul(factor, m.d[c * 2 * n + j]));
      }
    }
  }
  return mat(n, n, (i, j) => m.d[i * 2 * n + n + j]);
}

/** Determinant by LU with partial pivoting. */
export function matDet<T>(f: Field<T>, a: Mat<T>): T {
  const n = a.r;
  if (n !== a.c) throw new DomainError('determinant of a non square matrix');
  const m = a.d.slice();
  let det = f.one;
  for (let c = 0; c < n; c++) {
    // The pivot is the entry of largest magnitude where the field can say
    // what magnitude is. Over GF(p) it cannot (abs is not defined there), so
    // any nonzero pivot is exact: pick the first one.
    let pivot = -1;
    let best: T | null = null;
    for (let r = c; r < n; r++) {
      const v = m[r * n + c];
      if (f.isZero(v)) continue;
      if (pivot === -1) {
        pivot = r;
        try {
          best = f.abs(v);
        } catch {
          best = null;
        }
        continue;
      }
      if (best === null) continue;
      try {
        const mag = f.abs(v);
        if (f.cmp(mag, best) > 0) {
          best = mag;
          pivot = r;
        }
      } catch {
        break;
      }
    }
    if (pivot === -1) return f.zero;
    if (pivot !== c) {
      for (let j = 0; j < n; j++) {
        const tmp = m[c * n + j];
        m[c * n + j] = m[pivot * n + j];
        m[pivot * n + j] = tmp;
      }
      det = f.neg(det);
    }
    det = f.mul(det, m[c * n + c]);
    for (let r = c + 1; r < n; r++) {
      const factor = f.div(m[r * n + c], m[c * n + c]);
      for (let j = c; j < n; j++) {
        m[r * n + j] = f.sub(m[r * n + j], f.mul(factor, m[c * n + j]));
      }
    }
  }
  return det;
}

/** Solve A X = B by Gauss-Jordan. */
export function matSolve<T>(f: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  return matMul(f, matInv(f, a), b);
}

export function kron<T>(f: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  const r = a.r * b.r;
  const c = a.c * b.c;
  const d = new Array<T>(r * c);
  for (let i = 0; i < a.r; i++) {
    for (let j = 0; j < a.c; j++) {
      for (let p = 0; p < b.r; p++) {
        for (let q = 0; q < b.c; q++) {
          d[(i * b.r + p) * c + (j * b.c + q)] = f.mul(a.d[i * a.c + j], b.d[p * b.c + q]);
        }
      }
    }
  }
  return { r, c, d };
}

export function hadamard<T>(f: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  if (a.r !== b.r || a.c !== b.c) throw new Error('shape mismatch in hadamard');
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = f.mul(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}

/** Frobenius inner product, summed over every entry. */
export function inner<T>(f: Field<T>, a: Mat<T>, b: Mat<T>): T {
  if (a.r !== b.r || a.c !== b.c) throw new Error('shape mismatch in inner');
  let s = f.zero;
  for (let i = 0; i < a.d.length; i++) s = f.add(s, f.mul(a.d[i], b.d[i]));
  return s;
}

/** Sum of squares, the squared Frobenius norm. */
export function norm2<T>(f: Field<T>, a: Mat<T>): T {
  return inner(f, a, a);
}

export function vec<T>(a: Mat<T>): Mat<T> {
  return { r: a.r * a.c, c: 1, d: a.d.slice() };
}

export function diag<T>(f: Field<T>, v: Mat<T>): Mat<T> {
  const n = v.r * v.c;
  const d = new Array<T>(n * n).fill(f.zero);
  for (let i = 0; i < n; i++) d[i * n + i] = v.d[i];
  return { r: n, c: n, d };
}

/** Assemble a block matrix from a grid of blocks. */
export function block<T>(rows: Mat<T>[][]): Mat<T> {
  const R = rows.length;
  const C = rows[0].length;
  const r = rows.reduce((s, row) => s + row[0].r, 0);
  const c = rows.reduce((s, row) => s + row[0].c, 0);
  const d = new Array<T>(r * c);
  let oi = 0;
  for (let i = 0; i < R; i++) {
    let oj = 0;
    for (let j = 0; j < C; j++) {
      const blk = rows[i][j];
      for (let bi = 0; bi < blk.r; bi++) {
        for (let bj = 0; bj < blk.c; bj++) {
          d[(oi + bi) * c + (oj + bj)] = blk.d[bi * blk.c + bj];
        }
      }
      oj += blk.c;
    }
    oi += rows[i][0].r;
  }
  return { r, c, d };
}

/** Matrix power for a non negative integer exponent. */
export function matPow<T>(f: Field<T>, a: Mat<T>, k: number): Mat<T> {
  if (k === 0) return identity<T>(a.r, f.one, f.zero);
  let result = identity<T>(a.r, f.one, f.zero);
  let base = a;
  let e = k;
  while (e > 0) {
    if (e & 1) result = matMul(f, result, base);
    e >>= 1;
    if (e > 0) base = matMul(f, base, base);
  }
  return result;
}

/** Adjugate (classical adjoint) of a square matrix. */
export function matAdj<T>(f: Field<T>, a: Mat<T>): Mat<T> {
  const n = a.r;
  if (n !== a.c) throw new DomainError('adjoint of a non square matrix');
  if (n === 1) return { r: 1, c: 1, d: [f.one] };
  const cofactors = mat(n, n, (i, j) => {
    const minor = mat(n - 1, n - 1, (r, c) => a.d[(r < i ? r : r + 1) * n + (c < j ? c : c + 1)]);
    const sign = (i + j) % 2 === 0 ? f.one : f.neg(f.one);
    return f.mul(sign, matDet(f, minor));
  });
  return transpose(cofactors);
}

/** Solve a square system by Cramer's rule, for the small affine implication case. */
export function matSolveCramer<T>(f: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  const n = a.r;
  const detA = matDet(f, a);
  if (f.isZero(detA)) throw new DomainError('singular system');
  const out = mat(n, b.c, (i, j) => {
    const m = mat(n, n, (r, c) => (c === i ? b.d[r * b.c + j] : a.d[r * n + c]));
    return f.div(matDet(f, m), detA);
  });
  return out;
}
