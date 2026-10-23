import type { Field } from './fields/types.ts';
import { F64Field } from './fields/f64.ts';
import { DecField } from './fields/dec.ts';
import { GFpField, P1, P2 } from './fields/gfp.ts';
import { DomainError, matAdd, matInv, matMul, matSub, transpose, type Mat } from './linalg.ts';
import {
  evalNode,
  makeEnv,
  EvalError,
  directionalDerivative,
  mixedSecondDerivative,
} from './evaluate.ts';
import { Sampler } from './sample.ts';
import { rngFor, type Rng } from './prng.ts';
import { DEFAULT_FUNCTIONS, parseRow } from './parse.ts';
import { splitRows } from './steps.ts';
import { parseDeclarations, type SymbolDecl } from './decl.ts';
import { presetDecls } from './presets.ts';
import {
  createContext,
  degreeOf,
  dimSizeOf,
  inferType,
  unifyDim,
  type Chip,
  type SymbolInfo,
  type TypeContext,
} from './types.ts';
import { isMatrixVal, isScalarVal, scalar, type Val } from './value.ts';
import { collectDimVarsFor } from './dims.ts';
import { GAUSS7, type QuadVar } from './quadrature.ts';
import type { Assertion, Node, Relation, Span } from './ir.ts';
import type { Dim } from './decl.ts';

/**
 * The verdict engine.
 *
 * A step is checked under declarations by sampling instances of the declared
 * objects and evaluating both sides. Nothing is ever rewritten, so
 * non-commutativity, structure and shape all come for free.
 */

export const ENGINE_VERSION = '1.0.1';
export const DEFAULT_SEED = 0x5a305a;

export type Verdict = 'ok' | 'wrong' | 'shape' | 'inconclusive' | 'unchecked' | 'defined';
export type Mode = 'exact' | 'numeric' | 'quadrature';

export interface GuaranteeCard {
  trialsPerSize: number;
  sizes: Record<string, number>[];
  primes?: [number, number];
  degree?: number;
  bound?: number;
  maxDelta?: number;
  assumptions: string[];
  seed: number;
}

export interface Counterexample {
  dims: Record<string, number>;
  /** the values of the free symbols, the small integers a person can read */
  values: Record<string, unknown>;
  /** the values of the symbols the derivation defines, computed */
  derived?: Record<string, unknown>;
  lhs: unknown;
  rhs: unknown;
  diff: unknown;
  numpy: string;
  /**
   * The raw residues of the finite field.
   *
   * They are exact but unreadable, so they are kept out of the way: the
   * shrunk counterexample is what a person or an agent reads.
   */
  debug?: {
    residues: Record<string, unknown>;
    lhs: unknown;
    rhs: unknown;
    diff: unknown;
  };
}

export interface Fix {
  kind: 'mutation' | 'residual' | 'assumption' | 'shape';
  title: string;
  edit?: { span: Span; insert: string };
  addDecl?: string;
  verified: boolean;
  detail?: string;
  /** which side of the step the fix edits */
  side?: 'lhs' | 'rhs';
}

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  span: Span;
  stepId?: string;
}

export interface StepResult {
  id: string;
  row: number;
  span: Span;
  /** the source text of the row */
  text?: string;
  /** the line of the source, one based, when the caller knows it */
  line?: number;
  /** the column of the source, one based */
  column?: number;
  lhsSpan?: Span;
  rhsSpan?: Span;
  relation: Relation | 'defined';
  verdict: Verdict;
  mode?: Mode;
  card: GuaranteeCard;
  message: string;
  reason?: string;
  counterexample?: Counterexample;
  fixes?: Fix[];
  annotation?: string;
  isDefinition?: boolean;
  /** a note about the layout of a gradient, when the shapes do not agree */
  layoutHint?: string;
}

export interface Report {
  version: string;
  seed: number;
  steps: StepResult[];
  symbols: SymbolInfo[];
  chips: Chip[];
  diagnostics: Diagnostic[];
  ms: number;
}

export interface CheckOptions {
  decls?: string;
  preset?: string;
  seed?: number;
  trials?: number;
  budgetMs?: number;
  layout?: 'denominator' | 'numerator';
}

interface Step {
  id: string;
  row: number;
  span: Span;
  /** the source text of the row */
  text: string;
  lhs?: Node;
  rhs?: Node;
  relation: Relation | 'defined';
  annotation?: string;
  isDefinition: boolean;
  defName?: string;
  premise?: Assertion;
  conclusion?: Assertion;
  /** for a proportionality, the variable it is taken in */
  proportionalTo?: string;
  /** the row could not be read, and this is why */
  unreadable?: string;
  symbols: Set<string>;
}

