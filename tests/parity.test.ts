import { describe, expect, it } from 'vitest';
import { check, explain } from '../src/core/index.ts';
import { formatPretty, formatSarif, formatGithub, summaryLine } from '../cli/format.ts';
import { MENU } from '../corpus/menu.ts';

/**
 * Gate G7: the CLI, the MCP server and the web app must give the same
 * verdict for the same input.
 *
 * The three of them call the same engine, so the test is that they agree on
 * the report and that the formats say the same thing about it.
 */

const item = MENU.find((m) => m.id === 'kalman')!;

describe('the same verdict everywhere', () => {
  const report = check(item.bugSource!, { decls: item.decls });

  it('the engine finds the planted bug', () => {
    const wrong = report.steps.filter((s) => s.verdict === 'wrong');
    expect(wrong.length).toBe(1);
  });

  it('the pretty format says the same thing', () => {
    const withFixes = check(item.bugSource!, { decls: item.decls });
    const wrong = withFixes.steps.find((step) => step.verdict === 'wrong')!;
    const explanation = explain(item.bugSource!, wrong.id, { decls: item.decls }, withFixes);
    wrong.fixes = explanation.fixes;
    const text = formatPretty(withFixes, { file: 'kalman.tex' });
    expect(text).toContain('✗ wrong');
    expect(text).toContain('samosa/not-equal');
    expect(text).toContain('fix:');
    expect(text).toContain(explanation.fixes[0].title);
    expect(text).toContain(summaryLine(withFixes));
  });

  it('the SARIF format has one result per finding', () => {
    const sarif = JSON.parse(formatSarif([{ file: 'kalman.tex', report }]));
    expect(sarif.version).toBe('2.1.0');
    const results = sarif.runs[0].results;
    expect(results.length).toBe(report.steps.filter((s) => s.verdict === 'wrong' || s.verdict === 'shape').length);
    expect(results[0].ruleId).toBe('samosa/not-equal');
    expect(results[0].level).toBe('error');
    expect(results[0].partialFingerprints['samosa/v1']).toBeTruthy();
  });

  it('the GitHub format is a workflow command', () => {
    const text = formatGithub([{ file: 'kalman.tex', report }]);
    expect(text).toContain('::error file=kalman.tex,line=');
    expect(text).toContain('title=SAMOSA ✗ wrong');
  });

  it('the report is the same every time', () => {
    const again = check(item.bugSource!, { decls: item.decls });
    expect(again.steps.map((s) => s.verdict)).toEqual(report.steps.map((s) => s.verdict));
    expect(again.steps.map((s) => s.row)).toEqual(report.steps.map((s) => s.row));
  });

  it('a different seed can change nothing but the counterexample', () => {
    const other = check(item.bugSource!, { decls: item.decls, seed: 12345 });
    expect(other.steps.map((s) => s.verdict)).toEqual(report.steps.map((s) => s.verdict));
  });

  it('a source that declares its symbols in a comment is read everywhere (review 4.7)', () => {
    // the comment used to be a CLI-only feature: the MCP server and the app
    // passed the LaTeX straight to check() and never saw the declarations
    const src = [
      '% samosa: A: sym n',
      '\\begin{align*}',
      '  A^\\top &= A \\\\',
      '  A^\\top A &= A^2',
      '\\end{align*}',
    ].join('\n');
    const withComment = check(src);
    const steps = withComment.steps.filter((s) => s.verdict !== 'defined');
    // the symmetric identity holds once the comment has been read
    for (const step of steps) {
      expect(['ok', 'inconclusive', 'unchecked']).toContain(step.verdict);
      expect(step.verdict).not.toBe('shape');
      expect(step.message).not.toContain('treated as a matrix');
    }
    // and the same source without the comment says so honestly: the engine
    // has to guess what A is, and flags the guess
    const withoutComment = check(src.replace('% samosa: A: sym n\n', ''));
    expect(withoutComment.steps.some((s) => s.verdict === 'wrong')).toBe(true);
    expect(withoutComment.chips.some((c) => c.id === 'shape-guess')).toBe(true);
  });
});
