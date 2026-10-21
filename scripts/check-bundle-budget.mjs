import { readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The bundle budget.
 *
 * The plan sets a limit of 250 KB gzip for the initial JavaScript, and a
 * much smaller one for the landing page, which should load in an instant.
 */

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

const BUDGETS = {
  landing: 120 * 1024,
  app: 250 * 1024,
};

function gzipSize(file) {
  return gzipSync(readFileSync(file), { level: 9 }).length;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let failed = false;

const files = walk(dist);
const scripts = files.filter((f) => f.endsWith('.js'));
const total = scripts.reduce((sum, f) => sum + gzipSize(f), 0);

const html = files.filter((f) => f.endsWith('.html'));
for (const file of html) {
  const text = readFileSync(file, 'utf8');
  const isLanding = file.endsWith(resolve(dist, 'index.html'));
  const limit = isLanding ? BUDGETS.landing : BUDGETS.app;
  // the scripts the page loads first
  const loaded = [...text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  const size = loaded.reduce((sum, src) => {
    const full = resolve(dist, src.replace(/^\//, ''));
    return sum + (full.endsWith('.js') ? gzipSize(full) : 0);
  }, 0);
  const name = file.slice(dist.length + 1);
  const ok = size <= limit;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'ok  ' : 'over'} ${name.padEnd(12)} ${(size / 1024).toFixed(1)} KB gzip of ${(limit / 1024).toFixed(0)} KB`,
  );
}

console.log(`     the whole build is ${(total / 1024).toFixed(1)} KB gzip`);

if (failed) {
  console.error('the bundle is over the budget');
  process.exit(1);
}
