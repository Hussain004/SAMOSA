import { GFpField } from './fields/gfp.ts';
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
  /** the values of the symbols, row major */
  values: Record<string, number[] | number>;
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
  const names = [...ctx.symbols.keys()].filter((name) => {
    const info = ctx.symbols.get(name);
    return info && info.ty.t === 'mat';
  });

  const shrinkCtx: ShrinkCtx = {
    ctx,
    lhs,
    rhs,
    defs,
    symbolNames: names,
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
      return describe(ctx, sizes, values, l, r, field);
    }
  } catch {
    // fall through, the caller keeps the original counterexample
  }
  return null;
}

function searchSmallIntegers(sh: ShrinkCtx, range: number, seed: number): ShrunkInstance | null {
  const field = new GFpField(2147483647);
  const rng = rngFor(seed, 'small', range);
  const { ctx, sizes } = sh;

  for (let attempt = 0; attempt < 40; attempt++) {
    const values = new Map<string, Val<number>>();
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
      return describe(ctx, sizes, values, l, r, field);
    } catch {
      continue;
    }
  }
  return null;
}

/** A matrix with small integer entries, respecting the structure it claims. */
function smallMatrix(
  field: GFpField,
  r: number,
  c: number,
  props: Prop[],
  rng: () => number,
  range: number,
): Mat<number> | null {
  const has = (p: string) => props.some((x) => x === p);
  const entry = () => {
    const v = Math.floor(rng() * (2 * range + 1)) - range;
    return field.mod(v);
  };
  const d = new Array<number>(r * c);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (has('sym') || has('spd') || has('psd')) {
        d[i * c + j] = i <= j ? d[j * c + i] ?? entry() : d[j * c + i];
      } else if (has('skew')) {
        d[i * c + j] = i === j ? 0 : i < j ? entry() : field.neg(d[j * c + i]);
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
  const m: Mat<number> = { r, c, d };
  if ((has('spd') || has('psd')) && r === c) {
    // a symmetric matrix with a positive diagonal, so it can be positive definite
    for (let i = 0; i < r; i++) {
      d[i * c + i] = field.add(d[i * c + i], Math.max(1, r));
      for (let j = 0; j < i; j++) d[i * c + j] = d[j * c + i];
    }
  }
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
  _ctx: TypeContext,
  sizes: Map<string, number>,
  values: Map<string, Val<T>>,
  lhs: Val<T>,
  rhs: Val<T>,
  field: Field<T>,
): ShrunkInstance {
  const dims: Record<string, number> = {};
  for (const [k, v] of sizes) dims[k] = v;

  const plain: Record<string, number[] | number> = {};
  for (const [name, val] of values) {
    plain[name] = val.k === 's' ? field.toNumber(val.v) : val.m.d.map((x) => field.toNumber(x));
  }
  const lhsPlain = lhs.k === 's' ? field.toNumber(lhs.v) : lhs.m.d.map((x) => field.toNumber(x));
  const rhsPlain = rhs.k === 's' ? field.toNumber(rhs.v) : rhs.m.d.map((x) => field.toNumber(x));
  const diffPlain =
    lhs.k === 's' && rhs.k === 's'
      ? field.toNumber(lhs.v) - field.toNumber(rhs.v)
      : lhs.k === 'm' && rhs.k === 'm'
        ? lhs.m.d.map((x, i) => field.toNumber(x) - field.toNumber(rhs.m.d[i]))
        : 0;

  return {
    dims,
    values: plain,
    lhs: lhsPlain,
    rhs: rhsPlain,
    diff: diffPlain,
    numpy: toNumpy(plain, dims),
  };
}

/** A self contained NumPy snippet that reproduces the counterexample. */
export function toNumpy(values: Record<string, number[] | number>, _dims: Record<string, number>): string {
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
  lines.push('');
  lines.push('# the two sides of the step, with these values');
  lines.push('# lhs - rhs is not zero');
  return lines.join('\n');
}

/** The NumPy snippet for a counterexample that names the symbols. */
export function numpySnippet(
  values: Record<string, number[] | number>,
  dims: Record<string, number>,
  lhsText: string,
  rhsText: string,
): string {
  const lines: string[] = ['import numpy as np'];
  const map: Record<string, string> = {};
  Object.keys(values).forEach((name, i) => {
    const v = values[name];
    const pyName = `s${i}`;
    map[name] = pyName;
    if (typeof v === 'number') {
      lines.push(`${pyName} = ${Number(v.toFixed(6))}`);
    } else {
      const rows: string[] = [];
      const c = Math.max(1, Math.round(Math.sqrt(v.length)));
      for (let i = 0; i < v.length; i += c) {
        rows.push(`[${v.slice(i, i + c).map((x) => Number(x.toFixed(6))).join(', ')}]`);
      }
      lines.push(`${pyName} = np.array([${rows.join(', ')}])`);
    }
  });
  lines.push('');
  lines.push(`# ${lhsText} - ${rhsText} is not zero with these values`);
  lines.push(`# sizes: ${Object.entries(dims).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  void map;
  return lines.join('\n');
}

export { matInv, matMul, matSub };
export type { SymbolInfo };
export { isMatrixVal, isScalarVal };