/** Collects the symbols an expression mentions. */
function collectSymbols(node: Node | undefined, into: Set<string>): void {
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

/** Checks a derivation. This is the entry point of the whole product. */
export function check(src: string, opts: CheckOptions = {}): Report {
  const started = now();
  const seed = opts.seed ?? DEFAULT_SEED;
  const trials = opts.trials ?? 3;

  const rows = splitRows(src);
  const declared = parseDeclarations(opts.decls ?? '');
  const preset = presetDecls(opts.preset);
  const decls = mergeDecls(preset, declared.decls);

  const ctx = createContext(decls, opts.layout ?? 'denominator');
  const chips: Chip[] = [];
  const diagnostics: Diagnostic[] = [];
  const definedNames = new Set<string>();

  const knownFns = new Set<string>(decls.filter((d) => d.kind === 'function').map((d) => d.name));
  const steps: Step[] = [];
  /** the rows the parser could not read, with the reason */
  const unparsed: Array<{ row: number; message: string; span: Span }> = [];
  let previousRhs: Node | undefined;
  let rowIndex = 0;

  for (const row of rows) {
    const parsed = parseRow(src, row.text, row.from, rowIndex, knownFns);
    rowIndex++;
    if (parsed.error) {
      // a row SAMOSA did not read is a row it did not check, and it says so
      steps.push({
        id: `s${steps.length}`,
        row: rowIndex,
        span: parsed.error.span,
        text: row.text,
        relation: 'other',
        annotation: parsed.annotation,
        isDefinition: false,
        unreadable: parsed.error.message,
        symbols: new Set(),
      });
      unparsed.push({ row: rowIndex, message: parsed.error.message, span: parsed.error.span });
      continue;
    }
    if (parsed.prose || !parsed.parts.length) continue;

    for (const part of parsed.parts) {
      if (part.relation === '=>' || part.relation === '<=>') {
        const symbols = new Set<string>();
        collectSymbols(part.premise?.lhs, symbols);
        collectSymbols(part.premise?.rhs, symbols);
        collectSymbols(part.conclusion?.lhs, symbols);
        collectSymbols(part.conclusion?.rhs, symbols);
        steps.push({
          id: `s${steps.length}`,
          row: rowIndex,
          span: part.span,
          text: row.text,
          relation: part.relation,
          premise: part.premise,
          conclusion: part.conclusion,
          annotation: parsed.annotation,
          isDefinition: false,
          symbols,
        });
        previousRhs = part.conclusion?.rhs;
        continue;
      }

      let lhs = (part.lhs ?? null) ?? undefined;
      const rhs = (part.rhs ?? null) ?? undefined;
      if (!lhs && previousRhs) lhs = previousRhs;

      const symbols = new Set<string>();
      collectSymbols(lhs, symbols);
      collectSymbols(rhs, symbols);

      const bareLhs = defNameOf(lhs, ctx);
      // An equation whose left hand side is a bare symbol is a definition only
      // when the symbol is new: it is not declared, and it does not occur on
      // the right hand side. A symbol that was declared is a claim, and so is
      // a symbol that occurs on the right, because that row is circular.
      const rightSymbols = new Set<string>();
      collectSymbols(rhs, rightSymbols);
      const isDefinition =
        part.relation === ':=' ||
        (bareLhs !== undefined &&
          !definedNames.has(bareLhs) &&
          !isFunctionName(ctx, bareLhs) &&
          !ctx.decls.has(bareLhs) &&
          !rightSymbols.has(bareLhs));

      steps.push({
        id: `s${steps.length}`,
        row: rowIndex,
        span: part.span,
        text: row.text,
        lhs,
        rhs,
        proportionalTo: part.proportionalTo,
        relation: part.relation === ':=' ? 'defined' : part.relation,
        annotation: parsed.annotation,
        isDefinition,
        defName: isDefinition ? bareLhs : undefined,
        symbols,
      });
      previousRhs = rhs;
      if (bareLhs && isDefinition) definedNames.add(bareLhs);
    }
  }

  const defs = new Map<string, Node>();
  const results: StepResult[] = [];

  // A declaration that matches no symbol of the derivation is a name that was
  // spelled differently, so it is said out loud rather than ignored.
  const used = new Set<string>();
  for (const step of steps) {
    for (const name of step.symbols) used.add(name);
    if (step.lhs?.k === 'sym') used.add(step.lhs.name);
    if (step.rhs?.k === 'sym') used.add(step.rhs.name);
  }
  for (const decl of decls) {
    if (used.has(decl.name)) continue;
    if (decl.source === 'preset') continue;
    chips.push({
      id: 'unused-declaration',
      symbol: decl.name,
      message: `${decl.name} is declared but no row uses it, so the declaration does nothing`,
      span: { from: 0, to: 0 },
    });
  }

  for (const step of steps) {
    if (step.isDefinition && step.defName && step.rhs) {
      defs.set(step.defName, step.rhs);
      ctx.defs.set(step.defName, step.rhs);
    }
    const result = checkStep(step, ctx, defs, { seed, trials, budgetMs: opts.budgetMs ?? 500 }, diagnostics);
    // every result carries the text of its row, so a caller can point at the
    // line of the file the step came from
    result.text ??= step.text;
    results.push(result);
  }

  chips.push(...ctx.chips);

  return {
    version: ENGINE_VERSION,
    seed,
    steps: results,
    symbols: [...ctx.symbols.values()],
    chips,
    diagnostics,
    ms: Math.round(now() - started),
  };
}

function mergeDecls(preset: SymbolDecl[], declared: SymbolDecl[]): SymbolDecl[] {
  const out = [...preset];
  const index = new Map(out.map((d, i) => [d.name, i]));
  for (const d of declared) {
    const at = index.get(d.name);
    if (at === undefined) {
      index.set(d.name, out.length);
      out.push(d);
    } else {
      out[at] = d;
    }
  }
  return out;
}

function now(): number {
  return Date.now();
}

// ---------------------------------------------------------------- one step

interface StepOptions {
  seed: number;
  trials: number;
  budgetMs: number;
}

function checkStep(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  diagnostics: Diagnostic[],
): StepResult {
  const base: GuaranteeCard = {
    trialsPerSize: opts.trials,
    sizes: [],
    assumptions: [],
    seed: opts.seed,
  };

  if (step.unreadable) {
    // a row the parser did not read is never checked, and it says why
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: 'other',
      verdict: 'unchecked',
      card: base,
      message: step.unreadable,
      reason: step.unreadable,
      annotation: step.annotation,
    };
  }

  if (step.isDefinition) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: 'defined',
      verdict: 'defined',
      card: base,
      message: step.defName ? `defined: ${step.defName}` : 'defined',
      isDefinition: true,
      annotation: step.annotation,
    };
  }

  if (step.relation === '=>' || step.relation === '<=>') {
    return checkImplication(step, ctx, defs, opts, base);
  }

  if (step.relation !== '=' && step.relation !== 'propto') {
    const message = unsupportedRelation(step.relation);
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: step.relation,
      verdict: 'unchecked',
      card: base,
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  if (!step.lhs || !step.rhs) {
    const message = 'this row has no relation to check';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      relation: step.relation,
      verdict: 'unchecked',
      card: base,
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  const lhsTy = inferType(ctx, step.lhs);
  const rhsTy = inferType(ctx, step.rhs);
  // the two sides of an equality have to have the same shape
  // a gradient in the wrong layout shows up as a transposed shape, so the shapes
  // are compared before they are unified
  let transposed = false;
  if (step.lhs?.k === 'deriv' && rhsTy.t === 'mat' && lhsTy.t === 'mat') {
    const key = (d: Dim): string => (typeof d === 'number' ? String(d) : ctx.dims.find(d.v));
    transposed =
      key(rhsTy.r) === key(lhsTy.c) && key(rhsTy.c) === key(lhsTy.r) && key(rhsTy.r) !== key(rhsTy.c);
  }
  if (lhsTy.t === 'mat' && rhsTy.t === 'mat') {
    unifyShapes(ctx, lhsTy, rhsTy, step.span);
  }
  const shapeErrors = ctx.errors.splice(0, ctx.errors.length);

  if (shapeErrors.length && transposed) {
    shapeErrors[0].message =
      'this is the numerator layout: SAMOSA uses the denominator layout, where the gradient has the shape of the variable it is taken with respect to';
  }
  if (shapeErrors.length) {
    for (const error of shapeErrors) {
      diagnostics.push({ severity: 'error', message: error.message, span: error.span, stepId: step.id });
    }
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs.span,
      rhsSpan: step.rhs.span,
      relation: step.relation,
      verdict: 'shape',
      card: base,
      message: shapeErrors[0].message,
      reason: shapeErrors.map((e) => e.message).join('; '),
      annotation: step.annotation,
    };
  }

  if (step.relation === 'propto') {
    return checkProportionality(step, ctx, defs, opts, base);
  }

  const mode = planMode(step, ctx, defs);
  if (mode === 'unchecked') {
    const message = 'SAMOSA cannot check this step';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs.span,
      rhsSpan: step.rhs.span,
      relation: step.relation,
      verdict: 'unchecked',
      card: base,
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  if (mode === 'exact') return checkExact(step, ctx, defs, opts, base);
  return checkNumeric(step, ctx, defs, opts, base);
}

/** Unifies the shapes of the two sides of an equality. */
function unifyShapes(
  ctx: TypeContext,
  a: { r: Dim; c: Dim },
  b: { r: Dim; c: Dim },
  span: Span,
): void {
  const r = unifyDim(ctx, a.r, b.r, 'in this equality', span);
  const c = unifyDim(ctx, a.c, b.c, 'in this equality', span);
  void r;
  void c;
}

function unsupportedRelation(relation: Relation | 'defined'): string {
  switch (relation) {
    case 'le':
    case 'ge':
    case 'lt':
    case 'gt':
      return `inequalities (${relation}) are not checked in v1`;
    case 'approx':
      return 'approximations are not checked in v1';
    case 'propto':
      return 'proportionality is checked over the reals only';
    default:
      return 'this relation is not checked in v1';
  }
}

// ------------------------------------------------------------- mode planner

type Plan = 'exact' | 'numeric' | 'unchecked';

function planMode(step: Step, ctx: TypeContext, defs: Map<string, Node>): Plan {
  const nodes: Node[] = [];
  if (step.lhs) nodes.push(step.lhs);
  if (step.rhs) nodes.push(step.rhs);
  for (const node of nodes) {
    if (!isRational(node, ctx, defs, new Set())) return 'numeric';
  }
  return 'exact';
}

function isRational(node: Node, ctx: TypeContext, defs: Map<string, Node>, seen: Set<string>): boolean {
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
    case 'op':
      return node.args.every((a) => isRational(a, ctx, defs, seen));
    case 'call':
      return node.fn === 'det' || node.fn === 'tr' || node.fn === 'trace' || node.fn === 'var' || node.fn === 'cov';
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
    case 'raw':
      return false;
  }
}

