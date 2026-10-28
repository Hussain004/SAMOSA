import Decimal from 'decimal.js';
import { GFpField } from './fields/gfp.ts';
import { DecField } from './fields/dec.ts';
import { type Mat } from './linalg.ts';
import { evalNode, makeEnv } from './evaluate.ts';
import { Sampler } from './sample.ts';
import { rngFor } from './prng.ts';
import type { Field } from './fields/types.ts';
import type { Node } from './ir.ts';
import { type Val } from './value.ts';
import type { TypeContext } from './types.ts';
import type { Prop } from './decl.ts';
import { dimSizeOf } from './types.ts';
import { NUMPY_PRELUDE, numpyExpression, numpyNames, symbolsOf } from './numpy.ts';

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
  /** the rows and columns of every value, so a reader can draw the matrix */
  shapes: Record<string, [number, number]>;
  lhsShape: [number, number];
  rhsShape: [number, number];
  diffShape: [number, number];
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
    return info && !defs.has(name) && (info.ty.t === 'mat' || info.ty.t === 'scalar');
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
  const scalarRng = rngFor(seed, 'scalar');
  for (const name of names) {
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.ty.t === 'scalar') {
      // a free scalar is an input too, and leaving it out makes the search
      // fail on every derivation that uses one
      const n = Math.floor(scalarRng() * 5) - 2;
      values.set(name, { k: 's', v: field.fromRational(n, 1) });
      continue;
    }
    if (info.ty.t !== 'mat') continue;
    const r = dimSizeOf(ctx, info.ty.r, sizes);
    const c = dimSizeOf(ctx, info.ty.c, sizes);
    const val = sampler.sample({ name, r, c, props: info.props, variety: 0 });
    if (val && val.k === 'm') values.set(name, val);
  }
  for (const [name, value] of values.entries()) env.values.set(name, value);
  try {
    const l = evalNode(field, lhs, env);
    const r = evalNode(field, rhs, env);
    if (!equal(field, l, r)) {
      return describe(ctx, sizes, values, derivedValues(field, env, defs), (name) => ctx.symbols.get(name)?.props ?? [], lhs, rhs, defs, l, r, field, true);
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
      if (!info) continue;
      if (info.ty.t === 'scalar') {
        const n = Math.floor(rng() * (2 * range + 1)) - range;
        values.set(name, { k: 's', v: field.fromRational(n, 1) });
        continue;
      }
      if (info.ty.t !== 'mat') continue;
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
      return describe(ctx, sizes, values, derivedValues(field, env, sh.defs), sh.propOf, sh.lhs, sh.rhs, sh.defs, l, r, field, false);
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
  propOf: (name: string) => Prop[],
  lhsNode: Node,
  rhsNode: Node,
  defs: Map<string, Node>,
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
    // the identity is not a free value, so it is not one of the inputs
    if (propOf(name).includes('ident')) continue;
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

  // The shapes a reader needs to draw the values as matrices. A symbol that
  // the derivation defines has a type as well, so it is looked up the same way.
  const shapes: Record<string, [number, number]> = {};
  for (const name of Object.keys(plain)) shapes[name] = shapeOf(ctx, name, sizes);
  for (const name of Object.keys(derivedPlain)) shapes[name] = shapeOf(ctx, name, sizes);
  const valueShape = (val: Val<T>): [number, number] => (val.k === 's' ? [1, 1] : [val.m.r, val.m.c]);

  return {
    dims,
    values: plain,
    derived: derivedPlain,
    lhs: lhsPlain,
    rhs: rhsPlain,
    diff: diffPlain,
    shapes,
    lhsShape: valueShape(lhs),
    rhsShape: valueShape(rhs),
    diffShape: lhs.k === 'm' && rhs.k === 'm' ? [lhs.m.r, lhs.m.c] : [1, 1],
    numpy: toNumpy(ctx, sizes, lhsNode, rhsNode, defs, plain),
  };
}

/**
 * A self contained NumPy snippet that reproduces the counterexample.
 *
 * The snippet names the symbols the way a person can type them, uses the
 * declared shapes, computes the symbols the derivation defines, and prints
 * the difference of the two sides. Run it, and it shows why the step fails.
 */
export function toNumpy(
  ctx: TypeContext,
  sizes: Map<string, number>,
  lhsNode: Node,
  rhsNode: Node,
  defs: Map<string, Node>,
  values: Record<string, number[] | number>,
): string {
  const symbols = new Set<string>();
  for (const name of symbolsOf(lhsNode)) symbols.add(name);
  for (const name of symbolsOf(rhsNode)) symbols.add(name);
  for (const name of defs.keys()) symbols.add(name);
  // a definition is written with other symbols, and they are inputs too
  for (const node of defs.values()) {
    for (const name of symbolsOf(node)) symbols.add(name);
  }
  const names = numpyNames([...symbols]);

  const lines: string[] = [NUMPY_PRELUDE, ''];
  lines.push('# the values that break the step');
  for (const symbol of names.order) {
    if (defs.has(symbol)) continue;
    const value = values[symbol];
    if (value === undefined) {
      // the identity is not a free value, it is built
      const info = ctx.symbols.get(symbol);
      if (info && info.props.includes('ident')) {
        const size = info.ty.t === 'mat' ? dimSizeOf(ctx, info.ty.r, sizes) : 1;
        lines.push(`${names.map.get(symbol)} = np.eye(${size}, dtype=object)`);
      }
      continue;
    }
    const shape = shapeOf(ctx, symbol, sizes);
    lines.push(`${names.map.get(symbol)} = ${literal(value, shape)}`);
  }

  const defined = [...defs.keys()].filter((name) => names.map.has(name));
  if (defined.length) {
    lines.push('');
    lines.push('# the symbols the derivation defines, computed from the values above');
    for (const name of defined) {
      const node = defs.get(name);
      if (!node) continue;
      lines.push(`${names.map.get(name)} = ${numpyExpression(node, ctx, names)}`);
    }
  }

  lines.push('');
  lines.push('# the two sides of the step, with these values');
  lines.push(`lhs = ${numpyExpression(lhsNode, ctx, names)}`);
  lines.push(`rhs = ${numpyExpression(rhsNode, ctx, names)}`);
  lines.push('print(lhs - rhs)');
  lines.push('');
  lines.push('# the values above are the ones SAMOSA found; the two sides differ with them');
  return lines.join('\n');
}

/** The shape of a symbol, in the sizes the instance was found at. */
function shapeOf(ctx: TypeContext, symbol: string, sizes: Map<string, number>): [number, number] {
  const info = ctx.symbols.get(symbol);
  if (!info || info.ty.t !== 'mat') return [1, 1];
  const r = dimSizeOf(ctx, info.ty.r, sizes);
  const c = dimSizeOf(ctx, info.ty.c, sizes);
  return [r, c];
}

/** A value as Python, with the shape it has. */
function literal(value: number[] | number, shape: [number, number]): string {
  if (typeof value === 'number') return `Fraction('${value}')`;
  const [rows, cols] = shape;
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    const row = value
      .slice(i * cols, (i + 1) * cols)
      .map((x) => `Fraction('${x}')`);
    out.push(`[${row.join(', ')}]`);
  }
  return `np.array([${out.join(', ')}], dtype=object)`;
}
