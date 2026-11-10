/**
 * Non-polynomial expectations, by Monte Carlo sampling.
 *
 * The quadrature is exact for polynomials. For a non-polynomial integrand
 * (sin, exp, a rational function, anything), SAMOSA can only sample: the
 * integrand is evaluated at a large seeded number of Gaussian draws, and
 * the claim is compared against the mean. The verdict is one of these:
 *
 *   wrong         some entry is more than 6 standard errors from the claim;
 *   inconclusive  every entry is within 6 standard errors. Never a checkmark.
 *
 * A Monte Carlo estimate can refute and it can fail to refute. It cannot
 * certify. The samples are drawn from the seeded generator, so the same
 * input gives the same verdict everywhere.
 */

import Decimal from 'decimal.js';
import { DecField } from '../fields/dec.ts';
import { inferType } from '../types.ts';
import { collectDimVarsFor } from '../dims.ts';
import type { TypeContext } from '../types.ts';
import type { Node } from '../ir.ts';
import type { Mat } from '../linalg.ts';
import type { Val } from '../value.ts';
import { collectSymbols, freeVariables, sampleFor, settingKey } from './shared.ts';
import { degreeInVar } from '../quadrature.ts';
import { sizeSettings } from './plan.ts';
import { evalNode, makeEnv } from '../evaluate.ts';
import { Sampler } from '../sample.ts';
import { rngFor } from '../prng.ts';
import { matAdd, matMul } from '../linalg.ts';
import type { Step, StepOptions, GuaranteeCard, StepResult } from './types.ts';
import type { Defs } from '../ir.ts';

const SAMPLES_PER_EXPECTATION = 20_000;
const SIGMA_LEVEL = 6;
const MAX_VARIATE_DIM = 4;

interface ExpectationEstimate {
  /** the value, as a Decimal matrix or scalar */
  mean: Val<Decimal>;
  /** the standard error of each entry, same shape as the value */
  stderr: Val<Decimal>;
}

/** Every expect node of a tree, in order. */
function collectExpectations(node: Node, out: Node[] = []): Node[] {
  if (node.k === 'expect') {
    out.push(node);
    return out;
  }
  if ('args' in node && Array.isArray((node as { args?: Node[] }).args)) {
    for (const arg of (node as { args: Node[] }).args) collectExpectations(arg, out);
  }
  if (node.k === 'bigop') {
    collectExpectations(node.body, out);
    if (node.lo) collectExpectations(node.lo, out);
    if (node.hi) collectExpectations(node.hi, out);
  }
  if (node.k === 'deriv') {
    collectExpectations(node.f, out);
    for (const wrt of node.wrt) collectExpectations(wrt, out);
  }
  if (node.k === 'block') for (const row of node.rows) for (const cell of row) collectExpectations(cell, out);
  return out;
}

/** The matrix of iid standard normals, one column per component. */
function normalColumn(field: DecField, rng: () => number, dim: number): Mat<Decimal> {
  const d = new Array<Decimal>(dim).fill(field.zero);
  for (let i = 0; i < dim; i++) d[i] = field.normal(rng);
  return { r: dim, c: 1, d };
}

/** Accumulate a matrix entrywise into the sum and the sum of squares. */
function accumulate(
  field: DecField,
  m: Mat<Decimal>,
  sums: Map<number, Decimal>,
  squares: Map<number, Decimal>,
  count: Map<number, number>,
): void {
  for (let i = 0; i < m.d.length; i++) {
    const acc = sums.get(i);
    const sq = squares.get(i);
    const n = count.get(i) ?? 0;
    sums.set(i, (acc ?? field.zero).add(m.d[i]));
    squares.set(i, (sq ?? field.zero).add(m.d[i].mul(m.d[i])));
    count.set(i, n + 1);
  }
}

