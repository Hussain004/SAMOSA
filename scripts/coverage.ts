/**
 * The parse coverage over real papers (gate G3).
 *
 * The plan says to measure the coverage of the display math of a sample of
 * arXiv source bundles, to bucket the failures by the first unknown
 * construct, and to publish the number honestly.
 *
 * The sample is fetched politely, one paper at a time, and it is kept out
 * of the repository.
 *
 *   node_modules/.bin/vite-node scripts/coverage.ts [papers] [categories]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Parser } from '../src/core/parse.ts';
import { tokenize } from '../src/core/lex.ts';
import type { Node } from '../src/core/ir.ts';

const root = resolve(import.meta.dirname, '..');
const cache = resolve(root, '.coverage');

const PAPER_COUNT = Number(process.argv[2] ?? 40);
const CATEGORIES = (process.argv[3] ?? 'cs.LG,cs.RO,stat.ML').split(',');

/** A row that starts with a relation continues the row before it. */
const CONTINUATION = /^\s*(=|:=|\\le|\\ge|<|>|\\approx|\\Rightarrow|\\iff|\\propto)/;

interface Row {
  file: string;
  text: string;
}

async function main(): Promise<void> {
  mkdirSync(cache, { recursive: true });
  console.log(`the sample is ${PAPER_COUNT} papers from ${CATEGORIES.join(', ')}`);

  const ids: string[] = [];
  for (const category of CATEGORIES) {
    const url = `http://export.arxiv.org/api/query?search_query=cat:${category}&max_results=${Math.ceil(
      PAPER_COUNT / CATEGORIES.length,
    )}&sortBy=submittedDate&sortOrder=descending`;
    const xml = await fetchText(url);
    for (const match of xml.matchAll(/<id>http:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/g)) {
      ids.push(match[1]);
    }
    await sleep(3000);
  }

  console.log(`${ids.length} papers to fetch`);

  const rows: Row[] = [];
  let fetched = 0;
  for (const id of ids.slice(0, PAPER_COUNT)) {
    const dir = resolve(cache, id.replace(/[^a-zA-Z0-9.-]/g, '_'));
    const tarball = resolve(dir, 'source.tar.gz');
    if (!existsSync(tarball)) {
      mkdirSync(dir, { recursive: true });
      const ok = await download(`https://arxiv.org/e-print/${id}`, tarball);
      if (!ok) {
        console.log(`  ${id}: could not be fetched`);
        continue;
      }
      // be polite
      await sleep(2500);
    }
    try {
      execFileSync('tar', ['-xf', tarball, '-C', dir], { stdio: 'ignore' });
    } catch {
      console.log(`  ${id}: the archive could not be opened`);
      continue;
    }
    fetched++;
    for (const file of findTexFiles(dir)) {
      const text = readFileSync(file, 'utf8');
      for (const row of extractRows(stripComments(text))) {
        // a row that starts with a relation continues the row before it
        if (CONTINUATION.test(row)) continue;
        rows.push({ file: file.slice(dir.length + 1), text: row });
      }
    }
  }

  console.log(`${fetched} papers, ${rows.length} display math rows`);

  // and now the measurement
  let parsed = 0;
  let readable = 0;
  const failures = new Map<string, number>();
  const examples = new Map<string, string>();

  for (const row of rows) {
    const outcome = parseRow(row.text);
    if (outcome.readable) readable++;
    if (outcome.ok) {
      parsed++;
      continue;
    }
    const key = outcome.reason;
    failures.set(key, (failures.get(key) ?? 0) + 1);
    if (!examples.has(key)) examples.set(key, `${row.file}: ${row.text.slice(0, 160)}`);
  }

  const percent = rows.length ? (parsed / rows.length) * 100 : 0;
  const lenient = rows.length ? (readable / rows.length) * 100 : 0;
  console.log('');
  console.log(`the display math rows that SAMOSA reads with no unknown construct: ${parsed} of ${rows.length} (${percent.toFixed(1)}%)`);
  console.log(`the display math rows that SAMOSA can parse at all: ${readable} of ${rows.length} (${lenient.toFixed(1)}%)`);
  console.log('');
  console.log('the failures, by the first unknown construct:');
  const sorted = [...failures.entries()].sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sorted.slice(0, 15)) {
    console.log(`  ${String(count).padStart(5)}  ${reason}`);
    console.log(`         ${examples.get(reason)}`);
  }

  writeFileSync(
    resolve(cache, 'coverage.json'),
    JSON.stringify(
      {
        papers: fetched,
        ids: ids.slice(0, PAPER_COUNT),
        rows: rows.length,
        parsed,
        percent: Number(percent.toFixed(1)),
        readable,
        lenient: Number(lenient.toFixed(1)),
        failures: Object.fromEntries(failures),
        when: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log('');
  console.log(`the report is in ${resolve(cache, 'coverage.json')}`);
}

/** Parses one row and says what stopped it. */
function parseRow(text: string): { ok: boolean; readable: boolean; reason: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, readable: false, reason: 'an empty row' };
  try {
    const parser = new Parser(tokenize(trimmed), trimmed, {});
    const node = parser.parseExpression();
    const raw = firstRaw(node);
    if (raw) return { ok: false, readable: true, reason: `the unknown construct ${raw}` };
    return { ok: true, readable: true, reason: '' };
  } catch (error) {
    return { ok: false, readable: false, reason: `a parse error: ${(error as Error).message}` };
  }
}

/** Removes the LaTeX comments, so the commented out rows are not counted. */
function stripComments(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      let out = '';
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '%' && line[i - 1] !== '\\') break;
        out += line[i];
      }
      return out;
    })
    .join('\n');
}

