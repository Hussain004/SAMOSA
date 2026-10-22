/**
 * The public surface of the engine.
 *
 * The web app, the CLI and the MCP server all go through this file, so the
 * three of them always give the same verdict for the same input.
 */

export { check, sizeSettings, ENGINE_VERSION, DEFAULT_SEED } from './verdict.ts';
export type {
  CheckOptions,
  Counterexample,
  Diagnostic,
  Fix,
  GuaranteeCard,
  Mode,
  Report,
  StepResult,
  Verdict,
} from './verdict.ts';

export { parseRow, Parser, classifySuperscript, findRelations } from './parse.ts';
export { tokenize, renderTokens } from './lex.ts';
export type { Token } from './lex.ts';
export { splitRows, extractProse, harvestProseDecls } from './steps.ts';
export { parseDeclarations, parseCompactItem, parseDims, parseDim } from './decl.ts';
export type { Dim, Dist, Prop, SymKind, SymbolDecl } from './decl.ts';
export { PRESETS, getPreset, presetDecls } from './presets.ts';
export type { Preset } from './presets.ts';
export { canonicalizeSymbol, toDisplay, foldUnicode } from './notation.ts';
export { createContext, inferType, degreeOf, shapeText } from './types.ts';
export type { Chip, Deg, SymbolInfo, Ty } from './types.ts';
export type { Node, Relation, RowPart, Span } from './ir.ts';
export { renderNode } from './render.ts';
export { shrinkCounterexample } from './shrink.ts';
export type { ShrunkInstance } from './shrink.ts';

import { check, type CheckOptions, type Fix, type Report, type StepResult } from './verdict.ts';
import { parseRow } from './parse.ts';
import { splitRows } from './steps.ts';
import { parseDeclarations } from './decl.ts';
import { presetDecls } from './presets.ts';
import { createContext, inferType } from './types.ts';
import { shrinkCounterexample, type ShrunkInstance } from './shrink.ts';
import { repairs } from './repair.ts';
import type { Node } from './ir.ts';
import { collectDimVarsFor } from './dims.ts';

/**
 * Checks a single step, which is what the CLI and the MCP server use when
 * somebody hands over one equation.
 */
export function checkStep(lhs: string, rhs: string, opts: CheckOptions = {}): StepResult {
  const src = `${lhs} = ${rhs}`;
  const report = check(src, { ...opts, trials: opts.trials ?? 3 });
  const step = report.steps[0];
  if (!step) {
    return {
      id: 's0',
      row: 1,
      span: { from: 0, to: src.length },
      relation: '=',
      verdict: 'unchecked',
      card: { trialsPerSize: 0, sizes: [], assumptions: [], seed: opts.seed ?? 0 },
      message: 'SAMOSA could not read that step',
      reason: 'SAMOSA could not read that step',
    };
  }
  return step;
}

/** Parses a source without checking it. */
export function parse(src: string) {
  return splitRows(src).map((row) => parseRow(src, row.text, row.from, 0));
}

export interface Explanation {
  fixes: Fix[];
  counterexample?: ShrunkInstance;
  /** the guarantee card of the step, again */
  card?: StepResult['card'];
}

/**
 * The lazy part of a verdict: the shrunk counterexample and the fixes.
 *
 * These are expensive, so they only run when somebody opens the card of a
 * wrong step.
 */
export function explain(
  src: string,
  stepId: string,
  opts: CheckOptions = {},
  report?: Report,
): Explanation {
  const parsed = parseForExplain(src, opts);
  const step = parsed.steps.find((s) => s.id === stepId);
  if (!step || !step.lhs || !step.rhs) return { fixes: [] };
  // A row that holds has nothing to repair, so no fixes are offered for it.
  const verdict = report?.steps.find((s) => s.id === stepId)?.verdict;
  if (verdict && verdict !== 'wrong' && verdict !== 'shape') return { fixes: [] };
  return explainStep(parsed, step, opts);
}

/**
 * The explanations of every step that is wrong or does not fit.
 *
 * The CLI and the MCP server need all of them, and parsing the source once
 * for all of them is what makes that affordable.
 */