// ------------------------------------------------------------ exact mode

function checkExact(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const primes: [number, number] = [P1, P2];

  let worstBound = 0;
  let worstDegree = 0;
  const working: Map<string, number>[] = [];
  const sizes: Record<string, number>[] = [];
  const assumptions = collectAssumptions(ctx, step);

  for (const setting of settings) {
    let usable = false;
    for (let trial = 0; trial < opts.trials; trial++) {
      for (const p of primes) {
        const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, p);
        const outcome = runExactTrial(step, ctx, defs, setting, p, rng);
        if (outcome.kind === 'ok') {
          usable = true;
          continue;
        }
        if (outcome.kind === 'unknown') {
          if (outcome.domain) {
            // this size cannot work (a singular matrix, say), so it is skipped
            continue;
          }
          return {
            id: step.id,
            row: step.row,
            span: step.span,
            text: step.text,
            lhsSpan: step.lhs?.span,
            rhsSpan: step.rhs?.span,
            relation: step.relation,
            verdict: outcome.shape ? 'shape' : 'unchecked',
            card: { ...card, sizes, primes, assumptions },
            message: outcome.message,
            reason: outcome.message,
            annotation: step.annotation,
          };
        }
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          text: step.text,
          lhsSpan: step.lhs?.span,
          rhsSpan: step.rhs?.span,
          relation: step.relation,
          verdict: 'wrong',
          mode: 'exact',
          card: { ...card, sizes, primes, degree: worstDegree, bound: worstBound, assumptions },
          message: outcome.message,
          reason: outcome.message,
          counterexample: outcome.counterexample,
          layoutHint: outcome.layoutHint,
          annotation: step.annotation,
        };
      }
    }
    if (usable) working.push(setting);
  }

  if (!working.length) {
    const message = 'this step could not be evaluated at any size';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: 'unchecked',
      card: { ...card, sizes, primes, assumptions },
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  for (const setting of working) {
    sizes.push(Object.fromEntries(setting) as Record<string, number>);
    const dl = degreeOf(ctx, step.lhs!, setting, defs);
    const dr = degreeOf(ctx, step.rhs!, setting, defs);
    const d = Math.max(dl.n + dr.d, dr.n + dl.d);
    worstDegree = Math.max(worstDegree, d);
    const bound = Math.pow(d / P1, opts.trials) * Math.pow(d / P2, opts.trials);
    worstBound = Math.max(worstBound, bound);
  }

  return {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    lhsSpan: step.lhs?.span,
    rhsSpan: step.rhs?.span,
    relation: step.relation,
    verdict: 'ok',
    mode: hasExpectation(step) ? 'quadrature' : 'exact',
    card: { ...card, sizes, primes, degree: worstDegree, bound: worstBound, assumptions },
    message: 'holds at every size tested',
    annotation: step.annotation,
  };
}

type TrialOutcome =
  | { kind: 'ok' }
  | { kind: 'wrong'; message: string; counterexample: Counterexample; layoutHint?: string }
  | { kind: 'unknown'; message: string; domain?: boolean; shape?: boolean };

function runExactTrial(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  setting: Map<string, number>,
  p: number,
  rng: Rng,
): TrialOutcome {
  const field = new GFpField(p);
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;

  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free);
  if (sampled === 'unknown') {
    return { kind: 'unknown', message: 'SAMOSA could not sample an instance of these objects' };
  }
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);

  const sides = evaluateSides(field, step.lhs!, step.rhs!, env, sampler);
  if (sides.kind === 'unknown') {
    return { kind: 'unknown', message: sides.message, domain: sides.domain, shape: sides.shape };
  }
  if (sides.kind === 'equal') return { kind: 'ok' };

  return {
    kind: 'wrong',
    message: sides.message,
    layoutHint: sides.layoutHint,
    counterexample: buildCounterexample(ctx, step, setting, sampled.values, sides.lhs, sides.rhs, field),
  };
}

type Sides<T> =
  | { kind: 'equal' }
  | { kind: 'different'; lhs: Val<T>; rhs: Val<T>; message: string; layoutHint?: string }
  | { kind: 'unknown'; message: string; domain?: boolean; shape?: boolean };

/**
 * Compares two sides of a step.
 *
 * The repair engine uses it as well, because a fix for a gradient row has to
 * be checked the way the verdict was: with a directional derivative.
 */
