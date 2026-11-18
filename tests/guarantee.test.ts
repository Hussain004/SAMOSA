import { describe, expect, it } from 'vitest';
import { check, hasGuarantee, NO_GUARANTEE } from '../src/core/index.ts';
import { MENU } from '../corpus/menu.ts';
import { IDENTITIES } from '../corpus/cookbook/identities.ts';
import { FALSE_FRIENDS } from '../corpus/false-friends.ts';

/**
 * Rule 2: never a checkmark without a guarantee.
 *
 * `check` withdraws any checkmark whose card is not filled, so the rule
 * holds for every input. The corpora must never need it, though: a
 * withdrawn checkmark on a Menu row or a Cookbook identity is an engine gap
 * that this test names.
 */

const wrap = (row: string) => `\\begin{align*}\n${row}\n\\end{align*}`;

const SOURCES: Array<{ name: string; src: string; decls?: string }> = [
  ...MENU.flatMap((item) =>
    [item.source, item.bugSource, item.bugSource2]
      .filter((src): src is string => Boolean(src))
      .map((src) => ({ name: `menu ${item.id}`, src, decls: item.decls })),
  ),
  ...IDENTITIES.map((identity) => ({ name: `cookbook ${identity.id}`, src: identity.source, decls: identity.decls })),
  ...FALSE_FRIENDS.map((friend) => ({ name: `false friend ${friend.name}`, src: wrap(friend.src), decls: friend.decls })),
];

describe('the guarantee', () => {
  it('fills the card of every checkmark in the corpora, without the guard', () => {
    const gaps: string[] = [];
    for (const { name, src, decls } of SOURCES) {
      for (const step of check(src, { decls }).steps) {
        if (step.message === NO_GUARANTEE) gaps.push(`${name} row ${step.row}`);
        expect(hasGuarantee(step), `${name} row ${step.row}`).toBe(true);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('prices every exact checkmark of an implication', () => {
    const kalman = MENU.find((item) => item.id === 'kalman')!;
    const step = check(kalman.source, { decls: kalman.decls }).steps.find((s) => s.message.includes('implication'));
    expect(step?.verdict).toBe('ok');
    expect(step?.card.degree).toBeGreaterThan(0);
    expect(step?.card.bound).toBeLessThan(1e-20);
  });

  it('refuses a card with blanks', () => {
    const card = { trialsPerSize: 3, sizes: [{ n: 3 }], assumptions: [], seed: 0 };
    expect(hasGuarantee({ verdict: 'ok', mode: 'exact', card })).toBe(false);
    expect(hasGuarantee({ verdict: 'ok', mode: undefined, card })).toBe(false);
    expect(hasGuarantee({ verdict: 'ok', mode: 'exact', card: { ...card, primes: [3, 5], degree: 2, bound: 1 } })).toBe(false);
    expect(hasGuarantee({ verdict: 'ok', mode: 'exact', card: { ...card, primes: [3, 5], degree: 2, bound: 1e-9 } })).toBe(true);
    expect(hasGuarantee({ verdict: 'ok', mode: 'numeric', card: { ...card, sizes: [] } })).toBe(false);
    expect(hasGuarantee({ verdict: 'wrong', mode: undefined, card })).toBe(true);
  });
});
