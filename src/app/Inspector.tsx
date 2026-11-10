import { useEffect, useState } from 'react';
import type { Report, StepResult } from '../core/index.ts';
import { matrixLatex } from './matrix.ts';
import { VERDICT_ICON, VERDICT_LABEL, VERDICT_TITLE, seedText, guaranteeSentence, whyTrustHref, formatBound, reportIssueUrl } from './verdicts.ts';
import { saveReportCardPng, plainTex } from './report-card.ts';
import { Tex } from './tex.tsx';

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
      <div className="flex h-full items-center justify-between gap-4 border-b border-[var(--color-line)] p-3">
        <h2 className="pane-title">inspector</h2>
        <button
          onClick={onClose}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          close
        </button>
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
          <p className="mt-2 text-sm text-[var(--color-text)]" data-testid="guarantee-sentence">
            {guaranteeSentence(step)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            onClick={onClose}
            className="rounded border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
          >
            close
          </button>
          <button
            title="save this card as an image"
            onClick={() => {
              saveReportCardPng({
                step,
                latex: plainTex(step),
                counterexample: explanation?.counterexample,
                fixTitle: explanation?.fixes[0]?.title,
              }).catch((error: unknown) => {
                window.alert(`the image could not be saved: ${error instanceof Error ? error.message : String(error)}`);
              });
            }}
            className="rounded border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
          >
            save as image
          </button>
        </div>
      </div>

      {step.layoutHint && (
        <p className="mt-3 rounded border border-[var(--color-saffron)]/40 bg-[#f28c2812] p-2 text-xs text-[var(--color-saffron)]">
          {step.layoutHint}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <a
          href={whyTrustHref(step.mode)}
          className="inline-flex items-center gap-1 text-[0.6875rem] text-[var(--color-faint)] underline decoration-dotted underline-offset-2 hover:text-[var(--color-text)]"
        >
          why trust this?
        </a>
        {step.verdict === 'unchecked' && (
          <a
            href={reportIssueUrl(step)}
            target="_blank"
            rel="noreferrer"
            title="opens a prefilled GitHub issue in a new tab; the row goes in the URL, and you see it before you submit"
            className="inline-flex items-center gap-1 text-[0.6875rem] text-[var(--color-faint)] underline decoration-dotted underline-offset-2 hover:text-[var(--color-text)]"
          >
            report this row →
          </a>
        )}
      </div>

      <details className="mt-4" open>
        <summary className="cursor-pointer text-[0.6875rem] text-[var(--color-muted)]">the guarantee</summary>
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          <Field label="mode" value={step.mode ?? VERDICT_LABEL[step.verdict]} />
          <Field label="seed" value={seedText(card.seed)} />
          <Field label="trials per size" value={String(card.trialsPerSize)} />
          {/* A step that is wrong has no guarantee to show, so the fields of
              the guarantee are only there when the step holds. */}
          {step.verdict === 'ok' && (
            <>
              <div className="rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-2 py-1.5 sm:col-span-2">
                <div className="pane-title">sizes tested</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {card.sizes.map((size, i) => (
                    <span
                      key={i}
                      className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[0.625rem] text-[var(--color-muted)]"
                    >
                      {Object.entries(size).map(([k, v]) => `${k}=${v}`).join(' ')}
                    </span>
                  ))}
                </div>
              </div>
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
      </details>

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
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setCopied(null), [counterexample]);
  const [lang, setLang] = useState<'numpy' | 'julia' | 'matlab'>('numpy');
  const snippet = counterexample[lang];

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
        {(
          [
            { id: 'numpy', label: 'NumPy' },
            { id: 'julia', label: 'Julia' },
            { id: 'matlab', label: 'MATLAB' },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setLang(id)}
            aria-pressed={lang === id}
            className={`rounded border px-2 py-1 text-[0.625rem] transition-colors ${
              lang === id
                ? 'border-[var(--color-gold)] text-[var(--color-gold)]'
                : 'border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            onCopy(snippet);
            setCopied(lang);
          }}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          {copied === lang ? '✓ copied' : `copy as ${{ numpy: 'NumPy', julia: 'Julia', matlab: 'MATLAB' }[lang]}`}
        </button>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[0.625rem] text-[var(--color-faint)]">the { { numpy: 'NumPy', julia: 'Julia', matlab: 'MATLAB' }[lang] } snippet</summary>
        <pre className="mt-1 max-h-56 overflow-auto rounded border border-[var(--color-line)] bg-black/30 p-2 text-[0.625rem] leading-relaxed">
          {snippet}
        </pre>
      </details>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-2 py-1.5">
      <div className="pane-title">{label}</div>
      <div className="mt-0.5 break-words text-xs">{value}</div>
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


