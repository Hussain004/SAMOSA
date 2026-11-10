import { Worker } from 'node:worker_threads';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
  Hover,
  MarkupKind,
  CodeAction,
  CodeActionKind,
  TextEdit,
  Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { guaranteeSentence, VERDICT_TITLE } from '../../src/app/verdicts.ts';
import type { StepResult } from '../../src/core/index.ts';

/**
 * The SAMOSA language server.
 *
 * A thin layer over the engine: diagnostics for every row that is wrong, a
 * shape mismatch, inconclusive or not checked; hover with the guarantee;
 * quick fixes from the engine's own repair search. Nothing is sent
 * anywhere: the engine runs in a worker thread inside this process, and
 * the share link is only built by the client when the user asks for it.
 */

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

interface StepProjection {
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
  card?: StepResult['card'];
  counterexample?: StepResult['counterexample'];
}

interface ExplanationProjection {
  fixes: Array<{
    kind: string;
    title: string;
    verified: boolean;
    side?: string;
    addDecl?: string;
    edit?: { span: { from: number; to: number }; insert: string };
  }>;
  counterexample?: { dims: Record<string, number>; numpy: string } | null;
}

interface CheckResult {
  ok: boolean;
  steps?: StepProjection[];
  explanations?: Array<[string, ExplanationProjection]>;
  message?: string;
}

/** Per document: the last good check, with its explanations, and the worker. */
const state = new Map<
  string,
  {
    /** bumped on every change, so a stale worker answer is dropped */
    generation: number;
    worker?: Worker;
    timer?: NodeJS.Timeout;
    lineStarts?: number[];
    steps?: StepProjection[];
    explanations?: Map<string, ExplanationProjection>;
    /** the version of the document the cached check was for */
    checkedVersion?: number;
    /** the watchdog: a pathological file never freezes the server */
    watchdog?: NodeJS.Timeout;
    /** the last version that was checked, for hover and code actions */
    text?: string;
  }
>();

const WORKER_TIMEOUT_MS = 10_000;
const DEBOUNCE_MS = 300;
// the bundle is CJS, where __dirname exists; in an ESM build, fileURLToPath does
declare const __dirname: string | undefined;
const here =
  typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));

function workerPath(): string {
  // the server is bundled to dist/server.cjs and the worker to
  // dist/worker.cjs, so the worker file sits next to it
  return join(here, 'worker.cjs');
}

function lineStartsOf(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function offsetToPosition(starts: number[], offset: number): { line: number; character: number } {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low, character: offset - starts[low] };
}

function positionToOffset(starts: number[], line: number, character: number): number {
  const lineStart = starts[Math.min(line, starts.length - 1)] ?? 0;
  return lineStart + character;
}

function toRange(starts: number[], span: { from: number; to: number }): Range {
  return Range.create(offsetToPosition(starts, span.from), offsetToPosition(starts, span.to));
}

function severityOf(verdict: string): DiagnosticSeverity {
  switch (verdict) {
    case 'wrong':
    case 'shape':
      return DiagnosticSeverity.Error;
    case 'inconclusive':
      return DiagnosticSeverity.Warning;
    default:
      return DiagnosticSeverity.Information;
  }
}

function checkLater(document: TextDocument): void {
  const entry = state.get(document.uri) ?? { generation: 0 };
  entry.generation += 1;
  const generation = entry.generation;
  state.set(document.uri, entry);

  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => runCheck(document, generation), DEBOUNCE_MS);
}

