/**
 * The name of the identity, when the step is one the Cookbook knows.
 *
 * Presentation only: it never changes a verdict.
 *
 * For a row that holds, the sides are the same rational function. The
 * Cookbook is a table of named identities, so the same machinery that
 * finds the row holds also finds which identity it is: rename the
 * identity's symbols to the row's, and both pairs agree on shared
 * instances. Evaluation, not unification, is what keeps this honest.
 */

import { IDENTITIES } from '../../corpus/cookbook/identities.ts';
import { createContext, inferType } from './types.ts';
import { collectDimVarsFor } from './dims.ts';
import { sizeSettings, isRational } from './verdict/plan.ts';
import { sampleFor, sampledNames } from './verdict/shared.ts';
import { evaluateSides } from './verdict/sides.ts';
import { GFpField } from './fields/gfp.ts';
import { Sampler } from './sample.ts';
import { rngFor } from './prng.ts';
import { makeEnv } from './evaluate.ts';
import { walk } from './repair.ts';
import { analyzeSource } from './verdict/index.ts';
import type { Source, Step } from './verdict/types.ts';
import type { Node } from './ir.ts';
import type { Dim, SymbolDecl } from './decl.ts';
import type { TypeContext, Ty } from './types.ts';

/** One identity from the Cookbook, pre-read once per process. */
interface Pattern {
  /** the id of the entry, like `push-through` */
  id: string;
  /** the name of the identity, like `the push-through identity` */
  name: string;
  /** the claim row, with both sides */
  lhs: Node;
  rhs: Node;
  /** the free symbols of the claim, in a stable order */
  symbols: string[];
  /** the declarations, parsed, in the identity's own names */
  decls: SymbolDecl[];
  /** the definitions of the row, renamed with the claim */
  defs: Map<string, Node>;
  /** the context with the identity's declarations, already typed */
  ctx: TypeContext;
  /** the dimension variables, for the size settings */
  dimVars: string[];
  /** the span, reused for the fake step */
  span: { from: number; to: number };
}

let PATTERNS: Pattern[] | null = null;

/** Walks a node looking for a derivative, which the namer skips. */
function hasDeriv(node: Node): boolean {
  return walk(node).some(({ node: n }) => n.k === 'deriv');
}

/** Builds a minimal step object for the sampling machinery. */
function fakeStep(id: string, lhs?: Node, rhs?: Node): Step {
  return {
    id,
    row: 0,
    span: { from: 0, to: 0 },
    text: '',
    relation: '=',
    isDefinition: false,
    lhs,
    rhs,
    symbols: new Set(),
  } as unknown as Step;
}

/** Reads every single-row rational identity of the Cookbook for the namer. */
function patterns(): Pattern[] {
  if (PATTERNS) return PATTERNS;
  const out: Pattern[] = [];
  for (const identity of IDENTITIES) {
    let parsed;
    try {
      parsed = analyzeSource(identity.source, { decls: identity.decls });
    } catch {
      continue;
    }
    // only pure claim rows on their own make sense as patterns: a row that
    // defines a symbol belongs to a derivation, not to a table of identities
    const claims = parsed.steps.filter(
      (s) => s.relation === '=' && s.lhs && s.rhs && s.lhs.k !== 'raw' && s.rhs.k !== 'raw',
    );
    if (claims.length !== 1) continue;
    const claim = claims[0];
    if (hasDeriv(claim.lhs!) || hasDeriv(claim.rhs!)) continue;
    if (!isRational(claim.lhs!, parsed.ctx, parsed.defs, new Set())) continue;
    if (!isRational(claim.rhs!, parsed.ctx, parsed.defs, new Set())) continue;
    inferType(parsed.ctx, claim.lhs!);
    inferType(parsed.ctx, claim.rhs!);
    const symbols = sampledNames(fakeStep(identity.id, claim.lhs, claim.rhs), parsed.defs).filter((name) =>
      parsed.ctx.symbols.has(name),
    );
    if (symbols.length === 0 || symbols.length > 6) continue;
    // a random variable declaration references its mean and its covariance
    // by name, which the rename would have to rewrite too: skip them
    if ([...parsed.ctx.decls.values()].some((d) => d.kind === 'random')) continue;
    const dimVars = collectDimVarsFor(parsed.ctx, claim.lhs, claim.rhs, parsed.defs);
    out.push({
      id: identity.id,
      name: identity.name,
      lhs: claim.lhs!,
      rhs: claim.rhs!,
      symbols,
      decls: [...parsed.ctx.decls.values()],
      defs: parsed.defs,
      ctx: parsed.ctx,
      dimVars,
      span: claim.span,
    });
  }
  PATTERNS = out;
  return out;
}

