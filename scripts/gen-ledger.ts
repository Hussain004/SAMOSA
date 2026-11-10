/**
 * The ledger: the plausible-but-false identities SAMOSA never ratifies,
 * and the dated list of every false checkmark the changelog records.
 *
 * The false friends come from corpus/false-friends.ts, the same list the
 * structures test holds the engine to. The dated list is taken from
 * CHANGELOG.md with verbatim quotes, and the quotes are checked against
 * the changelog here: a change to the changelog that touches one of them
 * fails this script instead of quietly drifting.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FALSE_FRIENDS } from '../corpus/false-friends.ts';

const root = resolve(import.meta.dirname, '..');
const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');

/** The dated false-checkmark fixes the changelog records, verbatim. */
const DATED: Array<{ date: string; version: string; title: string; quote: string }> = [
  {
    date: '2026-11-03',
    version: '1.1.0',
    title: 'the checkmarks the checker had not earned',
    quote:
      'The checkmarks the checker had not earned: the orth components are declared, `abs` is out of exact mode, the degree rules bound det, tr, derivatives and blocks, and the structured samplers (spd, orth, stoch, unit, tril, triu) draw from the structure they claim.',
  },
  {
    date: '2026-11-03',
    version: '1.1.0',
    title: 'a non-square identity behind det and tr',
    quote:
      'The identity is square in the type system, in the sampler and in the printer, so det and tr no longer meet a non-square one.',
  },
  {
    date: '2026-11-03',
    version: '1.1.0',
    title: 'a shape assignment where the sizes happened to agree',
    quote:
      'A shape error carries the sizes that do not fit, never an assignment where the shapes happen to agree.',
  },
];

const flatChangelog = changelog.replace(/\s+/g, ' ');
for (const entry of DATED) {
  if (!flatChangelog.includes(entry.quote)) {
    console.error(`the changelog no longer carries this entry: ${entry.title}`);
    console.error(`looking for: ${entry.quote}`);
    process.exit(1);
  }
}

const ledger = {
  generated:
    'the false friends from corpus/false-friends.ts, and the dated list of false checkmarks from CHANGELOG.md',
  note: 'none of these may ever come back ok; the structures test holds the engine to the list',
  friends: FALSE_FRIENDS.map(({ name, src, decls, handle }) => ({ name, src, decls, handle })),
  dated: DATED,
};

writeFileSync(resolve(root, 'src/landing/ledger.json'), JSON.stringify(ledger, null, 2) + '\n');

const bullet = (name: string, src: string, handle?: string) =>
  `| ${name}${handle ? ` — @${handle}` : ''} | \`${src.replace(/\|/g, '\\|')}\` |`;
const friendsList = ledger.friends.map(({ name, src, handle }) => bullet(name, src, handle)).join('\n');
const datedList = ledger.dated
  .map(
    (entry) => `### ${entry.date} — ${entry.version}\n\n**${entry.title}.**\n\n> ${entry.quote}\n`,
  )
  .join('\n');

const md = `# The ledger

The plausible-but-false identities, and the checkmarks SAMOSA had not earned.

## The ${ledger.friends.length} friends nobody wants

These are the mistakes people actually write. None of them may ever come
back ok: the structures test holds the engine to this list on every commit,
and a new false checkmark fails CI. Where the surface syntax of an operator
is missing, the step is unchecked, which is honest, never a checkmark.

| | |
| --- | --- |
${friendsList}

## The dated list of false checkmarks found and fixed

Taken from the changelog, verbatim. The generator fails on drift, so this
list cannot silently grow stale.

${datedList}

## The method

A verdict is computed by evaluating both sides of a step on sampled
instances, over a finite field or at 50 digits, and never by a language
model. A checkmark carries the sizes that were tested, the number of
trials, the primes, the degree bound and the assumptions, and a wrong step
is caught by the same machinery: the engine found the counterexample above.
The [how it works](/docs/HOW_IT_WORKS) page says what the engine does; the
[Cookbook](/docs/COOKBOOK) shows the numbers measured on the corpus it
inherits from.
`;

writeFileSync(resolve(root, 'docs/LEDGER.md'), md);
console.log(`the ledger was written: ${ledger.friends.length} false friends, ${ledger.dated.length} dated fixes`);
