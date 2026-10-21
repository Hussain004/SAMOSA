/**
 * The generator of the demo.
 *
 * The landing page shows what SAMOSA says about a derivation. Those words
 * are written by hand in the source today, and a hand written demo is a demo
 * that can lie: it can name a fix the engine does not give, or a
 * counterexample the engine never produced.
 *
 * So the demo is generated: this script runs the real engine on the menu
 * bugs and writes what it says into `src/landing/generated.json`. The
 * landing page reads that file, and a test regenerates it and compares, so a
 * demo that does not match the engine fails the build.
 *
 *   node scripts/gen-demo.ts
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { check, explain } from '../src/core/index.ts';
import { MENU } from '../corpus/menu.ts';
import type { Report } from '../src/core/index.ts';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'src/landing/generated.json');

interface DemoRow {
  row: number;
  verdict: string;
  mode: string | null;
  message: string;
  relation: string;
  bound: number | undefined;
  degree: number | undefined;
}

interface DemoCounterexample {
  dims: Record<string, number>;
  values: Record<string, number[] | number>;
  derived: Record<string, number[] | number>;
  numpy: string;
}

interface Generated {
  /** the Kalman update, with the inverted noise term */
  kalman: {
    rows: DemoRow[];
    okRows: number;
    wrongRows: number;
    total: number;
    wrongRow: number;
    fixTitle: string;
    shareUrl: string;
  };
  /** the Joseph form, with the noise term missing */
  joseph: {
    wrongRow: number;
    fixTitle: string;
    fixEdit: string;
    counterexample: DemoCounterexample | null;
    rows: DemoRow[];
    total: number;
  };
  /** a transpose that is missing */
  shape: {
    row: number;
    message: string;
    fixTitle: string | null;
  };
  /** a gradient in the numerator layout */
  layout: {
    row: number;
    message: string;
  };
}

/** The rows of a report, in the shape the demo uses. */
function rowsOf(report: Report): DemoRow[] {
  return report.steps.map((step) => ({
    row: step.row,
    verdict: step.verdict,
    mode: step.mode ?? null,
    message: step.message,
    relation: step.relation,
    bound: step.card.bound,
    degree: step.card.degree,
  }));
}

/** The menu item, by its id. */
function menuItem(id: string) {
  const item = MENU.find((m) => m.id === id);
  if (!item) throw new Error(`no menu item called ${id}`);
  return item;
}

/** The step that is wrong, with its fixes and its counterexample. */
function theWrongOne(source: string, decls: string) {
  const report = check(source, { decls });
  const step = report.steps.find((s) => s.verdict === 'wrong');
  if (!step) throw new Error('no wrong step');
  const explanation = explain(source, step.id, { decls });
  return { report, step, explanation };
}

const kalman = menuItem('kalman');
const kalmanSource = kalman.bugSource ?? kalman.source;
const kalmanBug = check(kalmanSource, { decls: kalman.decls });
const kalmanWrong = kalmanBug.steps.filter((s) => s.verdict === 'wrong');
const kalmanWrongStep = kalmanBug.steps.find((s) => s.verdict === 'wrong');
const kalmanExplanation =
  kalmanWrongStep && kalmanWrongStep.id
    ? explain(kalmanSource, kalmanWrongStep.id, { decls: kalman.decls })
    : null;

const joseph = menuItem('joseph');
const josephWrong = theWrongOne(joseph.bugSource ?? joseph.source, joseph.decls);
const josephFix = josephWrong.explanation.fixes[0];

// a transpose that is missing, on the Joseph form: the push-through with a
// C_t that is not transposed
const shapeSource = String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1}
\end{align*}`;
const shapeReport = check(shapeSource, { decls: joseph.decls });
const shapeStep = shapeReport.steps.find((s) => s.verdict === 'shape');
const shapeExplanation = shapeStep ? explain(shapeSource, shapeStep.id, { decls: joseph.decls }) : null;

// a gradient in the numerator layout
const layoutSource = String.raw`\begin{align*}
J &:= a^\top X b \\
\frac{\partial J}{\partial X} &= b a^\top
\end{align*}`;
const layoutReport = check(layoutSource, { decls: 'X: m×n; a: m; b: n' });
const layoutStep = layoutReport.steps.find((s) => s.verdict === 'shape');

if (!shapeStep || !layoutStep) throw new Error('the demo needs a shape error and a layout error');

const shapeRow = shapeStep.row;
const shapeMessage = shapeStep.message;
const layoutRow = layoutStep.row;
const layoutMessage = layoutStep.message;

/** What the engine says about the menu bugs, in the shape the demo uses. */
function generateDemo(): Generated {
  return {
    kalman: {
      rows: rowsOf(kalmanBug),
      okRows: kalmanBug.steps.filter((s) => s.verdict === 'ok').length,
      wrongRows: kalmanWrong.length,
      total: kalmanBug.steps.length,
      wrongRow: kalmanWrongStep?.row ?? 0,
      fixTitle: kalmanExplanation?.fixes[0]?.title ?? '',
      shareUrl: '',
    },
    joseph: {
      wrongRow: josephWrong.step.row,
      fixTitle: josephFix?.title ?? '',
      fixEdit: josephFix?.edit?.insert ?? '',
      counterexample: josephWrong.explanation.counterexample
        ? {
            dims: josephWrong.explanation.counterexample.dims,
            values: josephWrong.explanation.counterexample.values,
            derived: josephWrong.explanation.counterexample.derived,
            numpy: josephWrong.explanation.counterexample.numpy,
          }
        : null,
      rows: rowsOf(josephWrong.report),
      total: josephWrong.report.steps.length,
    },
    shape: {
      row: shapeRow,
      message: shapeMessage,
      fixTitle: shapeExplanation?.fixes[0]?.title ?? null,
    },
    layout: {
      row: layoutRow,
      message: layoutMessage,
    },
  };
}

const generated = generateDemo();

/** Writes the demo into the file the landing page reads. */
export function writeDemo(): void {
  writeFileSync(out, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`the demo is written in ${out}`);
  console.log(
    `  the Kalman update: ${generated.kalman.okRows} hold, ${generated.kalman.wrongRows} wrong`,
  );
  console.log(`  the Joseph form: row ${generated.joseph.wrongRow}, ${generated.joseph.fixTitle}`);
}

// the script writes the file when it is run, and the test imports it to
// compare what the engine says today with what the landing page shows
if (process.argv.includes('--write')) {
  writeDemo();
}

export { generated };
export type { Generated };
