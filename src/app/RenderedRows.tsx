import { useEffect, useMemo, useRef } from 'react';
import katex from 'katex';
import type { Report, StepResult } from '../core/index.ts';
import { VERDICT_LABEL, VERDICT_ICON } from './verdicts.ts';

export interface RenderedProps {
  /** the whole source, so the spans of a step can be sliced */
  source: string;
  report: Report | null;
  selectedStep: string | null;
  onSelectStep: (id: string) => void;
  hoverStep: string | null;
  onHoverStep: (id: string | null) => void;
  /** the spot the bug game: the badges are hidden until the user guesses */
  spotTheBug: boolean;
  /** the row the user guessed, and the row that is really wrong */
  guess: string | null;
  revealed: string | null;
}

/**
 * The rendered pane.
 *
 * Every row of the derivation, rendered with KaTeX, with a badge and the
 * mode. The offending sub-expression is highlighted, so the eye goes
 * straight to the part that is wrong.
 */
export function RenderedRows({
  source,
  report,
  selectedStep,
  onSelectStep,
  hoverStep,
  onHoverStep,
  spotTheBug,
  guess,
  revealed,
}: RenderedProps) {
  if (!report || report.steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--color-faint)]">
        <div>
          <p className="text-[var(--color-muted)]">Nothing to check yet.</p>
          <p className="mt-1">Paste a derivation, or pick one from the menu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-4 py-3">
      {report.steps.map((step) => (
        <Row
          key={step.id}
          step={step}
          source={source}
          selected={selectedStep === step.id}
          hovered={hoverStep === step.id}
          spotTheBug={spotTheBug}
          guess={guess}
          revealed={revealed}
          onSelect={() => onSelectStep(step.id)}
          onHover={(on) => onHoverStep(on ? step.id : null)}
        />
      ))}
    </div>
  );
}

function Row({
  step,
  source,
  selected,
  hovered,
  spotTheBug,
  guess,
  revealed,
  onSelect,
  onHover,
}: {
  step: StepResult;
  source: string;
  selected: boolean;
  hovered: boolean;
  spotTheBug: boolean;
  guess: string | null;
  revealed: string | null;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const html = useMemo(
    () => renderStep(step, source, spotTheBug && !revealed),
    [step, source, spotTheBug, revealed],
  );

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <div
      ref={ref}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`group flex cursor-pointer items-start gap-3 rounded-md border-l-2 px-2 py-2 transition-colors ${
        selected
          ? 'border-l-[var(--color-gold)] bg-[#e8b04b12]'
          : hovered
            ? 'border-l-[var(--color-line)] bg-white/[0.03]'
            : 'border-l-transparent'
      }`}
    >
      <span className="mt-1 w-6 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-faint)]">
        {step.row}
      </span>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="text-[15px] leading-8" dangerouslySetInnerHTML={{ __html: html }} />
        {step.annotation && (
          <p className="mt-0.5 text-xs text-[var(--color-faint)]">{step.annotation}</p>
        )}
      </div>
      <div className="mt-1 shrink-0">
        {spotTheBug && !revealed ? (
          <span className="text-[11px] text-[var(--color-faint)]">
            {guess === step.id ? 'you think this one' : 'click the wrong row'}
          </span>
        ) : (
          <>
            <span className={`badge badge-${badgeClass(step)}`}>
              <span aria-hidden="true">{VERDICT_ICON[step.verdict]}</span>
              {VERDICT_LABEL[step.verdict]}
            </span>
            {step.mode && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--color-faint)]">{step.mode}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function badgeClass(step: StepResult): string {
  switch (step.verdict) {
    case 'ok':
      return 'ok';
    case 'wrong':
      return 'wrong';
    case 'shape':
      return 'shape';
    case 'inconclusive':
      return 'warn';
    case 'defined':
      return 'defined';
    default:
      return 'unknown';
  }
}

/** Renders a step with KaTeX, highlighting the part that is wrong. */
export function renderStep(step: StepResult, source = '', plain = false): string {
  const latex = stepLaTeX(step, source, plain);
  if (!latex) return '';
  try {
    return katex.renderToString(latex, {
      displayMode: false,
      throwOnError: false,
      trust: (ctx: { command: string; class?: string }) =>
        ctx.command === '\\htmlClass' && /^samosa-/.test(ctx.class ?? ''),
      strict: 'ignore',
      output: 'html',
    });
  } catch {
    return escapeHtml(latex);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * The LaTeX of a step, with the wrong part wrapped in a highlight.
 *
 * The spans of a step are offsets into its own row, so the row text is what
 * gets sliced.
 */
function stepLaTeX(step: StepResult, _source: string, plain = false): string {
  const text = step.text ?? '';
  if (!text) return '';
  if (!plain && step.verdict === 'wrong' && step.lhsSpan && step.rhsSpan) {
    const lhs = text.slice(step.lhsSpan.from, step.lhsSpan.to);
    const relation = text.slice(step.lhsSpan.to, step.rhsSpan.from).replace(/&/g, '');
    const rhs = text.slice(step.rhsSpan.from);
    return `${tex(lhs)}${tex(relation)}\\htmlClass{samosa-hl}{${tex(rhs)}}`;
  }
  return tex(text);
}

/** The LaTeX of a piece of a row, with the alignment markers removed. */
function tex(source: string): string {
  return source
    .replace(/&/g, '')
    .replace(/\\nonumber|\\notag/g, '')
    .trim();
}
