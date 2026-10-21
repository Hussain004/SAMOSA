import type { Node } from './ir.ts';
import type { TypeContext } from './types.ts';

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
        if (typeof d !== 'number') roots.add(ctx.dims.find(d.v));
      }
    }
  }
  const out: string[] = [];
  for (const declared of ctx.dimVars) {
    const root = ctx.dims.find(declared);
    if (roots.has(root) && !out.includes(root)) out.push(root);
  }
  for (const root of roots) {
    if (!out.includes(root) && !root.startsWith('#')) out.push(root);
  }
  return out;
}
