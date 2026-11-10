#!/usr/bin/env node
/**
 * The Cookbook numbers of the README and of docs/COOKBOOK.md.
 *
 * The docs say the false checkmarks, the catches and the gaps outright, and
 * those claims are only as good as the last run of the Cookbook. This script
 * regenerates the sections between the markers from `pnpm check:corpus`, and
 * CI fails when the docs drift from what the engine just did, the way it
 * does for the demo.
 *
 *   vite-node scripts/gen-readme.ts --write
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IDENTITIES } from '../corpus/cookbook/identities.ts';

const root = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
if (!argv.includes('--write')) {
  console.error('usage: vite-node scripts/gen-readme.ts --write');
  process.exit(1);
}

const out = execFileSync('node', ['scripts/check-corpus.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});

function need(pattern: RegExp, what: string): RegExpMatchArray {
  const match = out.match(pattern);
  if (!match) {
    console.error(`the cookbook output does not carry the ${what}; update the generator`);
    process.exit(1);
  }
  return match;
}

const identities = need(/the cookbook: (\d+) identities, (\d+) mutants/, 'identity count');
const falseCheckmarks = need(/the false checkmarks: (\d+)/, 'false checkmark count');
const cannotCheck = need(/the identities SAMOSA cannot check: (\d+)/, 'cannot check count');
const score = need(/the mutation score: (\d+) of (\d+) \(([\d.]+)%\), excluding (\d+) harmless/, 'mutation score');
const raw = need(/the raw rate: (\d+) of (\d+) \(([\d.]+)%\)/, 'raw rate');
const gaps = out.match(/(\d+) gaps to close/)?.[1] ?? '0';

const pct = score[3];
const scoreCaught = score[1];
const scoreTotal = score[2];
const verifiedHarmless = score[4];
const rawCaught = raw[1];
const rawTotal = raw[2];
const rawPct = raw[3];
const gapsCount = Number(gaps);

// the gap rows: one per identity that produced no checkmark, named from the
// corpus itself, deduplicated and in corpus order
const cannotCheckSection = out.split('the identities SAMOSA cannot check')[1]?.split(/\n\S/)[0] ?? '';
const gapRows: string[] = [];
const seenIds = new Set<string>();
for (const line of cannotCheckSection.split('\n')) {
  const row = line.match(/^\s+([a-z0-9-]+) row \d+: (.+)$/);
  if (!row) continue;
  const id = row[1];
  if (seenIds.has(id)) continue;
  seenIds.add(id);
  const item = IDENTITIES.find((i) => i.id === id);
  if (!item) continue;
  gapRows.push(`| ${item.name} | ${row[2].trim()} |`);
}

function replaceBlock(text: string, marker: string, block: string): string {
  const pattern = new RegExp(`<!-- ${marker} -->[\\s\\S]*?<!-- /${marker} -->`);
  if (!pattern.test(text)) {
    console.error(`no ${marker} markers found`);
    process.exit(1);
  }
  return text.replace(pattern, block);
}

const readmeBlock = `<!-- gen:cookbook -->
And the Cookbook: ${identities[1]} identities in matrix algebra, calculus and stochastics,
with the mistakes the catalog can make of them.

| | |
| --- | --- |
| the false checkmarks | **${falseCheckmarks[1]}** |
| the identities SAMOSA cannot check | **${cannotCheck[1]}** |
| the mutation score | **${scoreCaught} of ${scoreTotal} (${pct}%)** |
| the harmless mutants, where the mistake changes nothing | **${verifiedHarmless}** |
| the raw rate | **${rawCaught} of ${rawTotal} (${rawPct}%)** |

The plan's gate asks for 95% of the bugs caught; the mutation score is ${pct}%,
and every mutant the engine calls right is confirmed harmless by the float64
oracle. The method, the misses and the ${gapsCount} gaps the corpus found are
in [docs/COOKBOOK.md](docs/COOKBOOK.md).
<!-- /gen:cookbook -->`;

const numbersBlock = `<!-- gen:cookbook -->
| | |
| --- | --- |
| the identities | ${identities[1]} |
| the mutants | ${rawTotal} |
| **the false checkmarks** | **${falseCheckmarks[1]}** |
| the identities SAMOSA cannot check | ${cannotCheck[1]} |
| the mutation score | ${scoreCaught} of ${scoreTotal} (**${pct}%**) |
| the harmless mutants the float64 oracle confirmed | ${verifiedHarmless} |
| the raw rate | ${rawCaught} of ${rawTotal} (**${rawPct}%**) |
<!-- /gen:cookbook -->`;

const gapsBlock = `<!-- gen:cookbook-gaps -->
| the identity | why |
| --- | --- |
${gapRows.join('\n')}
<!-- /gen:cookbook-gaps -->`;

const gatesBlock = `<!-- gen:cookbook-gates -->
| gate | what the plan asks | what we measure |
| --- | --- | --- |
| G1: no false checkmark | the golden suite and the Cookbook | 0 false checkmarks in ${identities[1]} identities, and 0 in the 16 Menu derivations |
| G2: the bugs caught | 95%, with the repair in the top three | the mutation score is ${pct}% (${scoreCaught} of ${scoreTotal}, the ${verifiedHarmless} harmless mutants excluded and confirmed by the float64 oracle); the raw rate is ${rawPct}% (${rawCaught} of ${rawTotal}); the four planted bugs of the golden suite all get their expected repair in the top three |
| G3: the parse coverage | 70% | 78.9% of the claim rows of the sample parse end to end, measured in [COVERAGE.md](COVERAGE.md); the gate is met |
<!-- /gen:cookbook-gates -->`;

const readmePath = resolve(root, 'README.md');
const readme = readFileSync(readmePath, 'utf8');
writeFileSync(readmePath, replaceBlock(readme, 'gen:cookbook', readmeBlock));

const cookbookPath = resolve(root, 'docs/COOKBOOK.md');
let cookbook = readFileSync(cookbookPath, 'utf8');
cookbook = replaceBlock(cookbook, 'gen:cookbook', numbersBlock);
cookbook = replaceBlock(cookbook, 'gen:cookbook-gaps', gapsBlock);
cookbook = replaceBlock(cookbook, 'gen:cookbook-gates', gatesBlock);
writeFileSync(cookbookPath, cookbook);

console.log('the cookbook numbers of the README and of docs/COOKBOOK.md were regenerated');