export function compareSides<T>(
  field: Field<T>,
  lhs: Node,
  rhs: Node,
  env: ReturnType<typeof makeEnv<T>>,
  sampler: Sampler<T>,
): Sides<T> {
  return evaluateSides(field, lhs, rhs, env, sampler);
}

/**
 * Evaluates both sides of a step and compares them.
 *
 * A derivative on the left is special: the claim is about a gradient or a
 * Hessian, so the comparison uses a random direction and the inner product.
 */
function evaluateSides<T>(
  field: Field<T>,
  lhsNode: Node,
  rhsNode: Node,
  env: ReturnType<typeof makeEnv<T>>,
  sampler: Sampler<T>,
): Sides<T> {
  const derivNode = lhsNode.k === 'deriv' ? lhsNode : undefined;
  try {
    if (derivNode) {
      return compareDerivative(field, derivNode, rhsNode, env, sampler);
    }
    const lhs = evalNode(field, lhsNode, env);
    const rhs = evalNode(field, rhsNode, env);
    if (valuesEqual(field, lhs, rhs)) return { kind: 'equal' };
    return { kind: 'different', lhs, rhs, message: 'the two sides are not equal' };
  } catch (error) {
    if (error instanceof EvalError) {
      const domain = /singular|non square|domain/i.test(error.message);
      // the shapes of the two sides do not fit: that is a shape error, and
      // the repair engine has something to say about it
      const shape = /shape mismatch|not square|non square/i.test(error.message);
      return { kind: 'unknown', message: error.message, domain, shape };
    }
    if (error instanceof DomainError) {
      return { kind: 'unknown', message: error.message, domain: true };
    }
    // A crash is a gap in the engine, and it is said in words a person can
    // read, not as a stack trace.
    const detail = error instanceof Error ? error.message : String(error);
    return { kind: 'unknown', message: `SAMOSA could not evaluate this step: ${detail}` };
  }
}

function compareDerivative<T>(
  field: Field<T>,
  deriv: Extract<Node, { k: 'deriv' }>,
  claimed: Node,
  env: ReturnType<typeof makeEnv<T>>,
  sampler: Sampler<T>,
): Sides<T> {
  const wrt = deriv.wrt[0];
  if (!wrt || wrt.k !== 'sym') return { kind: 'unknown', message: 'SAMOSA does not know what to differentiate with respect to' };
  const pivotName = wrt.name;
  const pivot = env.values.get(pivotName);
  if (!pivot) {
    return { kind: 'unknown', message: `no value for ${pivotName}` };
  }
  const fnNode = deriv.f;
  if (fnNode.k !== 'sym') {
    return { kind: 'unknown', message: 'SAMOSA can only differentiate a named function' };
  }
  const def = env.defs.get(fnNode.name);
  if (!def) {
    return { kind: 'unknown', message: `${fnNode.name} is not defined, so its derivative cannot be computed` };
  }

  const isScalarPivot = isScalarVal(pivot);
  const n = isScalarPivot ? 1 : pivot.m.r;
  const c = isScalarPivot ? 1 : pivot.m.c;
  const direction: Val<T> = isScalarPivot
    ? scalar(sampler.sampleScalar())
    : { k: 'm', m: sampler.sampleGeneral(n, c) };

  if (deriv.order === 2) {
    const w: Val<T> = isScalarPivot
      ? scalar(sampler.sampleScalar())
      : { k: 'm', m: sampler.sampleGeneral(n, c) };
    const mixed = mixedSecondDerivative(field, def, env, pivotName, pivot, direction, w);
    const claimedVal = evalNode(field, claimed, env);
    if (isMatrixVal(claimedVal)) {
      const value = isScalarPivot
        ? field.mul(
            field.mul(
              (direction as { k: 's'; v: T }).v,
              claimedVal.m.d[0],
            ),
            (w as { k: 's'; v: T }).v,
          )
        : quadraticForm(field, (direction as { k: 'm'; m: Mat<T> }).m, claimedVal.m, (w as { k: 'm'; m: Mat<T> }).m);
      const mixedScalar = asScalar(field, mixed);
      if (mixedScalar !== null && field.eq(value, mixedScalar)) return { kind: 'equal' };
      return {
        kind: 'different',
        lhs: mixed,
        rhs: claimedVal,
        message: 'the claimed Hessian is not the Hessian of that function',
      };
    }
    return { kind: 'unknown', message: 'the right hand side of a Hessian claim has to be a matrix' };
  }

  const tangent = directionalDerivative(field, def, env, pivotName, pivot, direction);
  const claimedVal = evalNode(field, claimed, env);
  const tangentScalar = asScalar(field, tangent);

  if (tangentScalar !== null && isMatrixVal(claimedVal) && !isScalarPivot) {
    const inner = innerProduct(field, claimedVal.m, (direction as { k: 'm'; m: Mat<T> }).m);
    if (fieldClose(field, inner, tangentScalar)) return { kind: 'equal' };
    // the layout diagnosis: the claimed gradient has the transposed shape
    const dirMat = (direction as { k: 'm'; m: Mat<T> }).m;
    if (claimedVal.m.r === dirMat.c && claimedVal.m.c === dirMat.r) {
      const flipped = innerProduct(field, transposeMat(claimedVal.m), dirMat);
      if (field.eq(flipped, tangentScalar)) {
        return {
          kind: 'different',
          lhs: tangent,
          rhs: claimedVal,
          message: 'this is the numerator layout gradient; SAMOSA uses the denominator layout',
          layoutHint: 'The gradient has the shape of the variable it is taken with respect to. Transpose it.',
        };
      }
    }
    return {
      kind: 'different',
      lhs: tangent,
      rhs: claimedVal,
      message: 'the claimed gradient is not the gradient of that function',
    };
  }

  if (tangentScalar !== null && isScalarVal(claimedVal) && isScalarPivot) {
    const expected = field.mul(claimedVal.v, (direction as { k: 's'; v: T }).v);
    if (fieldClose(field, tangentScalar, expected)) return { kind: 'equal' };
    return {
      kind: 'different',
      lhs: tangent,
      rhs: claimedVal,
      message: 'the claimed derivative is not the derivative of that function',
    };
  }

  if (isMatrixVal(tangent) && isMatrixVal(claimedVal) && isMatrixVal(direction)) {
    const product = matMul(field, claimedVal.m, direction.m);
    if (product.r === tangent.m.r && product.c === tangent.m.c) {
      let same = true;
      for (let i = 0; i < product.d.length; i++) {
        if (!fieldClose(field, product.d[i], tangent.m.d[i])) {
          same = false;
          break;
        }
      }
      if (same) return { kind: 'equal' };
    }
    return {
      kind: 'different',
      lhs: tangent,
      rhs: claimedVal,
      message: 'the claimed Jacobian is not the Jacobian of that function',
    };
  }

  return { kind: 'unknown', message: 'the two sides of this derivative claim do not have comparable shapes' };
}

