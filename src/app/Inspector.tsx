import { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import type { Report, StepResult } from '../core/index.ts';
import { matrixLatex } from './matrix.ts';
import { VERDICT_ICON, VERDICT_LABEL, VERDICT_TITLE } from './verdicts.ts';

export interface InspectorProps {
  step: StepResult | null;
  report: Report | null;
  explanation?: { fixes: import('../core/index.ts').Fix[]; counterexample?: import('../core/index.ts').ShrunkInstance };
  onApplyFix: (fix: import('../core/index.ts').Fix) => void;
  onCopy: (text: string) => void;
  onClose: () => void;
}

/**
 * The inspector.
 *
 * The card of a step: the verdict, the guarantee, the counterexample and the
 * fixes. The guarantee is always shown, because a checkmark without a
 * guarantee is a guess.
 */
export function Inspector({ step, report, explanation, onApplyFix, onCopy, onClose }: InspectorProps) {
  if (!step) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-[var(--color-faint)]">
        Pick a row to see its card.
      </div>
    );
  }

  const card = step.card;

  return (
    <div data-testid="inspector" className="h-full overflow-auto p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <span className={textColor(step.verdict)} aria-hidden="true">
              {VERDICT_ICON[step.verdict]}
            </span>
            {VERDICT_TITLE[step.verdict]}
            <span className="text-[var(--color-faint)]">· row {step.row}</span>
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{step.message}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          close
        </button>
      </div>

      {step.layoutHint && (
        <p className="mt-3 rounded border border-[var(--color-saffron)]/40 bg-[#f28c2812] p-2 text-xs text-[var(--color-saffron)]">
          {step.layoutHint}
        </p>
      )}

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <Field label="mode" value={step.mode ?? VERDICT_LABEL[step.verdict]} />
        <Field label="seed" value={String(card.seed)} />
        <Field label="trials per size" value={String(card.trialsPerSize)} />
        {/* A step that is wrong has no guarantee to show, so the fields of
            the guarantee are only there when the step holds. */}
        {step.verdict === 'ok' && (
          <>
            <Field label="sizes tested" value={card.sizes.map((s) => Object.entries(s).map(([k, v]) => `${k}=${v}`).join(' ')).join(' · ')} />
            {card.primes && <Field label="primes" value={card.primes.map((p) => p.toString()).join(', ')} />}
            {card.degree !== undefined && <Field label="degree bound" value={String(card.degree)} />}
            {card.bound !== undefined && (
              <Field label="false checkmark" value={`≤ ${formatBound(card.bound)}`} />
            )}
            {card.maxDelta !== undefined && (
              <Field label="max difference" value={card.maxDelta.toExponential(2)} />
            )}
          </>
        )}
      </div>

      {card.assumptions.length > 0 && (
        <div className="mt-4" data-testid="assumptions">
          <h3 className="pane-title">checked assuming</h3>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
            {card.assumptions.map((a) => (
              <li key={a} className="flex gap-2">
                <span className="text-[var(--color-faint)]">·</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step.verdict === 'wrong' && explanation?.counterexample && (
        <CounterexampleView
          counterexample={explanation.counterexample}
          onCopy={onCopy}
        />
      )}

      {explanation && explanation.fixes.length > 0 && (
        <div className="mt-4">
          <h3 className="pane-title">did you mean</h3>
          <div className="mt-1 space-y-1.5">
            {explanation.fixes.map((fix, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] p-2"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs">
                    {fix.title}
                    {!fix.verified && (
                      <span className="rounded border border-[var(--color-saffron)]/50 px-1 py-0.5 text-[0.5625rem] uppercase tracking-wide text-[var(--color-saffron)]">
                        unverified
                      </span>
                    )}
                  </p>
                  {fix.detail && (
                    <Tex
                      latex={fix.detail}
                      className="mt-1 overflow-x-auto text-[0.75rem] text-[var(--color-muted)]"
                    />
                  )}
                </div>
                {fix.edit && (
                  <button
                    onClick={() => onApplyFix(fix)}
                    className="shrink-0 rounded border border-[var(--color-chutney)]/50 px-2 py-1 text-[0.625rem] text-[var(--color-chutney)] hover:bg-[#5bc27a18]"
                  >
                    apply
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {report && report.chips.length > 0 && (
        <div className="mt-4">
          <h3 className="pane-title">assumptions SAMOSA made</h3>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
            {/* the assumptions of the card are already listed above, so the
                chips that say the same thing are not said twice */}
            {report.chips
              .filter((chip) => !card.assumptions.includes(chip.message))
              .slice(0, 6)
              .map((chip) => (
                <li key={chip.id + chip.message} className="flex gap-2">
                  <span className="text-[var(--color-faint)]">·</span>
                  <span>{chip.message}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CounterexampleView({
  counterexample,
  onCopy,
}: {
  counterexample: import('../core/index.ts').ShrunkInstance;
  onCopy: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [counterexample]);

  // The values are drawn as the matrices they are. A symbol the derivation
  // defines is shown under its own heading, because it is computed and not
  // an input of the counterexample.
  const inputs = Object.entries(counterexample.values);
  const computed = Object.entries(counterexample.derived);
  const shape = (name: string): [number, number] => counterexample.shapes?.[name] ?? [1, 1];

  const left = matrixLatex(counterexample.lhs, counterexample.lhsShape ?? [1, 1]);
  const right = matrixLatex(counterexample.rhs, counterexample.rhsShape ?? [1, 1]);
  const difference = matrixLatex(counterexample.diff, counterexample.diffShape ?? [1, 1], true);

  return (
    <div className="mt-4">
      <h3 className="pane-title">counterexample</h3>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        These values break the step, and they are small enough to read.
      </p>

      <div className="mt-2 space-y-1 rounded border border-[var(--color-line)] bg-black/20 p-2">
        {inputs.map(([name, value]) => (
          <Tex key={name} display latex={`${name} = ${matrixLatex(value, shape(name))}`} />
        ))}
      </div>

      {computed.length > 0 && (
        <div className="mt-3">
          <h3 className="pane-title">computed by SAMOSA</h3>
          <p className="mt-0.5 text-[0.625rem] text-[var(--color-faint)]">
            The rows that define a symbol, run with the values above.
          </p>
          <div className="mt-1 space-y-1 rounded border border-[var(--color-line)] bg-black/10 p-2">
            {computed.map(([name, value]) => (
              <Tex key={name} display latex={`${name} = ${matrixLatex(value, shape(name))}`} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <h3 className="pane-title">the two sides</h3>
        <Tex
          display
          className="samosa-diff mt-1 overflow-x-auto rounded border border-[var(--color-line)] bg-black/20 p-2"
          latex={String.raw`\begin{aligned} \text{left side} &= ${left} \\ \text{right side} &= ${right} \\ \text{difference} &= ${difference} \end{aligned}`}
        />
        <p className="mt-1 text-[0.625rem] text-[var(--color-faint)]">
          The difference is what the step claims is zero. The nonzero entries are the ones in red.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            onCopy(counterexample.numpy);
            setCopied(true);
          }}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          {copied ? '✓ copied' : 'copy as NumPy'}
        </button>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[0.625rem] text-[var(--color-faint)]">the NumPy snippet</summary>
        <pre className="mt-1 max-h-56 overflow-auto rounded border border-[var(--color-line)] bg-black/30 p-2 text-[0.625rem] leading-relaxed">
          {counterexample.numpy}
        </pre>
      </details>
    </div>
  );
}

/** Renders a piece of LaTeX, and never throws at the reader. */
function Tex({ latex, display = false, className }: { latex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
        output: 'html',
      });
    } catch {
      return escapeHtml(latex);
    }
  }, [latex, display]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-2 py-1.5">
      <div className="pane-title">{label}</div>
      <div className="mt-0.5 truncate text-xs">{value}</div>
    </div>
  );
}

function textColor(verdict: StepResult['verdict']): string {
  switch (verdict) {
    case 'ok':
      return 'text-[var(--color-chutney)]';
    case 'wrong':
    case 'shape':
      return 'text-[var(--color-tamarind)]';
    case 'inconclusive':
      return 'text-[var(--color-saffron)]';
    default:
      return 'text-[var(--color-slate)]';
  }
}

/** A bound like 1.2e-47, in a way a person can read. */
export function formatBound(bound: number): string {
  if (bound === 0) return '0';
  if (bound < 1e-100) return `10^${Math.round(Math.log10(bound))}`;
  return bound.toExponential(1);
}
