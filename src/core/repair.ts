import { GFpField } from './fields/gfp.ts';
import { evalNode, makeEnv } from './evaluate.ts';
import { Sampler } from './sample.ts';
import { rngFor } from './prng.ts';
import { renderNode } from './render.ts';
import { compareSides, sizeSettings } from './verdict.ts';
import { dimSizeOf, type TypeContext } from './types.ts';
import type { Node, Span } from './ir.ts';
import type { Fix } from './verdict.ts';
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
const BUDGET_MS = 150;

interface RepairCtx {
  ctx: TypeContext;
  lhs: Node;
  rhs: Node;
  defs: Map<string, Node>;
  seed: number;
  dimVars: string[];
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
  const started = Date.now();
  const sh: RepairCtx = { ctx, lhs, rhs, defs, seed, dimVars };
  const out: Fix[] = [];

  const shape = kind === 'shape' ? shapeRepairs(sh) : [];
  out.push(...shape);
  if (Date.now() - started > BUDGET_MS) return out;

  out.push(...mutationRepairs(sh));
  if (Date.now() - started > BUDGET_MS) return out;

  out.push(...assumptionRepairs(sh));
  if (Date.now() - started > BUDGET_MS) return out;

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
  deduped.sort((a, b) => priority(a) - priority(b) || editSize(a) - editSize(b));
  return deduped.slice(0, 3);
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
          title: mutation.title,
          edit: { span: original.span, insert: renderNode(candidate) },
          verified: true,
          detail: renderNode(candidate),
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
      values.set(name, { k: 's', v: sampler.sampleScalar() });
      continue;
    }
    if (info.ty.t !== 'mat') continue;
    const r = dimSizeOf(ctx, info.ty.r, setting);
    const c = dimSizeOf(ctx, info.ty.c, setting);
    const val = sampler.sample({ name, r, c, props: info.props });
    if (!val) return null;
    values.set(name, val);
  }
  return values;
}

// ------------------------------------------------------------ assumptions

const ASSUMPTION_TRIES: Array<{ props: Prop[]; text: string }> = [
  { props: ['sym'], text: 'symmetric' },
  { props: ['orth'], text: 'orthogonal' },
  { props: ['diag'], text: 'diagonal' },
];

/**
 * The missing assumption.
 *
 * If a step only holds once a matrix is known to be symmetric, that is the
 * repair to offer, because a hidden assumption is what turns a checkmark
 * into a lie.
 *
 * A property that the shape cannot have is never offered: a matrix that is
 * not square cannot be symmetric, so the suggestion would be nonsense.
 */
function assumptionRepairs(sh: RepairCtx): Fix[] {
  const out: Fix[] = [];
  const candidates = [...sh.ctx.symbols.values()].filter(
    (s) => s.ty.t === 'mat' && s.props.length === 0 && s.source !== 'preset',
  );
  for (const symbol of candidates) {
    for (const attempt of ASSUMPTION_TRIES) {
      if (!canHave(sh.ctx, symbol.name, attempt.props)) continue;
      if (holdsWithProps(sh, symbol.name, attempt.props)) {
        out.push({
          kind: 'assumption',
          title: `holds if ${symbol.name} is ${attempt.text}`,
          addDecl: `${symbol.name}: ${attempt.props[0]} ${dimText(sh.ctx, symbol.name)}`,
          verified: true,
        });
        return out;
      }
    }
  }
  return out;
}

/** Can a matrix of this shape have this property at all? */
function canHave(ctx: TypeContext, name: string, props: Prop[]): boolean {
  const info = ctx.symbols.get(name);
  if (!info || info.ty.t !== 'mat') return false;
  const r = info.ty.r;
  const c = info.ty.c;
  const square =
    typeof r === 'number' && typeof c === 'number' ? r === c : typeof r !== 'number' && typeof c !== 'number' && r.v === c.v;
  // symmetry, orthogonality and diagonality all need a square matrix
  if (props.includes('sym') || props.includes('orth') || props.includes('diag')) return square;
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
    const values = sampleSymbols(sh.ctx, sh, setting, sampler);
    if (!values) continue;
    for (const [n, value] of values.entries()) if (value) env.values.set(n, value);
    try {
      evalNode(field, rhs, env);
      return true;
    } catch {
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
    const values = sampleSymbols(sh.ctx, sh, setting, sampler);
    if (!values) return out;
    for (const [name, value] of values.entries()) if (value) env.values.set(name, value);
    try {
      const l = evalNode(field, sh.lhs, env);
      const r = evalNode(field, sh.rhs, env);
      if (l.k !== 'm' || r.k !== 'm') return out;
      const d = l.m.d.map((x, i) => field.sub(x, r.m.d[i]));
      samples.push({ env, diff: d });
    } catch {
      return out;
    }
  }
  if (samples.length < 2) return out;

  const terms = candidateTerms(sh);

  for (const [text, term] of terms) {
    const scale = matchesScale(field, term, samples);
    if (scale === null) continue;
    out.push({
      kind: 'residual',
      title: `this step is off by exactly ${scaleText(scale)} ${text}`,
      edit: { span: sh.rhs.span, insert: `${renderNode(sh.rhs)} + ${scaleText(scale)} ${text}` },
      verified: false,
      detail: text,
    });
    if (out.length >= 3) break;
  }
  return out;
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

function matchesScale(
  field: GFpField,
  term: Node,
  samples: Array<{ env: ReturnType<typeof makeEnv<number>>; diff: number[] }>,
): number | null {
  // The term is evaluated on the same instances as the difference, or the
  // two would never agree.
  const termValues: number[][] = [];
  for (const { env, diff } of samples) {
    let value: number[];
    try {
      const t = evalNode(field, term, env);
      if (t.k !== 'm') return null;
      value = t.m.d;
    } catch {
      return null;
    }
    if (value.length !== diff.length) return null;
    termValues.push(value);
  }

  // The scale is read off one entry and then checked against all of them, so
  // the search is over the small rationals and not over the entries.
  const scale = niceScale(field, field.div(samples[0].diff[0], termValues[0][0]));
  if (scale === null) return null;

  for (let s = 0; s < samples.length; s++) {
    for (let i = 0; i < samples[s].diff.length; i++) {
      if (field.mul(field.fromRational(scale.n, scale.d), termValues[s][i]) !== samples[s].diff[i]) {
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