/** A 1 by 1 matrix is a scalar in disguise. */
function asScalar<T>(_field: Field<T>, val: Val<T>): T | null {
  if (isScalarVal(val)) return val.v;
  if (val.m.r === 1 && val.m.c === 1) return val.m.d[0];
  return null;
}

function innerProduct<T>(field: Field<T>, g: Mat<T>, v: Mat<T>): T {
  // tr(G^T V)
  let sum = field.zero;
  for (let i = 0; i < g.r; i++) {
    for (let j = 0; j < g.c; j++) {
      sum = field.add(sum, field.mul(g.d[i * g.c + j], v.d[i * v.c + j]));
    }
  }
  return sum;
}

function quadraticForm<T>(field: Field<T>, v: Mat<T>, h: Mat<T>, w: Mat<T>): T {
  let sum = field.zero;
  for (let i = 0; i < v.r; i++) {
    for (let j = 0; j < h.c; j++) {
      sum = field.add(
        sum,
        field.mul(field.mul(v.d[i * v.c], h.d[i * h.c + j]), w.d[j * w.c]),
      );
    }
  }
  return sum;
}

function transposeMat<T>(m: Mat<T>): Mat<T> {
  const d = new Array<T>(m.r * m.c);
  for (let i = 0; i < m.r; i++) for (let j = 0; j < m.c; j++) d[j * m.r + i] = m.d[i * m.c + j];
  return { r: m.c, c: m.r, d };
}

/** Is this name a declared function? Those are never defined by an equation. */
function isFunctionName(ctx: TypeContext, name: string): boolean {
  const decl = ctx.decls.get(name);
  return decl?.kind === 'function';
}

/**
 * Are two values the same?
 *
 * Over a finite field that is exact equality. Over the reals it is a
 * relative comparison, because the last bits of a float are noise.
 */
function fieldClose<T>(field: Field<T>, a: T, b: T): boolean {
  if (field instanceof GFpField) return field.eq(a, b);
  const x = field.toNumber(a);
  const y = field.toNumber(b);
  const scale = Math.max(1, Math.abs(x), Math.abs(y));
  return Math.abs(x - y) <= 1e-12 * scale;
}

/** Does the step contain an expectation? Those are checked by quadrature. */
function hasExpectation(step: Step): boolean {
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
function freeVariables(step: Step): Set<string> {
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
function defNameOf(lhs: Node | undefined, ctx: TypeContext): string | undefined {
  if (!lhs) return undefined;
  if (lhs.k === 'sym') return lhs.name;
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
function stepNodes(step: Step): Node[] {
  const out: Node[] = [];
  if (step.lhs) out.push(step.lhs);
  if (step.rhs) out.push(step.rhs);
  if (step.premise?.lhs) out.push(step.premise.lhs);
  if (step.premise?.rhs) out.push(step.premise.rhs);
  if (step.conclusion?.lhs) out.push(step.conclusion.lhs);
  if (step.conclusion?.rhs) out.push(step.conclusion.rhs);
  return out;
}

/** Samples every free symbol the step needs. */
function sampleFor<T>(
  ctx: TypeContext,
  step: Step,
  defs: Map<string, Node>,
  setting: Map<string, number>,
  sampler: Sampler<T>,
  free: Set<string> = new Set(),
): { values: Map<string, Val<T>>; quad: Map<string, QuadVar> } | 'unknown' {
  const values = new Map<string, Val<T>>();
  const quad = new Map<string, QuadVar<any>>();
  const names = new Set<string>();
  for (const node of stepNodes(step)) collectSymbols(node, names);
  // a definition brings in the symbols it is written with
  for (const name of [...names]) {
    const def = defs.get(name);
    if (def) collectSymbols(def, names);
  }

  for (const name of names) {
    if (defs.has(name) && !free.has(name)) continue;
    if (values.has(name)) continue;
    const info = ctx.symbols.get(name);
    if (!info) continue;
    if (info.ty.t === 'rv') {
      // a random variable: sample the root of its covariance, so that the
      // covariance symbol and the variable agree
      const dist = info.ty.dist;
      const size = info.ty.of.t === 'mat' ? dimSizeOf(ctx, info.ty.of.r, setting) : 1;
      let mean: Val<T>;
      if (dist.kind === 'normal' && dist.mu !== '0') {
        const existing = values.get(dist.mu);
        if (existing) {
          mean = existing;
        } else {
          mean = { k: 'm', m: sampler.sampleGeneral(size, 1) };
          values.set(dist.mu, mean);
        }
      } else {
        mean = { k: 'm', m: sampler.sampleGeneral(size, 1) };
      }
      const root = sampler.sampleGeneral(size, size);
      const f = sampler.field;
      if (dist.kind === 'normal' && dist.sigma !== 'I') {
        values.set(dist.sigma, { k: 'm', m: matMul(f, root, transpose(root)) });
      }
      const z = sampler.sampleGeneral(size, 1);
      const meanMat = isMatrixVal(mean) ? mean.m : { r: size, c: 1, d: new Array<T>(size).fill(f.zero) };
      values.set(name, { k: 'm', m: matAdd(f, meanMat, matMul(f, root, z)) });
      values.set(`__mean_${name}`, mean);
      quad.set(name, { name, mean, root, dim: size, rule: GAUSS7 });
      continue;
    }
    if (info.ty.t === 'scalar') {
      values.set(name, scalar(sampler.sampleScalar()));
      continue;
    }
    if (info.ty.t !== 'mat') continue;
    const r = dimSizeOf(ctx, info.ty.r, setting);
    const c = dimSizeOf(ctx, info.ty.c, setting);
    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const val = sampler.sample({ name, r, c, props: info.props });
      if (!val) continue;
      if (val.k === 'm' && isSingular(sampler.field, val.m)) continue;
      values.set(name, val);
      placed = true;
      break;
    }
    if (!placed) return 'unknown';
  }
  return { values, quad };
}

function isSingular<T>(field: Field<T>, m: Mat<T>): boolean {
  if (m.r !== m.c) return false;
  try {
    matInv(field, m);
    return false;
  } catch {
    return true;
  }
}

function valuesEqual<T>(field: Field<T>, a: Val<T>, b: Val<T>): boolean {
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
function checkProportionality(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const assumptions = collectAssumptions(ctx, step);
  const sizes: Record<string, number>[] = [];
  const variable = step.proportionalTo;

  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting) as Record<string, number>);
    const rng = rngFor(opts.seed, step.id, settingKey(setting), 'propto');
    const field = new F64Field();
    const sampler = new Sampler(field, rng);
    const env = makeEnv(field, rng);
    env.defs = defs;
    const sampled = sampleFor(ctx, step, defs, setting, sampler);
    if (sampled === 'unknown') {
      const message = 'could not sample an instance';
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: 'unchecked',
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation,
      };
    }
    for (const [name, value] of sampled.values.entries()) env.values.set(name, value);

    // the variable the proportionality is taken in
    const name = variable ?? guessProportionalityVariable(step, ctx);
    if (!name) {
      const message =
        'SAMOSA does not know which variable this proportionality is taken in. Write \\propto_x.';
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: 'unchecked',
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation,
      };
    }
    const info = ctx.symbols.get(name);
    if (!info) {
      const message = `SAMOSA does not know the shape of ${name}`;
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: 'unchecked',
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation,
      };
    }

    const differences: number[] = [];
    for (let point = 0; point < 3; point++) {
      const trialEnv = { ...env, values: new Map(env.values), memo: new Map() };
      if (info.ty.t === 'mat') {
        const r = dimSizeOf(ctx, info.ty.r, setting);
        const c = dimSizeOf(ctx, info.ty.c, setting);
        trialEnv.values.set(name, { k: 'm', m: sampler.sampleGeneral(r, c) });
      } else {
        trialEnv.values.set(name, scalar(sampler.sampleScalar()));
      }
      let left: number;
      let right: number;
      try {
        const l = evalNode(field, step.lhs!, trialEnv);
        const r = evalNode(field, step.rhs!, trialEnv);
        left = asNumber(l);
        right = asNumber(r);
      } catch {
        const message = 'SAMOSA could not evaluate this proportionality over the reals';
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          relation: step.relation,
          verdict: 'unchecked',
          card: { ...card, sizes, assumptions },
          message,
          reason: message,
          annotation: step.annotation,
        };
      }
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        const message = 'this proportionality was not defined at one of the points';
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          relation: step.relation,
          verdict: 'unchecked',
          card: { ...card, sizes, assumptions },
          message,
          reason: message,
          annotation: step.annotation,
        };
      }
      differences.push(Math.log(Math.abs(left)) - Math.log(Math.abs(right)));
    }

    const spread = Math.max(...differences) - Math.min(...differences);
    const scale = Math.max(1, ...differences.map((d) => Math.abs(d)));
    if (spread > 1e-8 * scale) {
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        relation: step.relation,
        verdict: 'wrong',
        mode: 'numeric',
        card: { ...card, sizes, assumptions },
        message: `the ratio of the two sides depends on ${name}, so they are not proportional`,
        reason: `the ratio of the two sides depends on ${name}, so they are not proportional`,
        annotation: step.annotation,
      };
    }
  }

  return {
    id: step.id,
    row: step.row,
    span: step.span,
    relation: step.relation,
    verdict: 'ok',
    mode: 'numeric',
    card: { ...card, sizes, assumptions },
    message: 'the ratio of the two sides does not depend on the variable',
    annotation: step.annotation,
  };
}