export function explainAll(
  src: string,
  opts: CheckOptions = {},
  limit = 8,
  report?: Report,
): Map<string, Explanation> {
  const out = new Map<string, Explanation>();
  const parsed = parseForExplain(src, opts);
  const deadline = Date.now() + (opts.budgetMs ?? 4000);
  let count = 0;
  for (const step of parsed.steps) {
    if (count >= limit) break;
    if (Date.now() > deadline) break;
    if (!step.lhs || !step.rhs) continue;
    if (step.relation !== '=' && step.relation !== 'shape') continue;
    const verdict = report?.steps.find((s) => s.id === step.id)?.verdict;
    if (verdict && verdict !== 'wrong' && verdict !== 'shape') continue;
    out.set(step.id, explainStep(parsed, step, opts));
    count++;
  }
  return out;
}

interface ParsedSource {
  ctx: ReturnType<typeof createContext>;
  defs: Map<string, Node>;
  steps: Array<{ id: string; lhs?: Node; rhs?: Node; relation: string; defined: boolean }>;
}

/** Parses a source into the steps the explanations work on. */
function parseForExplain(src: string, opts: CheckOptions): ParsedSource {
  const rows = splitRows(src);
  const declared = parseDeclarations(opts.decls ?? '');
  const preset = presetDecls(opts.preset);
  const decls = [...preset];
  const index = new Map(decls.map((d, i) => [d.name, i]));
  for (const d of declared.decls) {
    const at = index.get(d.name);
    if (at === undefined) {
      index.set(d.name, decls.length);
      decls.push(d);
    } else {
      decls[at] = d;
    }
  }

  const ctx = createContext(decls, opts.layout ?? 'denominator');
  const defs = new Map<string, Node>();
  const steps: ParsedSource['steps'] = [];
  let previousRhs: Node | undefined;

  rows.forEach((row, rowIndex) => {
    const parsed = parseRow(src, row.text, row.from, rowIndex);
    if (parsed.prose || !parsed.parts.length) return;
    for (const part of parsed.parts) {
      if (part.relation === '=>' || part.relation === '<=>') {
        steps.push({
          id: `s${steps.length}`,
          lhs: part.conclusion?.lhs,
          rhs: part.conclusion?.rhs,
          relation: part.relation,
          defined: false,
        });
        previousRhs = part.conclusion?.rhs;
        continue;
      }
      const lhs = part.lhs ?? previousRhs;
      const rhs = part.rhs;
      const bareLhs = lhs?.k === 'sym' ? lhs.name : undefined;
      const isDefinition =
        part.relation === ':=' ||
        (bareLhs !== undefined && !ctx.decls.has(bareLhs) && !defs.has(bareLhs));
      steps.push({
        id: `s${steps.length}`,
        lhs,
        rhs,
        relation: part.relation,
        defined: isDefinition,
      });
      previousRhs = rhs;
      if (isDefinition && bareLhs && rhs) {
        defs.set(bareLhs, rhs);
        ctx.defs.set(bareLhs, rhs);
      }
    }
  });

  return { ctx, defs, steps };
}

/** The fixes and the counterexample of one step. */
function explainStep(parsed: ParsedSource, step: ParsedSource['steps'][number], opts: CheckOptions): Explanation {
  const { ctx, defs } = parsed;
  if (!step.lhs || !step.rhs) return { fixes: [] };

  inferType(ctx, step.lhs);
  inferType(ctx, step.rhs);
  const dimVars = collectDimVarsFor(ctx, step.lhs, step.rhs, defs);

  const kind = step.relation === '=' ? 'wrong' : 'shape';
  const fixes = repairs(ctx, step.lhs, step.rhs, defs, opts.seed ?? 0x5a305a, dimVars, kind);

  // The counterexample is looked for at the smallest sizes first, so the one
  // a person reads is the one that still breaks the step with the fewest
  // numbers in it.
  let counterexample: ShrunkInstance | undefined;
  const deadline = Date.now() + 600;
  for (const size of [1, 2, 3]) {
    const sizes = new Map<string, number>();
    // the sizes are keyed by the root of the dimension variable, the way the
    // evaluator looks them up
    for (const v of dimVars) sizes.set(ctx.dims.find(v), size);
    const left = Math.max(50, deadline - Date.now());
    try {
      counterexample = shrinkCounterexample(ctx, step.lhs, step.rhs, defs, sizes, opts.seed ?? 0x5a305a, left) ?? undefined;
    } catch {
      counterexample = undefined;
    }
    if (counterexample) break;
    if (Date.now() > deadline) break;
  }

  return { fixes, counterexample };
}
