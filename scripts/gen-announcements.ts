/**
 * The announcements of the landing page.
 *
 * They are read from the changelog, so a release the world was told about is
 * a release the page says about, and the numbers a release fixed are the
 * numbers the page shows.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'src/landing/generated-announcements.json');

export interface Announcement {
  /** the day the release went out */
  date: string;
  /** the release, as the changelog calls it */
  version: string;
  /** what the release said, in one line */
  body: string;
}

/**
 * The releases of the changelog, in the order they shipped, each with the
 * line that introduces it.
 */
export function announcementsOf(changelog: string): Announcement[] {
  const releases = [...changelog.matchAll(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/gm)];
  const out: Announcement[] = [];
  for (let i = 0; i < releases.length; i++) {
    const version = releases[i][1];
    const date = releases[i][2];
    const start = releases[i].index ?? 0;
    const end = i + 1 < releases.length ? (releases[i + 1].index ?? changelog.length) : changelog.length;
    const after = changelog.slice(start, end).split('\n').slice(1).join('\n');
    const summary = after
      .split('\n')
      .find((line) => line.trim().length > 0 && !line.startsWith('#'))
      ?.trim()
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*([^*]*)\*/g, '$1')
      .trim();
    if (!summary) continue;
    out.push({ date, version, body: summary });
  }
  return out;
}

export function generateAnnouncements(): Announcement[] {
  return announcementsOf(readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8'));
}

if (process.argv.includes('--write')) {
  const announcements = generateAnnouncements();
  writeFileSync(out, `${JSON.stringify(announcements, null, 2)}\n`);
  console.log(`the announcements are written in ${out}`);
  console.log(`  ${announcements.length} releases`);
}
