/**
 * The seed sweep.
 *
 * The engine's soundness rests on randomised sampling, so the one risk it
 * carries is a correct derivation flipping to a wrong verdict at some seed,
 * or a false friend slipping through at some seed. This runs the whole
 * corpus at thirty seeds and says so out loud.
 *
 * Too slow for every PR; run nightly, or by hand:
 *
 *   npx vite-node scripts/seed-sweep.ts            # 30 seeds
 *   SEED_COUNT=5 npx vite-node scripts/seed-sweep.ts
 */

import { check } from '../src/core/index.ts';
import { MENU } from '../corpus/menu.ts';
import { IDENTITIES } from '../corpus/cookbook/identities.ts';
import { FALSE_FRIENDS } from '../corpus/false-friends.ts';

const SEED_COUNT = Number(process.env.SEED_COUNT ?? '30');
const BASE_SEED = 0x5a305a;

let failures = 0;
const lines: string[] = [];

const note = (text: string): void => {
  failures += 1;
  lines.push(text);
};

// the Menu: every correct derivation must never come back wrong or a shape
// mismatch, whatever the seed
for (const item of MENU) {
  for (let seed = 1; seed <= SEED_COUNT; seed++) {
    const report = check(item.source, { decls: item.decls, seed: BASE_SEED + seed });
    for (const step of report.steps) {
      if (step.verdict === 'wrong' || step.verdict === 'shape') {
        note(`menu ${item.id} row ${step.row} flipped at seed ${seed}: ${step.verdict}`);
      }
    }
  }
}

// the Cookbook: same contract, on the machine-readable list
for (const identity of IDENTITIES) {
  for (let seed = 1; seed <= SEED_COUNT; seed++) {
    const report = check(identity.source, { decls: identity.decls, seed: BASE_SEED + seed });
    for (const step of report.steps) {
      if (step.verdict === 'wrong' || step.verdict === 'shape') {
        note(`cookbook ${identity.id} row ${step.row} flipped at seed ${seed}: ${step.verdict}`);
      }
    }
  }
}

// the false friends: none of them may ever be ratified, whatever the seed
for (const friend of FALSE_FRIENDS) {
  for (let seed = 1; seed <= SEED_COUNT; seed++) {
    const report = check(friend.src, { decls: friend.decls ?? '', seed: BASE_SEED + seed });
    for (const step of report.steps) {
      if (step.verdict === 'ok') {
        note(`false friend "${friend.name}" is ok at seed ${seed}`);
      }
    }
  }
}

if (failures) {
  console.error(`the sweep found ${failures} failure(s):`);
  for (const line of lines) console.error(`  ${line}`);
  process.exit(1);
}
console.log(
  `the sweep is clean: ${MENU.length} menu items, ${IDENTITIES.length} identities, ${FALSE_FRIENDS.length} false friends, at ${SEED_COUNT} seeds`,
);
