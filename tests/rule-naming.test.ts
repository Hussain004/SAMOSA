import { describe, expect, it } from 'vitest';
import { check, explain } from '../src/core/index.ts';
import { MENU } from '../corpus/menu.ts';

/**
 * The names of the identities, on the rows the Menu holds.
 *
 * A row that holds is an instance of an identity, and the card says which
 * one. This is the naming the Cookbook makes possible: the checker found
 * the row holds, and the same machinery names what it is.
 *
 * The names are pinned per row, so a change to the matcher shows up here
 * before it ships as a wrong label on a card.
 */

const EXPECTED: Record<string, string[]> = {
  woodbury: ['the inverse of a sum, in the Woodbury form'],
  'sherman-morrison': ['the Sherman-Morrison formula'],
  'det-lemma': ['the matrix determinant lemma'],
  trace: ['the trace of a product is cyclic'],
  kalman: ['the Kalman gain', 'the Joseph form'],
  joseph: ['the Joseph form', 'the Joseph form'],
  rotation: ['an orthogonal matrix is its transpose inverse'],
};

describe('the identity names, on the Menu rows', () => {
  for (const [id, names] of Object.entries(EXPECTED)) {
    it(`names the identity of ${id}`, () => {
      const item = MENU.find((entry) => entry.id === id);
      if (!item) throw new Error(`no menu item ${id}`);
      const report = check(item.source, { decls: item.decls });
      const named = report.steps
        .filter((step) => step.verdict === 'ok')
        .map((step) => explain(item.source, step.id, { decls: item.decls }, report).ruleName)
        .filter((name): name is string => Boolean(name));
      for (const name of names) {
        expect(named, `${id} should name ${name}`).toContain(name);
      }
    });
  }

  it('never names a row that does not hold', () => {
    for (const item of MENU) {
      const report = check(item.source, { decls: item.decls });
      for (const step of report.steps) {
        if (step.verdict === 'ok') continue;
        const explanation = explain(item.source, step.id, { decls: item.decls }, report);
        expect(explanation.ruleName, `${item.id} row ${step.row}`).toBeUndefined();
      }
    }
  });

  it('is stable across runs, on the seeded instances', () => {
    const item = MENU.find((entry) => entry.id === 'kalman')!;
    const first = check(item.source, { decls: item.decls });
    const second = check(item.source, { decls: item.decls });
    expect(second.steps.map((s) => s.id)).toEqual(first.steps.map((s) => s.id));
    const named = first.steps
      .filter((step) => step.verdict === 'ok')
      .map((step) => explain(item.source, step.id, { decls: item.decls }, first).ruleName);
    expect(named).toContain('the Kalman gain');
    expect(named).toContain('the Joseph form');
  });
});
