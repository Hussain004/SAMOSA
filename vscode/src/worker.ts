import { parentPort } from 'node:worker_threads';
import { check, explainAll } from '../../src/core/index.ts';

/**
 * The checking worker of the language server.
 *
 * A derivation that loops for ever keeps the worker busy, not the language
 * server, so the editor never freezes. The parent kills this worker when
 * the answer takes too long.
 *
 * The verdicts feed nothing back into the language model; the parent only
 * receives rows, fixes and counterexamples.
 */

export interface CheckResult {
  ok: boolean;
  steps?: Array<{
    id: string;
    row: number;
    span: { from: number; to: number };
    lhsSpan?: { from: number; to: number } | null;
    rhsSpan?: { from: number; to: number } | null;
    verdict: string;
    mode: string | null;
    message: string;
    relation: string;
    text?: string;
    line?: number;
    card: unknown;
    counterexample?: { dims: Record<string, number> } | null;
  }>;
  explanations?: Array<
    [
      string,
      {
        fixes: Array<{
          kind: string;
          title: string;
          verified: boolean;
          side?: string;
          addDecl?: string;
          edit?: { span: { from: number; to: number }; insert: string };
        }>;
        counterexample?: {
          dims: Record<string, number>;
          numpy: string;
        } | null;
      },
    ]
  >;
  message?: string;
}

parentPort!.on('message', (event: { src: string }) => {
  try {
    const report = check(event.src, {});
    const explanations = explainAll(event.src, {}, 8, report);
    const result: CheckResult = {
      ok: true,
      steps: report.steps.map((step) => ({
        id: step.id,
        row: step.row,
        span: step.span,
        lhsSpan: step.lhsSpan ?? null,
        rhsSpan: step.rhsSpan ?? null,
        verdict: step.verdict,
        mode: step.mode ?? null,
        message: step.message,
        relation: step.relation,
        text: step.text,
        line: step.line,
        card: step.card,
        counterexample: step.counterexample ? { dims: step.counterexample.dims } : null,
      })),
      explanations: [...explanations].map(([id, explanation]) => [
        id,
        {
          fixes: explanation.fixes.map((fix) => ({
            kind: fix.kind,
            title: fix.title,
            verified: fix.verified,
            side: fix.side,
            addDecl: fix.addDecl,
            edit: fix.edit,
          })),
          counterexample: explanation.counterexample
            ? { dims: explanation.counterexample.dims, numpy: explanation.counterexample.numpy }
            : null,
        },
      ]),
    };
    parentPort!.postMessage(result);
  } catch (error) {
    parentPort!.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    } satisfies CheckResult);
  }
});
