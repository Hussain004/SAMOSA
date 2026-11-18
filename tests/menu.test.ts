import { describe, expect, it } from 'vitest';
import { check } from '../src/core/verdict/index.ts';
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

    it(`${item.id}: declares nothing it does not use`, () => {
      // the app shows an unused declaration as a warning on its pill, and a
      // Menu item is the first thing a visitor opens
      const unused = check(item.source, { decls: item.decls })
        .chips.filter((chip) => chip.id === 'unused-declaration')
        .map((chip) => chip.symbol);
      expect(unused).toEqual([]);
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