/** One expectation, estimated by sampling. */
function estimateExpectation(
  field: DecField,
  node: Extract<Node, { k: 'expect' }>,
  ctx: TypeContext,
  defs: Defs,
  values: Map<string, Val<Decimal>>,
  quad: Map<string, import('../quadrature.ts').QuadVar<Decimal>>,
  rng: () => number,
): ExpectationEstimate | null {
  const body = node.args[0];
  if (!body) return null;
  const rvSet = new Set<string>();
  collectSymbols(body, rvSet);
  const rvNames = [...rvSet].filter((name) => ctx.symbols.get(name)?.ty.t === 'rv');
  if (!rvNames.length) return null;
  // every random variable in the body must be Gaussian, or the estimate
  // is sampling the wrong law
  for (const name of rvNames) {
    const info = ctx.symbols.get(name)!;
    if (info.ty.t !== 'rv') return null;
    if (info.ty.dist.kind !== 'normal') return null;
  }
  for (const rv of rvNames) {
    const entry = quad.get(rv);
    if (!entry) return null;
    if (entry.dim > MAX_VARIATE_DIM) return null;
  }

  // the sums of powers, per entry, so the standard error is elementwise
  const rows = 0;
  void rows;
  const sums = new Map<number, Decimal>();
  const squares = new Map<number, Decimal>();
  const count = new Map<number, number>();
  let shape: { r: number; c: number } | null = null;
  let scalar = false;

  for (let trial = 0; trial < SAMPLES_PER_EXPECTATION; trial++) {
    const env = makeEnv(field, rng);
    env.defs = defs;
    // the same environment, with the variables overridden by one draw each
    const envValues = new Map(values);
    for (const rv of rvNames) {
      const entry = quad.get(rv)!;
      const z = normalColumn(field, rng, Math.max(1, entry.dim));
      const mean = entry.mean;
      if (!isMatrixMean(mean)) {
        envValues.set(rv, { k: 'm', m: { r: 1, c: 1, d: [mean.v] } });
        continue;
      }
      const x = matMul(field, entry.root, z);
      envValues.set(rv, { k: 'm', m: matAdd(field, mean.m, x) });
    }
    env.values = envValues;
    let value: Val<Decimal>;
    try {
      value = evalNode(field, body, env);
    } catch {
      return null;
    }
    if (value.k === 's') {
      scalar = true;
      accumulate(field, { r: 1, c: 1, d: [value.v] }, sums, squares, count);
      shape = { r: 1, c: 1 };
      continue;
    }
    accumulate(field, value.m, sums, squares, count);
    shape = { r: value.m.r, c: value.m.c };
  }

  if (!shape) return null;
  const n = SAMPLES_PER_EXPECTATION;
  const meanD = new Array<Decimal>(sums.size).fill(field.zero);
  const varD = new Array<Decimal>(sums.size).fill(field.zero);
  for (const [i, sum] of sums) {
    meanD[i] = sum.div(n);
    varD[i] = Decimal.max(
      field.zero,
      squares.get(i)!.div(n).sub(meanD[i].mul(meanD[i])).mul(n / (n - 1)),
    );
  }
  const meanVal: Val<Decimal> = shape.r === 1 && shape.c === 1 && scalar
    ? { k: 's', v: meanD[0] }
    : { k: 'm', m: { r: shape.r, c: shape.c, d: meanD } };
  const stderrVal: Val<Decimal> = shape.r === 1 && shape.c === 1 && scalar
    ? { k: 's', v: varD[0].div(n).sqrt() }
    : { k: 'm', m: { r: shape.r, c: shape.c, d: varD.map((v) => v.div(n).sqrt()) } };
  return { mean: meanVal, stderr: stderrVal };
}

function isMatrixMean(mean: Val<Decimal>): mean is { k: 'm'; m: Mat<Decimal> } {
  return mean.k === 'm';
}

/**
 * Replace each expectation in a tree with a fresh symbol, so the estimates
 * can be bound as environment values. The names are internal and cannot
 * collide with the parser's output.
 */
