#!/usr/bin/env node
import { check, checkStep, explain, explainAll } from '../src/core/index.ts';
import { shareLink, type SharePayload } from '../src/core/share.ts';
import type { StepResult } from '../src/core/index.ts';

/**
 * The MCP tool handlers, without the transport.
 *
 * The tools are small and the answers are evidence: the verdict, the
 * counterexample, the fixes and the share link a human can open to see the
 * same thing. Extracted from the server so the tests can call them directly.
 */

export const SHARE_BASE = process.env.SAMOSA_SHARE_BASE ?? 'https://samosa-math.vercel.app';

/** The link to the app, with the derivation and the declarations in it. */
export function shareUrl(source: string, declarations?: string, base: string = SHARE_BASE): string {
  return shareLink(base, { src: source, decls: declarations } as SharePayload);
}

/** The counts of a report, in one line. */
export function summarise(report: ReturnType<typeof check>): string {
  const counts = { ok: 0, wrong: 0, shape: 0, unchecked: 0, defined: 0, inconclusive: 0 };
  for (const step of report.steps) counts[step.verdict] += 1;
  const parts: string[] = [];
  if (counts.ok) parts.push(`${counts.ok} hold`);
  if (counts.wrong) parts.push(`${counts.wrong} wrong`);
  if (counts.shape) parts.push(`${counts.shape} shape error`);
  if (counts.inconclusive) parts.push(`${counts.inconclusive} inconclusive`);
  if (counts.unchecked) parts.push(`${counts.unchecked} not checked`);
  if (counts.defined) parts.push(`${counts.defined} defined`);
  return `${report.steps.length} rows: ${parts.join(', ')}`;
}

/** The exact span of a step, so an agent can edit the exact text. */
export function stepSpan(step: StepResult): { line: number | null; from: number; to: number } {
  return { line: step.line ?? null, from: step.span.from, to: step.span.to };
}

export function handleCheckDerivation(args: {
  latex: string;
  declarations?: string;
  preset?: string;
  seed?: number;
}): { structured: Record<string, unknown>; text: string } {
  const report = check(args.latex, {
    decls: args.declarations,
    preset: args.preset,
    seed: args.seed,
  });
  // The fixes and the shrunk counterexample, so the agent has something it
  // can act on and not only the fact that a row is wrong.
  const explanations = explainAll(
    args.latex,
    { decls: args.declarations, preset: args.preset, seed: args.seed },
    8,
    report,
  );
  const structured = {
    summary: summarise(report),
    // the declarations that could not be read, so the agent hears what the
    // user wrote that did nothing (review 5.5)
    warnings: report.diagnostics.filter((d) => d.severity !== 'error').map((d) => d.message),
    steps: report.steps.map((step) => {
      const explanation = explanations.get(step.id);
      return {
        row: step.row,
        verdict: step.verdict,
        mode: step.mode ?? null,
        message: step.message,
        relation: step.relation,
        card: step.card,
        span: stepSpan(step),
        lhsSpan: step.lhsSpan ?? null,
        rhsSpan: step.rhsSpan ?? null,
        fixes: explanation?.fixes ?? [],
        counterexample: explanation?.counterexample ?? null,
      };
    }),
    shareUrl: shareUrl(args.latex, args.declarations),
  };
  return { structured, text: summarise(report) };
}

export function handleCheckStep(args: {
  lhs: string;
  rhs: string;
  relation?: string;
  declarations?: string;
}): { structured: Record<string, unknown>; text: string } {
  const step = checkStep(args.lhs, args.rhs, { decls: args.declarations });
  const source = `${args.lhs} = ${args.rhs}`;
  const explanation = explain(source, 's0', { decls: args.declarations });
  const structured = {
    summary: `${step.verdict}: ${step.message}`,
    steps: [
      {
        row: step.row,
        verdict: step.verdict,
        mode: step.mode ?? null,
        message: step.message,
        relation: step.relation,
        card: step.card,
        span: stepSpan(step),
        lhsSpan: step.lhsSpan ?? null,
        rhsSpan: step.rhsSpan ?? null,
        fixes: explanation.fixes,
        counterexample: explanation.counterexample ?? null,
      },
    ],
    shareUrl: shareUrl(source, args.declarations),
  };
  return { structured, text: `${step.verdict}: ${step.message}` };
}

