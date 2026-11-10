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

describe('the MCP tools for agents', () => {
  const woodbury = MENU.find((m) => m.id === 'woodbury')!;

  it('suggest_declarations returns what the engine guessed, as a compact declaration string', async () => {
    const { handleSuggestDeclarations } = await import('../mcp/tools.ts');
    const { structured } = handleSuggestDeclarations({ latex: woodbury.source });
    expect(structured.declarations).toBe('A: n×n; U: n×n; C: n×n; V: n×n');
    expect(structured.guessed).toEqual(['A', 'U', 'C', 'V']);
  });

  it('two calls go from undeclared LaTeX to an all-hold result', async () => {
    const { handleSuggestDeclarations, handleCheckDerivation } = await import('../mcp/tools.ts');
    const first = handleSuggestDeclarations({ latex: woodbury.source });
    const second = handleCheckDerivation({ latex: woodbury.source, declarations: first.structured.declarations as string });
    const rows = (second.structured.steps as Array<{ verdict: string }>).map((s) => s.verdict);
    expect(rows).toEqual(['ok']);
  });

  it('every step carries the span an agent needs to edit the text', async () => {
    const { handleCheckDerivation } = await import('../mcp/tools.ts');
    const { structured } = handleCheckDerivation({ latex: woodbury.source, declarations: woodbury.decls });
    const steps = structured.steps as Array<{ row: number; span: { from: number; to: number }; text?: string }>;
    for (const [index, step] of steps.entries()) {
      expect(step.span.to, `row ${step.row}`).toBeGreaterThan(step.span.from);
      expect(step.row).toBe(index + 1);
    }
  });

  it('explain_step returns one row only, with the fix', async () => {
    const kalman = MENU.find((m) => m.id === 'kalman')!;
    const declared = check(kalman.bugSource!, { decls: kalman.decls });
    const wrong = declared.steps.find((s) => s.verdict === 'wrong')!;
    const { handleExplainStep } = await import('../mcp/tools.ts');
    const { structured } = handleExplainStep({
      latex: kalman.bugSource!,
      row: wrong.row,
      declarations: kalman.decls,
    });
    expect(structured.verdict).toBe('wrong');
    expect(structured.row).toBe(wrong.row);
    expect(Array.isArray(structured.fixes)).toBe(true);
    expect((structured.fixes as Array<unknown>).length).toBeGreaterThan(0);
  });

  it('explain_step names the row that does not exist', async () => {
    const { handleExplainStep } = await import('../mcp/tools.ts');
    const { structured } = handleExplainStep({ latex: woodbury.source, row: 99, declarations: woodbury.decls });
    expect(String(structured.error)).toContain('no row 99');
  });

  it('the guessed declarations round trip through check_derivation', async () => {
    const { handleCheckDerivation } = await import('../mcp/tools.ts');
    const { structured } = handleCheckDerivation({
      latex: woodbury.source,
      declarations: 'A: spd n',
    });
    expect(structured.summary).toContain('1 hold');
  });
});
