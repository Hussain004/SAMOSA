import { describe, expect, it } from 'vitest';
import { MENU } from '../corpus/menu.ts';
import { PACKS, packById, packCandidates } from '../corpus/packs.ts';

/**
 * The course packs.
 *
 * A pack is a deck of Menu items for the spot-the-bug game. Every id in
 * every pack has to exist in the Menu and carry a planted bug, or the game
 * breaks for a TA that chose it.
 */

describe('the course packs', () => {
  it('reference only items that exist in the Menu, with bugs', () => {
    for (const pack of PACKS) {
      expect(pack.itemIds.length, pack.id).toBeGreaterThanOrEqual(3);
      for (const id of pack.itemIds) {
        const item = MENU.find((entry) => entry.id === id);
        expect(item, `${pack.id} refers to missing menu item ${id}`).toBeDefined();
        expect(item!.bugSource, `${pack.id} refers to ${id}, which has no bug`).toBeTruthy();
      }
    }
  });

  it('has a title and a one-line blurb for every pack', () => {
    for (const pack of PACKS) {
      expect(pack.title.length).toBeGreaterThan(3);
      expect(pack.blurb.length).toBeGreaterThan(10);
    }
  });

  it('packById finds the pack, and returns null for anything else', () => {
    expect(packById('backprop')?.title).toContain('Backprop');
    expect(packById('ta')?.title).toContain('TA');
    expect(packById('nope')).toBeNull();
    expect(packById(undefined)).toBeNull();
    expect(packById(null)).toBeNull();
  });

  it('packCandidates excludes the item that is on screen', () => {
    for (const pack of PACKS) {
      const all = packCandidates(pack, MENU);
      expect(all.length, pack.id).toBe(pack.itemIds.length);
      for (const excluded of pack.itemIds) {
        const rest = packCandidates(pack, MENU, excluded);
        expect(rest.map((item) => item.id)).not.toContain(excluded);
      }
    }
  });

  it('packCandidates is empty for a pack with no bugs, and never invents one', () => {
    const ghost = { id: 'ghost', title: 'ghost', blurb: 'ghost pack for the test', itemIds: ['woodbury'] };
    expect(packCandidates(ghost, []).length).toBe(0);
  });
});