/** The value of a number, whether it is a scalar or a one by one matrix. */
function asNumber<T>(val: Val<T>): number {
  if (isScalarVal(val)) return Number(val.v);
  return Number(val.m.d[0]);
}

/** Guesses the variable of a proportionality: the first free symbol of the left. */
function guessProportionalityVariable(step: Step, ctx: TypeContext): string | undefined {
  const names = new Set<string>();
  collectSymbols(step.lhs, names);
  for (const name of names) {
    const info = ctx.symbols.get(name);
    if (info && info.ty.t === 'mat') return name;
  }
  return undefined;
}

// ------------------------------------------------------------- numeric mode

function checkNumeric(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const sizes: Record<string, number>[] = [];
  const assumptions = collectAssumptions(ctx, step);
  let maxDelta = 0;
  const dec = new DecField(50);

  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting) as Record<string, number>);
    for (let trial = 0; trial < 3; trial++) {
      const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, 'f64');
      const delta = numericDelta(ctx, defs, step, setting, rng, new F64Field());
      if (delta === null) {
        const message = 'SAMOSA could not evaluate this step over the reals';
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          text: step.text,
          relation: step.relation,
          verdict: 'unchecked',
          card: { ...card, sizes, assumptions },
          message,
          reason: message,
          annotation: step.annotation,
        };
      }
      maxDelta = Math.max(maxDelta, delta);
      if (delta > 1e-6) {
        let confirmed = false;
        for (let k = 0; k < 3 && !confirmed; k++) {
          const rng2 = rngFor(opts.seed, step.id, settingKey(setting), trial, 'dec', k);
          const d2 = numericDelta(ctx, defs, step, setting, rng2, dec);
          if (d2 !== null && d2 > 1e-20) confirmed = true;
        }
        const message = confirmed
          ? 'the two sides differ'
          : 'the two sides differ, but not enough to call it wrong';
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          lhsSpan: step.lhs?.span,
          rhsSpan: step.rhs?.span,
          relation: step.relation,
          verdict: confirmed ? 'wrong' : 'inconclusive',
          mode: 'numeric',
          card: { ...card, sizes, maxDelta, assumptions },
          message,
          reason: message,
          annotation: step.annotation,
        };
      }
    }
  }

  for (const setting of settings) {
    const rng = rngFor(opts.seed, step.id, settingKey(setting), 'dec');
    const delta = numericDelta(ctx, defs, step, setting, rng, dec);
    if (delta === null) {
      const message = 'SAMOSA could not evaluate this step at 50 digits';
      return {
        id: step.id,
        row: step.row,
        span: step.span,
        text: step.text,
        relation: step.relation,
        verdict: 'unchecked',
        card: { ...card, sizes, assumptions },
        message,
        reason: message,
        annotation: step.annotation,
      };
    }
    maxDelta = Math.max(maxDelta, delta);
  }

  if (maxDelta < 1e-35) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      text: step.text,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: 'ok',
      mode: 'numeric',
      card: { ...card, sizes, maxDelta, assumptions },
      message: 'the two sides agree to 50 digits',
      annotation: step.annotation,
    };
  }
  const message = 'the two sides agree, but not to 50 digits';
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    relation: step.relation,
    verdict: 'inconclusive',
    mode: 'numeric',
    card: { ...card, sizes, maxDelta, assumptions },
    message,
    reason: message,
    annotation: step.annotation,
  };
}

function numericDelta<T>(
  ctx: TypeContext,
  defs: Map<string, Node>,
  step: Step,
  setting: Map<string, number>,
  rng: Rng,
  field: Field<T>,
): number | null {
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;
  const free = freeVariables(step);
  const sampled = sampleFor(ctx, step, defs, setting, sampler, free);
  if (sampled === 'unknown') return null;
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);

  const sides = evaluateSides(field, step.lhs!, step.rhs!, env, sampler);
  if (sides.kind === 'unknown') return null;
  if (sides.kind === 'equal') return 0;
  return relativeDelta(field, sides.lhs, sides.rhs);
}