/** The class of a symbol, for matching: scalar, vector, row, square or general. */
function symbolClass(ty: Ty, ctx: TypeContext): string {
  if (ty.t !== 'mat') return 'scalar';
  const r = ty.r!;
  const c = ty.c!;
  const key = (d: Dim): string => (typeof d === 'number' ? `#${d}` : ctx.dims.find(d.v));
  if (key(r) === key(c)) return 'square';
  if (typeof c === 'number' && c === 1) return 'vec';
  if (typeof r === 'number' && r === 1) return 'row';
  return 'mat';
}

/** The renamings that respect the shape classes, in a stable order. */
function renamings(pattern: Pattern, stepSymbols: string[], stepCtx: TypeContext): Array<Map<string, string>> {
  const out: Array<Map<string, string>> = [];
  const idSymbols = pattern.symbols;
  if (idSymbols.length !== stepSymbols.length) return out;
  const idClasses = idSymbols.map((name) => symbolClass(pattern.ctx.symbols.get(name)!.ty, pattern.ctx));
  const stepClasses = stepSymbols.map((name) => symbolClass(stepCtx.symbols.get(name)!.ty, stepCtx));
  const buckets = new Map<string, string[]>();
  for (let i = 0; i < stepSymbols.length; i++) {
    const list = buckets.get(stepClasses[i]) ?? [];
    list.push(stepSymbols[i]);
    buckets.set(stepClasses[i], list);
  }
  if (idSymbols.some((_, i) => !buckets.get(idClasses[i])?.length)) return out;
  const order = idSymbols.map((_, i) => i).sort((a, b) => idClasses[a].localeCompare(idClasses[b]) || a - b);
  const used = new Set<string>();
  const assignment = new Map<string, string>();
  const assign = (k: number): void => {
    if (out.length >= 64) return;
    if (k === order.length) {
      out.push(new Map(assignment));
      return;
    }
    const i = order[k];
    for (const candidate of buckets.get(idClasses[i]) ?? []) {
      if (used.has(candidate)) continue;
      used.add(candidate);
      assignment.set(idSymbols[i], candidate);
      assign(k + 1);
      assignment.delete(idSymbols[i]);
      used.delete(candidate);
    }
  };
  assign(0);
  return out;
}

/** The dimension substitution of one assignment, or null when they do not fit. */
function dimSubstitution(
  pattern: Pattern,
  assignment: Map<string, string>,
  stepCtx: TypeContext,
): Map<string, string | number> | null {
  const sub = new Map<string, string | number>();
  const put = (idDim: Dim, stepDim: Dim): boolean => {
    const from = typeof idDim === 'number' ? `#${idDim}` : idDim.v;
    if (typeof idDim === 'number') {
      // a fixed dimension of the identity has to be a fixed dimension of the step
      if (typeof stepDim !== 'number') return false;
      return idDim === stepDim;
    }
    const root = typeof stepDim === 'number' ? `#${stepDim}` : stepCtx.dims.find(stepDim.v);
    if (sub.get(from) === undefined) sub.set(from, root);
    return sub.get(from) === root;
  };
  for (const [idName, stepName] of assignment) {
    const idInfo = pattern.ctx.symbols.get(idName);
    const stepInfo = stepCtx.symbols.get(stepName);
    if (!idInfo || !stepInfo) return null;
    if (idInfo.ty.t !== stepInfo.ty.t) return null;
    if (idInfo.ty.t === 'mat' && stepInfo.ty.t === 'mat') {
      if (!put(idInfo.ty.r as Dim, stepInfo.ty.r)) return null;
      if (!put(idInfo.ty.c as Dim, stepInfo.ty.c)) return null;
    }
  }
  return sub;
}

/** Renames a node, replacing the identity's symbol names with the step's. */
function rename(node: Node, names: Map<string, string>): Node {
  const map = (n: Node): Node => {
    if (n.k === 'sym') {
      const next = names.get(n.name);
      if (!next) return n;
      return { ...n, name: next, display: next };
    }
    if ('args' in n && Array.isArray((n as { args?: Node[] }).args)) {
      return { ...n, args: (n as { args: Node[] }).args.map(map) } as Node;
    }
    if (n.k === 'bigop') return { ...n, lo: n.lo ? map(n.lo) : null, hi: n.hi ? map(n.hi) : null, body: map(n.body) };
    if (n.k === 'deriv') return { ...n, f: map(n.f), wrt: n.wrt.map(map) };
    if (n.k === 'expect') return { ...n, args: n.args.map(map) };
    if (n.k === 'block') return { ...n, rows: n.rows.map((row) => row.map(map)) };
    return n;
  };
  return map(node);
}

