/**
 * SAMOSA-Bench: scoring model answers (the v1 arm).
 *
 * This is the tool the LLM arm will use. It scores a submission file against
 * the probe list: one JSONL line per model answer, produced by prompting a
 * model with the probe and asking for exactly one token.
 *
 *   {"id": "true-woodbury", "output": "ok"}
 *   {"id": "false-determinant-of-sum", "output": "wrong"}
 *
 * The answer is read case-insensitively; the first occurrence of the word
 * `ok` or `wrong` wins. Everything else is an abstention and is reported as
 * one, never silently scored as either class.
 *
 * Precision and recall are reported per class against the probe's ground
 * truth, and side by side with SAMOSA's own verdict on the same probes, so
 * the table can never overstate what either judge does.
 *
 *   pnpm bench:score -- path/to/answers.jsonl [--model "name"]
 *
 * No model outputs exist in this repository yet. The harness is here;
 * the arm needs API keys and a human label pass, and inventing either
 * would be fabrication. See bench/README.md.
 */

import { readFileSync } from 'node:fs';
import { check } from '../src/core/index.ts';
import { PROBES } from './probes.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const modelFlag = args.indexOf('--model');
const model = modelFlag >= 0 ? args[modelFlag + 1] : 'unnamed-model';
if (!file) {
  console.error('usage: pnpm bench:score -- answers.jsonl [--model "name"]');
  process.exit(1);
}

const probeById = new Map(PROBES.map((p) => [p.id, p]));

interface Submission { id: string; output: string }
const submissions: Submission[] = readFileSync(file, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Submission);

const seen = new Set<string>();
let tp = 0, fp = 0, fn = 0, tn = 0, abstained = 0, unknown = 0;
const samosaRight = new Set<string>();

for (const sub of submissions) {
  const probe = probeById.get(sub.id);
  if (!probe) {
    unknown++;
    continue;
  }
  seen.add(sub.id);
  const text = sub.output.toLowerCase();
  const okAt = text.search(/\bok\b/);
  const wrongAt = text.search(/\bwrong\b/);
  let call: 'ok' | 'wrong' | null = null;
  if (okAt >= 0 && (wrongAt < 0 || okAt < wrongAt)) call = 'ok';
  else if (wrongAt >= 0) call = 'wrong';

  // SAMOSA's own verdict on the same probe, for the side-by-side
  const report = check(probe.latex, { decls: probe.decls });
  const claim = report.steps.filter((s) => s.relation !== 'defined');
  const samosaCaught = claim.some((s) => s.verdict === 'wrong' || s.verdict === 'shape');
  const samosaOk = claim.length > 0 && claim.every((s) => s.verdict === 'ok');
  if ((probe.expect === 'ok' && samosaOk) || (probe.expect === 'wrong' && samosaCaught)) samosaRight.add(probe.id);

  if (call === null) {
    abstained++;
    continue;
  }
  const saidWrong = call === 'wrong';
  const actuallyWrong = probe.expect === 'wrong';
  if (saidWrong && actuallyWrong) tp++;
  else if (saidWrong && !actuallyWrong) fp++;
  else if (!saidWrong && actuallyWrong) fn++;
  else tn++;
}

const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
const accuracy = tp + tn + fp + fn > 0 ? (tp + tn) / (tp + tn + fp + fn) : 0;
const missing = PROBES.filter((p) => !seen.has(p.id)).length;

console.log(`# SAMOSA-Bench — ${model}\n`);
console.log(`probes: ${PROBES.length} · answered: ${submissions.length - unknown - abstained} · abstained: ${abstained} · unknown ids: ${unknown} · missing: ${missing}\n`);
console.log(`| | model | SAMOSA |`);
console.log(`|---|---|---|`);
console.log(`| precision (catching wrong claims) | ${precision.toFixed(3)} | — |`);
console.log(`| recall (caught of the false) | ${recall.toFixed(3)} | — |`);
console.log(`| accuracy | ${accuracy.toFixed(3)} | ${(samosaRight.size / PROBES.length).toFixed(3)} |`);
console.log(`\nconfusion: tp ${tp} · fp ${fp} · fn ${fn} · tn ${tn} · abstained ${abstained}\n`);
console.log('SAMOSA abstains rather than guesses on the rows it cannot decide; that is by design, and it is counted here as abstention, never as correctness.');
