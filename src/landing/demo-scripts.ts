/**
 * The typed agent demo (F21).
 *
 * The script is data, and the verdict lines come from the real engine, so the
 * demo can never lie about what SAMOSA says. The renderer types the user
 * text, then reveals the tool output line by line after a braille spinner.
 */

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
    title: '~/notes · claude',
    events: [
      { kind: 'user', text: 'derive the Kalman gain for my notes and check every step' },
      { kind: 'think', text: 'Thinking…' },
      { kind: 'tool', text: 'samosa.check_derivation(kalman.tex)' },
      { kind: 'result', text: 'row  3 ✓ exact   ∂J/∂x (dual numbers)', tone: 'ok' },
      { kind: 'result', text: 'row 11 ✓ exact   push-through · false-✓ ≤ 1e-46', tone: 'ok' },
      { kind: 'result', text: 'row 12 ✗ wrong   missing + K_t Q_t K_tᵀ   counterexample n=2, m=1', tone: 'bad' },
      { kind: 'agent', text: 'Fixing row 12 (the Joseph form)…' },
      { kind: 'tool', text: 'samosa.check_derivation(kalman.tex)' },
      { kind: 'result', text: '✓ 12/12 rows verified · exact · 31 ms', tone: 'ok' },
      { kind: 'agent', text: 'Done. Share link: samosa-math.vercel.app/#v1.eNq…', tone: 'ok' },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    title: '~/notes · codex',
    events: [
      { kind: 'user', text: 'derive the Kalman gain for my notes and check every step' },
      { kind: 'think', text: 'Working…' },
      { kind: 'tool', text: '$ samosa check kalman.tex --format json' },
      { kind: 'result', text: 'row  3  ok    exact   ∂J/∂x (dual numbers)', tone: 'ok' },
      { kind: 'result', text: 'row 12  wrong  exact   missing + K_t Q_t K_tᵀ', tone: 'bad' },
      { kind: 'agent', text: 'Patching row 12, then re-checking…' },
      { kind: 'result', text: 'ok    12/12 rows verified · 31 ms', tone: 'ok' },
    ],
  },
  {
    id: 'cli',
    label: 'CLI',
    title: 'samosa · zsh',
    events: [
      { kind: 'user', text: 'npx samosa-math check paper.tex' },
      { kind: 'result', text: 'paper/appendix.tex', tone: 'plain' },
      { kind: 'result', text: '  132:18  ✗ wrong   align@130 row 3  not equal: the RHS is missing + K Q Kᵀ  samosa/not-equal', tone: 'bad' },
      { kind: 'result', text: '  141:5   ⊘ shape   align@140 row 2  (n×n)(m×n): inner sizes n ≠ m  samosa/shape', tone: 'bad' },
      { kind: 'result', text: '✗ 1 wrong · ⊘ 1 shape · ? 1 unchecked · ✓ 41 · 38 ms', tone: 'plain' },
    ],
  },
  {
    id: 'ci',
    label: 'CI',
    title: 'github actions',
    events: [
      { kind: 'tool', text: 'run: samosa check "paper/**/*.tex" --format github' },
      { kind: 'result', text: '::error file=paper/appendix.tex,line=132,col=18,title=SAMOSA ✗ wrong::not equal: the RHS is missing + K Q Kᵀ', tone: 'bad' },
      { kind: 'result', text: 'the job failed with 1 error', tone: 'plain' },
    ],
  },
];
