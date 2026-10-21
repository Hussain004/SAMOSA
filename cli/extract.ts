/**
 * The document extraction for the CLI.
 *
 * A `.tex` file is walked for its math environments, and the rows of each
 * one become the steps. A `.md` file is scanned for its math blocks. The
 * declarations come from the `% samosa:` comments and from the "where" prose.
 */

import { parse } from '@unified-latex/unified-latex-util-parse';
import { visit } from '@unified-latex/unified-latex-util-visit';
import { printRaw } from '@unified-latex/unified-latex-util-print-raw';

const MATH_ENVIRONMENTS = [
  'align',
  'align*',
  'aligned',
  'alignat',
  'alignat*',
  'gather',
  'gather*',
  'gathered',
  'split',
  'equation',
  'equation*',
  'multline',
  'multline*',
  'eqnarray',
  'eqnarray*',
  'displaymath',
  'array',
];

/** One piece of a document: the math rows and the declarations around them. */
export interface Extraction {
  /** the math rows, with their source text */
  rows: Array<{ text: string; line: number }>;
  /** the declarations found in the comments and in the prose */
  decls: string[];
}

export function extractDocument(source: string, isTex: boolean): Extraction {
  const decls: string[] = [];

  // the % samosa: comments are declarations
  for (const line of source.split('\n')) {
    const match = line.match(/%\s*samosa:\s*(.+)$/);
    if (match) decls.push(match[1].trim());
  }

  const rows = isTex ? extractTex(source) : extractMarkdown(source);
  return { rows, decls: [...decls, ...harvestProse(source)] };
}

/** The math rows of a LaTeX file. */
function extractTex(source: string): Array<{ text: string; line: number }> {
  const rows: Array<{ text: string; line: number }> = [];
  const lineOf = lineNumbers(source);

  let tree: ReturnType<typeof parse>;
  try {
    tree = parse(source);
  } catch {
    return extractByBraces(source, lineOf);
  }

  visit(tree, (node) => {
    if (node.type !== 'environment') return;
    const environment = node as unknown as { name: unknown; content: unknown };
    const name = printRaw(environment.name as never).trim();
    if (!MATH_ENVIRONMENTS.includes(name)) return;
    const content = printRaw(environment.content as never);
    for (const row of splitRows(content)) {
      rows.push({ text: row, line: lineOf(row) ?? 0 });
    }
  });

  if (!rows.length) rows.push(...extractByBraces(source, lineOf));
  return rows;
}

/** A fallback that finds the environments with the text alone. */
function extractByBraces(
  source: string,
  lineOf: (text: string) => number | undefined,
): Array<{ text: string; line: number }> {
  const rows: Array<{ text: string; line: number }> = [];
  const pattern = /\\begin\{(align\*?|aligned|gather\*?|split|equation\*?|eqnarray\*?|multline\*?|displaymath|array)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const name = match[1];
    const end = source.indexOf(`\\end{${name}}`, match.index);
    const content = source.slice(match.index + match[0].length, end < 0 ? source.length : end);
    for (const row of splitRows(content)) rows.push({ text: row, line: lineOf(row) ?? 0 });
  }
  return rows;
}

/** The line a piece of text starts on, one based. */
function lineNumbers(source: string): (text: string) => number | undefined {
  const lines = source.split('\n');
  const starts: Array<{ at: number; text: string }> = [];
  let at = 0;
  for (const line of lines) {
    starts.push({ at, text: line });
    at += line.length + 1;
  }
  return (text: string) => {
    // the row has been normalised, so the search ignores the white space
    const probe = text.replace(/[\s&]/g, '').slice(0, 24);
    if (!probe) return undefined;
    for (const line of starts) {
      if (line.text.replace(/[\s&]/g, '').includes(probe)) {
        return source.slice(0, line.at).split('\n').length;
      }
    }
    return undefined;
  };
}

/** Splits the content of an environment into its rows. */
export function splitRows(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('\\begin{', i)) {
      depth++;
      current += text.slice(i, i + 7);
      i += 7;
      continue;
    }
    if (text.startsWith('\\end{', i)) {
      depth--;
      current += text.slice(i, i + 5);
      i += 5;
      continue;
    }
    if (text.startsWith('\\\\', i) && depth === 0) {
      out.push(current);
      current = '';
      i += 2;
      continue;
    }
    current += text[i];
    i++;
  }
  if (current.trim()) out.push(current);
  return out
    .map((row) =>
      row
        .replace(/&/g, ' ')
        .replace(/\\nonumber|\\notag/g, '')
        .replace(/\\label\{[^}]*\}/g, '')
        .replace(/\\tag\{[^}]*\}/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

/** The math blocks of a Markdown file. */
function extractMarkdown(source: string): Array<{ text: string; line: number }> {
  const rows: Array<{ text: string; line: number }> = [];
  const lines = source.split('\n');
  let inMath = false;
  let buffer: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inMath && line.includes('$$')) {
      inMath = true;
      buffer = [];
      startLine = i + 1;
      const after = line.slice(line.indexOf('$$') + 2);
      if (after.includes('$$')) {
        inMath = false;
        for (const row of splitRows(line.replace(/\$\$/g, ' '))) rows.push({ text: row, line: i + 1 });
      }
      continue;
    }
    if (inMath) {
      if (line.includes('$$')) {
        inMath = false;
        for (const row of splitRows(buffer.join('\n'))) rows.push({ text: row, line: startLine });
        buffer = [];
        continue;
      }
      buffer.push(line);
    }
  }
  return rows;
}

/** The "where ..." declarations of a document. */
function harvestProse(source: string): string[] {
  const found: string[] = [];
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%')) continue;
    const match = trimmed.match(/\bwhere\b\s*([\s\S]+)$/i);
    if (!match) continue;
    for (const piece of match[1].split(/[,;]\s*(?=[A-Za-z\\])/)) {
      const text = piece.trim();
      if (/\\in\s*\\mathbb|\\succ|\\succeq|\\sim|:/.test(text)) found.push(text);
    }
  }
  return found;
}
