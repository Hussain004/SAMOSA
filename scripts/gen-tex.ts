/**
 * The generator of the math on the landing page.
 *
 * KaTeX is a big library, and the landing page shows a handful of static
 * equations. Rendering them at build time keeps the library out of the
 * bundle, so the page loads in an instant.
 *
 *   node scripts/gen-tex.ts
 */

import { writeFileSync } from 'node:fs';
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

/** The math of the landing page, rendered. */
export function generateTex(): { bugs: string[]; menu: Record<string, string> } {
  const menu: Record<string, string> = {};
  for (const item of MENU) {
    menu[item.id] = tex(firstLine(item.source));
  }
  return { bugs: BUGS.map(tex), menu };
}

if (process.argv.includes('--write')) {
  const generated = generateTex();
  writeFileSync(out, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`the math is written in ${out}`);
  console.log(`  ${generated.bugs.length} bugs and ${Object.keys(generated.menu).length} menu cards`);
}
