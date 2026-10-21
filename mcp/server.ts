#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { check, checkStep, explain } from '../src/core/index.ts';

/**
 * The MCP server.
 *
 * An agent can check its own matrix algebra with it. The tools are small and
 * the answers are evidence: the verdict, the counterexample, the fixes and
 * the share link a human can open to see the same thing.
 */

const VERSION = '1.0.0';

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
    shareUrl: z.string().optional(),
  })
  .passthrough();

function summarise(report: ReturnType<typeof check>): string {
  const counts = { ok: 0, wrong: 0, shape: 0, unchecked: 0, defined: 0, inconclusive: 0 };
  for (const step of report.steps) counts[step.verdict] += 1;
  const parts: string[] = [];
  if (counts.ok) parts.push(`${counts.ok} hold`);
  if (counts.wrong) parts.push(`${counts.wrong} wrong`);
  if (counts.shape) parts.push(`${counts.shape} shape error`);
  if (counts.inconclusive) parts.push(`${counts.inconclusive} inconclusive`);
  if (counts.unchecked) parts.push(`${counts.unchecked} not checked`);
  if (counts.defined) parts.push(`${counts.defined} defined`);
  return `${report.steps.length} rows: ${parts.join(', ')}`;
}

const shareBase = process.env.SAMOSA_SHARE_BASE ?? 'https://samosa-math.vercel.app';

function shareUrl(source: string): string {
  // the fragment keeps the derivation in the browser, nothing is uploaded
  const json = JSON.stringify({ src: source });
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${shareBase}/#v1.${base64}`;
}

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
      seed: z.number().int().optional(),
    },
    outputSchema: reportSchema,
  },
  async (args) => {
    const report = check(args.latex, {
      decls: args.declarations,
      preset: args.preset,
      seed: args.seed,
    });
    const structured = {
      summary: summarise(report),
      steps: report.steps.map((step) => ({
        row: step.row,
        verdict: step.verdict,
        mode: step.mode ?? null,
        message: step.message,
        relation: step.relation,
        card: step.card,
      })),
      shareUrl: shareUrl(args.latex),
    };
    return {
      content: [{ type: 'text' as const, text: summarise(report) }],
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
    const step = checkStep(args.lhs, args.rhs, { decls: args.declarations });
    const structured = {
      summary: `${step.verdict}: ${step.message}`,
      steps: [
        {
          row: step.row,
          verdict: step.verdict,
          mode: step.mode ?? null,
          message: step.message,
          relation: step.relation,
          card: step.card,
        },
      ],
    };
    return {
      content: [{ type: 'text' as const, text: `${step.verdict}: ${step.message}` }],
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
    const source = `${args.lhs} = ${args.rhs}`;
    const explanation = explain(source, 's0', { decls: args.declarations });
    const text = explanation.counterexample
      ? explanation.counterexample.numpy
      : 'no counterexample was found';
    return {
      content: [{ type: 'text' as const, text }],
      structuredContent: {
        summary: text,
        steps: [],
        fixes: explanation.fixes,
      } as never,
    };
  },
);

const serverTransport = new StdioServerTransport();
await server.connect(serverTransport);