/** The free symbols the engine samples for a step, step names. */
function sampledFor(step: Step, defs: Map<string, Node>, ctx: TypeContext): string[] {
  return sampledNames(step, defs).filter((name) => ctx.symbols.has(name));
}

/** Swaps every identity symbol name for the step's name in a text. */
function swapAll(text: string, assignment: Map<string, string>): string {
  let out = text;
  for (const [id, step] of assignment) out = out.split(id).join(step);
  return out;
}

/** Renames the identity's declarations into the step's names. */
function renamedDeclarations(pattern: Pattern, assignment: Map<string, string>): SymbolDecl[] {
  return pattern.decls.map((decl) => {
    const next = assignment.get(decl.name);
    if (!next) return decl;
    const renamed: SymbolDecl = { ...decl, name: next, display: next };
    if (renamed.kind === 'random' && renamed.dist) {
      // no random-variable identity reaches here: they are filtered out in
      // patterns(), and the filter is the only honest place to do it
      if (renamed.dist.kind === 'normal') {
        renamed.dist = {
          ...renamed.dist,
          mu: swapAll(renamed.dist.mu, assignment),
          sigma: swapAll(renamed.dist.sigma, assignment),
        };
      }
    }
    return renamed;
  });
}

/** Renames the definitions of the identity, names and bodies. */
function renamedDefs(pattern: Pattern, assignment: Map<string, string>): Map<string, Node> {
  const defs = new Map<string, Node>();
  for (const [name, body] of pattern.defs) {
    const renamedName = assignment.get(name) ?? name;
    defs.set(renamedName, rename(body, assignment));
  }
  return defs;
}

/**
 * The identity the step is, if it is one the Cookbook knows.
 *
 * The verdicts are untouched: this reads a checked row and reports a name.
 */
export function identifyRule(parsed: Source, step: Step, spent: { n: number }): string | null {
  if (step.relation !== '=' || !step.lhs || !step.rhs) return null;
  if (hasDeriv(step.lhs) || hasDeriv(step.rhs)) return null;
  // the registry is filled by the inference pass, and the explanation path
  // does not run one, so it runs here
  inferType(parsed.ctx, step.lhs);
  inferType(parsed.ctx, step.rhs);
  for (const def of parsed.defs.values()) inferType(parsed.ctx, def);
  const names = sampledFor(step, parsed.defs, parsed.ctx);
  if (names.length === 0 || names.length > 6) return null;
  for (const pattern of patterns()) {
    if (pattern.symbols.length !== names.length) continue;
    for (const assignment of renamings(pattern, names, parsed.ctx)) {
      if (dimSubstitution(pattern, assignment, parsed.ctx) === null) continue;
      // the renamed world: the identity's declarations in the step's names
      const renamedDecls = renamedDeclarations(pattern, assignment);
      const ctx2 = createContext(renamedDecls, 'denominator', {});
      const lhs = rename(pattern.lhs, assignment);
      const rhs = rename(pattern.rhs, assignment);
      inferType(ctx2, lhs);
      inferType(ctx2, rhs);
      const defs2 = renamedDefs(pattern, assignment);
      const dimVars = collectDimVarsFor(ctx2, lhs, rhs, defs2);
      const settings = sizeSettings(dimVars).slice(0, 2);
      const field = new GFpField(2147483647);
      let matched = true;
      for (const setting of settings) {
        if (!matched) break;
        for (let trial = 0; trial < 4; trial++) {
          spent.n += 8;
          if (spent.n > 900) return null;
          try {
            const rng = rngFor(1, 'name-rule', pattern.id, [...setting.entries()].flat().join('.'), trial);
            const sampler = new Sampler(field, rng);
            const env = makeEnv(field, rng);
            // the step's own definitions, plus the identity's renamed ones
            env.defs = new Map([...parsed.defs, ...defs2]);
            env.sizes = new Map(setting);
            const sample = sampleFor(ctx2, fakeStep(pattern.id, lhs, rhs), defs2, setting, sampler, new Set(), trial);
            if (sample === 'unknown') {
              matched = false;
              break;
            }
            for (const [name, value] of sample.values.entries()) env.values.set(name, value);
            for (const [name, quad] of sample.quad.entries()) env.quad.set(name, quad);
            const s = evaluateSides(field, step.lhs, lhs, env, sampler);
            const t = evaluateSides(field, step.rhs, rhs, env, sampler);
            if (s.kind !== 'equal' || t.kind !== 'equal') {
              matched = false;
              break;
            }
          } catch {
            matched = false;
            break;
          }
        }
      }
      if (matched) return pattern.name;
    }
  }
  return null;
}