function relativeDelta<T>(field: Field<T>, a: Val<T>, b: Val<T>): number {
  const flat = (v: Val<T>): number[] => (v.k === 's' ? [field.toNumber(v.v)] : v.m.d.map((x) => field.toNumber(x)));
  const fa = flat(a);
  const fb = flat(b);
  if (fa.length !== fb.length) return Number.POSITIVE_INFINITY;
  let diff = 0;
  let scale = 0;
  for (let i = 0; i < fa.length; i++) {
    diff = Math.max(diff, Math.abs(fa[i] - fb[i]));
    scale = Math.max(scale, Math.abs(fa[i]), Math.abs(fb[i]));
  }
  if (scale === 0) return diff === 0 ? 0 : Number.POSITIVE_INFINITY;
  return diff / scale;
}

// ---------------------------------------------------------- the dimensions

function collectDimVars(ctx: TypeContext, step: Step, defs: Map<string, Node>): string[] {
  const lhs = step.lhs;
  const rhs = step.rhs;
  if (step.premise?.lhs || step.conclusion?.lhs) {
    return collectDimVarsFor(ctx, step.conclusion?.lhs ?? lhs, step.conclusion?.rhs ?? rhs, defs);
  }
  return collectDimVarsFor(ctx, lhs, rhs, defs);
}

/** The size settings of a step: three of them, with the sizes the plan pins down. */
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

function settingKey(setting: Map<string, number>): string {
  return [...setting.entries()].map(([k, v]) => `${k}=${v}`).join(',');
}

/**
 * The assumptions a verdict rests on.
 *
 * Every default or inferred assumption is listed, because hiding one can
 * produce a false checkmark, which is the worst thing that can happen.
 */
function collectAssumptions(ctx: TypeContext, step: Step): string[] {
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
const PROP_WORDS: Record<string, string> = {
  sym: 'symmetric',
  spd: 'symmetric positive definite',
  psd: 'symmetric positive semi definite',
  orth: 'orthogonal',
  diag: 'diagonal',
  triu: 'upper triangular',
  tril: 'lower triangular',
  skew: 'skew symmetric',
  idem: 'idempotent',
  proj: 'a projector',
  unit: 'unit length',
  stoch: 'stochastic',
  pos: 'positive',
  int: 'an integer',
  ident: 'the identity',
  zero: 'zero',
  ones: 'ones',
};

// ------------------------------------------------------------- counterexample

function buildCounterexample<T>(
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
    debug: { residues, lhs: lhsVal, rhs: rhsVal, diff },
  };
}

// ------------------------------------------------------------- implications

function checkImplication(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  opts: StepOptions,
  card: GuaranteeCard,
): StepResult {
  const premise = step.premise;
  const conclusion = step.conclusion;
  if (!premise || !conclusion || !conclusion.lhs || !conclusion.rhs) {
    const message = 'this implication has no conclusion to check';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: 'unchecked',
      card,
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  const conclusionLhs = conclusion.lhs;
  const pivot = conclusionLhs && conclusionLhs.k === 'sym' ? conclusionLhs.name : undefined;
  if (!pivot) {
    const message = 'the conclusion of this implication is not a single variable';
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      relation: step.relation,
      verdict: 'unchecked',
      card,
      message,
      reason: message,
      annotation: step.annotation,
    };
  }

  const dimVars = collectDimVars(ctx, step, defs);
  const settings = sizeSettings(dimVars);
  const primes: [number, number] = [P1, P2];
  const sizes: Record<string, number>[] = [];
  const assumptions = collectAssumptions(ctx, step);

  for (const setting of settings) {
    sizes.push(Object.fromEntries(setting) as Record<string, number>);
    for (let trial = 0; trial < opts.trials; trial++) {
      for (const p of primes) {
        const rng = rngFor(opts.seed, step.id, settingKey(setting), trial, p);
        const outcome = runImplicationTrial(step, ctx, defs, setting, p, rng);
        if (outcome.kind === 'ok') continue;
        if (outcome.kind === 'unknown') {
          if (outcome.domain) {
            // this size cannot work (a singular matrix, say), so it is skipped
            continue;
          }
          return {
            id: step.id,
            row: step.row,
            span: step.span,
            text: step.text,
            lhsSpan: step.lhs?.span,
            rhsSpan: step.rhs?.span,
            relation: step.relation,
            verdict: outcome.shape ? 'shape' : 'unchecked',
            card: { ...card, sizes, primes, assumptions },
            message: outcome.message,
            reason: outcome.message,
            annotation: step.annotation,
          };
        }
        return {
          id: step.id,
          row: step.row,
          span: step.span,
          lhsSpan: conclusion.lhs.span,
          rhsSpan: conclusion.rhs.span,
          relation: step.relation,
          verdict: 'wrong',
          mode: 'exact',
          card: { ...card, sizes, primes, assumptions },
          message: outcome.message,
          reason: outcome.message,
          counterexample: outcome.counterexample,
          annotation: step.annotation,
        };
      }
    }
  }

  return {
    id: step.id,
    row: step.row,
    span: step.span,
    lhsSpan: conclusion.lhs!.span,
    rhsSpan: conclusion.rhs!.span,
    relation: step.relation,
    verdict: 'ok',
    mode: 'exact',
    card: { ...card, sizes, primes, assumptions },
    message: 'the implication holds at every size tested',
    annotation: step.annotation,
  };
}

type ImpOutcome =
  | { kind: 'ok' }
  | { kind: 'wrong'; message: string; counterexample: Counterexample }
  | { kind: 'unknown'; message: string; domain?: boolean; shape?: boolean };

/**
 * Checks "premise => conclusion" with constraint completion.
 *
 * The residual of the premise has to be affine in the pivot variable. If it
 * is, the premise is solved for that variable and the conclusion is checked
 * on the solution.
 */
