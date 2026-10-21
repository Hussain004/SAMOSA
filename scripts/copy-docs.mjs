import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The documentation is served with the site.
 *
 * The pages in `docs/` are plain Markdown, and they are copied into
 * `public/docs` so the build puts them next to the app. The landing page
 * links to them.
 */

const root = resolve(import.meta.dirname, '..');
const from = resolve(root, 'docs');
const to = resolve(root, 'public/docs');

mkdirSync(to, { recursive: true });
for (const name of readdirSync(from)) {
  if (!name.endsWith('.md')) continue;
  cpSync(resolve(from, name), resolve(to, name));
}
console.log('the documentation is copied into public/docs');