/** The first unknown construct in a tree. */
function firstRaw(node: Node): string | null {
  switch (node.k) {
    case 'raw':
      return node.text;
    case 'op':
    case 'call':
      for (const arg of node.args) {
        const found = firstRaw(arg);
        if (found) return found;
      }
      return null;
    case 'deriv':
      return firstRaw(node.f);
    case 'expect':
      for (const arg of node.args) {
        const found = firstRaw(arg);
        if (found) return found;
      }
      return null;
    case 'bigop':
      return firstRaw(node.body);
    case 'block':
      for (const row of node.rows) {
        for (const cell of row) {
          const found = firstRaw(cell);
          if (found) return found;
        }
      }
      return null;
    default:
      return null;
  }
}

/** The display math rows of a LaTeX file. */
export function extractRows(text: string): string[] {
  const rows: string[] = [];
  const pattern = /\\begin\{(align\*?|aligned|alignat\*?|gather\*?|gathered|split|equation\*?|multline\*?|eqnarray\*?|displaymath)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const name = match[1];
    const end = text.indexOf(`\\end{${name}}`, match.index);
    if (end < 0) continue;
    const content = text.slice(match.index + match[0].length, end);
    for (const row of splitRows(content)) {
      const cleaned = row
        .replace(/&/g, ' ')
        .replace(/\\label\{[^}]*\}/g, '')
        .replace(/\\nonumber|\\notag/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned) rows.push(cleaned);
    }
  }
  return rows;
}

function splitRows(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('\\begin{', i)) {
      depth++;
      current += text.slice(i, i + 7);
      i += 7;
      continue;
    }
    if (text.startsWith('\\end{', i)) {
      depth--;
      current += text.slice(i, i + 5);
      i += 5;
      continue;
    }
    if (text.startsWith('\\\\', i) && depth === 0) {
      out.push(current);
      current = '';
      i += 2;
      continue;
    }
    current += text[i];
    i++;
  }
  if (current.trim()) out.push(current);
  return out;
}

function findTexFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...findTexFiles(full));
    else if (name.endsWith('.tex') && !name.endsWith('.bbl')) out.push(full);
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': 'samosa-coverage/1.0 (a measurement script)' } });
  return response.text();
}

async function download(url: string, to: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'samosa-coverage/1.0 (a measurement script)' } });
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(to, buffer);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();

export { rmSync };
