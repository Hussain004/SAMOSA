import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'pkg/dist', 'playwright-report', 'test-results', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Invariant 1 from AGENTS.md: the core is pure TypeScript. It may not reach
    // for the DOM or for Node built-ins, so it can run in a Worker, in the CLI
    // and in the MCP server unchanged.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/core must not touch the DOM.' },
        { name: 'document', message: 'src/core must not touch the DOM.' },
        { name: 'localStorage', message: 'src/core must not touch browser storage.' },
        { name: 'process', message: 'src/core must not depend on Node built-ins.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'No Math.random in the core. Use the seeded PRNG in prng.ts so verdicts are reproducible.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'fs', 'path', 'os', 'crypto', 'child_process', 'worker_threads'], message: 'src/core must not import Node built-ins.' },
          ],
        },
      ],
    },
  },
]);
