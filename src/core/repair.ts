import { GFpField } from './fields/gfp.ts';
import { evalNode, makeEnv } from './evaluate.ts';
import { Sampler } from './sample.ts';
import { rngFor } from './prng.ts';
import { renderNode } from './render.ts';
import { compareSides, sizeSettings } from './verdict/index.ts';
import { mat, matSolve } from './linalg.ts';
import { dimSizeOf, type TypeContext } from './types.ts';
import type { Node, Span } from './ir.ts';
import type { Fix } from './verdict/index.ts';
import { canonicalizeSymbol } from './notation.ts';
import type { Prop } from './decl.ts';

/**
 * Repairs: the "did you mean" suggestions.
 *
 * They run lazily, when a wrong or a shape error card is opened, and they
 * are never applied automatically. Every suggestion is a quick fix that the
 * user can take or leave.
 *
 * Four kinds:
 *
 *   a. a mutation from the mistake catalog, applied to one node
 *   b. the residual fingerprint, which names the term that is missing
 *   c. the missing assumption, which names the property that is needed
 *   d. the shape repair, which suggests a transpose
 */

const CANDIDATE_LIMIT = 300;

/**
 * The repair budget, in evaluations and not in milliseconds (review 5.8).
 *
 * A wall clock makes the fixes a person sees depend on the speed of the
 * machine: a slow runner silently drops the families that come last. The
 * count is a safety net over families that are already count bounded, so a
 * normal step is never cut short and any cut lands in the same place
 * everywhere.
 */
const BUDGET_EVALS = 1200;

interface RepairCtx {
  ctx: TypeContext;
  lhs: Node;
  rhs: Node;
  defs: Map<string, Node>;
  seed: number;
  dimVars: string[];
  /** the evaluations spent so far, shared by the four families */
  spent: { n: number };
}

