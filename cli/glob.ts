import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The glob patterns of the command line.
 *
 * A GitHub Action passes the pattern to the command as it is, and the shell
 * inside an action does not expand `**`, so the command does it itself. The
 * patterns are the ones people write: `*`, `**`, `?` and `{a,b}`.
 *
 * A name that is not a pattern is returned as it is, so a plain file name
 * works the way it always did.
 */

const PATTERN = /[*?{]/;

export function isGlob(pattern: string): boolean {
  return PATTERN.test(pattern);
}

/** The files a pattern matches, in a stable order. */
export function expandGlob(pattern: string, cwd = process.cwd()): string[] {
  if (!isGlob(pattern)) {
    // a plain name is kept, so the caller can report a missing file
    return [pattern];
  }
  const root = resolve(cwd);
  const absolute = resolve(root, pattern);
  // the part of the pattern before the first wildcard is the folder to walk
  const first = pattern.split('*')[0].split('?')[0].split('{')[0];
  const base = resolve(root, first.endsWith('/') ? first : first.slice(0, Math.max(0, first.lastIndexOf('/') + 1)));
  const relative = (absolute.startsWith(base) ? absolute.slice(base.length) : pattern).replace(/^\/+/, '');
  // the names are given back the way the caller wrote them, so they can be
  // opened from where the command was run
  const baseRelative = base === root ? '' : base.slice(root.length + 1);
  const out: string[] = [];
  walk(base, '', relative, out, 0, baseRelative);
  out.sort();
  return out;
}

/** Walks a folder, collecting the names that match the pattern. */
function walk(
  base: string,
  prefix: string,
  pattern: string,
  out: string[],
  depth: number,
  baseRelative: string,
): void {
  if (depth > 12) return;
  let entries: string[];
  try {
    entries = readdirSync(join(base, prefix));
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    if (entry.startsWith('.') && entry !== '.') continue;
    const relative = prefix ? `${prefix}/${entry}` : entry;
    let isDirectory: boolean;
    try {
      isDirectory = statSync(join(base, relative)).isDirectory();
    } catch {
      continue;
    }
    if (isDirectory) {
      // a folder only matches if the pattern says so
      if (patternMatches(relative, pattern) || patternHasDoubleStar(pattern)) {
        walk(base, relative, pattern, out, depth + 1, baseRelative);
      }
      continue;
    }
    if (patternMatches(relative, pattern)) {
      out.push(baseRelative ? join(baseRelative, relative) : relative);
    }
  }
}

/** Does the pattern have a `**`, which reaches into the folders? */
function patternHasDoubleStar(pattern: string): boolean {
  return pattern.includes('**');
}

/**
 * Matches a name against a glob pattern.
 *
 * The pattern is turned into a regular expression: `*` is anything but a
 * slash, `**` is anything, `?` is one character and `{a,b}` is a choice.
 */
export function patternMatches(name: string, pattern: string): boolean {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*';
        i++;
        if (pattern[i + 1] === '/') i++;
      } else {
        source += '[^/]*';
      }
      continue;
    }
    if (ch === '?') {
      source += '[^/]';
      continue;
    }
    if (ch === '{') {
      const end = pattern.indexOf('}', i);
      if (end < 0) {
        source += '\\{';
        continue;
      }
      const choices = pattern.slice(i + 1, end).split(',');
      source += `(?:${choices.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
      i = end;
      continue;
    }
    source += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`).test(name);
}
