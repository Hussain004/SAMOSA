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

import { check, explain, analyzeSource, numericDelta, inferType } from '../src/core/index.ts';
import { F64Field } from '../src/core/fields/f64.ts';
import { rngFor } from '../src/core/prng.ts';
import { IDENTITIES } from '../corpus/cookbook/identities.ts';
import { allMutants } from '../corpus/cookbook/mutants.ts';

/** The verdicts that count as a catch. */
const CATCHES = ['wrong', 'shape'];

/**
 * The identities that carry no claim row, and why. A silent identity is a
 * hole in the suite, so adding one here has to be a decision that shows up
 * in review; anything not listed fails the check.
 */
const SILENT_ALLOWED = new Map([
  // the discrete algebraic Riccati equation is a fixed point written as a
  // definition; the claim you would write re-expands the definition forever,
  // so this engine cannot evaluate it yet
  ['riccati', 'the fixed point re-expands the definition forever'],
]);

const falseCheckmarks = [];
const uncheckedIdentities = [];
const missedMutants = [];
const harmlessMutants = [];
let checked = 0;
let mutants = 0;

for (const identity of IDENTITIES) {
  const report = check(identity.source, { decls: identity.decls });
  checked++;
  // an identity with no claim row is not an identity at all: it is a
  // definition with no checking in it, and it would silently pass and
  // silently ship (this is how kl-of-gaussians rotted)
  const claimRows = report.steps.filter((s) => s.relation !== 'defined');
  if (claimRows.length === 0 && !SILENT_ALLOWED.has(identity.id)) {
    console.error(`the identity ${identity.id} has no claim row; nothing is checked in it`);
    process.exit(1);
  }
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
    harmlessMutants.push({ id: identity.id, row: mutant.row, rule: mutant.rule, source: mutant.source, text: mutant.text });
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

// the harmless mutants are audited with the float64 oracle, here in the
// check itself: a mutant the engine calls right is harmless only when an
// independent kit agrees, and a mutant the oracle cannot decide counts as
// missed, never as harmless
const verifiedHarmlessMutants = [];
const unverifiableMutants = [];
for (const mutant of harmlessMutants) {
  const identity = IDENTITIES.find((i) => i.id === mutant.id);
  const parsed = analyzeSource(mutant.source, { decls: identity.decls });
  // type inference registers the symbols in the context; the numeric
  // evaluation cannot see them before it runs
  for (const step of parsed.steps) {
    if (step.lhs) inferType(parsed.ctx, step.lhs);
    if (step.rhs) inferType(parsed.ctx, step.rhs);
  }
  const step = parsed.steps.find((s) => s.row === mutant.row);
  if (!step) continue;
  const run = numericDelta(
    parsed.ctx,
    parsed.defs,
    step,
    new Map([['n', 3]]),
    rngFor(0, 'cookbook-oracle', mutant.id),
    0,
    new F64Field(),
  );
  if (run === null || run === 'domain') {
    unverifiableMutants.push(mutant);
    missedMutants.push({ ...mutant, verdict: 'ok', message: 'the oracle could not decide; counted as missed' });
    continue;
  }
  if (run.shapeMessage !== undefined) {
    // the oracle says the shapes do not agree either way, which the engine
    // should have called a shape catch
    missedMutants.push({ ...mutant, verdict: 'ok', message: `the oracle saw the shape: ${run.shapeMessage}` });
    continue;
  }
  if (run.delta <= 1e-9) {
    verifiedHarmlessMutants.push(mutant);
    continue;
  }
  console.error(`the false checkmark: ${mutant.id} row ${mutant.row} (${mutant.rule}) had the wrong green light`);
  process.exit(1);
}

const caught = mutants - missedMutants.length - verifiedHarmlessMutants.length;
// the mutation score, the way the literature computes it: equivalent
// mutants (checked harmless) leave the denominator
const score = mutants - verifiedHarmlessMutants.length > 0 ? (caught / (mutants - verifiedHarmlessMutants.length)) * 100 : 100;
// and the raw rate, the harsh one, kept in the open
const rawRate = mutants ? (caught / mutants) * 100 : 100;

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

console.log(`the cookbook: ${IDENTITIES.length} identities, ${mutants} mutants`);
console.log(`  the false checkmarks: ${falseCheckmarks.length}`);
for (const item of falseCheckmarks) {
  console.log(`    ${item.id} row ${item.row}: ${item.verdict}, ${item.message}`);
}
console.log(`  the identities SAMOSA cannot check: ${uncheckedIdentities.length}`);
for (const item of uncheckedIdentities.slice(0, 10)) {
  console.log(`    ${item.id} row ${item.row}: ${item.message}`);
}
console.log(`  the mutation score: ${caught} of ${mutants - verifiedHarmlessMutants.length} (${score.toFixed(1)}%), excluding ${verifiedHarmlessMutants.length} harmless mutants the oracle confirmed`);
console.log(`  the raw rate: ${caught} of ${mutants} (${rawRate.toFixed(1)}%)`);
console.log(`  the mutants the oracle could not decide: ${unverifiableMutants.length}, counted as missed`);
console.log(`  the mutants with a fix on offer: ${withRepair} of ${total}`);
for (const item of missedMutants) {
  console.log(
    `    missed: ${item.id} row ${item.row} (${item.rule}) -> ${item.verdict}: ${item.message} | ${(item.text ?? '').slice(0, 60)}`,
  );
}

if (falseCheckmarks.length) {
  // a false checkmark is the one thing the corpus cannot forgive
  console.error('the cookbook found a false checkmark');
  process.exit(1);
}
if (missedMutants.length) {
  // the misses are a gap, not a lie, so they are named and not a failure
  console.log(`the cookbook is clean, with ${missedMutants.length} gaps to close`);
} else {
  console.log('the cookbook is clean');
}
