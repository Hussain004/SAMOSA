/**
 * The helpers the evaluation engine is built from.
 *
 * Everything in here is used by at least two of the mode modules; the mode
 * logic stays in its own module.
 */
import type { Field } from '../fields/types.ts';
import {
  matAdd,
  matInv,
  matMul,
  transpose,
  type Mat,
} from '../linalg.ts';
import { Sampler } from '../sample.ts';
import type { Node } from '../ir.ts';
import {
  dimSizeOf,
  type TypeContext,
} from '../types.ts';
import type { Step, Counterexample } from './types.ts';
import { collectDimVarsFor } from '../dims.ts';
import { GAUSS7, type QuadVar } from '../quadrature.ts';
import { isGFpField } from '../fields/gfp.ts';
import type { Prop } from '../decl.ts';
import { isMatrixVal, isScalarVal, scalar, type Val } from '../value.ts';
import { DEFAULT_FUNCTIONS } from '../parse.ts';
export function collectSymbols(node: Node | undefined, into: Set<string>): void {
  if (!node) return;
  switch (node.k) {
    case 'sym':
      into.add(node.name);
      return;
    case 'num':
      return;
    case 'op':
    case 'call':
      for (const a of node.args) collectSymbols(a, into);
      return;
    case 'deriv':
      collectSymbols(node.f, into);
      for (const w of node.wrt) collectSymbols(w, into);
      return;
    case 'expect':
      for (const a of node.args) collectSymbols(a, into);
      return;
    case 'bigop':
      collectSymbols(node.lo ?? undefined, into);
      collectSymbols(node.hi ?? undefined, into);
      collectSymbols(node.body, into);
      return;
    case 'block':
      for (const row of node.rows) for (const cell of row) collectSymbols(cell, into);
      return;
    case 'raw':
      return;
  }
}

/**
 * The reason the parser left unread, if a side of the step carries a raw
 * node (review 4.5): the row is a question, never a silent misread.
 */

export function rawReason(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  if (node.k === 'raw') return node.text;
  switch (node.k) {
    case 'op':
    case 'call':
      for (const a of node.args) {
        const r = rawReason(a);
        if (r) return r;
      }
      return undefined;
    case 'deriv':
      return rawReason(node.f);
    case 'expect':
      for (const a of node.args) {
        const r = rawReason(a);
        if (r) return r;
      }
      return undefined;
    case 'bigop':
      return rawReason(node.lo ?? undefined) ?? rawReason(node.hi ?? undefined) ?? rawReason(node.body);
    case 'block':
      for (const row of node.rows) {
        for (const cell of row) {
          const r = rawReason(cell);
          if (r) return r;
        }
      }
      return undefined;
    default:
      return undefined;
  }
}

/** The parsed shape of a source: what the checker and the explainer both walk. */

export function freeVariables(step: Step): Set<string> {
  const out = new Set<string>();
  const add = (node: Node | undefined) => {
    if (node && node.k === 'deriv') {
      for (const w of node.wrt) if (w.k === 'sym') out.add(w.name);
    }
  };
  add(step.lhs);
  add(step.rhs);
  if (step.premise) {
    add(step.premise.lhs);
    add(step.premise.rhs);
  }
  if (step.conclusion) {
    add(step.conclusion.lhs);
    add(step.conclusion.rhs);
  }
  return out;
}

/** The name a definition binds, whether it is a symbol or a function. */

export function stepNodes(step: Step): Node[] {
  const out: Node[] = [];
  if (step.lhs) out.push(step.lhs);
  if (step.rhs) out.push(step.rhs);
  if (step.premise?.lhs) out.push(step.premise.lhs);
  if (step.premise?.rhs) out.push(step.premise.rhs);
  if (step.conclusion?.lhs) out.push(step.conclusion.lhs);
  if (step.conclusion?.rhs) out.push(step.conclusion.rhs);
  return out;
}

/**
 * Samples every free symbol the step needs.
 *
 * The variety pegs one corner per structured symbol (review 3.1) and one
 * sign per scalar (review 3.4): symbol i reads bit i of the trial index, so
 * every combination of corners is evaluated across trials and no false
 * verdict can hide in the corner nobody drew. The peg index is a counter in
 * sampling order, which is deterministic for a given step.
 */

