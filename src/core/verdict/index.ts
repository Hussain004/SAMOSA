/**
 * The verdict engine.
 *
 * A step is checked under declarations by sampling instances of the declared
 * objects and evaluating both sides. Nothing is ever rewritten, so
 * non-commutativity, structure and shape all come for free.
 *
 * The modes live in their own modules under `./` (exact, numeric, derivative,
 * proportionality, implication), the shared helpers in `./shared.ts`, the
 * plan in `./plan.ts`. This file holds the pipeline: analyze the source,
 * check each step, and report.
 */
import { harvestMacros, parseRow } from '../parse.ts';
import { splitRows, harvestDeclsDetailed } from '../steps.ts';
import { parseDeclarations, type SymbolDecl } from '../decl.ts';
import { presetDecls } from '../presets.ts';
import {
  createContext,
  inferType,
  unifyDim,
  type Chip,
  type TypeContext,
} from '../types.ts';
import type { Defs, Node, Relation, Span } from '../ir.ts';
import type { Dim } from '../decl.ts';
import {
  collectDimVars,
  collectAssumptions,
  collectSymbols,
  defNameOf,
  isFunctionName,
  rawReason,
} from './shared.ts';
import { sizeSettings, planMode } from './plan.ts';
import { checkExact } from './exact.ts';
import { checkNumeric } from './numeric.ts';
import { checkImplication } from './implication.ts';
import { checkInequality } from './inequality.ts';
import { checkDistributionClaim } from './distribution.ts';
import { checkProportionality } from './proportionality.ts';
import {
  ENGINE_VERSION,
  DEFAULT_SEED,
  type Verdict,
  type Mode,
  type Step,
  type StepOptions,
  type GuaranteeCard,
  type Counterexample,
  type Fix,
  type Diagnostic,
  type StepResult,
  type Report,
  type CheckOptions,
  type Source,
} from './types.ts';

export {
  ENGINE_VERSION,
  DEFAULT_SEED,
  type Verdict,
  type Mode,
  type Step,
  type StepOptions,
  type GuaranteeCard,
  type Counterexample,
  type Fix,
  type Diagnostic,
  type StepResult,
  type Report,
  type CheckOptions,
  type Source,
};

export function analyzeSource(src: string, opts: CheckOptions): Source {
  const rows = splitRows(src);
  // the declarations around the mathematics count too: the `% samosa:`
  // comments and the prose lines that carry them (review 4.7), so the
  // CLI, the MCP server and the app all read the same source the same
  // way. Every declaration read from prose says where it came from.
  const harvested = harvestDeclsDetailed(src);
  const proseChips: Chip[] = harvested.fromProse.map((h) => ({
    id: 'harvested',
    symbol: h.name,
    span: { from: 0, to: 0 },
    message: `${h.decl}, read from line ${h.line}`,
  }));
  // a harvested declaration that is a typo is caught later by the unused
  // declaration visitor; a harvested declaration that is read is not
  const declared = parseDeclarations([opts.decls ?? '', ...harvested.decls].filter(Boolean).join('; '));
  const preset = presetDecls(opts.preset);
  const decls = mergeDecls(preset, declared.decls);

  const ctx = createContext(decls, opts.layout ?? 'denominator', declared.pinned);
  const defs: Defs = new Map<string, Node>();
  const definedNames = new Set<string>();

  const knownFns = new Set<string>(decls.filter((d) => d.kind === 'function').map((d) => d.name));
  // a declared value followed by a parenthesis is a product, and so is a
  // name the derivation defined; the set grows as the definitions come
  const knownValues = new Set<string>(decls.filter((d) => d.kind !== 'function').map((d) => d.name));
  // the macros the paper defines, so `\newcommand` and
  // `\DeclareMathOperator` mean what the author wrote (review 5.6)
  const macros = harvestMacros(src);
  const steps: Step[] = [];
  let previousRhs: Node | undefined;
  let rowIndex = 0;

  for (const row of rows) {
    const parsed = parseRow(src, row.text, row.from, rowIndex, knownFns, macros, knownValues);
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
      if (bareLhs && isDefinition) {
        definedNames.add(bareLhs);
        knownValues.add(bareLhs);
        // a definition whose left side is a call is a function, and f(3)
        // is a call afterwards, not the product f · 3
        if (lhs?.k === 'call') knownFns.add(bareLhs);
      }
      if (isDefinition && bareLhs && rhs) {
        defs.set(bareLhs, rhs);
        ctx.defs.set(bareLhs, rhs);
        if (lhs?.k === 'call') {
          const params = lhs.args.filter((a) => a.k === 'sym').map((a) => (a as { name: string }).name);
          (defs as Defs).params ??= new Map();
          (defs as Defs).params!.set(bareLhs, params);
        }
      }
    }
  }

  return { ctx, defs, steps, declErrors: declared.errors, harvested: proseChips };
}

/** Checks a derivation. This is the entry point of the whole product. */

