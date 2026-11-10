#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  handleCheckDerivation,
  handleCheckStep,
  handleExplainStep,
  handleFindCounterexample,
  handleSuggestDeclarations,
  summarise,
} from './tools.ts';
import type { SharePayload } from '../src/core/share.ts';

export { handleCheckDerivation, handleCheckStep, handleExplainStep, handleFindCounterexample, handleSuggestDeclarations };
export type { SharePayload };

/**
 * The MCP server.
 *
 * An agent can check its own matrix algebra with it. The tools are small and
 * the answers are evidence: the verdict, the counterexample, the fixes and
 * the share link a human can open to see the same thing.
 */

/** The build replaced the version it read from the package manifest. */
declare const SAMOSA_VERSION: string | undefined;
declare const SAMOSA_DOCS_NOTATION: string | undefined;
declare const SAMOSA_COOKBOOK: string | undefined;
const VERSION = typeof SAMOSA_VERSION === 'string' ? SAMOSA_VERSION : '0.0.0-dev';

const server = new McpServer({ name: 'samosa', version: VERSION });

/** The shape of a step, the same one the CLI prints. */
const stepSchema = z
  .object({
    row: z.number(),
    verdict: z.string(),
    mode: z.string().nullable(),
    message: z.string(),
    relation: z.string(),
    card: z.object({
      trialsPerSize: z.number(),
      sizes: z.array(z.record(z.string(), z.number())),
      primes: z.array(z.number()).optional(),
      degree: z.number().optional(),
      bound: z.number().optional(),
      assumptions: z.array(z.string()),
      seed: z.number(),
    }),
  })
  .passthrough();

const reportSchema = z
  .object({
    summary: z.string(),
    steps: z.array(stepSchema),
    warnings: z.array(z.string()),
    shareUrl: z.string().optional(),
  })
  .passthrough();

server.registerTool(
  'check_derivation',
  {
    title: 'Check a derivation step by step',
    description:
      'Checks every step of a LaTeX derivation (matrix algebra, gradients, Gaussian expectations) by exact finite field or 50 digit evaluation. Returns the verdict of every row, the counterexamples, the fixes and a share link. No AI is involved in the verdict.',
    inputSchema: {
      latex: z.string().describe('the derivation, as a LaTeX align block or as plain rows'),
      declarations: z.string().optional().describe('the declarations, in the compact syntax'),
      preset: z.string().optional().describe('one of the presets'),
      seed: z.number().int().min(0).max(0xffffffff).optional(),
    },
    outputSchema: reportSchema,
  },
  async (args) => {
    const { structured, text } = handleCheckDerivation(args);
    return {
      content: [{ type: 'text' as const, text }],
      structuredContent: structured as never,
    };
  },
);

server.registerTool(
  'check_step',
  {
    title: 'Check one step',
    description:
      'Checks a single equation, for instance "A^T A x = A^T b". Returns the verdict, the guarantee and the fixes.',
    inputSchema: {
      lhs: z.string(),
      rhs: z.string(),
      relation: z.string().optional().describe('the relation, = by default'),
      declarations: z.string().optional(),
    },
    outputSchema: reportSchema,
  },
  async (args) => {
    const { structured, text } = handleCheckStep(args);
    return {
      content: [{ type: 'text' as const, text }],
      structuredContent: structured as never,
    };
  },
);

server.registerTool(
  'find_counterexample',
  {
    title: 'Find a counterexample',
    description:
      'Searches for small values that break an equation, and returns them with a NumPy snippet that reproduces them.',
    inputSchema: {
      lhs: z.string(),
      rhs: z.string(),
      declarations: z.string().optional(),
    },
    outputSchema: reportSchema,
  },
  async (args) => {
    const { structured, text } = handleFindCounterexample(args);
    return {
      content: [{ type: 'text' as const, text }],
      structuredContent: structured as never,
    };
  },
);

server.registerTool(
  'suggest_declarations',
  {
    title: 'Suggest declarations for an undeclared derivation',
    description:
      'Reads a derivation nobody declared and returns what SAMOSA guessed and what it read from the text, as a compact declaration string you can pass straight back to check_derivation. Two calls from an undeclared derivation to an all-✓ one.',
    inputSchema: {
      latex: z.string().describe('the derivation, as a LaTeX align block'),
    },
    outputSchema: z.object({
      declarations: z.string(),
      samosaComment: z.string(),
      guessed: z.array(z.string()),
      harvested: z.array(z.object({ symbol: z.string().optional(), origin: z.string() })),
      note: z.string(),
      summary: z.string(),
    }),
  },
  async (args) => {
    const { structured, text } = handleSuggestDeclarations(args);
    return {
      content: [{ type: 'text' as const, text }],
      structuredContent: structured as never,
    };
  },
);