export function defNameOf(lhs: Node | undefined, ctx: TypeContext): string | undefined {
  if (!lhs) return undefined;
  if (lhs.k === 'sym') {
    // a powered symbol, like \Sigma^{3/2}, is not a fresh name (review 4.2):
    // a row that assigns to one is a claim about it, not a definition of it.
    // A decorative label, like the star of w^\star, is part of the name, and
    // the corpus defines w^\star, so those stay definable.
    const caret = lhs.name.lastIndexOf('^');
    if (caret >= 0 && /^[+-]?[\d.]/.test(lhs.name.slice(caret + 1))) return undefined;
    return lhs.name;
  }
  if (lhs.k === 'call') {
    const decl = ctx.decls.get(lhs.fn);
    if (decl && decl.kind === 'function') return lhs.fn;
    // tr, det and the rest are functions, not variables
    if (DEFAULT_FUNCTIONS.has(lhs.fn)) return undefined;
    return lhs.fn;
  }
  return undefined;
}

/** Every node a step mentions, including the premise and the conclusion. */

export function isFunctionName(ctx: TypeContext, name: string): boolean {
  const decl = ctx.decls.get(name);
  return decl?.kind === 'function';
}

/**
 * Are two values the same?
 *
 * Over a finite field that is exact equality. Over the reals it is a
 * relative comparison, because the last bits of a float are noise.
 */

export function hasExpectation(step: Step): boolean {
  const check = (node: Node | undefined): boolean => {
    if (!node) return false;
    if (node.k === 'expect') return true;
    if (node.k === 'op' || node.k === 'call') return node.args.some(check);
    if (node.k === 'deriv') return check(node.f);
    if (node.k === 'bigop') return check(node.body);
    if (node.k === 'block') return node.rows.flat().some(check);
    return false;
  };
  return stepNodes(step).some(check);
}

/** The variables a derivative is taken with respect to: they stay free. */

export function fieldClose<T>(field: Field<T>, a: T, b: T): boolean {
  if (isGFpField(field)) return field.eq(a, b);
  const x = field.toNumber(a);
  const y = field.toNumber(b);
  const scale = Math.max(1, Math.abs(x), Math.abs(y));
  return Math.abs(x - y) <= 1e-12 * scale;
}

/** Does the step contain an expectation? Those are checked by quadrature. */

export function settingKey(setting: Map<string, number>): string {
  return [...setting.entries()].map(([k, v]) => `${k}=${v}`).join(',');
}

/**
 * The assumptions a verdict rests on.
 *
 * Every default or inferred assumption is listed, because hiding one can
 * produce a false checkmark, which is the worst thing that can happen.
 */

export function isSingular<T>(field: Field<T>, m: Mat<T>): boolean {
  if (m.r !== m.c) return false;
  try {
    matInv(field, m);
    return false;
  } catch {
    return true;
  }
}


export function singularByDesign(props: Prop[], r: number, c: number, corner: number): boolean {
  const has = (target: string) => props.some((x) => typeof x === 'string' && x === target);
  if (has('zero')) return true;
  if (has('idem') || has('proj')) {
    const rank = corner === 0 ? Math.min(r, c) : Math.max(1, Math.min(r, c) - 1);
    return rank < Math.min(r, c);
  }
  if (has('skew')) return r === c && r % 2 === 1;
  return false;
}


export function valuesEqual<T>(field: Field<T>, a: Val<T>, b: Val<T>): boolean {
  if (a.k === 's' && b.k === 's') return field.eq(a.v, b.v);
  // a 1 by 1 matrix and a scalar are the same thing
  if (a.k === 'm' && b.k === 's' && a.m.r === 1 && a.m.c === 1) return field.eq(a.m.d[0], b.v);
  if (a.k === 's' && b.k === 'm' && b.m.r === 1 && b.m.c === 1) return field.eq(a.v, b.m.d[0]);
  if (a.k === 'm' && b.k === 'm') {
    if (a.m.r !== b.m.r || a.m.c !== b.m.c) return false;
    for (let i = 0; i < a.m.d.length; i++) if (!field.eq(a.m.d[i], b.m.d[i])) return false;
    return true;
  }
  return false;
}

// -------------------------------------------------------- proportionality

/**
 * A proportionality, checked by the log difference.
 *
 * `p(x) \propto g(x)` says that the ratio of the two does not depend on x.
 * So the difference of the logs is evaluated at three values of the variable,
 * and it has to be the same at all three.
 */

export function sampledNames(step: Step, defs: Map<string, Node>, free: Set<string> = new Set()): string[] {
  const names = new Set<string>();
  for (const node of stepNodes(step)) collectSymbols(node, names);
  for (const name of [...names]) {
    const def = defs.get(name);
    if (def) collectSymbols(def, names);
  }
  // a component names its parent: `x_i` is read from `x`, so the parent
  // must be sampled even though the row never writes it out
  for (const name of [...names]) {
    const cut = name.indexOf('_');
    if (cut > 0) names.add(name.slice(0, cut));
  }
  return [...names].filter((name) => !(defs.has(name) && !free.has(name)));
}

