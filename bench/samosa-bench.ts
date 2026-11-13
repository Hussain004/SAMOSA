/**
 * SAMOSA-Bench: the baseline, measured.
 *
 * Runs the engine over every probe and prints the auditor's report card:
 *
 *   verified    a Cookbook identity the engine calls ok (or a false friend
 *               it calls anything other than ok, but never ok)
 *   caught      a false friend the engine calls wrong or a shape error
 *   abstained   anything the engine cannot decide today, which is honest
 *
 * Two gates, the same two the launch gates enforce:
 *
 *   the Cookbook may not come back wrong        (a false ✓ in reverse)
 *   a false friend may never come back ok       (the ledger's promise)
 *
 * A gate failure exits 1. Abstentions do not fail the run; they are
 * printed, because a silent skip is a hole.
 *
 *   pnpm bench:samosa
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { check } from '../src/core/index.ts';
import { PROBES, COUNTS } from './probes.ts';

interface ProbeResult {
  id: string;
  source: 'cookbook' | 'ledger';
  expect: 'ok' | 'wrong';
  name: string;
  outcome: 'verified' | 'caught' | 'abstained' | 'gate-failure';
  verdicts: string[];
}

const results: ProbeResult[] = [];
const CAUGHT = new Set(['wrong', 'shape']);

for (const probe of PROBES) {
  const report = check(probe.latex, { decls: probe.decls });
  const claim = report.steps.filter((step) => step.relation !== 'defined');
  const verdicts = claim.map((step) => step.verdict);

  const anyCaught = verdicts.some((v) => CAUGHT.has(v));
  const allOk = verdicts.length > 0 && verdicts.every((v) => v === 'ok');
  const anyOk = verdicts.some((v) => v === 'ok');

  let outcome: ProbeResult['outcome'];
  if (probe.expect === 'wrong') {
    // the ledger's promise: never a checkmark; caught is better
    outcome = anyOk ? 'gate-failure' : anyCaught ? 'caught' : 'abstained';
  } else {
    outcome = anyCaught ? 'gate-failure' : allOk ? 'verified' : 'abstained';
  }
  results.push({ id: probe.id, source: probe.source, expect: probe.expect, name: probe.name, outcome, verdicts });
}

const summarize = (items: ProbeResult[]) => ({
  verified: items.filter((r) => r.outcome === 'verified').length,
  caught: items.filter((r) => r.outcome === 'caught').length,
  abstained: items.filter((r) => r.outcome === 'abstained').length,
  gateFailures: items.filter((r) => r.outcome === 'gate-failure').map((r) => r.id),
});

const trues = results.filter((r) => r.expect === 'ok');
const falses = results.filter((r) => r.expect === 'wrong');
const summary = {
  probes: COUNTS,
  cookbook: summarize(trues),
  ledger: summarize(falses),
};

for (const r of results) {
  const mark = { verified: '✓', caught: '✓', abstained: '?', 'gate-failure': '✗' }[r.outcome];
  console.log(`${mark} ${r.outcome === 'gate-failure' ? 'GATE-FAILURE ' : ''}${r.id.padEnd(48)} ${r.outcome}`);
}
console.log('');
console.log(`cookbook: ${summary.cookbook.verified}/${trues.length} verified, ${summary.cookbook.abstained} abstained${summary.cookbook.gateFailures.length ? `, GATE FAILURES: ${summary.cookbook.gateFailures.join(', ')}` : ''}`);
console.log(`ledger:   ${summary.ledger.caught}/${falses.length} caught, ${summary.ledger.abstained} abstained${summary.ledger.gateFailures.length ? `, GATE FAILURES: ${summary.ledger.gateFailures.join(', ')}` : ''}`);

const root = resolve(import.meta.dirname, '..');
writeFileSync(
  resolve(root, 'bench/report.json'),
  JSON.stringify({ ...summary, results }, null, 2) + '\n',
);

const gateFailures = [...summary.cookbook.gateFailures, ...summary.ledger.gateFailures];
if (gateFailures.length > 0) {
  console.error(`\nSAMOSA-Bench failed its gates: ${gateFailures.join(', ')}`);
  process.exit(1);
}
console.log('\nSAMOSA-Bench: both gates held.');