server.registerTool(
  'explain_step',
  {
    title: 'Explain one row of a derivation',
    description:
      'Checks the whole derivation, then returns the explanation for one row only: the verdict, the guarantee card, the fixes and the counterexample. Cheaper than check_derivation with all explanations when an agent is iterating on one row.',
    inputSchema: {
      latex: z.string().describe('the derivation, as a LaTeX align block'),
      row: z.number().int().min(1).describe('the 1-based row number, as check_derivation reports them'),
      declarations: z.string().optional(),
      preset: z.string().optional(),
      seed: z.number().int().min(0).max(0xffffffff).optional(),
    },
    outputSchema: z.object({
      row: z.number(),
      verdict: z.string(),
      mode: z.string().nullable(),
      message: z.string(),
      relation: z.string(),
      card: z.object({
        trialsPerSize: z.number(),
        sizes: z.array(z.record(z.string(), z.number())),
        primes: z.array(z.number()).optional(),
        degree: z.number().optional(),
        bound: z.number().optional(),
        assumptions: z.array(z.string()),
        seed: z.number(),
      }),
    }).passthrough(),
  },
  async (args) => {
    const { structured, text } = handleExplainStep(args);
    return {
      content: [{ type: 'text' as const, text }],
      structuredContent: structured as never,
    };
  },
);

// ----------------------------------------------------------- the resources

/** A resource bundled into the single-file build. */
const fallback = (what: string) =>
  `the ${what} resource is bundled into the npm build of the server; in a development checkout it lives in docs/\n`;

const NOTATION =
  typeof SAMOSA_DOCS_NOTATION === 'string'
    ? SAMOSA_DOCS_NOTATION
    : (() => {
        try {
          return readFileSync(resolve(process.cwd(), 'docs/NOTATION.md'), 'utf8');
        } catch {
          return fallback('notation');
        }
      })();

const COOKBOOK =
  typeof SAMOSA_COOKBOOK === 'string'
    ? SAMOSA_COOKBOOK
    : (() => {
        try {
          // the identities are TypeScript, so in a development checkout the
          // list is best-effort: read the ids and names with a regex
          const source = readFileSync(resolve(process.cwd(), 'corpus/cookbook/identities.ts'), 'utf8');
          const pairs = [...source.matchAll(/id: '([^']+)',\s*\n\s*name: '([^']+)',/g)];
          if (!pairs.length) return fallback('cookbook');
          return `# The Cookbook\n\n${pairs.length} identities, measured by the engine, none of them allowed to pass with a wrong checkmark.\n\n`
            + pairs.map(([, id, name]) => `- \`${id}\`: ${name}`).join('\n');
        } catch {
          return fallback('cookbook');
        }
      })();

server.registerResource(
  'notation',
  'samosa://docs/notation',
  {
    description: 'SAMOSA notation: every construct and what SAMOSA does with it',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: NOTATION }],
  }),
);

server.registerResource(
  'cookbook',
  'samosa://cookbook',
  {
    description: 'the Cookbook: every identity SAMOSA measures itself against, id and name',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: COOKBOOK }],
  }),
);

// ------------------------------------------------------------- the prompts

server.registerPrompt(
  'check-my-derivation',
  {
    title: 'Check my derivation',
    description: 'The workflow: declare, check, fix, check again, present with the guarantee.',
    argsSchema: {
      latex: z.string().describe('the derivation, as a LaTeX align block, one step per row').optional(),
    },
  },
  (args) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: [
            'Check this derivation with SAMOSA, in this order:',
            '1. Call suggest_declarations with the latex, and take the compact declaration string it returns.',
            '2. Call check_derivation with the latex and those declarations.',
            '3. For every row marked wrong or shape, call explain_step for that row, and read the counterexample and the fixes.',
            '4. Fix the rows. Check again. Never present a derivation that still has a wrong or shape row.',
            '5. If a row is unchecked, say so, and say why: inequalities and non-polynomial expectations are not checked.',
            '6. Include the shareUrl from the report so the reader can open every step.',
            '',
            args.latex ? `The derivation:\n${args.latex}` : 'The derivation is the one in the current file.',
          ].join('\n'),
        },
      },
    ],
  }),
);

const serverTransport = new StdioServerTransport();
await server.connect(serverTransport);

export { summarise };