/** Has this structure a singular corner by construction? */

export function sampleFor<T>(
  ctx: TypeContext,
  step: Step,
  defs: Map<string, Node>,
  setting: Map<string, number>,
  sampler: Sampler<T>,
  free: Set<string> = new Set(),
  variety = 0,
): { values: Map<string, Val<T>>; quad: Map<string, QuadVar<any>> } | 'unknown' {
  const values = new Map<string, Val<T>>();
  const quad = new Map<string, QuadVar<any>>();
  const names = sampledNames(step, defs, free);
  const pegs = new Map(names.map((n, i) => [n, i]));

  for (const name of names) {
    if (values.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
    // a component has no sampling of its own: it is an entry of the parent
    if (info.props.some((p) => p === 'component')) continue;
    const peg = pegs.get(name) ?? 0;
    if (info.ty.t === 'rv') {
      // a random variable: sample the root of its covariance, so that the
      // covariance symbol and the variable agree
      const dist = info.ty.dist;
      const f = sampler.field;
      // a literal in the distribution is a specific number, not a generic
      // symbol to guess. A literal covariance other than the identity is
      // not supported, so such a row comes back unevaluated rather than
      // sampled dishonestly
      const literalNumber = (text: string): [number, number] | null => {
        const match = text.trim().match(/^(-?\d+)(?:\/(\d+))?$/);
        if (!match) return null;
        const denominator = match[2] ? Number(match[2]) : 1;
        if (!denominator) return null;
        return [Number(match[1]), denominator];
      };
      const sigma = dist.kind === 'normal' ? dist.sigma : '';
      const identityLiteral = sigma === 'I' || sigma === '1';
      // a zero mean literal is unambiguous at any size; a nonzero literal
      // mean for a vector is not, so it is not accepted
      const muLiteral =
        dist.kind === 'normal' && dist.mu.trim() !== '0' ? literalNumber(dist.mu) : null;
      const sigmaLiteral = dist.kind === 'normal' && !identityLiteral ? literalNumber(sigma) : null;
      const size = info.ty.of.t === 'mat' ? dimSizeOf(ctx, info.ty.of.r, setting) : 1;
      if (muLiteral !== null && size !== 1) return 'unknown';
      if (sigmaLiteral !== null) return 'unknown';
      let mean: Val<T>;
      if (dist.kind === 'normal' && dist.mu !== '0') {
        if (muLiteral !== null) {
          mean = { k: 'm', m: { r: 1, c: 1, d: [f.fromRational(muLiteral[0], muLiteral[1])] } };
        } else {
          const existing = values.get(dist.mu);
          if (existing) {
            mean = existing;
          } else {
            mean = { k: 'm', m: sampler.sampleGeneral(size, 1) };
            values.set(dist.mu, mean);
          }
        }
      } else if (dist.kind === 'normal') {
        // N(0, Sigma) has the mean it says: zero. A random mean here gave
        // E[x x^T] = Sigma a false cross
        const f0 = sampler.field;
        mean = { k: 'm', m: { r: size, c: 1, d: new Array(size).fill(f0.zero) } };
      } else {
        mean = { k: 'm', m: sampler.sampleGeneral(size, 1) };
      }
      // the identity covariance is its own square root, and the quadrature
      // with a random root drew the wrong distribution
      const root =
        dist.kind === 'normal' && identityLiteral
          ? { r: size, c: size, d: Array.from({ length: size * size }, (_, i) => (Math.floor(i / size) === i % size ? f.one : f.zero)) }
          : sampler.sampleGeneral(size, size);
      const f0 = sampler.field;
      if (dist.kind === 'normal' && !identityLiteral) {
        values.set(dist.sigma, { k: 'm', m: matMul(f0, root, transpose(root)) });
      }
      const z = sampler.sampleGeneral(size, 1);
      const meanMat = isMatrixVal(mean) ? mean.m : { r: size, c: 1, d: new Array<T>(size).fill(f.zero) };
      values.set(name, { k: 'm', m: matAdd(f, meanMat, matMul(f, root, z)) });
      values.set(`__mean_${name}`, mean);
      quad.set(name, { name, mean, root, dim: size, rule: GAUSS7 });
      continue;
    }
    if (info.ty.t === 'scalar') {
      const value = info.props.some((p) => p === 'pos')
        ? sampler.samplePositiveScalar()
        : sampler.sampleScalar(variety, peg);
      values.set(name, scalar(value));
      continue;
    }
    if (info.ty.t !== 'mat') continue;
    const r = dimSizeOf(ctx, info.ty.r, setting);
    const c = dimSizeOf(ctx, info.ty.c, setting);
    // A structure that is singular by construction (a rank deficient
    // idempotent, for instance) never passes a singular rejection, so the
    // rejection is skipped for it and the engine relies on the domain error
    // of a step that actually inverts one (review 5.4).
    const forced = singularByDesign(info.props, r, c, (variety >> peg) & 1);
    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const val = sampler.sample({ name, r, c, props: info.props, variety: (variety >> peg) & 1 });
      if (!val) continue;
      if (val.k === 'm' && !forced && isSingular(sampler.field, val.m)) continue;
      values.set(name, val);
      placed = true;
      break;
    }
    if (!placed) return 'unknown';
  }
  return { values, quad };
}

