import { build } from 'esbuild';
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The build of the VS Code extension.
 *
 * Three bundles, everything inlined except the `vscode` API: the extension
 * host entry, the language server, and the checking worker the server
 * spawns. The .vsix is self-contained; a user never runs npm.
 */

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'vscode', 'dist');
mkdirSync(out, { recursive: true });

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  legalComments: 'none',
  define: {
    'process.env.SAMOSA_SHARE_BASE': JSON.stringify(process.env.SAMOSA_SHARE_BASE ?? 'https://samosa-math.vercel.app'),
  },
};

await build({
  ...shared,
  entryPoints: [resolve(root, 'vscode/src/extension.ts')],
  outfile: resolve(out, 'extension.js'),
  external: ['vscode'],
});

await build({
  ...shared,
  entryPoints: [resolve(root, 'vscode/src/server.ts')],
  outfile: resolve(out, 'server.cjs'),
  // the server spawns the worker by file name, so the worker is its own file
});

await build({
  ...shared,
  entryPoints: [resolve(root, 'vscode/src/worker.ts')],
  outfile: resolve(out, 'worker.cjs'),
});

// the icon: the app's samosa mark, copied next to the extension manifest
const icon = resolve(root, 'public', 'icon-512.png');
if (existsSync(icon)) copyFileSync(icon, resolve(root, 'vscode', 'icon.png'));

writeFileSync(
  resolve(root, 'vscode', '.vscodeignore'),
  ['src/**', 'node_modules/**', '*.vsix', '.vscodeignore', 'tsconfig.json'].join('\n') + '\n',
);
console.log('the extension is built in vscode/dist');
