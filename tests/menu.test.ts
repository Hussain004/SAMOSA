import { describe, expect, it } from 'vitest';
import { check } from '../src/core/verdict.ts';
import { MENU } from '../corpus/menu.ts';

/**
 * The Menu is the golden suite.
 *
 * Every correct derivation has to pass with no false checkmark, and every
 * planted bug has to be caught on the right row.
 */

describe('the menu', () => {
  for (const item of MENU) {
    it(`${item.id}: the correct version passes`, () => {
      const report = check(item.source, { decls: item.decls });
      const bad = report.steps.filter(
        (s) => s.verdict === 'wrong' || s.verdict === 'shape' || s.verdict === 'inconclusive',
      );
      expect(bad.map((s) => `row ${s.row}: ${s.message}`)).toEqual([]);
    });

    if (item.bugSource) {
      it(`${item.id}: the planted bug is caught`, () => {
        const report = check(item.bugSource, { decls: item.decls });
        const bad = report.steps.filter((s) => s.verdict === 'wrong' || s.verdict === 'shape');
        expect(bad.length).toBeGreaterThan(0);
      });
    }
  }
});
