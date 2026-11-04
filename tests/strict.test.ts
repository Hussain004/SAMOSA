import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { check } from '../src/core/verdict.ts';
import { parseRow } from '../src/core/parse.ts';
import { parseDeclarations } from '../src/core/decl.ts';

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

describe('a declaration the parser does not read (review 5.5)', () => {
  it('the words for the standing matrices are there', () => {
    const result = parseDeclarations('Z: zero n; E: ident n; B: n by n');
    expect(result.decls.map((d) => `${d.name}:${d.kind}`)).toEqual(['Z:matrix', 'E:matrix', 'B:matrix']);
    expect(result.errors).toEqual([]);
  });

  it('an unknown type is an error, never a silence', () => {
    const result = parseDeclarations('Z: zero n; A: banana n');
    expect(result.decls.map((d) => d.name)).toEqual(['Z']);
    expect(result.errors).toEqual(['the type of A is not read: banana n']);
  });

  it('the checker says the error out loud, in the diagnostics', () => {
    const report = check('A^\\top = A', { decls: 'A: banana n' });
    expect(report.diagnostics.some((d) => d.message.includes('the type of A is not read'))).toBe(true);
    // the symbol really is undeclared, so the engine also says what it had
    // to guess about it
    expect(report.chips.some((c) => c.id === 'shape-guess')).toBe(true);
  });

  it('a zero on one side names the zero matrix', () => {
    // P idempotent is singular by design, so this also needs 5.4
    const report = check('(P - I) P = 0', { decls: 'P: idem 3' });
    expect(report.steps[0].verdict).toBe('ok');
  });

  it('a matrix against a number that is not zero is still a shape error', () => {
    const report = check('A = 5', { decls: 'A: n×n' });
    expect(report.steps[0].verdict).toBe('shape');
  });

  it('a shape error carries the sizes that do not fit', () => {
    // the card used to show an assignment where the shapes agreed, which
    // cannot witness the mismatch; every size on the card must not fit
    const report = check('(A B)^\\top = A^\\top B^\\top', { decls: 'A: m×n; B: n×m' });
    expect(report.steps[0].verdict).toBe('shape');
    const sizes = report.steps[0].card.sizes;
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      expect(size.m).not.toBe(size.n);
    }
  });

  it('a pinned dimension is used, not dropped', () => {
    const pinned = check('A^\\top = A', { decls: 'A: sym n; n = 3' });
    const free = check('A^\\top = A', { decls: 'A: sym n' });
    // the pinned dimension is swept at no size, the free one at three
    expect(pinned.steps[0].card.sizes).toEqual([{}]);
    expect(free.steps[0].card.sizes.length).toBeGreaterThan(1);
    expect(pinned.steps[0].verdict).toBe('ok');
  });
});

describe('a declared value before a parenthesis', () => {
  // A (B + C) used to be read as a call to an unknown function A, so plain
  // distributivity came back as a question, and before that as a false shape
  // error. A name the user declared as a value is a factor, never a function.
  const verdict = (row: string, decls: string) => check(`\\begin{align*} ${row} \\end{align*}`, { decls }).steps.at(-1)?.verdict;

  it('is a product, so distributivity holds', () => {
    expect(verdict('A (B + C) &= A B + A C', 'A, B, C: n×n')).toBe('ok');
    expect(verdict('c (a + b) &= c a + c b', 'a, b, c: scalar')).toBe('ok');
    expect(verdict('y \\left(A + B\\right) &= y A + y B', 'y: 1×n; A, B: n×n')).toBe('ok');
  });

  it('is still a product when the factors do not fit', () => {
    expect(verdict('x (A + B) &= x A', 'x: n; A, B: n×n')).toBe('shape');
  });

  it('is a product when the name was defined earlier in the derivation', () => {
    const source = '\\begin{align*} K &:= A B \\\\ K (C + D) &= K C + K D \\end{align*}';
    expect(check(source, { decls: 'A, B, C, D: n×n' }).steps.at(-1)?.verdict).toBe('ok');
  });

  it('leaves a function the user declared as a call', () => {
    const report = check('\\begin{align*} f &:= x^\\top x \\\\ \\frac{\\partial f}{\\partial x} &= 2 x \\end{align*}', { decls: 'x: n' });
    expect(report.steps.at(-1)?.verdict).toBe('ok');
  });
});
