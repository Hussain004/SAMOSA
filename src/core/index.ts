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

import { check, type CheckOptions, type StepResult } from './verdict.ts';
import { parseRow } from './parse.ts';

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
  const rows = splitRowsSafe(src);
  return rows.map((row) => parseRow(src, row.text, row.from, 0));
}

function splitRowsSafe(src: string) {
  // a tiny indirection so that the parse helper does not import the whole
  // document pipeline at the top level
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return splitRowsImpl(src);
}

import { splitRows as splitRowsImpl } from './steps.ts';