function runCheck(document: TextDocument, generation: number): void {
  const entry = state.get(document.uri);
  if (!entry) return;
  const text = document.getText();
  entry.text = text;

  // a worker per check, killed on timeout: a pathological file never
  // freezes the language server, and the editor keeps the last diagnostics
  const worker = new Worker(workerPath(), { workerData: undefined });
  entry.worker = worker;
  entry.watchdog = setTimeout(() => {
    void worker.terminate();
    connection.console.warn('the derivation took too long to check; keeping the last diagnostics');
  }, WORKER_TIMEOUT_MS);

  worker.once('message', (result: CheckResult) => {
    if (entry.watchdog) clearTimeout(entry.watchdog);
    void worker.terminate();
    entry.worker = undefined;
    const current = state.get(document.uri);
    if (!current || current.generation !== generation) return; // stale
    if (!result.ok || !result.steps) {
      connection.console.error(`SAMOSA could not check this file: ${result.message ?? 'unknown error'}`);
      return;
    }
    current.steps = result.steps;
    current.lineStarts = lineStartsOf(text);
    current.explanations = new Map(result.explanations ?? []);
    current.checkedVersion = document.version;
    publishDiagnostics(document.uri, current);
  });
  worker.once('error', (error) => {
    if (entry.watchdog) clearTimeout(entry.watchdog);
    entry.worker = undefined;
    connection.console.error(`SAMOSA check failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  worker.postMessage({ src: text });
}

function publishDiagnostics(uri: string, entry: NonNullable<ReturnType<typeof state.get>>): void {
  const starts = entry.lineStarts!;
  const diagnostics: Diagnostic[] = [];
  for (const step of entry.steps ?? []) {
    if (step.verdict === 'ok' || step.verdict === 'defined') continue;
    const diagnostic: Diagnostic = {
      range: toRange(starts, step.span),
      severity: severityOf(step.verdict),
      source: 'samosa',
      message: `${step.row}: ${step.message}`,
      data: { stepId: step.id },
    };
    diagnostics.push(diagnostic);
  }
  void connection.sendDiagnostics({ uri, diagnostics });
}

function stepAt(entry: NonNullable<ReturnType<typeof state.get>>, offset: number): StepProjection | undefined {
  return (entry.steps ?? []).find((step) => step.span.from <= offset && offset <= step.span.to);
}

function asStepResult(step: StepProjection): StepResult {
  return {
    id: step.id,
    row: step.row,
    span: step.span,
    text: step.text,
    line: step.line,
    relation: step.relation as StepResult['relation'],
    verdict: step.verdict as StepResult['verdict'],
    mode: step.mode as StepResult['mode'],
    card: step.card,
    counterexample: step.counterexample,
    message: step.message,
    reason: step.message,
  } as StepResult;
}

documents.onDidOpen((event) => checkLater(event.document));
documents.onDidChangeContent((change) => checkLater(change.document));
documents.onDidClose((event) => {
  clearTimeout(state.get(event.document.uri)?.timer);
  void connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
  state.delete(event.document.uri);
});

connection.onHover((params) => {
  const entry = state.get(params.textDocument.uri);
  if (!entry || !entry.lineStarts || entry.checkedVersion === undefined) return null;
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  const offset = positionToOffset(
    entry.lineStarts,
    params.position.line,
    params.position.character,
  );
  const step = stepAt(entry, offset);
  if (!step) return null;
  const result = asStepResult(step);
  const lines = [
    `**${VERDICT_TITLE[result.verdict] ?? result.verdict}** · row ${step.row}`,
    '',
    guaranteeSentence(result),
  ];
  const explanation = entry.explanations?.get(step.id);
  if (explanation?.counterexample?.numpy) {
    lines.push('', '```python', explanation.counterexample.numpy, '```');
  }
  lines.push('', '_SAMOSA · every check runs on this machine, nothing leaves the editor._');
  const hover: Hover = {
    contents: { kind: MarkupKind.Markdown, value: lines.join('\n') },
  };
  return hover;
});

connection.onCodeAction((params) => {
  const entry = state.get(params.textDocument.uri);
  if (!entry || !entry.lineStarts || entry.checkedVersion === undefined) return [];
  const starts = entry.lineStarts;
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const actions: CodeAction[] = [];
  for (const diagnostic of params.context.diagnostics) {
    const stepId = (diagnostic.data as { stepId?: string } | undefined)?.stepId;
    if (!stepId) continue;
    const step = (entry.steps ?? []).find((s) => s.id === stepId);
    const explanation = entry.explanations?.get(stepId);
    if (!step || !explanation) continue;
    for (const fix of explanation.fixes) {
      if (fix.addDecl) {
        // declare what the engine had to guess, on the % samosa: line if
        // there is one, otherwise a new one at the top of the file
        const text = document.getText();
        const at = text.indexOf('% samosa:');
        const edit =
          at >= 0
            ? (() => {
                const line = text.slice(0, at).split('\n').length - 1;
                const lineEnd = text.indexOf('\n', at);
                const character = (lineEnd === -1 ? text.length : lineEnd) - (starts[line] ?? 0);
                return TextEdit.insert({ line, character }, `; ${fix.addDecl}`);
              })()
            : TextEdit.insert({ line: 0, character: 0 }, `% samosa: ${fix.addDecl}\n`);
        actions.push({
          title: `SAMOSA: ${fix.addDecl}`,
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [params.textDocument.uri]: [edit],
            },
          },
        });
        continue;
      }
      if (!fix.edit) continue;
      // the fix span is relative to the row, so the row offset is added
      const from = fix.edit.span.from + step.span.from;
      const to = fix.edit.span.to + step.span.from;
      actions.push({
        title: `SAMOSA: ${fix.title}`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        isPreferred: fix.verified,
        edit: {
          changes: {
            [params.textDocument.uri]: [
              TextEdit.replace(toRange(starts, { from, to }), fix.edit.insert),
            ],
          },
        },
      });
    }
  }
  return actions;
});

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    hoverProvider: true,
    codeActionProvider: {
      codeActionKinds: [CodeActionKind.QuickFix],
      resolveProvider: false,
    },
  },
  serverInfo: {
    name: 'samosa',
    version: '1.2.0',
  },
}));

documents.listen(connection);
connection.listen();
