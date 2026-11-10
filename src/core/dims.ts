import type { Node } from './ir.ts';
import { fixedSize, type TypeContext } from './types.ts';

/**
 * The dimension variables a step uses.
 *
 * Kept in its own module so that the verdict engine and the repair engine
 * agree on them.
 */
export function collectDimVarsFor(
  ctx: TypeContext,
  lhs: Node | undefined,
  rhs: Node | undefined,
  defs: Map<string, Node>,
): string[] {
  const names = new Set<string>();
  const collect = (node: Node | undefined) => {
    if (!node) return;
    switch (node.k) {
      case 'sym':
        names.add(node.name);
        return;
      case 'op':
      case 'call':
        node.args.forEach(collect);
        return;
      case 'deriv':
        collect(node.f);
        node.wrt.forEach(collect);
        return;
      case 'expect':
        node.args.forEach(collect);
        return;
      case 'bigop':
        collect(node.lo ?? undefined);
        collect(node.hi ?? undefined);
        collect(node.body);
        return;
      case 'block':
        node.rows.flat().forEach(collect);
        return;
      case 'raw':
      case 'num':
        return;
    }
  };
  collect(lhs);
  collect(rhs);
  for (const name of [...names]) {
    const def = defs.get(name);
    if (def) collect(def);
  }

  const roots = new Set<string>();
  for (const name of names) {
    if (defs.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.ty.t === 'mat') {
      for (const d of [info.ty.r, info.ty.c]) {
        if (
          typeof d !== 'number' &&
          ctx.pinned[ctx.dims.find(d.v)] === undefined &&
          fixedSize(ctx, ctx.dims.find(d.v)) === undefined
        ) {
          roots.add(ctx.dims.find(d.v));
        }
      }
      continue;
    }
    // a bare size symbol is a dimension variable too: a step that only
    // mentions n as a sum bound is an n-sized question
    if (info.ty.t === 'scalar' && info.props.some((p) => p === 'size')) {
      const root = ctx.dims.find(name);
      if (ctx.pinned[root] === undefined && fixedSize(ctx, root) === undefined) roots.add(root);
    }
  }

  // An internal dimension, the one the identity matrix or a product brings
  // with it, can end up as the root of a declared one. The name a person
  // wrote is the one that is reported.
  const named = new Map<string, string>();
  for (const declared of ctx.dimVars) {
    const root = ctx.dims.find(declared);
    if (!named.has(root)) named.set(root, declared);
  }

  const out: string[] = [];
  for (const declared of ctx.dimVars) {
    const root = ctx.dims.find(declared);
    if (roots.has(root) && !out.includes(declared)) out.push(declared);
  }
  for (const root of roots) {
    const name = named.get(root) ?? root;
    if (!out.includes(name) && !name.startsWith('#')) out.push(name);
  }
  return out;
}