/** The names a step samples: its own, plus the free names of its definitions. */

export function collectAssumptions(ctx: TypeContext, step: Step): string[] {
  const out = new Set<string>();
  for (const name of step.symbols) {
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.assumption) out.add(info.assumption);
    const props = info.props
      .map((p) => (typeof p === 'string' ? PROP_WORDS[p] : p && 'rank' in p ? `of rank ${p.rank}` : null))
      .filter((p): p is string => Boolean(p));
    // The identity, the zero matrix and the ones vector have their own
    // assumption, so the structural sentence would say the same thing twice.
    const alreadySaid = info.props.every(
      (p) => typeof p === 'string' && (p === 'ident' || p === 'zero' || p === 'ones'),
    );
    if (props.length && !(info.assumption && alreadySaid)) {
      out.add(`${info.display || name} is ${props.join(' and ')}`);
    }
  }
  if (!out.size) out.add('every symbol was declared');
  return [...out];
}

/** How the structure of a symbol reads in a sentence. */

export function collectDimVars(ctx: TypeContext, step: Step, defs: Map<string, Node>): string[] {
  const lhs = step.lhs;
  const rhs = step.rhs;
  if (step.premise?.lhs || step.conclusion?.lhs) {
    return collectDimVarsFor(ctx, step.conclusion?.lhs ?? lhs, step.conclusion?.rhs ?? rhs, defs);
  }
  return collectDimVarsFor(ctx, lhs, rhs, defs);
}

/** The size settings of a step: three of them, with the sizes the plan pins down. */

export function buildCounterexample<T>(
  _ctx: TypeContext,
  _step: Step,
  setting: Map<string, number>,
  sampled: Map<string, Val<T>>,
  lhs: Val<T>,
  rhs: Val<T>,
  field: Field<T>,
): Counterexample {
  const dims: Record<string, number> = {};
  for (const [k, v] of setting) dims[k] = v;
  const residues: Record<string, unknown> = {};
  for (const [name, val] of sampled) {
    residues[name] = val.k === 's' ? val.v : val.m.d;
  }
  const lhsVal = lhs.k === 's' ? lhs.v : lhs.m.d;
  const rhsVal = rhs.k === 's' ? rhs.v : rhs.m.d;
  const diff =
    lhs.k === 's' && rhs.k === 's'
      ? field.sub(lhs.v, rhs.v)
      : lhs.k === 'm' && rhs.k === 'm'
        ? lhs.m.d.map((x, i) => field.sub(x, rhs.m.d[i]))
        : null;
  // The residues are exact but unreadable, so they live under the debug key.
  // The values a person reads come from the shrinker.
  return {
    dims,
    values: {},
    lhs: null,
    rhs: null,
    diff: null,
    numpy: '',
    julia: '',
    matlab: '',
    debug: { residues, lhs: lhsVal, rhs: rhsVal, diff },
  };
}

// ------------------------------------------------------------- implications


export function asScalar<T>(_field: Field<T>, val: Val<T>): T | null {
  if (isScalarVal(val)) return val.v;
  if (val.m.r === 1 && val.m.c === 1) return val.m.d[0];
  return null;
}


export const PROP_WORDS: Record<string, string> = {
  sym: 'symmetric',
  spd: 'symmetric positive definite',
  psd: 'symmetric positive semi definite',
  orth: 'orthogonal',
  rot: 'a rotation',
  diag: 'diagonal',
  triu: 'upper triangular',
  tril: 'lower triangular',
  skew: 'skew symmetric',
  idem: 'idempotent',
  proj: 'a projector',
  unit: 'unit length',
  unitary: 'unitary',
  complex: 'complex',
  hermitian: 'Hermitian',
  stoch: 'stochastic',
  pos: 'positive',
  int: 'an integer',
  ident: 'the identity',
  zero: 'zero',
  ones: 'ones',
};

// ------------------------------------------------------------- counterexample
