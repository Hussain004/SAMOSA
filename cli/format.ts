import type { Report, StepResult } from '../src/core/index.ts';

/**
 * The output formats of the CLI.
 *
 * The pretty one is for a person, the SARIF one is for a code scanner, and
 * the GitHub one prints workflow commands, so a paper gets inline
 * annotations without any plumbing.
 */

export const ICONS: Record<string, string> = {
  ok: '✓',
  wrong: '✗',
  shape: '⊘',
  inconclusive: '⚠',
  unchecked: '?',
  defined: '≡',
};

export interface PrettyOptions {
  file: string;
  /** the lines of the file, so the output can point at them */
  lines?: string[];
}

/** The human readable output, in the style of a linter. */
export function formatPretty(report: Report, options: PrettyOptions): string {
  const out: string[] = [];
  for (const step of report.steps) {
    if (step.verdict === 'defined' || step.verdict === 'ok') continue;
    const line = step.line ?? 0;
    const column = step.column ?? 1;
    out.push(
      `${options.file}:${line}:${column}  ${ICONS[step.verdict]} ${pad(step.verdict)}  ${step.message}  samosa/${ruleId(step)}`,
    );
    // The explanation is already computed by the CLI. A fix that has not
    // been checked is labeled, so a suggestion is never read as a guarantee.
    for (const fix of (step.fixes ?? []).slice(0, 3)) {
      out.push(`    fix${fix.verified ? '' : ' (unverified)'}: ${fix.title}`);
    }
  }
  out.push(summaryLine(report));
  return out.join('\n');
}

function pad(verdict: string): string {
  return verdict.padEnd(9, ' ');
}

function ruleId(step: StepResult): string {
  switch (step.verdict) {
    case 'wrong':
      return 'not-equal';
    case 'shape':
      return 'shape';
    case 'inconclusive':
      return 'inconclusive';
    default:
      return 'unchecked';
  }
}

/** The one line summary. */
export function summaryLine(report: Report): string {
  const counts = { ok: 0, wrong: 0, shape: 0, unchecked: 0, defined: 0, inconclusive: 0 };
  for (const step of report.steps) counts[step.verdict] += 1;
  const parts: string[] = [];
  if (counts.wrong) parts.push(`${counts.wrong} wrong`);
  if (counts.shape) parts.push(`${counts.shape} shape`);
  if (counts.inconclusive) parts.push(`${counts.inconclusive} inconclusive`);
  if (counts.unchecked) parts.push(`${counts.unchecked} unchecked`);
  if (counts.ok) parts.push(`${counts.ok} ok`);
  if (counts.defined) parts.push(`${counts.defined} defined`);
  return `${ICONS.wrong} ${parts.join(' · ')} · ${report.ms} ms`;
}

/** The SARIF output, version 2.1.0. */
export function formatSarif(reports: Array<{ file: string; report: Report }>): string {
  const results: unknown[] = [];
  for (const { file, report } of reports) {
    for (const step of report.steps) {
      if (step.verdict === 'defined' || step.verdict === 'ok') continue;
      const level =
        step.verdict === 'wrong' || step.verdict === 'shape'
          ? 'error'
          : step.verdict === 'inconclusive'
            ? 'warning'
            : 'note';
      results.push({
        ruleId: `samosa/${ruleId(step)}`,
        level,
        message: { text: step.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: file },
              region: {
                startLine: Math.max(1, step.line ?? 1),
                startColumn: Math.max(1, step.column ?? 1),
                endLine: Math.max(1, step.line ?? 1),
              },
            },
          },
        ],
        partialFingerprints: { 'samosa/v1': fingerprint(step) },
        properties: {
          mode: step.mode ?? null,
          seed: step.card.seed,
          sizes: step.card.sizes,
          degree: step.card.degree ?? null,
          bound: step.card.bound ?? null,
          assumptions: step.card.assumptions,
        },
      });
    }
  }

  return JSON.stringify(
    {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'samosa',
              informationUri: 'https://github.com/Hussain004/SAMOSA',
              rules: [
                { id: 'samosa/not-equal', shortDescription: { text: 'the two sides are not equal' } },
                { id: 'samosa/shape', shortDescription: { text: 'the shapes do not fit' } },
                { id: 'samosa/inconclusive', shortDescription: { text: 'SAMOSA could not decide' } },
                { id: 'samosa/unchecked', shortDescription: { text: 'SAMOSA did not check this step' } },
              ],
            },
          },
          results,
        },
      ],
    },
    null,
    2,
  );
}

/** A stable fingerprint of a step, so a rerun does not make new findings. */
function fingerprint(step: StepResult): string {
  let hash = 0x811c9dc5;
  const text = `${step.row}:${step.relation}:${step.text ?? ''}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** The GitHub workflow commands, which become inline annotations. */
export function formatGithub(reports: Array<{ file: string; report: Report }>): string {
  const out: string[] = [];
  for (const { file, report } of reports) {
    for (const step of report.steps) {
      if (step.verdict === 'defined' || step.verdict === 'ok') continue;
      const command = step.verdict === 'inconclusive' ? 'warning' : 'error';
      const title = `SAMOSA ${ICONS[step.verdict]} ${step.verdict}`;
      out.push(
        `::${command} file=${file},line=${Math.max(1, step.line ?? 1)},col=${Math.max(1, step.column ?? 1)},title=${title}::${step.message}`,
      );
    }
    out.push(summaryLine(report));
  }
  return out.join('\n');
}
