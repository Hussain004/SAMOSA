import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';
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
    const text = formatPretty(report, { file: 'kalman.tex' });
    expect(text).toContain('✗ wrong');
    expect(text).toContain('samosa/not-equal');
    expect(text).toContain(summaryLine(report));
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
});
