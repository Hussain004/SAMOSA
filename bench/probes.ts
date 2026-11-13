/**
 * SAMOSA-Bench: the probe list.
 *
 * SAMOSA-Bench is the auditor's report card. Every probe is an identity
 * SAMOSA was already built to judge: the 94 measured Cookbook identities
 * (which must come back ok) and the 43 measured false friends (which may
 * never come back ok). Nothing is invented here, and no model answers
 * exist yet: the list is a projection of the measured corpora, so it grows
 * with them.
 *
 * The file is a map, not a corpus. The corpora stay the single source:
 *
 *   corpus/cookbook/identities.ts   the identities people write
 *   corpus/false-friends.ts         the mistakes people actually write
 */

import { IDENTITIES } from '../corpus/cookbook/identities.ts';
import { FALSE_FRIENDS } from '../corpus/false-friends.ts';

export type Expected = 'ok' | 'wrong';
export type Source = 'cookbook' | 'ledger';

export interface Probe {
  /** stable handle, `true-<cookbook id>` or a slug of the friend's name */
  id: string;
  source: Source;
  expect: Expected;
  name: string;
  decls?: string;
  latex: string;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const trueProbes: Probe[] = IDENTITIES.map((identity) => ({
  id: `true-${identity.id}`,
  source: 'cookbook',
  expect: 'ok',
  name: identity.name,
  decls: identity.decls,
  latex: identity.source,
}));

const falseProbes: Probe[] = FALSE_FRIENDS.map((friend) => ({
  id: `false-${slug(friend.name)}`,
  source: 'ledger',
  expect: 'wrong',
  name: friend.name,
  decls: friend.decls,
  latex: friend.src,
}));

export const PROBES: Probe[] = [...trueProbes, ...falseProbes];

/** the two bucket sizes, for the report header */
export const COUNTS = {
  true: trueProbes.length,
  false: falseProbes.length,
  total: PROBES.length,
};
