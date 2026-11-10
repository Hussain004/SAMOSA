import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { readShareLink } from '../core/share.ts';
import { check } from '../core/index.ts';
import { VERDICT_ICON, VERDICT_LABEL, VERDICT_TITLE } from '../app/verdicts.ts';
import type { StepResult } from '../core/index.ts';

/**
 * The embed view.
 *
 * A derivation, checked, read-only, with nothing uploaded and nothing to
 * click. The rows and the badges are the same as the app, without the
 * editor, the menu and the inspector. The whole check happens once, on
 * mount, on this machine, and the page ships no network request after it.
 */

function tex(source: string): string {
  return source
    .replace(/&/g, '')
    .replace(/\\nonumber|\\notag/g, '')
    .trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function Row({ step }: { step: StepResult }) {
  const text = tex(step.text ?? '');
  let html: string;
  try {
    html = katex.renderToString(text, {
      displayMode: false,
      throwOnError: false,
      strict: 'ignore',
      output: 'html',
    });
  } catch {
    html = escapeHtml(text);
  }
  return (
    <div className="row" data-step-id={step.id} data-verdict={step.verdict}>
      <span
        className={`badge v-${step.verdict}`}
        title={`${VERDICT_TITLE[step.verdict] ?? step.verdict} · row ${step.row}`}
      >
        {VERDICT_ICON[step.verdict]} {VERDICT_LABEL[step.verdict]}
      </span>
      <span className="math" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Broken() {
  return (
    <div className="broken">
      this embed link is broken: the derivation lives in the fragment of the URL
      and it did not survive the trip.
    </div>
  );
}

function summarize(steps: StepResult[]): string {
  const counts = new Map<string, number>();
  for (const step of steps) counts.set(step.verdict, (counts.get(step.verdict) ?? 0) + 1);
  const parts: string[] = [];
  for (const verdict of ['ok', 'wrong', 'shape', 'unchecked', 'defined']) {
    const n = counts.get(verdict);
    if (n) parts.push(`${n} ${VERDICT_LABEL[verdict as StepResult['verdict']]}`);
  }
  return parts.join(' · ');
}

function Embed() {
  const payload = readShareLink(window.location.href);
  if (!payload || typeof payload.src !== 'string' || !payload.src.trim()) return <Broken />;
  const settings = (payload.settings ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined;
  const report = check(payload.src, {
    decls: typeof payload.decls === 'string' && payload.decls ? payload.decls : undefined,
    preset: str(settings.preset),
    seed: num(settings.seed),
    trials: num(settings.trials),
    layout: str(settings.layout) as 'denominator' | 'numerator' | undefined,
  });
  return (
    <>
      <div className="rows" aria-label="the rows of the derivation, checked">
        {report.steps.map((step) => (
          <Row key={step.id} step={step} />
        ))}
      </div>
      <div className="fine">
        <span>{summarize(report.steps)} · checked on this page, nothing uploaded</span>
        <a href={`/app/#v1.${window.location.hash.slice('#v1.'.length)}`}>
          open in SAMOSA →
        </a>
      </div>
    </>
  );
}

const strict = (
  <StrictMode>
    <Embed />
  </StrictMode>
);

createRoot(document.getElementById('root')!).render(strict);
