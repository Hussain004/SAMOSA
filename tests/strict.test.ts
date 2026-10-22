import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { check } from '../src/core/verdict.ts';
import { parseRow } from '../src/core/parse.ts';

/**
 * The rows that look right and are not.
 *
 * A linter that says "holds" about a row it did not read is worse than one
 * that says nothing, so the parser has to be strict: anything it does not
 * understand has to come back as a question, never as a checkmark.
 */

const DECLS = 'A, B: n×n';

describe('a row the parser does not read', () => {
  it('never gets a checkmark', () => {
    const cases = [
      '\\begin{align*} A + B &= A + B) + B \\end{align*}',
      '\\begin{align*} A B &= A B) - B A \\end{align*}',
      '\\begin{align*} A &= B)) \\end{align*}',
      '\\begin{align*} A &= (B \\end{align*}',
      '\\begin{align*} A &= B] \\end{align*}',
    ];
    for (const source of cases) {
      const report = check(source, { decls: DECLS });
      for (const step of report.steps) {
        expect(step.verdict, `${source} gave ${step.verdict}`).not.toBe('ok');
      }
    }
  });

  it('says why it could not read the row', () => {
    const report = check('\\begin{align*} A + B &= A + B) + B \\end{align*}', { decls: DECLS });
    const step = report.steps[0];
    expect(step.verdict).not.toBe('ok');
    expect(step.message.toLowerCase()).toContain('unbalanced');
  });

  it('never gets a checkmark when there is junk after the row', () => {
    fc.assert(
      fc.property(fc.integer({ min: -4, max: 4 }), fc.integer({ min: -4, max: 4 }), (a, b) => {
        const source = `\\begin{align*} A + B &= ${a} A ${b} B \\end{align*}`;
        const report = check(source, { decls: DECLS });
        for (const step of report.steps) {
          expect(step.verdict, `${source} gave ${step.verdict}`).not.toBe('ok');
        }
      }),
      { numRuns: 25 },
    );
  });
});

describe('the span of the right hand side', () => {
  it('covers the whole right hand side, the closing bracket included', () => {
    const cases: Array<[string, string]> = [
      ['\\det(A B) &= \\det(A)\\det(B)', '\\det(A)\\det(B)'],
      ['(A B)^\\top &= \\operatorname{tr}(A)', '\\operatorname{tr}(A)'],
      ['A &= B + C', 'B + C'],
    ];
    for (const [source, expected] of cases) {
      const parsed = parseRow(source, source, 0, 0);
      const part = parsed.parts[0];
      // the row has to be read, or the test says nothing
      expect(parsed.error, `${source} could not be read`).toBeUndefined();
      expect(part?.rhsSpan, `${source} has no right hand side span`).toBeDefined();
      const slice = source.slice(part!.rhsSpan!.from, part!.rhsSpan!.to);
      expect(slice, `${source} gave the span ${slice}`).toBe(expected);
    }
  });
});

describe('an implicit definition', () => {
  it('is a claim when the symbol is declared', () => {
    const report = check('\\begin{align*} A &= B \\end{align*}', { decls: DECLS });
    expect(report.steps[0].verdict).not.toBe('defined');
    expect(report.steps[0].verdict).toBe('wrong');
  });

  it('is a claim when the symbol occurs on the right hand side', () => {
    const report = check('\\begin{align*} A &= A^\\top \\end{align*}', { decls: 'A: n×n' });
    expect(report.steps[0].verdict).not.toBe('defined');
    expect(report.steps[0].verdict).toBe('wrong');
  });

  it('is a claim when it is circular', () => {
    const report = check('\\begin{align*} S &= S + I \\end{align*}', { decls: 'S: spd n' });
    expect(report.steps[0].verdict).not.toBe('defined');
    expect(report.steps[0].verdict).not.toBe('ok');
  });
});
