import { build } from 'esbuild';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * The build of the npm package.
 *
 * One single file for the CLI and one for the MCP server, so the Action and
 * the `npx` install do not need a node_modules folder.
 */

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'pkg/dist');
mkdirSync(out, { recursive: true });

const shared = {
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
};

await build({
  ...shared,
  entryPoints: [resolve(root, 'cli/bin.ts')],
  outfile: resolve(out, 'cli.mjs'),
  external: ['@unified-latex/unified-latex-util-parse', '@unified-latex/unified-latex-util-split', '@unified-latex/unified-latex-util-environments'],
});

await build({
  ...shared,
  entryPoints: [resolve(root, 'mcp/server.ts')],
  outfile: resolve(out, 'mcp.mjs'),
  external: ['@modelcontextprotocol/sdk/*', 'zod'],
});

// the package manifest
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
writeFileSync(
  resolve(root, 'pkg/package.json'),
  `${JSON.stringify(
    {
      name: 'samosa-math',
      version: pkg.version,
      description:
        'A step auditor for matrix algebra, stochastics and algebra. Checks every step of a derivation, exactly, with counterexamples and fixes.',
      license: 'MIT',
      type: 'module',
      bin: {
        samosa: 'dist/cli.mjs',
        'samosa-mcp': 'dist/mcp.mjs',
      },
      files: ['dist', 'README.md', 'LICENSE'],
      keywords: ['math', 'linear-algebra', 'matrix-calculus', 'latex', 'linter', 'kalman-filter', 'mcp', 'agent-skills'],
      repository: { type: 'git', url: 'git+https://github.com/Hussain004/SAMOSA.git' },
      homepage: 'https://samosa-math.vercel.app',
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.32.1',
        '@unified-latex/unified-latex-util-parse': '^1.8.4',
        '@unified-latex/unified-latex-util-split': '^1.8.4',
        '@unified-latex/unified-latex-util-environments': '^1.8.4',
        'decimal.js': '^10.6.0',
        'zod': '^4.6.7',
      },
      engines: { node: '>=20' },
    },
    null,
    2,
  )}\n`,
);

copyFileSync(resolve(root, 'LICENSE'), resolve(root, 'pkg/LICENSE'));

/**
 * The readme of the package.
 *
 * The paths in the readme of the repository are relative to the repository,
 * so on the npm page they are rewritten to the raw files of the repository.
 */
const RAW = 'https://raw.githubusercontent.com/Hussain004/SAMOSA/master';
const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
  .replace(/(src=")public\//g, `$1${RAW}/public/`)
  .replace(/(\]\()public\//g, `$1${RAW}/public/`)
  .replace(/(\]\()docs\//g, `$1${RAW}/docs/`);
writeFileSync(resolve(root, 'pkg/README.md'), readme);

console.log('the package is ready in pkg/');
void dirname;
