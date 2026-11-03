import { build } from 'esbuild';
import { chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The build of the standalone CLI.
 *
 * One file, no node_modules, so the GitHub Action can run it with plain
 * node.
 */

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'pkg/dist');
mkdirSync(out, { recursive: true });

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

await build({
  entryPoints: [resolve(root, 'cli/bin.ts')],
  outfile: resolve(out, 'cli.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: [
    '@unified-latex/unified-latex-util-parse',
    '@unified-latex/unified-latex-util-split',
    '@unified-latex/unified-latex-util-environments',
  ],
  logLevel: 'info',
  define: {
    SAMOSA_VERSION: JSON.stringify(pkg.version),
  },
});

chmodSync(resolve(out, 'cli.mjs'), 0o755);
console.log('the CLI is ready in pkg/dist/cli.mjs');
