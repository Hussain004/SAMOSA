import type { Report } from '../core/index.ts';
import type { Settings } from './store.ts';

/** The exports: JSON for the agents, Markdown for a person, LaTeX for a paper. */

export function exportJson(report: Report | null, source: string, settings: Settings): string {
  return JSON.stringify(
    {
      tool: 'samosa',
      version: report?.version ?? '1.0.0',
      seed: settings.seed,
      source,
      settings: {
        decls: settings.decls,
        preset: settings.preset,
        trials: settings.trials,
        layout: settings.layout,
      },
      summary: summarise(report),
      steps:
        report?.steps.map((step) => ({
          row: step.row,
          verdict: step.verdict,
          mode: step.mode ?? null,
          message: step.message,
          relation: step.relation,
          span: step.span,
          card: step.card,
          counterexample: step.counterexample ?? null,
        })) ?? [],
      symbols: report?.symbols ?? [],
      chips: report?.chips ?? [],
    },
    null,
    2,
  );
}

export function exportMarkdown(report: Report | null, source: string): string {
  const lines: string[] = [];
  lines.push('# SAMOSA report');
  lines.push('');
  if (report) {
    lines.push(`Seed \`${report.seed}\`, ${report.ms} ms.`);
    lines.push('');
    lines.push(summarise(report));
    lines.push('');
    lines.push('| row | verdict | mode | message |');
    lines.push('| --- | --- | --- | --- |');
    for (const step of report.steps) {
      lines.push(
        `| ${step.row} | ${step.verdict} | ${step.mode ?? ''} | ${step.message.replace(/\|/g, '\\|')} |`,
      );
    }
    lines.push('');
    for (const step of report.steps) {
      if (step.verdict === 'wrong') {
        lines.push(`## Row ${step.row}`);
        lines.push('');
        lines.push(step.message);
        lines.push('');
      }
    }
  }
  lines.push('## Source');
  lines.push('');
  lines.push('```latex');
  lines.push(source);
  lines.push('```');
  return lines.join('\n');
}

export function exportLatex(report: Report | null, source: string): string {
  const lines: string[] = [];
  const byRow = new Map<number, string>();
  for (const step of report?.steps ?? []) {
    const tag =
      step.verdict === 'ok'
        ? `\\textbf{✓} exact`
        : step.verdict === 'wrong'
          ? `\\textbf{✗} wrong`
          : step.verdict === 'shape'
            ? `\\textbf{⊘} shape`
            : step.verdict === 'defined'
              ? 'defined'
              : `\\textbf{?} not checked`;
    byRow.set(step.row, tag);
  }
  let lastRow = -1;
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      lines.push(line);
      continue;
    }
    const match = trimmed.match(/^\\\\[^&]*&(.*)$/);
    if (match) {
      const tag = byRow.get(lastRow + 1);
      if (tag) {
        lines.push(`${line} % samosa: ${tag}`);
        lastRow++;
        continue;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** The one line summary, the same one the CLI prints. */
export function summarise(report: Report | null): string {
  if (!report) return 'no report';
  const counts = { ok: 0, wrong: 0, shape: 0, unchecked: 0, defined: 0, inconclusive: 0 };
  for (const step of report.steps) counts[step.verdict] += 1;
  const parts: string[] = [];
  if (counts.ok) parts.push(`${counts.ok} ✓`);
  if (counts.wrong) parts.push(`${counts.wrong} ✗`);
  if (counts.shape) parts.push(`${counts.shape} ⊘`);
  if (counts.inconclusive) parts.push(`${counts.inconclusive} ⚠`);
  if (counts.unchecked) parts.push(`${counts.unchecked} ?`);
  if (counts.defined) parts.push(`${counts.defined} defined`);
  return `${report.steps.length} rows: ${parts.join(', ')}`;
}
