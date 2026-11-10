/**
 * The plan: which mode a step gets, and the size of the instance to draw.
 */
import type { Node } from '../ir.ts';
import type { Step } from './types.ts';
import type { TypeContext } from '../types.ts';
import { sampledNames } from './shared.ts';

export type Plan = 'exact' | 'numeric' | 'unchecked';


export function planMode(step: Step, ctx: TypeContext, defs: Map<string, Node>): Plan {
  const nodes: Node[] = [];
  if (step.lhs) nodes.push(step.lhs);
  if (step.rhs) nodes.push(step.rhs);
  for (const node of nodes) {
    if (!isRational(node, ctx, defs, new Set())) return 'numeric';
  }
  return 'exact';
}


export function isRational(node: Node, ctx: TypeContext, defs: Map<string, Node>, seen: Set<string>): boolean {
  switch (node.k) {
    case 'num':
      return true;
    case 'sym': {
      const def = defs.get(node.name);
      if (def) {
        if (seen.has(node.name)) return true;
        seen.add(node.name);
        return isRational(def, ctx, defs, seen);
      }
      const info = ctx.symbols.get(node.name);
      if (info && info.ty.t === 'rv') return false;
      return true;
    }
    case 'op': {
      // |x| and the matrix root need an order or positivity, which GF(p) has
      // not, so they force numeric mode (review 3.2)
      if (node.op === 'abs' || node.op === 'sqrtm') return false;
      // an unsquared norm needs an order too, and 50 digits, so numeric mode
      if (node.op === 'norm' || node.op === 'normF') return false;
      // a fractional power is a root, which GF(p) has not either
      if (node.op === 'pow' && node.args[1]?.k === 'num' && node.args[1].value.d !== 1) return false;
      return node.args.every((a) => isRational(a, ctx, defs, seen));
    }
    case 'call': {
      const def = defs.get(node.fn);
      if (def) return isRational(def, ctx, defs, seen);
      return node.fn === 'det' || node.fn === 'tr' || node.fn === 'trace' || node.fn === 'var' || node.fn === 'cov';
    }
    case 'deriv':
      return isRational(node.f, ctx, defs, seen);
    case 'expect':
      // the quadrature is exact, so an expectation does not force numeric mode
      return true;
    case 'bigop':
      return (
        (!node.lo || isRational(node.lo, ctx, defs, seen)) &&
        (!node.hi || isRational(node.hi, ctx, defs, seen)) &&
        isRational(node.body, ctx, defs, seen)
      );
    case 'block':
      return node.rows.every((row) => row.every((cell) => isRational(cell, ctx, defs, seen)));
    case 'piecewise':
      // an order is needed on the conditions, so a piecewise row is
      // checked over the reals only
      return false;
    case 'cond':
      return isRational(node.lhs, ctx, defs, seen) && isRational(node.rhs, ctx, defs, seen);
    case 'raw':
      return false;
  }
}

// ------------------------------------------------------------ exact mode


export function cornerCount(step: Step, ctx: TypeContext, defs: Map<string, Node>): number {
  let k = 0;
  for (const name of sampledNames(step, defs)) {
    const info = ctx.symbols.get(name);
    if (!info || info.ty.t !== 'mat') continue;
    const has = (target: string) => info.props.some((x) => typeof x === 'string' && x === target);
    if (has('orth') || has('idem') || has('proj') || has('rot')) k++;
  }
  return k;
}


export function sizeSettings(dimVars: string[]): Map<string, number>[] {
  if (dimVars.length === 0) return [new Map()];
  if (dimVars.length === 1) {
    return [2, 3, 4].map((n) => new Map([[dimVars[0], n]]));
  }
  if (dimVars.length === 2) {
    const [a, b] = dimVars;
    return [
      new Map([[a, 3], [b, 2]]),
      new Map([[a, 2], [b, 3]]),
      new Map([[a, 4], [b, 3]]),
    ];
  }
  const cycle = [2, 3, 4, 5];
  const out: Map<string, number>[] = [];
  for (let shift = 0; shift < 3; shift++) {
    const m = new Map<string, number>();
    dimVars.forEach((v, i) => m.set(v, cycle[(i + shift) % cycle.length]));
    out.push(m);
  }
  return out;
}
