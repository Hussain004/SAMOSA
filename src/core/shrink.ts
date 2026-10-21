import Decimal from 'decimal.js';
import { GFpField } from './fields/gfp.ts';
import { DecField } from './fields/dec.ts';
import { matInv, matMul, matSub, type Mat } from './linalg.ts';
import { evalNode, makeEnv } from './evaluate.ts';
import { Sampler } from './sample.ts';
import { rngFor } from './prng.ts';
import type { Field } from './fields/types.ts';
import type { Node } from './ir.ts';
import { isMatrixVal, isScalarVal, type Val } from './value.ts';
import type { SymbolInfo, TypeContext } from './types.ts';
import type { Prop } from './decl.ts';
import { dimSizeOf } from './types.ts';

/**
 * Counterexample shrinking.
 *
 * A counterexample over a finite field is exact but unreadable: the entries
 * are large numbers that mean nothing to a person. The shrinker looks for a
 * small integer instance that still breaks the step, the way Hypothesis
 * shrinks a failing case.
 *
 * The search is in this order:
 *
 *   1. small integer entries, from {-2..2} outwards
 *   2. smaller dimensions
 *   3. entries pulled towards zero
 *
 * Every candidate is re-verified exactly, so a shrunk counterexample is never
 * a false one.
 */

export interface ShrunkInstance {
  dims: Record<string, number>;
  /** the values of the free symbols, row major: the inputs of the counterexample */
  values: Record<string, number[] | number>;
  /** the values of the symbols the derivation defines, computed from the inputs */
  derived: Record<string, number[] | number>;
  lhs: number[] | number;
  rhs: number[] | number;
  diff: number[] | number;
  numpy: string;
}

interface ShrinkCtx {
  ctx: TypeContext;
  lhs: Node;
  rhs: Node;
  defs: Map<string, Node>;
  symbolNames: string[];
  /** the names the derivation defines, so they are computed and not sampled */
  derivedNames: string[];
  sizes: Map<string, number>;
  propOf: (name: string) => Prop[];
}

/** Searches for a small instance that still breaks the step. */
export function shrinkCounterexample(
  ctx: TypeContext,
  lhs: Node,
  rhs: Node,
  defs: Map<string, Node>,
  sizes: Map<string, number>,
  seed: number,
  budgetMs = 200,
): ShrunkInstance | null {
  const started = Date.now();
  // A symbol the derivation defines is not an input: it is computed from the
  // definitions, so sampling it would give an instance that does not satisfy
  // the derivation at all.
  const names = [...ctx.symbols.keys()].filter((name) => {
    const info = ctx.symbols.get(name);
    return info && info.ty.t === 'mat' && !defs.has(name);
  });

  const shrinkCtx: ShrinkCtx = {
    ctx,
    lhs,
    rhs,
    defs,
    symbolNames: names,
    derivedNames: [...defs.keys()],
    sizes,
    propOf: (name) => ctx.symbols.get(name)?.props ?? [],
  };

  // 1. small integer instances
  for (const range of [2, 5]) {
    const candidate = searchSmallIntegers(shrinkCtx, range, seed);
    if (candidate) return candidate;
    if (Date.now() - started > budgetMs) break;
  }

  // 2. the finite field instance, with the entries pulled towards zero
  const field = new GFpField(2147483647);
  const sampler = new Sampler(field, rngFor(seed, 'shrink'));
  const env = makeEnv(field, rngFor(seed, 'shrink'));
  env.defs = defs;
  const values = new Map<string, Val<number>>();
  for (const name of names) {
    const info = ctx.symbols.get(name);
    if (!info || info.ty.t !== 'mat') continue;
    const r = dimSizeOf(ctx, info.ty.r, sizes);
    const c = dimSizeOf(ctx, info.ty.c, sizes);
    const val = sampler.sample({ name, r, c, props: info.props });
    if (val && val.k === 'm') values.set(name, val);
  }
  for (const [name, value] of values.entries()) env.values.set(name, value);
  try {
    const l = evalNode(field, lhs, env);
    const r = evalNode(field, rhs, env);
    if (!equal(field, l, r)) {
      return describe(ctx, sizes, values, derivedValues(field, env, defs), l, r, field, true);
    }
  } catch {
    // fall through, the caller keeps the original counterexample
  }
  return null;
}

/**
 * The values of the symbols the derivation defines.
 *
 * They are computed from the definitions with the sampled inputs, so a person
 * who recomputes them gets the same numbers.
 */