function substituteExpectations(
  node: Node,
  table: Map<Node, ExpectationEstimate>,
): { node: Node; slots: Array<{ node: Node; symbol: string }> } {
  const slots: Array<{ node: Node; symbol: string }> = [];
  const walk = (n: Node): Node => {
    const found = table.get(n);
    if (found) {
      const symbol = `@mc${slots.length}`;
      slots.push({ node: n, symbol });
      return { k: 'sym', name: symbol, display: symbol, span: n.span };
    }
    if ('args' in n && Array.isArray((n as { args?: Node[] }).args)) {
      return { ...n, args: (n as { args: Node[] }).args.map(walk) } as Node;
    }
    if (n.k === 'bigop') {
      return { ...n, lo: n.lo ? walk(n.lo) : null, hi: n.hi ? walk(n.hi) : null, body: walk(n.body) };
    }
    if (n.k === 'deriv') {
      return { ...n, f: walk(n.f), wrt: n.wrt.map(walk) };
    }
    if (n.k === 'block') {
      return { ...n, rows: n.rows.map((row) => row.map(walk)) };
    }
    if (n.k === 'expect') {
      // an expectation the estimate table does not know: keep the arguments
      // walked; the caller never reads this branch
      return { ...n, args: n.args.map(walk) };
    }
    return n;
  };
  return { node: walk(node), slots };
}

/** Does this row have an expectation the quadrature cannot integrate? */
export function hasNonPolynomialExpectation(
  step: Step,
  ctx: TypeContext,
  defs: Defs,
): boolean {
  // the registry is filled by the inference pass, and this path asks for it early
  if (step.lhs) inferType(ctx, step.lhs);
  if (step.rhs) inferType(ctx, step.rhs);
  for (const def of defs.values()) inferType(ctx, def);
  for (const node of [step.lhs, step.rhs]) {
    if (!node) continue;
    for (const expectNode of collectExpectations(node)) {
      const body = (expectNode as Extract<Node, { k: 'expect' }>).args[0];
      const set = new Set<string>();
      collectSymbols(body, set);
      for (const name of set) {
        if (ctx.symbols.get(name)?.ty.t !== 'rv') continue;
        if (degreeInVar(body, name) > 7) return true;
      }
    }
  }
  return false;
}

