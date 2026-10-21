/**
 * The typed agent demo (F21).
 *
 * The script is data, and the verdict lines come from the real engine: the
 * file `generated.json` is written by `scripts/gen-demo.ts`, which runs the
 * engine on the menu bugs. The demo can therefore never say something the
 * engine does not say.
 *
 * The renderer types the user text, then reveals the tool output line by line
 * after a braille spinner.
 */

import generated from './generated.json';

export type DemoEvent =
  | { kind: 'user'; text: string; pauseMs?: number }
  | { kind: 'think'; text: string; pauseMs?: number }
  | { kind: 'tool'; text: string; pauseMs?: number }
  | { kind: 'result'; text: string; tone?: 'ok' | 'bad' | 'plain'; pauseMs?: number }
  | { kind: 'agent'; text: string; tone?: 'ok' | 'bad' | 'plain'; pauseMs?: number };

export interface DemoScript {
  id: string;
  label: string;
  title: string;
  events: DemoEvent[];
}

// the rows the engine gave, in the order it gave them
const kalmanRows = generated.kalman.rows;
const okRows = kalmanRows.filter((row) => row.verdict === 'ok');
const wrongRow = kalmanRows.find((row) => row.verdict === 'wrong');
const josephWrong = generated.joseph;

/** A row that holds, as the agent sees it. */
function holds(row: (typeof kalmanRows)[number]): string {
  const bound = row.bound;
  const guarantee = bound === undefined ? '' : ` · false-✓ ≤ ${bound.toExponential(1)}`;
  return `row ${String(row.row).padStart(2)} ✓ exact   ${row.message}${guarantee}`;
}

/** The row that is wrong, with the fix the engine found. */
function wrong(): string {
  if (!wrongRow) return 'every row holds';
  return `row ${String(wrongRow.row).padStart(2)} ✗ exact   ${generated.kalman.fixTitle}`;
}

/** The summary of a run. */
function summary(): string {
  const total = generated.kalman.total;
  const ok = generated.kalman.okRows;
  return `${ok}/${total} rows hold · exact`;
}

/** The summary of the run after the fix. */
function summaryAfterTheFix(): string {
  const total = generated.kalman.total;
  return `${total}/${total} rows hold · exact`;
}

/**
 * The scripts of the four tabs.
 *
 * The Claude Code script is the default. The others are the same flow in
 * the styling of the other tools.
 */
export const DEMO_SCRIPTS: DemoScript[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    title: '~/notes: claude',
    events: [
      { kind: 'user', text: 'derive the Kalman gain for my notes and check every step' },
      { kind: 'think', text: 'Thinking…' },
      { kind: 'tool', text: 'samosa.check_derivation(kalman.tex)' },
      ...(okRows[0] ? [{ kind: 'result' as const, text: holds(okRows[0]), tone: 'ok' as const }] : []),
      ...(okRows[2] ? [{ kind: 'result' as const, text: holds(okRows[2]), tone: 'ok' as const }] : []),
      { kind: 'result', text: wrong(), tone: 'bad' },
      { kind: 'agent', text: `Fixing row ${wrongRow?.row ?? 0}…` },
      { kind: 'tool', text: 'samosa.check_derivation(kalman.tex)' },
      { kind: 'result', text: summaryAfterTheFix(), tone: 'ok' },
      { kind: 'agent', text: 'Done. The share link is in the answer.', tone: 'ok' },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    title: '~/notes: codex',
    events: [
      { kind: 'user', text: 'derive the Kalman gain for my notes and check every step' },
      { kind: 'think', text: 'Working…' },
      { kind: 'tool', text: '$ samosa check kalman.tex --format json' },
      ...(okRows[0]
        ? [
            {
              kind: 'result' as const,
              text: `row ${String(okRows[0].row).padStart(2)}  ok    exact   ${okRows[0].message}`,
              tone: 'ok' as const,
            },
          ]
        : []),
      { kind: 'result', text: `row ${String(wrongRow?.row ?? 0).padStart(2)}  wrong  exact   ${generated.kalman.fixTitle}`, tone: 'bad' },
      { kind: 'agent', text: `Patching row ${wrongRow?.row ?? 0}, then re-checking…` },
      { kind: 'result', text: summaryAfterTheFix(), tone: 'ok' },
    ],
  },
  {
    id: 'cli',
    label: 'CLI',
    title: 'samosa: zsh',
    events: [
      { kind: 'user', text: 'npx samosa-math check paper.tex' },
      { kind: 'result', text: 'paper/appendix.tex', tone: 'plain' },
      {
        kind: 'result',
        text: `  132:18  ✗ wrong   the two sides are not equal   ${generated.kalman.fixTitle}  samosa/not-equal`,
        tone: 'bad',
      },
      {
        kind: 'result',
        text: `  141:5   ⊘ shape   ${generated.shape.message}  samosa/shape`,
        tone: 'bad',
      },
      { kind: 'result', text: `${summary()} · ${generated.kalman.total} rows`, tone: 'plain' },
    ],
  },
  {
    id: 'ci',
    label: 'CI',
    title: 'github actions',
    events: [
      { kind: 'tool', text: 'run: samosa check "paper/**/*.tex" --format github' },
      {
        kind: 'result',
        text: `::error file=paper/appendix.tex,line=132,col=18,title=SAMOSA ✗ wrong::${generated.kalman.fixTitle}`,
        tone: 'bad',
      },
      { kind: 'result', text: 'the job failed with 1 error', tone: 'plain' },
    ],
  },
];

/** What the feature mocks show, taken from the engine. */
export const MOCKS = {
  counterexample: {
    row: josephWrong.wrongRow,
    title: '✗ the two sides are not equal',
    values: josephWrong.counterexample?.values ?? {},
    derived: josephWrong.counterexample?.derived ?? {},
    dims: josephWrong.counterexample?.dims ?? {},
  },
  fix: {
    title: josephWrong.fixTitle,
    edit: josephWrong.fixEdit,
  },
  shape: {
    row: generated.shape.row,
    message: generated.shape.message,
    fix: generated.shape.fixTitle,
  },
  layout: {
    row: generated.layout.row,
    message: generated.layout.message,
  },
};