export function handleFindCounterexample(args: {
  lhs: string;
  rhs: string;
  declarations?: string;
}): { structured: Record<string, unknown>; text: string } {
  const source = `${args.lhs} = ${args.rhs}`;
  const explanation = explain(source, 's0', { decls: args.declarations });
  const text = explanation.counterexample
    ? explanation.counterexample.numpy
    : 'no counterexample was found';
  return {
    structured: {
      summary: text,
      steps: [],
      fixes: explanation.fixes,
    },
    text,
  };
}

/**
 * What SAMOSA had to guess, to check a derivation nobody declared.
 *
 * The guessed symbols come back as a compact declaration string the agent
 * can pass straight back to check_derivation, and the harvested ones with
 * their origins, so the agent hears what the text gave it.
 */
export function handleSuggestDeclarations(args: {
  latex: string;
}): { structured: Record<string, unknown>; text: string } {
  const report = check(args.latex, {});
  const chips = report.chips ?? [];
  const guessed = chips.filter((chip) => chip.id === 'shape-guess').map((chip) => chip.symbol);
  const harvested = chips.filter((chip) => chip.id === 'harvested').map((chip) => ({
    message: chip.message,
    symbol: chip.symbol,
  }));
  // the guess for a capital is a matrix; a scalar oracle is impossible to
  // guess, so the guesses are honest: everything unknown is n×n
  const guessDecls = guessed.map((symbol) => `${symbol}: n×n`);
  const harvestDecls = harvested.map(({ message }) => {
    // "x ~ N(mu, Sigma), read from line 12" → "x ~ N(mu, Sigma)"
    const cut = message.indexOf(',');
    return cut > 0 ? message.slice(0, cut) : message;
  });
  const decls = [...guessDecls, ...harvestDecls].join('; ');
  const samosaComment = decls ? `% samosa: ${decls}` : '';
  const structured = {
    declarations: decls,
    samosaComment,
    guessed,
    harvested: harvested.map(({ message, symbol }) => ({ symbol, origin: message })),
    note: 'the guesses are the engine default: every guessed symbol is a square matrix. Declare structure (spd, sym, an n-vector, a distribution) to make the guesses honest.',
    summary: decls
      ? `${guessDecls.length} guessed, ${harvestDecls.length} harvested`
      : 'nothing to declare; SAMOSA read every symbol from the text or had no need to guess',
  };
  return {
    structured,
    text: structured.summary as string,
  };
}

/**
 * One row, explained: the verdict, the card, the fixes, the counterexample.
 *
 * The full check runs because the verdicts feed each other — the fixes for a
 * row may depend on the rows before it — but the answer is one row only, so
 * an agent iterating on a fix never pays for twelve explanations.
 */
export function handleExplainStep(args: {
  latex: string;
  row: number;
  declarations?: string;
  preset?: string;
  seed?: number;
}): { structured: Record<string, unknown>; text: string } {
  const report = check(args.latex, {
    decls: args.declarations,
    preset: args.preset,
    seed: args.seed,
  });
  const step = report.steps.find((s) => s.row === args.row);
  if (!step) {
    const rows = report.steps.map((s) => s.row).join(', ');
    const text = `no row ${args.row}; the rows are ${rows}`;
    return { structured: { summary: text, row: args.row, error: text }, text };
  }
  const explanation = explain(args.latex, step.id, {
    decls: args.declarations,
    preset: args.preset,
    seed: args.seed,
  }, report);
  const structured = {
    row: step.row,
    verdict: step.verdict,
    mode: step.mode ?? null,
    message: step.message,
    relation: step.relation,
    card: step.card,
    span: stepSpan(step),
    lhsSpan: step.lhsSpan ?? null,
    rhsSpan: step.rhsSpan ?? null,
    fixes: explanation?.fixes ?? [],
    counterexample: explanation?.counterexample ?? null,
    shareUrl: shareUrl(args.latex, args.declarations),
  };
  return { structured, text: `${step.verdict}: ${step.message}` };
}

export type CheckDerivationHandler = typeof handleCheckDerivation;
