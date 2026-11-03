#!/usr/bin/env node
/**
 * The Cookbook numbers of the README.
 *
 * The README says the false checkmarks, the catches and the gaps outright,
 * and those claims are only as good as the last run of the Cookbook. This
 * script regenerates the section between the markers from
 * `pnpm check:corpus`, and CI fails when the README drifts from what the
 * engine just did, the way it does for the demo.
 *
 *   vite-node scripts/gen-readme.ts --write
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const caught = need(/the caught mutants: (\d+) of (\d+) \(([\d.]+)%\)/, 'caught count');
const harmless = need(/the harmless mutants, where the mistake changes nothing: (\d+)/, 'harmless count');
const gaps = out.match(/(\d+) gaps to close/)?.[1] ?? '0';

const block = `<!-- gen:cookbook -->
And the Cookbook: ${identities[1]} identities in matrix algebra, calculus and stochastics,
with the mistakes the catalog can make of them.

| | |
| --- | --- |
| the false checkmarks | **${falseCheckmarks[1]}** |
| the identities SAMOSA cannot check | **${cannotCheck[1]}** |
| the caught mutants | **${caught[1]} of ${caught[2]} (${caught[3]}%)** |
| the harmless mutants, where the mistake changes nothing | **${harmless[1]}** |

The plan's gate asks for 95% of the bugs caught. The cookbook is at ${caught[3]}%,
and every miss is a step the engine says it cannot decide, never one it
calls right. The method, the misses and the ${gaps} gaps the corpus found are
in [docs/COOKBOOK.md](docs/COOKBOOK.md).
<!-- /gen:cookbook -->`;

const path = resolve(root, 'README.md');
const readme = readFileSync(path, 'utf8');
const pattern = /<!-- gen:cookbook -->[\s\S]*?<!-- \/gen:cookbook -->/;
if (!pattern.test(readme)) {
  console.error('README.md has no gen:cookbook markers; add them once by hand');
  process.exit(1);
}
writeFileSync(path, readme.replace(pattern, block));
console.log('the cookbook numbers of the README were regenerated');
