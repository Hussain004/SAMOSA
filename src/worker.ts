/// <reference lib="webworker" />
import { check, explain, type CheckOptions, type Explanation, type Report } from './core/index.ts';

/**
 * The engine worker.
 *
 * The engine runs off the main thread, so a long derivation never freezes
 * the editor. The main thread sends a generation number with every request
 * and drops the answers of an old generation, so a fast typist never sees a
 * stale verdict.
 */

export interface CheckRequest {
  type: 'check';
  gen: number;
  src: string;
  options: CheckOptions;
}

export interface ExplainRequest {
  type: 'explain';
  gen: number;
  src: string;
  stepId: string;
  options: CheckOptions;
}

export type WorkerRequest = CheckRequest | ExplainRequest;

export type WorkerResponse =
  | { type: 'report'; gen: number; report: Report }
  | { type: 'explain'; gen: number; stepId: string; explanation: Explanation }
  | { type: 'error'; gen: number; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

/**
 * The last report this worker built.
 *
 * Explain requests need the verdicts, so the app does not have to send the
 * report back with every request.
 */
let lastReport: Report | undefined;

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'check') {
      const report = check(request.src, request.options);
      lastReport = report;
      const response: WorkerResponse = { type: 'report', gen: request.gen, report };
      scope.postMessage(response);
      return;
    }
    if (request.type === 'explain') {
      const explanation = explain(request.src, request.stepId, request.options, lastReport);
      const response: WorkerResponse = {
        type: 'explain',
        gen: request.gen,
        stepId: request.stepId,
        explanation,
      };
      scope.postMessage(response);
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      gen: request.gen,
      message: error instanceof Error ? error.message : String(error),
    };
    scope.postMessage(response);
  }
};