function runImplicationTrial(
  step: Step,
  ctx: TypeContext,
  defs: Map<string, Node>,
  setting: Map<string, number>,
  p: number,
  rng: Rng,
): ImpOutcome {
  const premise = step.premise!;
  const conclusion = step.conclusion!;
  const field = new GFpField(p);
  const sampler = new Sampler(field, rng);
  const env = makeEnv(field, rng);
  env.defs = defs;

  const sampled = sampleFor(ctx, step, defs, setting, sampler);
  if (sampled === 'unknown') return { kind: 'unknown', message: 'could not sample an instance' };
  for (const [name, value] of sampled.values.entries()) env.values.set(name, value);
  for (const [name, quadVar] of sampled.quad.entries()) env.quad.set(name, quadVar);

  const conclusionLhs = conclusion.lhs;
  const pivot = conclusionLhs && conclusionLhs.k === 'sym' ? conclusionLhs.name : undefined;
  if (!pivot) return { kind: 'unknown', message: 'the conclusion is not about a single variable' };
  const pivotValue = env.values.get(pivot);
  if (!pivotValue || pivotValue.k !== 'm') return { kind: 'unknown', message: `no value for ${pivot}` };

  const n = pivotValue.m.r;
  const dim = pivotValue.m.c;

  const residual = (x: Mat<number>): Mat<number> | null => {
    const trialEnv = { ...env, values: new Map(env.values), memo: new Map() };
    trialEnv.values.set(pivot, { k: 'm', m: x });
    try {
      if (premise.lhs?.k === 'deriv') {
        const grad = gradientAt(field, premise.lhs, trialEnv, pivot, x, n);
        if (!grad) return null;
        const rhs = premise.rhs ? evalNode(field, premise.rhs, trialEnv) : scalar(field.zero);
        const rhsScalar = asScalar(field, rhs);
        if (rhsScalar === null) return null;
        return {
          r: grad.r,
          c: grad.c,
          d: grad.d.map((x) => field.sub(x, rhsScalar)),
        };
      }
      const l = evalResidual(field, premise, trialEnv);
      if (!l) return null;
      return l;
    } catch {
      return null;
    }
  };

  const dir = sampler.sampleGeneral(n, dim);
  const second = secondDirectional(field, residual, pivotValue.m, dir);
  if (second === null) return { kind: 'unknown', message: 'could not evaluate the premise' };
  if (!second.d.every((x) => field.isZero(x))) {
    return {
      kind: 'unknown',
      message: 'the premise is not affine in the variable, so the implication is not checked in v1',
    };
  }

  const r0 = residual(pivotValue.m);
  if (!r0) return { kind: 'unknown', message: 'could not evaluate the premise' };
  const rows = r0.r;
  const cols = r0.c;
  const jac = { r: rows, c: n, d: new Array<number>(rows * n).fill(field.zero) };
  for (let j = 0; j < n; j++) {
    const e = { r: n, c: dim, d: new Array<number>(n * dim).fill(field.zero) };
    e.d[j * dim + (dim - 1)] = field.one;
    const rj = residual(addMat(field, pivotValue.m, e));
    if (!rj) return { kind: 'unknown', message: 'could not evaluate the premise' };
    // the column is the difference, not the value: r(x + e_j) - r(x)
    for (let i = 0; i < rows; i++) jac.d[i * n + j] = field.sub(rj.d[i * cols], r0.d[i * cols]);
  }

  let stepVec: Mat<number>;
  try {
    const inv = matInv(field, jac);
    stepVec = matMul(field, inv, r0);
  } catch {
    return { kind: 'unknown', message: 'the premise could not be solved for that variable' };
  }

  const solved = subMat(field, pivotValue.m, stepVec);
  const solvedEnv = { ...env, values: new Map(env.values), memo: new Map() };
  solvedEnv.values.set(pivot, { k: 'm', m: solved });

  let cl: Val<number>;
  let cr: Val<number>;
  try {
    cl = evalNode(field, conclusion.lhs!, solvedEnv);
    cr = evalNode(field, conclusion.rhs!, solvedEnv);
  } catch {
    return { kind: 'unknown', message: 'could not evaluate the conclusion' };
  }
  if (valuesEqual(field, cl, cr)) return { kind: 'ok' };

  return {
    kind: 'wrong',
    message: 'the implication does not follow',
    counterexample: buildCounterexample(ctx, step, setting, sampled.values, cl, cr, field),
  };
}

/**
 * The gradient of a function, one basis direction at a time.
 *
 * This is what a stationarity premise needs: the residual of "the gradient
 * is zero" is the gradient itself, as a vector.
 */
function gradientAt<T>(
  field: Field<T>,
  deriv: Extract<Node, { k: 'deriv' }>,
  env: ReturnType<typeof makeEnv<T>>,
  pivotName: string,
  baseValue: Mat<T>,
  n: number,
): Mat<T> | null {
  const fnNode = deriv.f;
  if (fnNode.k !== 'sym') return null;
  const def = env.defs.get(fnNode.name);
  if (!def) return null;
  const g: Mat<T> = { r: n, c: 1, d: new Array<T>(n).fill(field.zero) };
  for (let i = 0; i < n; i++) {
    const e: Mat<T> = { r: n, c: 1, d: new Array<T>(n).fill(field.zero) };
    e.d[i] = field.one;
    const tangent = directionalDerivative(field, def, env, pivotName, { k: 'm', m: baseValue }, { k: 'm', m: e });
    const value = asScalar(field, tangent);
    if (value === null) return null;
    g.d[i] = value;
  }
  return g;
}

/** The residual of a premise: the left hand side minus the right hand side. */
function evalResidual<T>(field: Field<T>, premise: Assertion, env: ReturnType<typeof makeEnv<T>>): Mat<T> | null {
  const l = evalNode(field, premise.lhs!, env);
  const r = premise.rhs ? evalNode(field, premise.rhs, env) : scalar(field.zero);
  if (l.k === 'm' && r.k === 'm') return matSub(field, l.m, r.m);
  if (l.k === 's' && r.k === 's') return { r: 1, c: 1, d: [field.sub(l.v, r.v)] };
  return null;
}

function addMat<T>(field: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = field.add(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}

function subMat<T>(field: Field<T>, a: Mat<T>, b: Mat<T>): Mat<T> {
  const d = new Array<T>(a.r * a.c);
  for (let i = 0; i < d.length; i++) d[i] = field.sub(a.d[i], b.d[i]);
  return { r: a.r, c: a.c, d };
}

/**
 * The second directional derivative of a residual, by a central difference.
 *
 * Over a finite field the central difference is exact, because 2 is
 * invertible and the residual is a polynomial.
 */
function secondDirectional(
  field: GFpField,
  residual: (x: Mat<number>) => Mat<number> | null,
  x: Mat<number>,
  dir: Mat<number>,
): Mat<number> | null {
  const plus = residual(addMat(field, x, dir));
  const minus = residual(subMat(field, x, dir));
  const centre = residual(x);
  if (!plus || !minus || !centre) return null;
  const d = new Array<number>(plus.d.length);
  const two = field.fromRational(2, 1);
  for (let i = 0; i < d.length; i++) {
    // f(x + d) - 2 f(x) + f(x - d) is the second directional derivative
    d[i] = field.sub(field.add(plus.d[i], minus.d[i]), field.mul(two, centre.d[i]));
  }
  return { r: plus.r, c: plus.c, d };
}
