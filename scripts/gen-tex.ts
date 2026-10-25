/**
 * The generator of the math on the landing page.
 *
 * KaTeX is a big library, and the landing page shows a handful of static
 * equations. Rendering them at build time keeps the library out of the
 * bundle, so the page loads in an instant.
 *
 *   node scripts/gen-tex.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import katex from 'katex';
import { MENU } from '../corpus/menu.ts';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'src/landing/generated-tex.json');

/** The mistakes in the hall of bugs, from Appendix B of the plan. */
const BUGS = [
  String.raw`(A + B)^\top = A^\top + B`,
  String.raw`\Sigma_t = (I - K_t C_t)\bar\Sigma_t`,
  String.raw`\frac{\partial J}{\partial w} = X^\top(\sigma(Xw) - y)`,
  String.raw`K_t = \bar\Sigma_t C_t^\top(C_t\bar\Sigma_t C_t^\top + Q_t)^{-1}`,
];

/** Renders a bit of LaTeX, the way the landing page shows it. */
function tex(source: string): string {
  try {
    return katex.renderToString(source, {
      throwOnError: false,
      displayMode: false,
      output: 'html',
    });
  } catch {
    return source;
  }
}

/** The first line of a derivation, which is what the menu card shows. */
function firstLine(source: string): string {
  const body = source.replace(/\\begin\{[^}]*\}/g, '').replace(/\\end\{[^}]*\}/g, '');
  const line = body.split(/\\\\/)[0]?.trim() ?? '';
  return line.replace(/&/g, '').trim();
}

/**
 * A line that is too long for a card is cut at its relation, and the rest is
 * a row of dots. A card that scrolls sideways hides the formula it shows.
 */
const CARD_LIMIT = 84;

function cardLine(line: string): string {
  if (line.length <= CARD_LIMIT) return line;
  const at = line.search(/:=|=/);
  if (at < 0) return line;
  const relation = line.startsWith(':=', at) ? ':=' : '=';
  return `${line.slice(0, at).trim()} ${relation} \\cdots`;
}

export interface GeneratedTex {
  bugs: string[];
  menu: Record<string, string>;
  /** the fix of the Joseph bug, as the feature card shows it */
  fix: { term: string; edit: string };
}

/** The text of one row of an align block, with the alignment marks removed. */
function firstRowOf(source: string, row: number): string {
  const body = source.replace(/\\begin\{[^}]*\}/g, '').replace(/\\end\{[^}]*\}/g, '');
  const rows = body.split(/\\\\/).map((r) => r.replace(/&/g, '').trim()).filter(Boolean);
  return rows.at(row - 1) ?? rows.at(-1) ?? '';
}

/** The math of the landing page, rendered. */
export function generateTex(): GeneratedTex {
  const menu: Record<string, string> = {};
  for (const item of MENU) {
    menu[item.id] = tex(cardLine(firstLine(item.source)));
  }
  const joseph = JSON.parse(readFileSync(resolve(root, 'src/landing/generated.json'), 'utf8')).joseph;
  const term = String(joseph.fixTitle ?? '').match(/exactly (.*)$/)?.[1] ?? '';
  // The row that is wrong, as the author wrote it, with the missing term in
  // green. The engine's own text for the edit groups with braces, which
  // KaTeX would draw with no parentheses at all.
  const bug = MENU.find((item) => item.id === 'joseph')?.bugSource ?? '';
  const row = firstRowOf(bug, joseph.wrongRow);
  const edit = row ? `${row} \\htmlClass{fix-add}{${term}}` : '';
  return {
    bugs: BUGS.map(tex),
    menu,
    fix: { term: tex(term), edit: edit ? katex.renderToString(edit, { throwOnError: false, trust: true, output: 'html' }) : '' },
  };
}

if (process.argv.includes('--write')) {
  const generated = generateTex();
  writeFileSync(out, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`the math is written in ${out}`);
  console.log(`  ${generated.bugs.length} bugs and ${Object.keys(generated.menu).length} menu cards`);
}
