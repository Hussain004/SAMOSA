/**
 * The course packs.
 *
 * A pack is a named bundle of Menu items, used as a practice deck for the
 * spot-the-bug game: a TA assembles the week's five derivations, the deck
 * plays, the score is the streak. Every id must exist in the Menu and
 * carry a planted bug, which the test enforces.
 */
export interface Pack {
  id: string;
  title: string;
  blurb: string;
  itemIds: string[];
}

export const PACKS: Pack[] = [
  {
    id: 'backprop',
    title: 'Backprop through an MLP',
    blurb: 'the gradient derivations, logistic to softmax to the MLP',
    itemIds: ['ridge', 'logistic', 'softmax-ce', 'least-squares', 'mlp'],
  },
  {
    id: 'kalman',
    title: 'EKF and the Riccati recursion',
    blurb: 'the filter, the gain, the stable update, conditioning',
    itemIds: ['kalman', 'joseph', 'gauss-cond', 'kl-gauss', 'lqr'],
  },
  {
    id: 'lemmas',
    title: 'The inversion lemmas',
    blurb: 'Woodbury, Sherman-Morrison, the determinant lemma, and friends',
    itemIds: ['woodbury', 'sherman-morrison', 'det-lemma', 'quadratic', 'trace'],
  },
  {
    id: 'ta',
    title: 'TA solution keys',
    blurb: 'the whole exam you will set: a false step in every row',
    itemIds: ['rotation', 'quadratic', 'trace', 'kl-gauss', 'woodbury', 'mlp', 'gauss-cond', 'ridge'],
  },
];

/** The pack by id, or null. */
export function packById(id: string | null | undefined): Pack | null {
  if (!id) return null;
  return PACKS.find((pack) => pack.id === id) ?? null;
}

/**
 * The items of a pack that can play the game, excluding one item (the one
 * on screen). The general game has its own pool and its own rules; a
 * pack plays its items as they are, all of them carrying a bug.
 */
export function packCandidates<T extends { id: string; bugSource?: string }>(
  pack: Pack,
  items: T[],
  excludeId?: string,
): T[] {
  return items.filter(
    (item) => pack.itemIds.includes(item.id) && item.bugSource && item.id !== excludeId,
  );
}