/** The repairs for one step. */
export function repairs(
  ctx: TypeContext,
  lhs: Node,
  rhs: Node,
  defs: Map<string, Node>,
  seed: number,
  dimVars: string[],
  kind: 'wrong' | 'shape',
): Fix[] {
  const sh: RepairCtx = { ctx, lhs, rhs, defs, seed, dimVars, spent: { n: 0 } };
  const out: Fix[] = [];

  const shape = kind === 'shape' ? shapeRepairs(sh) : [];
  out.push(...shape);
  if (sh.spent.n > BUDGET_EVALS) return out;

  out.push(...mutationRepairs(sh));
  if (sh.spent.n > BUDGET_EVALS) return out;

  out.push(...assumptionRepairs(sh));
  if (sh.spent.n > BUDGET_EVALS) return out;

  out.push(...residualRepairs(sh));

  // The same fix is only offered once: two rules that lead to the same
  // expression are one fix, however they are phrased.
  const deduped: Fix[] = [];
  const seen = new Set<string>();
  for (const fix of out) {
    const key = `${fix.edit?.insert ?? ''}|${fix.addDecl ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(fix);
  }
  deduped.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      // a fix of the right hand side is a fix of the derivation, so it comes
      // before a fix of the left hand side that edits the claim
      compareSide(a.side, b.side) ||
      editSize(a) - editSize(b),
  );
  return deduped.slice(0, 3);
}

/** The order of the sides a fix can change, most derivation-like first. */
function compareSide(a: 'lhs' | 'rhs' | undefined, b: 'lhs' | 'rhs' | undefined): number {
  const as = a ?? 'rhs';
  const bs = b ?? 'rhs';
  if (as === bs) return 0;
  // the right hand side is where a mistake in the derivation usually sits,
  // so it is offered first (review 3.1 of the second audit, item 2.4)
  return as === 'rhs' ? -1 : 1;
}

/** The order the kinds of fix are offered in. */
function priority(fix: Fix): number {
  switch (fix.kind) {
    case 'mutation':
      return 0;
    case 'residual':
      return 1;
    case 'shape':
      return 2;
    case 'assumption':
      return 3;
    default:
      return 4;
  }
}

// ------------------------------------------------------------- mutations

interface Mutation {
  id: string;
  title: string;
  apply: (node: Node) => Node | null;
}

/**
 * The mistake catalog of Appendix B, in the shapes the IR can express.
 *
 * It is exported so that the corpus can generate its mutants from the same
 * list the repairs use: a mutant and a repair are the same thing seen from
 * the two sides.
 */
export const MUTATIONS: Mutation[] = [
  {
    id: 'T1',
    title: 'the transpose of a product keeps the order',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'T') return null;
      const arg = node.args[0];
      if (arg.k !== 'op' || arg.op !== 'mul') return null;
      return { ...node, args: [{ ...arg, args: [arg.args[1], arg.args[0]] }] };
    },
  },
  {
    id: 'T2',
    title: 'the inverse of a product keeps the order',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'inv') return null;
      const arg = node.args[0];
      if (arg.k !== 'op' || arg.op !== 'mul') return null;
      return {
        ...node,
        args: [
          {
            ...arg,
            args: [
              { k: 'op', op: 'inv', args: [arg.args[1]], span: arg.args[1].span },
              { k: 'op', op: 'inv', args: [arg.args[0]], span: arg.args[0].span },
            ],
          },
        ],
      };
    },
  },
  {
    id: 'T3',
    title: 'a transpose is missing',
    apply: (node) => {
      if (node.k !== 'sym') return null;
      return { k: 'op', op: 'T', args: [node], span: node.span };
    },
  },
  {
    id: 'T3r',
    title: 'a transpose is not needed',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'T') return null;
      return node.args[0];
    },
  },
  {
    id: 'A4',
    title: 'an inverse where there should be none, or the other way round',
    apply: (node) => {
      if (node.k === 'op' && node.op === 'inv') return node.args[0];
      if (node.k === 'op' && (node.op === 'mul' || node.op === 'add' || node.op === 'sub')) {
        for (const arg of node.args) {
          if (arg.k === 'op' && arg.op === 'inv' && !isInvertedTwice(arg)) {
            return { ...node, args: node.args.map((a) => (a === arg ? a.args[0] : a)) };
          }
        }
      }
      return null;
    },
  },
  {
    id: 'A1',
    title: 'a sign is flipped',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'add') return null;
      const second = node.args[1];
      if (second.k !== 'op' || second.op !== 'neg') return null;
      return { ...node, op: 'sub', args: [node.args[0], second.args[0]] };
    },
  },
  {
    id: 'A2',
    title: 'a factor of two',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'mul') return null;
      const a = node.args[0];
      const b = node.args[1];
      if (a.k === 'num' && a.value.n === 2) return { ...node, args: [a, b] };
      if (b.k === 'num' && b.value.n === 2) return { ...node, args: [a, b] };
      if (a.k === 'num' && a.value.n === 1) {
        return {
          ...node,
          args: [
            { k: 'num', value: { n: 2, d: 1 }, span: a.span },
            b,
          ],
        };
      }
      return null;
    },
  },
  {
    id: 'C1',
    title: 'two factors are swapped',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'mul') return null;
      return { ...node, args: [node.args[1], node.args[0]] };
    },
  },
  {
    id: 'S1',
    title: 'the inverse of a sum is split',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'inv') return null;
      const arg = node.args[0];
      if (arg.k !== 'op' || arg.op !== 'add') return null;
      return {
        ...node,
        args: [
          {
            k: 'op',
            op: 'add',
            args: [
              { k: 'op', op: 'inv', args: [arg.args[0]], span: arg.args[0].span },
              { k: 'op', op: 'inv', args: [arg.args[1]], span: arg.args[1].span },
            ],
            span: arg.span,
          },
        ],
      };
    },
  },
  {
    id: 'N2',
    title: 'the Frobenius norm uses the wrong trace',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'frob') return null;
      const arg = node.args[0];
      if (arg.k !== 'op' || arg.op !== 'T') return null;
      return { ...node, op: 'norm2', args: [arg.args[0]] };
    },
  },
  {
    id: 'G1',
    title: 'the gradient of a quadratic form assumes symmetry',
    apply: (node) => {
      if (node.k !== 'op' || node.op !== 'mul') return null;
      return null;
    },
  },
];

/**
 * The pretty form of a piece of LaTeX.
 *
 * The braces a renderer needs are noise in a sentence, so they go.
 */
function pretty(latex: string): string {
  return latex.replace(/[{}]/g, '');
}

/** How big is the edit a fix proposes? */
function editSize(fix: Fix): number {
  if (!fix.edit) return 0;
  return fix.edit.insert.length;
}

/** Is this inverse already inside an inverse? Then unwrapping it changes nothing. */
function isInvertedTwice(node: Extract<Node, { k: 'op' }>): boolean {
  return node.args[0]?.k === 'op' && node.args[0].op === 'inv';
}

/** Every node of a tree, with its path. */
export function walk(node: Node, path: number[] = []): Array<{ node: Node; path: number[] }> {
  const out = [{ node, path }];
  const children: Node[] =
    node.k === 'op' || node.k === 'call'
      ? node.args
      : node.k === 'deriv'
        ? [node.f, ...node.wrt]
        : node.k === 'expect'
          ? node.args
          : node.k === 'bigop'
            ? [node.body]
            : node.k === 'block'
              ? node.rows.flat()
              : [];
  children.forEach((child, i) => out.push(...walk(child, [...path, i])));
  return out;
}

/** Replaces one node of a tree with another. */
export function replaceAt(node: Node, path: number[], replacement: Node): Node {
  if (path.length === 0) return replacement;
  const [head, ...rest] = path;
  if (node.k === 'op' || node.k === 'call') {
    const args = node.args.slice();
    args[head] = replaceAt(args[head], rest, replacement);
    return { ...node, args };
  }
  if (node.k === 'block') {
    const rows = node.rows.map((r) => r.slice());
    const flat = rows.flat();
    flat[head] = replaceAt(flat[head], rest, replacement);
    const out: Node[][] = [];
    let i = 0;
    for (const row of rows) {
      out.push(flat.slice(i, i + row.length));
      i += row.length;
    }
    return { ...node, rows: out };
  }
  return node;
}

/**
 * The mutations, applied to either side of the step.
 *
 * A mistake is as often on the left as on the right, so both are tried, and
 * the fix that is offered edits the side that was changed.
 */
function mutationRepairs(sh: RepairCtx): Fix[] {
  const out: Fix[] = [];
  let count = 0;
  for (const side of ['rhs', 'lhs'] as const) {
    const original = side === 'rhs' ? sh.rhs : sh.lhs;
    for (const { node, path } of walk(original)) {
      if (count > CANDIDATE_LIMIT) break;
      for (const mutation of MUTATIONS) {
        if (count > CANDIDATE_LIMIT) break;
        const mutated = mutation.apply(node);
        if (!mutated) continue;
        count++;
        const candidate = replaceAt(original, path, mutated);
        if (renderNode(candidate) === renderNode(original)) continue;
        if (!holdsWith(sh, side, candidate)) continue;
        out.push({
          kind: 'mutation',
          // the fix says which side it changes, the derivation comes before
          // the claim in the reading order of a person (review 3.1, item 2.4)
          // the mistake first, then the edit; the new side follows as the
          // detail, so "two factors are swapped, so change the right side
          // to" reads on, into the expression
          title: `${mutation.title}, so change the ${side === 'rhs' ? 'right' : 'left'} side to`,
          edit: { span: original.span, insert: renderNode(candidate) },
          verified: true,
          detail: renderNode(candidate),
          side: side === 'rhs' ? 'rhs' : 'lhs',
        });
      }
    }
  }
  return out;
}

/** Does the step hold with this side replaced? */
function holdsWith(sh: RepairCtx, side: 'lhs' | 'rhs', candidate: Node): boolean {
  const settings = sizeSettings(sh.dimVars);
  const field = new GFpField(2147483647);
  for (const setting of settings.slice(0, 2)) {
    const rng = rngFor(sh.seed, 'repair', 'mutation');
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = sh.defs;
    env.sizes = new Map(setting);
    const values = sampleSymbols(sh.ctx, sh, setting, sampler);
    if (!values) return false;
    for (const [name, value] of values.entries()) if (value) env.values.set(name, value);
    try {
      const sides = compareSides(
        field,
        side === 'lhs' ? candidate : sh.lhs,
        side === 'rhs' ? candidate : sh.rhs,
        env,
        sampler,
      );
      sh.spent.n++;
      if (sides.kind !== 'equal') return false;
    } catch {
      return false;
    }
  }
  return true;
}

function sampleSymbols(
  ctx: TypeContext,
  sh: RepairCtx,
  setting: Map<string, number>,
  sampler: Sampler<number>,
): Map<string, ReturnType<Sampler<number>['sample']> extends infer T ? T : never> | null {
  const values = new Map<string, any>();
  const names = new Set<string>();
  const collect = (node: Node) => {
    if (node.k === 'sym') names.add(node.name);
    else if (node.k === 'op' || node.k === 'call') node.args.forEach(collect);
    else if (node.k === 'deriv') {
      collect(node.f);
      node.wrt.forEach(collect);
    } else if (node.k === 'expect') node.args.forEach(collect);
    else if (node.k === 'bigop') collect(node.body);
    else if (node.k === 'block') node.rows.flat().forEach(collect);
  };
  collect(sh.lhs);
  collect(sh.rhs);
  // A symbol the step brings with it, a defined one, brings its definition
  // and the symbols that definition is written with: the noise term of the
  // Kalman filter is written with a symbol that never appears in the step.
  for (const name of [...names]) {
    const def = sh.defs.get(name);
    if (def) collect(def);
  }
  for (const name of names) {
    if (sh.defs.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.ty.t === 'scalar') {
      const value = info.props.some((p) => p === 'pos')
        ? sampler.samplePositiveScalar()
        : sampler.sampleScalar();
      values.set(name, { k: 's', v: value });
      continue;
    }
    if (info.ty.t !== 'mat') continue;
    const r = dimSizeOf(ctx, info.ty.r, setting);
    const c = dimSizeOf(ctx, info.ty.c, setting);
    const val = sampler.sample({ name, r, c, props: info.props, variety: 0 });
    if (!val) return null;
    values.set(name, val);
  }
  return values;
}

// ------------------------------------------------------------ assumptions

const ASSUMPTION_TRIES: Array<{ props: Prop[]; text: string; scalar?: boolean }> = [
  { props: ['sym'], text: 'symmetric' },
  { props: ['orth'], text: 'orthogonal' },
  { props: ['diag'], text: 'diagonal' },
  { props: ['pos'], text: 'positive', scalar: true },
];

/**
 * The missing assumption.
 *
 * If a step only holds once a matrix is known to be symmetric, that is the
 * repair to offer, because a hidden assumption is what turns a checkmark
 * into a lie.
 *
 * A property that the shape cannot have is never offered: a matrix that is
 * not square cannot be symmetric, so the suggestion would be nonsense. A
 * positive scalar is offered for steps that failed on a domain error over a
 * sign (review 3.4): a log or a square root of a negative sample.
 */
function assumptionRepairs(sh: RepairCtx): Fix[] {
  const out: Fix[] = [];
  const candidates = [...sh.ctx.symbols.values()].filter(
    (s) => s.props.length === 0 && s.source !== 'preset' && (s.ty.t === 'mat' || s.ty.t === 'scalar'),
  );
  for (const symbol of candidates) {
    for (const attempt of ASSUMPTION_TRIES) {
      if (!canHave(sh.ctx, symbol.name, attempt.props)) continue;
      if (holdsWithProps(sh, symbol.name, attempt.props)) {
        const decl =
          attempt.scalar
            ? `${symbol.name}: pos`
            : `${symbol.name}: ${attempt.props[0]} ${dimText(sh.ctx, symbol.name)}`;
        out.push({
          kind: 'assumption',
          title: `holds if ${symbol.name} is ${attempt.text}`,
          addDecl: decl,
          verified: true,
        });
        return out;
      }
    }
  }
  return out;
}

/** Can a symbol of this type have this property at all? */
function canHave(ctx: TypeContext, name: string, props: Prop[]): boolean {
  const info = ctx.symbols.get(name);
  if (!info) return false;
  // positivity is a property of a scalar, not of a matrix
  if (props.includes('pos')) return info.ty.t === 'scalar';
  if (info.ty.t !== 'mat') return false;
  const r = info.ty.r;
  const c = info.ty.c;
  const square =
    typeof r === 'number' && typeof c === 'number' ? r === c : typeof r !== 'number' && typeof c !== 'number' && r.v === c.v;
  // symmetry, orthogonality, rotations and diagonality all need a square matrix
  if (
    props.includes('sym') ||
    props.includes('orth') ||
    props.includes('rot') ||
    props.includes('diag')
  ) {
    return square;
  }
  return true;
}

function dimText(ctx: TypeContext, name: string): string {
  const info = ctx.symbols.get(name);
  if (!info || info.ty.t !== 'mat') return '';
  const r = info.ty.r;
  const c = info.ty.c;
  if (typeof r === 'number') return String(r);
  if (typeof c === 'number' || (c as { v: string }).v !== (r as { v: string }).v) {
    return `${(r as { v: string }).v}×${typeof c === 'number' ? c : (c as { v: string }).v}`;
  }
  return (r as { v: string }).v;
}

function holdsWithProps(sh: RepairCtx, name: string, props: Prop[]): boolean {
  const saved = sh.ctx.symbols.get(name);
  if (!saved) return false;
  sh.ctx.symbols.set(name, { ...saved, props });
  const ok = holdsWith(sh, 'rhs', sh.rhs);
  sh.ctx.symbols.set(name, saved);
  return ok;
}

// -------------------------------------------------------------- shape

/** The shape repair: try a transpose here and there. */
function shapeRepairs(sh: RepairCtx): Fix[] {
  const out: Fix[] = [];
  const candidates = walk(sh.rhs);
  for (const { node, path } of candidates.slice(0, 40)) {
    if (node.k === 'sym') {
      const flipped = { k: 'op' as const, op: 'T' as const, args: [node], span: node.span };
      const candidate = replaceAt(sh.rhs, path, flipped);
      if (typeChecks(sh, candidate)) {
        out.push({
          kind: 'shape',
          title: `did you mean ${renderNode(flipped)}?`,
          edit: { span: sh.rhs.span, insert: renderNode(candidate) },
          verified: false,
        });
        if (out.length >= 3) return out;
      }
    }
  }
  return out;
}

function typeChecks(sh: RepairCtx, rhs: Node): boolean {
  // a cheap check: the candidate must evaluate without a shape error
  const settings = sizeSettings(sh.dimVars);
  const field = new GFpField(2147483647);
  for (const setting of settings.slice(0, 1)) {
    const rng = rngFor(sh.seed, 'repair', 'shape');
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = sh.defs;
    env.sizes = new Map(setting);
    const values = sampleSymbols(sh.ctx, sh, setting, sampler);
    if (!values) continue;
    for (const [n, value] of values.entries()) if (value) env.values.set(n, value);
    try {
      evalNode(field, rhs, env);
      sh.spent.n++;
      return true;
    } catch {
      sh.spent.n++;
      return false;
    }
  }
  return false;
}

// ------------------------------------------------------------- residual

/**
 * The residual fingerprint.
 *
 * When the step is off by exactly one term, that term can be found: the
 * difference between the two sides is a small rational multiple of a term
 * built from the symbols of the step.
 *
 * The terms are the sandwiches: `X Xᵀ` and `X Y Xᵀ`, because that is the
 * shape a missing noise term has. The Joseph form, for instance, is off by
 * exactly `K_t Q_t K_tᵀ`.
 */
function residualRepairs(sh: RepairCtx): Fix[] {
  const out: Fix[] = [];
  const settings = sizeSettings(sh.dimVars);
  const field = new GFpField(2147483647);

  // The difference on a few instances. The environments are kept, because a
  // candidate term has to be tried on the very same instances.
  const samples: Array<{ env: ReturnType<typeof makeEnv<number>>; diff: number[] }> = [];
  for (const setting of settings.slice(0, 2)) {
    const rng = rngFor(sh.seed, 'repair', 'residual');
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = sh.defs;
    env.sizes = new Map(setting);
    const values = sampleSymbols(sh.ctx, sh, setting, sampler);
    if (!values) return out;
    for (const [name, value] of values.entries()) if (value) env.values.set(name, value);
    try {
      const l = evalNode(field, sh.lhs, env);
      const r = evalNode(field, sh.rhs, env);
      sh.spent.n += 2;
      if (l.k !== 'm' || r.k !== 'm') return out;
      const d = l.m.d.map((x, i) => field.sub(x, r.m.d[i]));
      samples.push({ env, diff: d });
    } catch {
      return out;
    }
  }
  if (samples.length < 2) return out;

  const terms = candidateTerms(sh);

  // the difference and every candidate on the same instances, evaluated once
  const flat: number[] = [];
  for (const s of samples) flat.push(...s.diff);
  const usable: Array<{ text: string; node: Node; entries: number[] }> = [];
  for (const [text, term] of terms) {
    const entries: number[] = [];
    let ok = true;
    for (const { env, diff } of samples) {
      try {
        const t = evalNode(field, term, env);
        if (t.k !== 'm' || t.m.d.length !== diff.length) {
          ok = false;
          break;
        }
        entries.push(...t.m.d);
      } catch {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    usable.push({ text, node: term, entries });
  }

  for (const { text, node, entries } of usable) {
    sh.spent.n++;
    const scale = matchesScaleValues(field, entries, samples);
    if (scale === null || scale === 0) continue;
    // the patched row is checked like any other candidate, so the fix that is
    // offered is one that has been seen to hold
    const patched: Node = {
      k: 'op',
      op: 'add',
      args: [sh.rhs, node],
      span: sh.rhs.span,
    };
    // an edit that does not change the row is no fix at all
    if (renderNode(patched) === renderNode(sh.rhs)) continue;
    const verified = holdsWith(sh, 'rhs', patched);
    out.push({
      kind: 'residual',
      title: `this step is off by exactly ${scaleText(scale)} ${pretty(text)}`,
      edit: { span: sh.rhs.span, insert: `${renderNode(sh.rhs)} ${scaleText(scale)} ${text}` },
      verified,
      detail: text,
      side: 'rhs',
    });
    if (out.length >= 3) return out;
  }

  // the residual can be two or three terms deep, so the fit runs over small
  // subsets, solved with the Gaussian elimination of linalg over GF(p) and
  // accepted only when the coefficients are small rationals
  if (usable.length >= 2) {
    for (let i = 0; i < usable.length && out.length < 3; i++) {
      for (let j = i + 1; j < usable.length && out.length < 3; j++) {
        const coefs = solveSmall(field, usable, [i, j], flat);
        if (coefs) pushResidualFix(sh, out, [
          { c: coefs[0], text: usable[i].text, node: usable[i].node },
          { c: coefs[1], text: usable[j].text, node: usable[j].node },
        ]);
      }
    }
  }
  if (usable.length <= 48) {
    for (let i = 0; i < usable.length && out.length < 3; i++) {
      for (let j = i + 1; j < usable.length && out.length < 3; j++) {
        for (let k = j + 1; k < usable.length && out.length < 3; k++) {
          const coefs = solveSmall(field, usable, [i, j, k], flat);
          if (coefs) pushResidualFix(sh, out, [
            { c: coefs[0], text: usable[i].text, node: usable[i].node },
            { c: coefs[1], text: usable[j].text, node: usable[j].node },
            { c: coefs[2], text: usable[k].text, node: usable[k].node },
          ]);
        }
      }
    }
  }
  return out;
}

/** The small rationals a multi-term fit accepts, and their text. */
const SMALL_NICE_SCALES = [-2, -1, -0.5, 0.5, 1, 2];

/** The text of one signed coefficient, like the single-term repair prints it. */
function coefText(c: number): string {
  const mag = Math.abs(c);
  const sign = c >= 0 ? '+' : '-';
  const coeff = mag === 1 ? '' : mag === 0.5 ? '\\frac{1}{2}' : `${mag}`;
  return `${sign}${coeff ? ` ${coeff}` : ''}`;
}

/** A num node for the magnitude of a small rational. */
function smallNum(c: number): Node {
  if (Math.abs(c) === 0.5) return { k: 'num', value: { n: 1, d: 2 }, span: { from: 0, to: 0 } };
  return { k: 'num', value: { n: Math.abs(c), d: 1 }, span: { from: 0, to: 0 } };
}

/** The patched row: rhs plus the terms with their coefficients. */
function patchWith(sh: RepairCtx, terms: Array<{ c: number; text: string; node: Node }>): Node {
  let acc: Node = sh.rhs;
  for (const { c, node } of terms) {
    const mag = Math.abs(c);
    const scaled: Node = mag === 1 ? node : { k: 'op', op: 'mul', args: [smallNum(c), node], span: node.span };
    acc = {
      k: 'op',
      op: c >= 0 ? 'add' : 'sub',
      args: [acc, scaled],
      span: sh.rhs.span,
    };
  }
  return acc;
}

/** A multi-term residual fix, once the fit has been seen to hold. */
function pushResidualFix(
  sh: RepairCtx,
  out: Fix[],
  terms: Array<{ c: number; text: string; node: Node }>,
): void {
  const text = terms.map(({ c, text: t }) => `${coefText(c)} ${pretty(t)}`).join(' ');
  const patched = patchWith(sh, terms);
  if (renderNode(patched) === renderNode(sh.rhs)) return;
  const insert = `${renderNode(sh.rhs)} ${text}`;
  const verified = holdsWith(sh, 'rhs', patched);
  out.push({
    kind: 'residual',
    title: `this step is off by exactly ${text}`,
    edit: { span: sh.rhs.span, insert },
    verified,
    detail: terms.map(({ text: t }) => t).join(' + '),
    side: 'rhs',
  });
}

/** The equations a fit solves on, the first few, tried in order. */
function equationSubsets(n: number, k: number): number[][] {
  const out: number[][] = [];
  if (k === 2) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
    return out;
  }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k2 = j + 1; k2 < n; k2++) out.push([i, j, k2]);
  return out;
}

/**
 * The coefficients of a small subset of candidate terms, over GF(p).
 *
 * The system is solved on a few equations and then verified on all of
 * them, so a solution is accepted only when it is exact everywhere, and
 * only when every coefficient is a small rational.
 */
function solveSmall(
  field: GFpField,
  terms: Array<{ entries: number[] }>,
  idxs: number[],
  flat: number[],
): number[] | null {
  const k = idxs.length;
  const nEq = Math.min(8, flat.length);
  for (const subset of equationSubsets(nEq, k)) {
    try {
      const A = mat(k, k, (r, c) => terms[idxs[c]].entries[subset[r]]);
      const b = mat(k, 1, (r) => flat[subset[r]]);
      const x = matSolve(field, A, b);
      const coefs = idxs.map((_, c) => x.d[c]);
      const accepted = coefs.map((c) => {
        for (const s of SMALL_NICE_SCALES) {
          const den = Math.abs(s % 1) > 0 ? 2 : 1;
          const num = Math.abs(s % 1) > 0 ? (s < 0 ? -1 : 1) : s;
          if (field.fromRational(num, den) === c) return s;
        }
        return null;
      });
      if (accepted.some((c) => c === null)) continue;
      // exact on every equation, or it is nothing
      let ok = true;
      for (let e = 0; e < flat.length && ok; e++) {
        let acc = 0;
        for (let c = 0; c < k; c++) {
          acc = field.add(acc, field.mul(x.d[c], terms[idxs[c]].entries[e]));
        }
        if (acc !== flat[e]) ok = false;
      }
      if (ok) return accepted as number[];
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * The terms a residual can be.
 *
 * A sandwich `X Xᵀ` and a sandwich with a middle `X Y Xᵀ`, built from the
 * symbols of the step. The same term is only kept once.
 */
function candidateTerms(sh: RepairCtx): Map<string, Node> {
  const terms = new Map<string, Node>();
  const symbols: Node[] = [];
  const seen = new Set<string>();
  const collect = (node: Node) => {
    if (node.k !== 'sym') return;
    if (seen.has(node.name)) return;
    seen.add(node.name);
    symbols.push(node);
  };
  for (const { node } of walk(sh.lhs).concat(walk(sh.rhs))) collect(node);
  // a symbol the step brings with it, a defined one, brings its definition
  // and the symbols that definition is written with: the noise term of the
  // Kalman filter is written with a symbol that never appears in the step
  for (const name of [...seen]) {
    const def = sh.defs.get(name);
    if (!def) continue;
    for (const { node } of walk(def)) collect(node);
  }

  const add = (node: Node) => {
    const text = renderNode(node);
    if (!terms.has(text)) terms.set(text, node);
  };

  for (const x of symbols) {
    const xt = { k: 'op' as const, op: 'T' as const, args: [x], span: x.span };
    add({
      k: 'op',
      op: 'mul',
      args: [x, xt],
      span: x.span,
    });
  }

  // the sandwiches with a middle: X Y Xᵀ
  for (const x of symbols) {
    for (const y of symbols) {
      if (x === y) continue;
      const xt = { k: 'op' as const, op: 'T' as const, args: [x], span: x.span };
      add({
        k: 'op',
        op: 'mul',
        args: [
          { k: 'op', op: 'mul', args: [x, y], span: x.span },
          xt,
        ],
        span: x.span,
      });
    }
  }
  return terms;
}

/**
 * The scale of a residual that is a multiple of one candidate term, read off
 * one entry and checked against all of them, so the search is over the
 * small rationals and not over the entries.
 */
function matchesScaleValues(
  field: GFpField,
  termValues: number[],
  samples: Array<{ env: ReturnType<typeof makeEnv<number>>; diff: number[] }>,
): number | null {
  const termValuesPerSample: number[][] = [];
  let at = 0;
  for (const { diff } of samples) {
    termValuesPerSample.push(termValues.slice(at, at + diff.length));
    at += diff.length;
  }

  // The scale is read off an entry where the term is nonzero, then checked
  // against every entry, so the search stays over the small rationals
  let scale: { n: number; d: number } | null = null;
  for (let s = 0; s < termValuesPerSample.length && scale === null; s++) {
    for (let i = 0; i < termValuesPerSample[s].length; i++) {
      if (termValuesPerSample[s][i] === 0) continue;
      scale = niceScale(field, field.div(samples[s].diff[i], termValuesPerSample[s][i]));
      if (scale) break;
    }
  }
  if (scale === null) return null;

  for (let s = 0; s < samples.length; s++) {
    for (let i = 0; i < samples[s].diff.length; i++) {
      if (field.mul(field.fromRational(scale.n, scale.d), termValuesPerSample[s][i]) !== samples[s].diff[i]) {
        return null;
      }
    }
  }
  return scale.n / scale.d;
}

/** The small rational a field element stands for, if it is one. */
function niceScale(field: GFpField, value: number): { n: number; d: number } | null {
  for (let a = -12; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      if (field.fromRational(a, b) === value) return { n: a, d: b };
    }
  }
  return null;
}

function scaleText(scale: number): string {
  if (scale === 1) return '+';
  if (scale === -1) return '-';
  if (Number.isInteger(scale)) return scale > 0 ? `+ ${scale}` : `- ${-scale}`;
  return scale > 0 ? `+ ${scale}` : `- ${-scale}`;
}

/** The declaration that would add the missing property. */
export function assumptionDecl(name: string, prop: string, dims: string): string {
  return `${canonicalizeSymbol(name)}: ${prop} ${dims}`;
}

export type { Span };