export function check(src: string, opts: CheckOptions = {}): Report {
  const started = now();
  const seed = opts.seed ?? DEFAULT_SEED;
  const trials = opts.trials ?? 3;

  const source = analyzeSource(src, opts);
  const { ctx, defs, steps } = source;
  const decls = [...ctx.decls.values()];
  const chips: Chip[] = [];
  const diagnostics: Diagnostic[] = [];

  const results: StepResult[] = [];

  // A declaration that matches no symbol of the derivation is a name that was
  // spelled differently, so it is said out loud rather than ignored.
  const used = new Set<string>();
  for (const step of steps) {
    for (const name of step.symbols) used.add(name);
    if (step.lhs?.k === 'sym') used.add(step.lhs.name);
    if (step.rhs?.k === 'sym') used.add(step.rhs.name);
  }
  // the parameters of a random variable that is used are used too: in
  // `x ~ N(\mu, \Sigma)` the mean and the covariance are what x is made of
  for (const decl of decls) {
    if (!decl.dist || !used.has(decl.name)) continue;
    for (const param of Object.values(decl.dist) as string[]) {
      if (param !== decl.dist.kind) used.add(param);
    }
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
    const result = checkStep(step, ctx, defs, { seed, trials }, diagnostics);
    // every result carries the text of its row, so a caller can point at the
    // line of the file the step came from
    result.text ??= step.text;
    results.push(result);
  }

  // a declaration that could not be read is said out loud, in the same
  // diagnostics the steps use (review 5.5)
  for (const message of source.declErrors) {
    diagnostics.push({ severity: 'warning', message, span: { from: 0, to: 0 } });
  }

  chips.push(...ctx.chips);
  chips.push(...source.harvested);

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

  if (step.relation === 'le' || step.relation === 'lt' || step.relation === 'ge' || step.relation === 'gt') {
    return checkInequality(step, ctx, defs, opts, base);
  }

  if (step.relation === 'sim') {
    return checkDistributionClaim(step, ctx, defs, opts, base);
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
  const allErrors = ctx.errors.splice(0, ctx.errors.length);
  const shapeConflicts = ctx.shapeConflicts.splice(0, ctx.shapeConflicts.length);
  // an unknown function is not a shape claim (review 4.4): SAMOSA cannot
  // read the name, so the row is ? and never a shape error
  const shapeErrors = allErrors.filter((e) => e.kind !== 'unknown-function');
  const unknownFn = allErrors.find((e) => e.kind === 'unknown-function');

  if (shapeErrors.length && transposed) {
    shapeErrors[0].message =
      'this is the numerator layout: SAMOSA uses the denominator layout, where the gradient has the shape of the variable it is taken with respect to';
  }
  if (shapeErrors.length) {
    for (const error of shapeErrors) {
      diagnostics.push({ severity: 'error', message: error.message, span: error.span, stepId: step.id });
    }
    // the card shows the sizes that do not fit: the assignments where the
    // clashing dimensions differ, never one where they agree
    const dimVars = collectDimVars(ctx, step, defs);
    const settings = sizeSettings(dimVars);
    const witness = settings.filter((s) =>
      shapeConflicts.every(({ a, b }) => s.get(a) !== s.get(b)),
    );
    const shown = (witness.length ? witness : settings).slice(0, 3);
    const sizes = shown.map((s) => Object.fromEntries(s) as Record<string, number>);
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs.span,
      rhsSpan: step.rhs.span,
      relation: step.relation,
      verdict: 'shape',
      card: { ...base, sizes, assumptions: collectAssumptions(ctx, step) },
      message: shapeErrors[0].message,
      reason: shapeErrors.map((e) => e.message).join('; '),
      annotation: step.annotation,
    };
  }
  if (unknownFn) {
    diagnostics.push({ severity: 'error', message: unknownFn.message, span: unknownFn.span, stepId: step.id });
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs.span,
      rhsSpan: step.rhs.span,
      relation: step.relation,
      verdict: 'unchecked',
      card: base,
      message: `${unknownFn.message}, so SAMOSA cannot read this step`,
      reason: unknownFn.message,
      annotation: step.annotation,
    };
  }

  // A construct SAMOSA cannot read is a question, never a silent misread
  // (review 4.5): the raw node carries the reason
  const unreadable = rawReason(step.lhs) ?? rawReason(step.rhs);
  if (unreadable) {
    return {
      id: step.id,
      row: step.row,
      span: step.span,
      lhsSpan: step.lhs?.span,
      rhsSpan: step.rhs?.span,
      relation: step.relation,
      verdict: 'unchecked',
      card: base,
      message: unreadable,
      reason: unreadable,
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

export function unifyShapes(
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

export { compareSides } from './sides.ts';
export { sizeSettings } from './plan.ts';
export { sampledNames, freeVariables } from './shared.ts';
export { numericDelta, numericAbsDelta } from './numeric.ts';