/** Checks a row whose expectation is not a polynomial. */
export function checkMonteCarlo(
  step: Step,
  ctx: TypeContext,
  defs: Defs,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const baseCard: GuaranteeCard = {
    ...card,
    sizes: [],
    assumptions: [
      'a Monte Carlo estimate of the expectation, seeded; it can refute and it can fail to refute; it never certifies',
      ...card.assumptions,
    ],
  };
  const failure = (message: string, verdict: StepResult['verdict'] = 'unchecked'): StepResult => ({
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict,
    card: baseCard,
    message,
    reason: message,
    annotation: step.annotation,
  });

  const lhs = step.lhs;
  const rhs = step.rhs;
  if (!lhs || !rhs) return failure('a row needs both sides');

  const expectNodes = [...collectExpectations(lhs), ...collectExpectations(rhs)];
  if (expectNodes.length === 0) return failure('this mode is for rows whose expectation is not a polynomial');

  const dimVars = collectDimVarsFor(ctx, lhs, rhs, defs);
  const settings = sizeSettings(dimVars).slice(0, 2);
  const field = new DecField(50);
  const sizes: Record<string, number>[] = [];
  let refutations = 0;
  let estimateCount = 0;
  let worstExcess = 0;

  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting));
    const rng = rngFor(opts.seed, step.id, settingKey(setting), 'mc');
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rngFor(opts.seed, step.id, settingKey(setting), 'env'));
    env.defs = defs;
    env.sizes = new Map(setting);
    const sampled = sampleFor(ctx, step, defs, setting, sampler, freeVariables(step), 0);
    if (sampled === 'unknown') return failure('SAMOSA could not sample an instance for the Monte Carlo check');
    for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
    for (const [name, quad] of sampled.quad.entries()) env.quad.set(name, quad);

    // estimate each expectation in the row, at this instance
    const estimates = new Map<Node, ExpectationEstimate>();
    for (const node of expectNodes) {
      const estimate = estimateExpectation(
        field,
        node as Extract<Node, { k: 'expect' }>,
        ctx,
        defs,
        env.values,
        sampled.quad,
        rngFor(opts.seed, step.id, settingKey(setting), 'samples'),
      );
      if (!estimate) return failure('SAMOSA cannot estimate this expectation: the variable is not a Gaussian, or the body could not be averaged');
      estimates.set(node, estimate);
    }
    estimateCount += estimates.size;

    // the two sides, with the estimates bound as fresh environment symbols
    const lhsWalk = substituteExpectations(lhs, estimates);
    const rhsWalk = substituteExpectations(rhs, estimates);
    const envEst = makeEnv(field, rngFor(opts.seed, step.id, settingKey(setting), 'est'));
    envEst.defs = env.defs;
    envEst.sizes = new Map(setting);
    envEst.values = new Map(env.values);
    for (const [walk, estimates_] of [
      [lhsWalk, estimates],
      [rhsWalk, estimates],
    ] as const) {
      for (const slot of walk.slots) {
        const estimate = estimates_.get(slot.node);
        if (estimate) envEst.values.set(slot.symbol, estimate.mean);
      }
    }
    const l = evalNode(field, lhsWalk.node, envEst);
    const r = evalNode(field, rhsWalk.node, envEst);

    // the propagated standard error of the difference: the sum of the
    // squared standard errors of the estimates, in squares
    let maxExcess = 0;
    const entries = matrixEntries(field, l, r);
    if (entries === null) return failure('the two sides have incomparable shapes', 'shape');
    for (const [i, diff] of entries.entries()) {
      // the standard error of the difference at entry i: from every estimate
      let variance = new Decimal(0);
      for (const estimate of estimates.values()) {
        variance = variance.add(stderrSquaredAt(estimate, i, field));
      }
      const stderr = variance.sqrt();
      if (stderr.eq(0)) continue;
      const excess = diff.abs().div(stderr).toNumber();
      if (excess > maxExcess) maxExcess = excess;
    }
    if (maxExcess > SIGMA_LEVEL) {
      refutations += 1;
      worstExcess = Math.max(worstExcess, maxExcess);
    } else {
      worstExcess = Math.max(worstExcess, maxExcess);
    }
  }

  if (refutations > 0) {
    return failure(
      `the Monte Carlo estimate of the expectation differs from the claim by more than ${SIGMA_LEVEL} standard errors (${estimateCount * SAMPLES_PER_EXPECTATION} seeded samples)`,
      'wrong',
    );
  }

  const message = `within ${SIGMA_LEVEL} standard errors of the claim (${estimateCount * SAMPLES_PER_EXPECTATION} seeded Monte Carlo samples); never certified`;
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict: 'inconclusive',
    mode: 'numeric',
    card: { ...baseCard, sizes },
    message,
    reason: message,
    annotation: step.annotation,
  };
}

/** The entries of the difference between two vals, matched by position. */
function matrixEntries(
  field: DecField,
  l: Val<Decimal>,
  r: Val<Decimal>,
): Decimal[] | null {
  const asMat = (v: Val<Decimal>): Mat<Decimal> | null => {
    if (v.k === 's') return { r: 1, c: 1, d: [v.v] };
    return v.m;
  };
  const a = asMat(l);
  const b = asMat(r);
  if (!a || !b) return null;
  if (a.r !== b.r || a.c !== b.c) return null;
  const out = new Array<Decimal>(a.d.length).fill(field.zero);
  for (let i = 0; i < a.d.length; i++) out[i] = a.d[i].sub(b.d[i]);
  return out;
}

/** The squared standard error contributed by estimate `estimate`, at entry i. */
function stderrSquaredAt(
  estimate: ExpectationEstimate,
  entry: number,
  field: DecField,
): Decimal {
  const s = estimate.stderr;
  if (s.k === 's') return s.v.mul(s.v);
  const d = s.m.d;
  if (entry >= d.length) return field.zero;
  return d[entry].mul(d[entry]);
}
