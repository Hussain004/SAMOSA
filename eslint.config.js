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
    rules: {
      // the dual number wrappers are generic over an unknown field, so `any`
      // is the honest type there
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // a component file may export its helpers; the fast refresh warning is
      // about the development server only
      'react-refresh/only-export-components': 'off',
      // the landing page animates on a timer, so the state changes inside an
      // effect on purpose
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
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
            {
              group: ['node:*', 'fs', 'path', 'os', 'crypto', 'child_process', 'worker_threads'],
              message: 'src/core must not import Node built-ins.',
            },
          ],
        },
      ],
    },
  },
]);
