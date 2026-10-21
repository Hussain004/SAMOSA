#!/usr/bin/env node
/**
 * The Cookbook check.
 *
 * It runs the engine over the identities of the Cookbook and over the
 * mutants the mistake catalog makes of them, and prints the two numbers the
 * launch gates are measured with:
 *
 *   the false checkmarks: an identity that does not hold but is called
 *   the caught mutants: a mistake that is not caught
 *
 *   node scripts/check-corpus.mjs
 */

import { check, explain } from '../src/core/index.ts';
import { IDENTITIES } from '../corpus/cookbook/identities.ts';
import { allMutants } from '../corpus/cookbook/mutants.ts';

/** The verdicts that count as a catch. */
const CATCHES = ['wrong', 'shape'];

const falseCheckmarks = [];
const uncheckedIdentities = [];
const missedMutants = [];
const harmlessMutants = [];
let checked = 0;
let mutants = 0;

for (const identity of IDENTITIES) {
  const report = check(identity.source, { decls: identity.decls });
  checked++;
  for (const step of report.steps) {
    // a definition is not a claim, so it is not a checkmark
    if (step.relation === 'defined') continue;
    if (step.verdict === 'ok') continue;
    if (step.verdict === 'unchecked' || step.verdict === 'inconclusive') {
      uncheckedIdentities.push({ id: identity.id, row: step.row, message: step.message });
      continue;
    }
    falseCheckmarks.push({ id: identity.id, row: step.row, verdict: step.verdict, message: step.message });
  }
}

for (const mutant of allMutants(IDENTITIES)) {
  const identity = IDENTITIES.find((i) => i.id === mutant.id);
  if (!identity) continue;
  mutants++;
  const report = check(mutant.source, { decls: identity.decls });
  const step = report.steps.find((s) => s.row === mutant.row);
  if (!step) continue;
  if (CATCHES.includes(step.verdict)) continue;
  if (step.verdict === 'ok') {
    // the mistake happens to be harmless: the two sides are still equal, so
    // there is nothing to catch
    harmlessMutants.push({ id: identity.id, row: mutant.row, rule: mutant.rule });
    continue;
  }
  missedMutants.push({
    id: identity.id,
    row: mutant.row,
    rule: mutant.rule,
    verdict: step.verdict,
    message: step.message,
    text: mutant.text,
  });
}

const caught = mutants - missedMutants.length - harmlessMutants.length;
const rate = mutants ? (caught / mutants) * 100 : 0;

console.log(`the cookbook: ${IDENTITIES.length} identities, ${mutants} mutants`);
console.log(`  the false checkmarks: ${falseCheckmarks.length}`);
for (const item of falseCheckmarks) {
  console.log(`    ${item.id} row ${item.row}: ${item.verdict}, ${item.message}`);
}
console.log(`  the identities SAMOSA cannot check: ${uncheckedIdentities.length}`);
for (const item of uncheckedIdentities.slice(0, 10)) {
  console.log(`    ${item.id} row ${item.row}: ${item.message}`);
}
console.log(`  the caught mutants: ${caught} of ${mutants} (${rate.toFixed(1)}%)`);
console.log(`  the harmless mutants, where the mistake changes nothing: ${harmlessMutants.length}`);
for (const item of missedMutants.slice(0, 20)) {
  console.log(
    `    missed: ${item.id} row ${item.row} (${item.rule}) -> ${item.verdict}: ${item.message} | ${item.text.slice(0, 50)}`,
  );
}
if (missedMutants.length > 20) console.log(`    ... and ${missedMutants.length - 20} more`);

// the repairs: for every mutant, the fix should be in the top three
let withRepair = 0;
let total = 0;
for (const mutant of allMutants(IDENTITIES)) {
  const identity = IDENTITIES.find((i) => i.id === mutant.id);
  if (!identity) continue;
  const report = check(mutant.source, { decls: identity.decls });
  const step = report.steps.find((s) => s.row === mutant.row);
  if (!step || !CATCHES.includes(step.verdict)) continue;
  total++;
  const explanation = explain(mutant.source, step.id, { decls: identity.decls });
  if (explanation.fixes.length > 0) withRepair++;
}
console.log(`  the mutants with a fix on offer: ${withRepair} of ${total}`);

if (falseCheckmarks.length || missedMutants.length) {
  console.error('the cookbook found something');
  process.exit(1);
}
console.log('the cookbook is clean');
