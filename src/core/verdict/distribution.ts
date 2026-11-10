/**
 * A distribution claim, `f ~ \mathcal{N}(m, S)`.
 *
 * For a Gaussian the first two moments determine the law, so the claim is
 * checked by matching the mean and the covariance exactly, over the primes,
 * with the rational quadrature. The left side is assumed Gaussian; for an
 * affine function of a Gaussian it is, and the assumption is listed in the
 * card, because SAMOSA does not prove normality, it proves moments.
 *
 * The claim can come back as this:
 *   ok         both moments match on every sampled instance;
 *   wrong      some instance makes them differ;
 *   unchecked  no Gaussian variable is declared, or the moments are not
 *              polynomials of a degree the quadrature integrates.
 */

import { inferType } from '../types.ts';
import { sampleFor } from './shared.ts';
import { collectDimVarsFor } from '../dims.ts';
import { dimSizeOf } from '../types.ts';
import { sizeSettings } from './plan.ts';
import { evalNode, makeEnv } from '../evaluate.ts';
import { Sampler } from '../sample.ts';
import { rngFor } from '../prng.ts';
import { GFpField, P1 } from '../fields/gfp.ts';
import { isMatrixVal } from '../value.ts';
import type { Val } from '../value.ts';
import type { Field } from '../fields/types.ts';
import type { Node } from '../ir.ts';
import type { Step, StepOptions, GuaranteeCard, StepResult } from './types.ts';
import { checkExact } from './exact.ts';
import type { TypeContext } from '../types.ts';
import type { Defs } from '../ir.ts';

/** The name of the density calls the parser produces for \mathcal N. */
const NORMAL_DENSITIES = new Set(['normalDensity', 'normal', 'N']);

/** Replace every occurrence of a symbol with a node. */
function replaceSymbol(node: Node, from: string, replacement: Node): Node {
  const map = (n: Node): Node => {
    if (n.k === 'sym') return n.name === from ? replacement : n;
    if ('args' in n && Array.isArray((n as { args?: Node[] }).args)) {
      return { ...n, args: (n as { args: Node[] }).args.map(map) } as Node;
    }
    if (n.k === 'bigop') {
      return { ...n, lo: n.lo ? map(n.lo) : null, hi: n.hi ? map(n.hi) : null, body: map(n.body) };
    }
    if (n.k === 'deriv') return { ...n, f: map(n.f), wrt: n.wrt.map(map) };
    if (n.k === 'block') return { ...n, rows: n.rows.map((row) => row.map(map)) };
    if (n.k === 'expect') return { ...n, args: n.args.map(map) };
    return n;
  };
  return map(node);
}

/** Compares two values entry by entry over the field. */
function valuesDiffer(
  field: Field<number>,
  a: Val<number>,
  b: Val<number>,
): boolean {
  if (a.k !== b.k) return true;
  if (a.k === 's' && b.k === 's') return !field.eq(a.v, b.v);
  if (a.k === 'm' && b.k === 'm') {
    if (a.m.r !== b.m.r || a.m.c !== b.m.c) return true;
    for (let i = 0; i < a.m.d.length; i++) if (!field.eq(a.m.d[i], b.m.d[i])) return true;
    return false;
  }
  return true;
}

/** A scalar multiple of a node; `2 x` parses, so the factor is literal. */
function timesTwo(node: Node): Node {
  return {
    k: 'op',
    op: 'mul',
    args: [{ k: 'num', value: { n: 2, d: 1 } }, node],
    span: node.span,
  } as Node;
}

/**
 * Is this expression affine in the random variable?
 *
 * For a polynomial, f is affine iff its second difference vanishes: for any
 * instances x and any shift pattern, f(x + y + z) − f(x + y) − f(x + z) +
 * f(x) = 0. The test below compares g(x) = f(2x) − 2f(x) at two independent
 * instances: for an affine f, g is the constant −f(0); anything else varies.
 * The check runs over exact field elements, never over floats.
 */