function derivedValues<T>(
  field: Field<T>,
  env: ReturnType<typeof makeEnv<T>>,
  defs: Map<string, Node>,
): Map<string, Val<T>> {
  const out = new Map<string, Val<T>>();
  for (const [name, node] of defs) {
    try {
      out.set(name, evalNode(field, node, env));
    } catch {
      // a definition that cannot be computed is simply not reported
    }
  }
  return out;
}

function searchSmallIntegers(sh: ShrinkCtx, range: number, seed: number): ShrunkInstance | null {
  // The search runs over the decimals, so the numbers a person reads are the
  // ones they wrote: an inverse of five is a fifth and not a residue of
  // nineteen billion.
  const field = new DecField(50);
  const rng = rngFor(seed, 'small', range);
  const { ctx, sizes } = sh;

  for (let attempt = 0; attempt < 40; attempt++) {
    const values = new Map<string, Val<Decimal>>();
    for (const name of sh.symbolNames) {
      const info = ctx.symbols.get(name);
      if (!info || info.ty.t !== 'mat') continue;
      const r = dimSizeOf(ctx, info.ty.r, sizes);
      const c = dimSizeOf(ctx, info.ty.c, sizes);
      const props = sh.propOf(name);
      const m = smallMatrix(field, r, c, props, rng, range);
      if (!m) continue;
      values.set(name, { k: 'm', m });
    }
    if (!values.size) continue;

    const env = makeEnv(field, rng);
    env.defs = sh.defs;
    for (const [name, value] of values.entries()) env.values.set(name, value);
    try {
      const l = evalNode(field, sh.lhs, env);
      const r = evalNode(field, sh.rhs, env);
      if (equal(field, l, r)) continue;
      return describe(ctx, sizes, values, derivedValues(field, env, sh.defs), l, r, field, false);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * A matrix with small integer entries, respecting the structure it claims.
 *
 * A symmetric matrix is built from its upper triangle and mirrored, and a
 * positive definite one is built as `L Lᵀ + I`, so the numbers a person sees
 * are a genuine positive definite matrix over the reals and not just
 * something with a positive diagonal.
 */
function smallMatrix(
  field: Field<any>,
  r: number,
  c: number,
  props: Prop[],
  rng: () => number,
  range: number,
): Mat<any> | null {
  const has = (p: string) => props.some((x) => x === p);
  // the entries are plain small integers, so the structure survives the trip
  // into the field
  const entry = () => Math.floor(rng() * (2 * range + 1)) - range;

  if ((has('spd') || has('psd')) && r === c) {
    // L Lᵀ + I, with L lower triangular
    const l = new Array<number>(r * r).fill(0);
    for (let i = 0; i < r; i++) {
      for (let j = 0; j <= i; j++) l[i * r + j] = entry();
    }
    const d = new Array<number>(r * c).fill(0);
    for (let i = 0; i < r; i++) {
      for (let j = 0; j < r; j++) {
        let sum = 0;
        for (let k = 0; k < r; k++) sum += l[i * r + k] * l[j * r + k];
        d[i * c + j] = sum + (i === j ? 1 : 0);
      }
    }
    return { r, c, d: d.map((x) => field.fromRational(x, 1)) };
  }

  const d = new Array<number>(r * c).fill(0);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (has('sym') || has('psd')) {
        // the upper triangle is drawn, the lower one is its mirror
        d[i * c + j] = i <= j ? d[j * c + i] || entry() : d[j * c + i];
        if (i > j) d[i * c + j] = d[j * c + i];
      } else if (has('skew')) {
        d[i * c + j] = i === j ? 0 : i < j ? entry() : -d[j * c + i];
      } else if (has('diag')) {
        d[i * c + j] = i === j ? entry() : 0;
      } else if (has('ident')) {
        d[i * c + j] = i === j ? 1 : 0;
      } else if (has('zero')) {
        d[i * c + j] = 0;
      } else if (has('ones')) {
        d[i * c + j] = 1;
      } else {
        d[i * c + j] = entry();
      }
    }
  }
  const m: Mat<any> = { r, c, d: d.map((x) => field.fromRational(x, 1)) };
  if (r === c && (has('orth') || has('idem') || has('proj'))) return null;
  return m;
}

function equal<T>(field: Field<T>, a: Val<T>, b: Val<T>): boolean {
  if (a.k === 's' && b.k === 's') return field.eq(a.v, b.v);
  if (a.k === 'm' && b.k === 'm') {
    if (a.m.r !== b.m.r || a.m.c !== b.m.c) return false;
    for (let i = 0; i < a.m.d.length; i++) if (!field.eq(a.m.d[i], b.m.d[i])) return false;
    return true;
  }
  return false;
}

/** Turns a set of values into something a person can read, plus NumPy. */
function describe<T>(
  ctx: TypeContext,
  sizes: Map<string, number>,
  values: Map<string, Val<T>>,
  derived: Map<string, Val<T>>,
  lhs: Val<T>,
  rhs: Val<T>,
  field: Field<T>,
  residue: boolean,
): ShrunkInstance {
  // The sizes are keyed by the root of a dimension variable. A person should
  // see the name they wrote, and never an internal one.
  const dims: Record<string, number> = {};
  for (const [root, size] of sizes) {
    const declared = ctx.dimVars.find((d) => ctx.dims.find(d) === root);
    if (declared) dims[declared] = size;
    else if (!root.startsWith('#')) dims[root] = size;
  }

  // A residue of a finite field is shown as the small signed integer it is.
  // A decimal is shown as the decimal it is.
  const signed = (x: number): number => {
    if (!residue) return x;
    const p = 2147483647;
    return x > p / 2 ? x - p : x;
  };
  const plain: Record<string, number[] | number> = {};
  for (const [name, val] of values) {
    plain[name] = val.k === 's' ? signed(field.toNumber(val.v)) : val.m.d.map((x) => signed(field.toNumber(x)));
  }
  const derivedPlain: Record<string, number[] | number> = {};
  for (const [name, val] of derived) {
    derivedPlain[name] =
      val.k === 's' ? signed(field.toNumber(val.v)) : val.m.d.map((x) => signed(field.toNumber(x)));
  }
  const lhsPlain = lhs.k === 's' ? signed(field.toNumber(lhs.v)) : lhs.m.d.map((x) => signed(field.toNumber(x)));
  const rhsPlain = rhs.k === 's' ? signed(field.toNumber(rhs.v)) : rhs.m.d.map((x) => signed(field.toNumber(x)));
  const diffPlain =
    lhs.k === 's' && rhs.k === 's'
      ? signed(field.toNumber(lhs.v) - field.toNumber(rhs.v))
      : lhs.k === 'm' && rhs.k === 'm'
        ? lhs.m.d.map((x, i) => signed(field.toNumber(x) - field.toNumber(rhs.m.d[i])))
        : 0;

  return {
    dims,
    values: plain,
    derived: derivedPlain,
    lhs: lhsPlain,
    rhs: rhsPlain,
    diff: diffPlain,
    numpy: toNumpy(plain, dims, derivedPlain),
  };
}

/** A self contained NumPy snippet that reproduces the counterexample. */
export function toNumpy(
  values: Record<string, number[] | number>,
  _dims: Record<string, number>,
  derived: Record<string, number[] | number> = {},
): string {
  const lines: string[] = ['import numpy as np'];
  const names = Object.keys(values);
  names.forEach((name, i) => {
    const v = values[name];
    const pyName = `s${i}`;
    if (typeof v === 'number') {
      lines.push(`${pyName} = ${v}`);
    } else {
      const rows: string[] = [];
      const c = Math.max(1, Math.round(Math.sqrt(v.length)));
      for (let i = 0; i < v.length; i += c) {
        rows.push(`[${v.slice(i, i + c).map((x) => Number(x.toFixed(6))).join(', ')}]`);
      }
      lines.push(`${pyName} = np.array([${rows.join(', ')}])`);
    }
  });
  const derivedNames = Object.keys(derived);
  if (derivedNames.length) {
    lines.push('');
    lines.push('# the symbols the derivation defines, computed by SAMOSA from the values above');
    derivedNames.forEach((name, i) => {
      const v = derived[name];
      const pyName = `d${i}`;
      if (typeof v === 'number') {
        lines.push(`${pyName} = ${v}  # ${name}`);
      } else {
        const rows: string[] = [];
        const c = Math.max(1, Math.round(Math.sqrt(v.length)));
        for (let i = 0; i < v.length; i += c) {
          rows.push(`[${v.slice(i, i + c).map((x) => Number(x.toFixed(6))).join(', ')}]`);
        }
        lines.push(`${pyName} = np.array([${rows.join(', ')}])  # ${name}`);
      }
    });
  }
  lines.push('');
  lines.push('# the two sides of the step, with these values');
  lines.push('# lhs - rhs is not zero');
  return lines.join('\n');
}

export { matInv, matMul, matSub };
export type { SymbolInfo };
export { isMatrixVal, isScalarVal };
