import { useMemo } from 'react';
import { mathBlocks } from '../core/index.ts';
import type { Report, StepResult } from '../core/index.ts';
import { VERDICT_ICON } from './verdicts.ts';

/**
 * The outline of a document.
 *
 * A source with more than one block of mathematics gets a rail: one entry
 * per block, with the rows it holds and the verdicts of those rows, so a
 * paper reads as blocks and not as five hundred identical lines. Clicking
 * an entry jumps to its first row.
 */

export interface OutlineProps {
  source: string;
  report: Report | null;
  onJump: (stepId: string) => void;
  selectedStep: string | null;
}

interface BlockSummary {
  ok: number;
  wrong: number;
  shape: number;
  unchecked: number;
  other: number;
}

function summarize(steps: StepResult[]): BlockSummary {
  const out: BlockSummary = { ok: 0, wrong: 0, shape: 0, unchecked: 0, other: 0 };
  for (const step of steps) {
    if (step.verdict === 'ok') out.ok++;
    else if (step.verdict === 'wrong') out.wrong++;
    else if (step.verdict === 'shape') out.shape++;
    else if (step.verdict === 'unchecked' || step.verdict === 'inconclusive') out.unchecked++;
    else out.other++;
  }
  return out;
}

export function DocumentOutline({ source, report, onJump, selectedStep }: OutlineProps) {
  const blocks = useMemo(() => mathBlocks(source), [source]);
  if (blocks.length < 2) return null;

  return (
    <nav
      aria-label="the blocks of the document"
      className="hidden w-40 shrink-0 select-none flex-col gap-1 overflow-y-auto border-r border-[var(--color-line)] py-3 md:flex"
    >
      <div className="pane-title px-3">blocks</div>
      {blocks.map((block) => {
        const rows = report?.steps.filter((s) => s.row >= block.rowFrom && s.row <= block.rowTo) ?? [];
        const summary = summarize(rows);
        const stepId = rows[0]?.id ?? `s${block.rowFrom - 1}`;
        const selected = rows.some((s) => s.id === selectedStep);
        const parts: string[] = [];
        if (summary.ok) parts.push(`${summary.ok} ${VERDICT_ICON.ok}`);
        if (summary.wrong) parts.push(`${summary.wrong} ${VERDICT_ICON.wrong}`);
        if (summary.shape) parts.push(`${summary.shape} ${VERDICT_ICON.shape}`);
        if (summary.unchecked) parts.push(`${summary.unchecked} ${VERDICT_ICON.unchecked}`);
        if (summary.other) parts.push(`${summary.other} ≡`);
        const pending = report === null;
        return (
          <button
            key={block.from}
            onClick={() => onJump(stepId)}
            aria-current={selected ? 'true' : undefined}
            title={`rows ${block.rowFrom}–${block.rowTo}`}
            className={`mx-2 flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors ${
              selected
                ? 'border-[var(--color-gold)] bg-[#e8b04b12]'
                : 'border-transparent hover:border-[var(--color-line)] hover:bg-white/[0.03]'
            }`}
          >
            <span className="font-mono text-[0.6875rem] text-[var(--color-gold)]">{block.env}</span>
            <span className="text-[0.625rem] text-[var(--color-faint)]">rows {block.rowFrom}–{block.rowTo}</span>
            <span className="font-mono text-[0.6875rem] text-[var(--color-muted)]">
              {pending ? '…' : parts.join(' ')}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