function isAffineIn(lhs: Node, rv: string, rvTy: { t: string; r?: import('../decl.ts').Dim; c?: import('../decl.ts').Dim }, ctx: TypeContext, defs: import('../ir.ts').Defs): boolean {
  const rvNode = { k: 'sym', name: rv, display: rv } as Node;
  const f2x = replaceSymbol(lhs, rv, timesTwo(rvNode));
  const twoLhs = timesTwo(lhs);
  const field = new GFpField(P1);
  const rng = rngFor(20261110, 'affine-check');
  for (let probe = 0; probe < 4; probe++) {
    // the same environment twice, only the variable moves
    const sampler = new Sampler(field, rngFor(20261110, 'affine-check', probe));
    const stepLike = { symbols: new Set([...collectSymbolNames(lhs), rv]), lhs, rhs: lhs, span: { from: 0, to: 0 } } as never;
    const dimVars = collectDimVarsFor(ctx, lhs, lhs, defs);
    const setting = sizeSettings(dimVars)[0] ?? new Map();
    const sampled = sampleFor(ctx, stepLike, defs, setting, sampler, new Set(), probe);
    if (sampled === 'unknown') return false; // cannot verify affinity
    const env = makeEnv(field, rng);
    env.defs = defs;
    env.sizes = new Map(setting);
    env.quad = sampled.quad;
    const draw = (): Val<number> => {
      if (rvTy.t === 'mat') {
        const r = rvTy.r ? dimSizeOf(ctx, rvTy.r, setting) : 1;
        const c = rvTy.c ? dimSizeOf(ctx, rvTy.c, setting) : 1;
        return { k: 'm', m: sampler.sampleGeneral(r, c) };
      }
      return { k: 's', v: field.random(rng) } as never;
    };
    const matrixLike = rvTy.t === 'mat';
    const w1 = draw();
    const w2 = draw();
    const assign = (value: typeof w1): typeof w1 => (matrixLike ? (value as typeof w1) : ({ k: 's', v: (value as { v: number }).v } as typeof w1));
    const evalG = (which: '1' | '2'): Val<number> => {
      const values = new Map(sampled.values);
      for (const [name, value] of sampled.values.entries()) values.set(name, value);
      values.set(rv, which === '1' ? assign(w1) as never : assign(w2) as never);
      env.values = values;
      const a = evalNode(field, f2x, env) as import('../value.ts').Val<number>;
      const b = evalNode(field, twoLhs, env) as import('../value.ts').Val<number>;
      return subtractVal(field, a, b);
    };
    try {
      const g1 = evalG('1');
      const g2 = evalG('2');
      if (valuesDiffer(field, g1, g2)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** All the symbol names of a node, for the sampler. */
function collectSymbolNames(node: Node): Set<string> {
  const out = new Set<string>();
  const walk = (n: Node): void => {
    if (n.k === 'sym') {
      out.add(n.name);
      return;
    }
    if ('args' in n && Array.isArray((n as { args?: Node[] }).args)) {
      for (const arg of (n as { args: Node[] }).args) walk(arg);
    }
    if (n.k === 'bigop') {
      walk(n.body);
      if (n.lo) walk(n.lo);
      if (n.hi) walk(n.hi);
    }
    if (n.k === 'deriv') {
      walk(n.f);
      for (const w of n.wrt) walk(w);
    }
    if (n.k === 'block') for (const row of n.rows) for (const cell of row) walk(cell);
    if (n.k === 'expect') for (const arg of n.args) walk(arg);
  };
  walk(node);
  return out;
}

/** Subtract two values over the field; matrices must share a shape. */
function subtractVal(
  field: Field<number>,
  a: Val<number>,
  b: Val<number>,
): Val<number> {
  if (isMatrixVal(a) && isMatrixVal(b)) {
    if (a.m.r !== b.m.r || a.m.c !== b.m.c) return a;
    const d = a.m.d.map((x: number, i: number) => field.sub(x, b.m.d[i]));
    return { k: 'm', m: { r: a.m.r, c: a.m.c, d } };
  }
  if (a.k === 's' && b.k === 's') return { k: 's', v: field.sub(a.v, b.v) };
  // mixed shapes say nothing; report the left value, the test treats it as different
  return a;
}

/** The symbols that are random variables in this context. */
function normalRvs(ctx: TypeContext): Array<{ name: string; mu: string; sigma: string }> {
  const out: Array<{ name: string; mu: string; sigma: string }> = [];
  for (const [name, info] of ctx.symbols) {
    if (info.ty.t !== 'rv') continue;
    const dist = info.ty.dist;
    if (dist.kind !== 'normal') continue;
    out.push({ name, mu: dist.mu, sigma: dist.sigma });
  }
  return out;
}

/** A synthetic equality step, for the existing exact mode to decide. */
function momentStep(parent: Step, lhs: Node, rhs: Node, id: string): Step {
  const symbols = new Set<string>();
  const collect = (node: Node): void => {
    if (node.k === 'sym') {
      symbols.add(node.name);
      return;
    }
    if ('args' in node && Array.isArray((node as { args?: Node[] }).args)) {
      for (const arg of (node as { args: Node[] }).args) collect(arg);
    }
    if (node.k === 'bigop') {
      collect(node.body);
      if (node.lo) collect(node.lo);
      if (node.hi) collect(node.hi);
    }
    if (node.k === 'expect') return;
  };
  collect(lhs);
  collect(rhs);
  return {
    id,
    row: parent.row,
    span: parent.span,
    text: parent.text,
    lhs,
    rhs,
    relation: '=',
    isDefinition: false,
    symbols,
    annotation: parent.annotation,
  };
}

/** An expectation or variance node over the free variables. */
function expectNode(op: 'E' | 'Var', arg: Node): Node {
  return { k: 'expect', op, args: [arg], over: [], span: arg.span };
}

/** The distribution claim row, checked by matching the two moments. */
export function checkDistributionClaim(
  step: Step,
  ctx: TypeContext,
  defs: Defs,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const { lhs, rhs } = step;
  const span = step.span;
  const baseCard: GuaranteeCard = {
    ...card,
    sizes: [],
    assumptions: [
      'the left side is a Gaussian; for a Gaussian the first two moments determine the law',
      ...card.assumptions,
    ],
  };
  const failure = (message: string, verdict: StepResult['verdict'] = 'unchecked'): StepResult => ({
    id: step.id,
    row: step.row,
    span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: 'sim',
    verdict,
    card: baseCard,
    message,
    reason: message,
    annotation: step.annotation,
  });

  if (!lhs || !rhs) return failure('a distribution claim needs both sides');
  // the registry is filled by the inference pass, and this path does not run one
  inferType(ctx, lhs);
  inferType(ctx, rhs);
  for (const def of defs.values()) inferType(ctx, def);

  // the right side has to be a normal density, with mean and covariance
  if (rhs.k !== 'call' || !NORMAL_DENSITIES.has(rhs.fn)) {
    return failure('SAMOSA only checks a claim to normality today');
  }
  if (rhs.args.length !== 2) {
    return failure('the normal density takes a mean and a covariance');
  }
  const [mean, covariance] = rhs.args;

  // exactly one joint Gaussian variable, declared with its parameters
  const rvs = normalRvs(ctx);
  if (rvs.length === 0) {
    return failure(
      'declare the random variable first: % samosa: x ~ \\mathcal{N}(\\mu, \\Sigma)',
    );
  }
  if (rvs.length > 1) {
    return failure('SAMOSA checks one Gaussian variable per claim today');
  }
  const rv = rvs[0].name;
  // the shape of a Gaussian lives behind the `of` of its rv type
  const tyOf = ctx.symbols.get(rv)!.ty;
  const inner = tyOf.t === 'rv' ? tyOf.of : tyOf;
  const rvTy = inner.t === 'mat'
    ? { t: 'mat' as const, r: inner.r, c: inner.c }
    : { t: 'scalar' as const };
  if (!isAffineIn(lhs, rv, rvTy, ctx, defs)) {
    // a non-affine function of a Gaussian is not Gaussian, so the
    // first two moments say nothing about the law
    return failure(
      'not an affine function of the random variable; moments do not determine the law',
    );
  }

  // E[f] = m, and Var(f) = S: the two moments decide the law, given
  // the left side is Gaussian
  const meanStep = checkExact(
    momentStep(step, expectNode('E', lhs), mean, `${step.id}:mean`),
    ctx,
    defs,
    opts,
    card,
  );
  const covStep = checkExact(
    momentStep(step, expectNode('Var', lhs), covariance, `${step.id}:covariance`),
    ctx,
    defs,
    opts,
    card,
  );

  const pick = (child: StepResult, which: string): StepResult | null => {
    if (child.verdict === 'ok') return null;
    if (child.verdict === 'wrong') {
      return {
        ...child,
        id: step.id,
        relation: 'sim',
        message: `the claimed ${which} does not match: ${child.message}`,
        reason: `the claimed ${which} does not match`,
        card: { ...child.card, assumptions: baseCard.assumptions },
        annotation: step.annotation,
      };
    }
    // unchecked or shape: propagate honestly, the moment itself could not
    // be read or decided
    return {
      ...child,
      id: step.id,
      relation: 'sim',
      message: `SAMOSA could not check the ${which}: ${child.message}`,
      reason: `SAMOSA could not check the ${which}: ${child.message}`,
      annotation: step.annotation,
    };
  };

  const meanFailure = pick(meanStep, 'mean');
  if (meanFailure) return meanFailure;
  const covFailure = pick(covStep, 'covariance');
  if (covFailure) return covFailure;

  // both moments hold on every sampled instance
  const carried = meanStep.card.assumptions.length ? meanStep.card : covStep.card;
  return {
    id: step.id,
    row: step.row,
    span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: 'sim',
    verdict: 'ok',
    mode: 'exact',
    card: {
      ...carried,
      assumptions: baseCard.assumptions,
    },
    message: 'the first two moments match; for a Gaussian these determine the law',
    annotation: step.annotation,
  };
}
