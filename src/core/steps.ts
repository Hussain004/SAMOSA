import type { Span } from './ir.ts';

/**
 * Splitting a document into rows.
 *
 * The input can be a LaTeX document with align blocks, a Markdown file with
 * $$ blocks, or a bare paste of LaTeX rows. In every case the result is the
 * same: a list of rows, each with the offsets of its source text.
 *
 * Alignment markers are blanked out with spaces rather than removed, so the
 * offsets of every row still point at the original text.
 */

export interface SourceRow {
  /** the cleaned row text */
  text: string;
  /** offsets into the original source */
  from: number;
  to: number;
  /** where the row came from, for messages */
  where: string;
}

const MATH_ENVS = new Set([
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
  'flalign',
  'flalign*',
]);

/**
 * The matrix environments. They are mathematics too, but unlike the math
 * environments above they are a value inside a row, not a region of rows:
 * a block matrix sits in the middle of a claim (review 4.3). When the
 * splitter meets one it steps over it and leaves it in the row text.
 */
const MATRIX_ENVS = new Set([
  'matrix',
  'bmatrix',
  'pmatrix',
  'vmatrix',
  'Bmatrix',
  'Vmatrix',
  'smallmatrix',
  'cases',
]);

export function splitRows(src: string): SourceRow[] {
  const rows: SourceRow[] = [];
  const prose: string[] = [];
  let i = 0;
  const len = src.length;

  const flushProse = (text: string) => {
    const t = text.trim();
    if (t) prose.push(t);
  };

  while (i < len) {
    const ifIdx = nextOutsideComment(src, '\\iffalse', i);
    const beginIdx = nextOutsideComment(src, '\\begin{', i);
    const dollarIdx = nextOutsideComment(src, '$$', i);
    const bracketIdx = nextOutsideComment(src, '\\[', i);

    const candidates = [ifIdx, beginIdx, dollarIdx, bracketIdx].filter((v) => v >= 0);
    if (!candidates.length) {
      flushProse(src.slice(i));
      break;
    }
    const next = Math.min(...candidates);
    flushProse(src.slice(i, next));

    if (next === ifIdx) {
      // a conditional that is false: TeX skips its text without reading it,
      // so the checker does the same (review 5.2)
      const fi = endOfFalse(src, ifIdx);
      i = fi >= 0 ? fi : len;
      continue;
    }

    if (next === beginIdx) {
      const env = readEnvName(src, beginIdx + 6);
      if (!env) {
        flushProse(src.slice(next, next + 7));
        i = next + 7;
        continue;
      }
      const envName = env.name;
      const endIdx = findEnvEnd(src, beginIdx, envName);
      const contentStart = env.next;
      const contentEnd = endIdx >= 0 ? endIdx : len;
      if (MATH_ENVS.has(envName)) {
        rows.push(...splitMathContent(src, contentStart, contentEnd, `${envName}@${beginIdx}`));
        i = endIdx >= 0 ? endIdx + 1 : len;
        continue;
      }
      if (MATRIX_ENVS.has(envName)) {
        // a block matrix is a value inside a row (review 4.3): step over it
        // and let the bare paste of rows read the line it sits in
        i = endIdx >= 0 ? endIdx + envName.length + 6 : len;
        continue;
      }
      // a non math environment (a table, a figure): its content is prose
      flushProse(src.slice(contentStart, contentEnd));
      i = endIdx >= 0 ? endIdx + 1 : len;
      continue;
    }

    if (next === dollarIdx) {
      const end = nextOutsideComment(src, '$$', dollarIdx + 2);
      const contentStart = dollarIdx + 2;
      const contentEnd = end >= 0 ? end : len;
      rows.push(...splitMathContent(src, contentStart, contentEnd, `$$@${dollarIdx}`));
      i = end >= 0 ? end + 2 : len;
      continue;
    }

    // \[
    const end = nextOutsideComment(src, '\\]', bracketIdx + 2);
    const contentStart = bracketIdx + 2;
    const contentEnd = end >= 0 ? end : len;
    rows.push(...splitMathContent(src, contentStart, contentEnd, `\\[@${bracketIdx}`));
    i = end >= 0 ? end + 2 : len;
  }

  if (!rows.length) {
    // a bare paste of rows
    let offset = 0;
    for (const line of src.split('\n')) {
      const trimmed = line.trim();
      // a line may open with a block matrix, which is a value of the row
      // (review 4.3); any other environment opening is a region already read
      const envStart = /^\\begin\{([^}]+)\}/.exec(trimmed);
      const opensMatrix = envStart !== null && MATRIX_ENVS.has(envStart[1]);
      if (trimmed && !trimmed.startsWith('%') && (!trimmed.startsWith('\\begin{') || opensMatrix) && !trimmed.startsWith('\\end{')) {
        const from = offset + line.indexOf(trimmed);
        rows.push({ text: cleanRow(line), from, to: from + trimmed.length, where: 'line' });
      }
      offset += line.length + 1;
    }
  }

  return rows;
}

function readEnvName(src: string, i: number): { name: string; next: number } | null {
  if (src[i] !== '{') return null;
  const end = src.indexOf('}', i);
  if (end < 0) return null;
  return { name: src.slice(i + 1, end), next: end + 1 };
}

/**
 * True when the character at `at` sits in a `%` comment of its line.
 *
 * A percent that an odd number of backslashes precedes is the escaped
 * percent, not the start of a comment.
 */
function inComment(src: string, at: number): boolean {
  const lineStart = src.lastIndexOf('\n', at - 1) + 1;
  for (let j = lineStart; j < at; j++) {
    if (src[j] !== '%') continue;
    let slashes = 0;
    for (let k = j - 1; k >= lineStart && src[k] === '\\'; k--) slashes++;
    if (slashes % 2 === 0) return true;
  }
  return false;
}

/** The next occurrence of a marker that is not inside a comment. */
function nextOutsideComment(src: string, marker: string, from: number): number {
  let at = src.indexOf(marker, from);
  while (at >= 0 && inComment(src, at)) at = src.indexOf(marker, at + 1);
  return at;
}

/** The conditional words that open a TeX skipping region. */
const IF_WORDS = new Set([
  'if', 'iftrue', 'iffalse', 'ifcase', 'ifx', 'ifnum', 'ifdim', 'ifodd',
  'ifhmode', 'ifvmode', 'ifmmode', 'ifinner', 'ifvoid', 'ifhbox', 'ifvbox',
  'ifeof', 'ifdefined', 'ifcsname', 'ifincsname', 'ifprimitive', 'iffontchar',
]);

/**
 * The index just past the `\fi` that closes the `\iffalse` opened at `at`,
 * or -1 when the conditional is never closed.
 */
function endOfFalse(src: string, at: number): number {
  let depth = 1;
  let i = at + 8;
  while (i < src.length) {
    if (src[i] !== '\\') {
      i += 1;
      continue;
    }
    const word = /^\\([a-zA-Z]+)/.exec(src.slice(i, i + 40));
    if (!word) {
      i += 2;
      continue;
    }
    const name = word[1];
    if (name === 'fi') {
      depth--;
      if (depth === 0) return i + word[0].length;
    } else if (IF_WORDS.has(name)) {
      depth++;
    }
    i += word[0].length;
  }
  return -1;
}

function findEnvEnd(src: string, start: number, envName: string): number {
  let depth = 1;
  let i = start + 1;
  const open = `\\begin{${envName}}`;
  const close = `\\end{${envName}}`;
  while (i < src.length) {
    const openIdx = nextOutsideComment(src, open, i);
    const closeIdx = nextOutsideComment(src, close, i);
    if (closeIdx < 0) return -1;
    if (openIdx >= 0 && openIdx < closeIdx) {
      depth++;
      i = openIdx + open.length;
      continue;
    }
    depth--;
    if (depth === 0) return closeIdx;
    i = closeIdx + close.length;
  }
  return -1;
}

/**
 * The row groups. Inside a math region they only wrap rows: their markers
 * carry no mathematics of their own, and their backslash backslash still
 * separates the rows of the region. An `aligned` inside an `equation` is
 * the common shape (review 5.2).
 */
const ROW_GROUP_ENVS = new Set(['aligned', 'gathered', 'split']);

/**
 * Splits the content of a math region into rows.
 *
 * Rows are separated by \\ at brace depth zero and outside any nested
 * environment. Inside a row, the top level alignment markers are blanked.
 */
function splitMathContent(src: string, from: number, to: number, where: string): SourceRow[] {
  const rows: SourceRow[] = [];
  const content = src.slice(from, to);
  let braceDepth = 0;
  let envDepth = 0;
  let rowStart = 0;
  const chars = content.split('');

  for (let i = 0; i < content.length; i++) {
    const ch = chars[i];
    if (ch === '\\') {
      const next = chars.slice(i, i + 8).join('');
      if (next.startsWith('\\begin{')) {
        const name = readEnvName(content, i + 6)?.name;
        const open = `\\begin{${name}}`;
        if (name && ROW_GROUP_ENVS.has(name)) {
          // the markers of a row group are not part of the rows
          for (let j = i; j < i + open.length && j < content.length; j++) chars[j] = ' ';
          i += open.length - 1;
          continue;
        }
        envDepth++;
        i += 7;
        continue;
      }
      if (next.startsWith('\\end{')) {
        const name = readEnvName(content, i + 4)?.name;
        const close = `\\end{${name}}`;
        if (name && ROW_GROUP_ENVS.has(name)) {
          for (let j = i; j < i + close.length && j < content.length; j++) chars[j] = ' ';
          i += close.length - 1;
          continue;
        }
        envDepth = Math.max(0, envDepth - 1);
        i += 5;
        continue;
      }
      if (next.startsWith('\\iffalse')) {
        // the conditional text is not part of the rows: it is blanked, and
        // the offsets stay where they were
        const fi = endOfFalse(content, i);
        const stop = fi >= 0 ? fi : content.length;
        for (let j = i; j < stop; j++) chars[j] = ' ';
        i = stop - 1;
        continue;
      }
      if (next.startsWith('\\\\')) {
        if (braceDepth === 0 && envDepth === 0) {
          const seg = chars.slice(rowStart, i).join('');
          pushRow(rows, seg, from + rowStart, where);
          rowStart = i + 2;
          i += 1;
          continue;
        }
        i += 1;
        continue;
      }
      if (next.startsWith('\\label{') || next.startsWith('\\tag{')) {
        const end = content.indexOf('}', i);
        if (end > 0) {
          for (let j = i; j < end; j++) chars[j] = ' ';
          i = end;
          continue;
        }
      }
      i += 1;
      continue;
    }
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '&' && braceDepth === 0 && envDepth === 0) {
      chars[i] = ' ';
    }
  }
  const seg = chars.slice(rowStart).join('');
  pushRow(rows, seg, from + rowStart, where);
  return rows;
}

function pushRow(rows: SourceRow[], segment: string, offset: number, where: string) {
  const text = cleanRow(segment);
  if (!text.trim()) return;
  const lead = segment.length - segment.trimStart().length;
  const from = offset + lead;
  rows.push({ text, from, to: from + text.trimEnd().length, where });
}

/** Removes the noise that carries no mathematical content. */
function cleanRow(text: string): string {
  return text
    .replace(/\\nonumber\b/g, '')
    .replace(/\\notag\b/g, '')
    // a row separator that ended the line, which happens when the rows are
    // pasted without an environment around them
    .replace(/\\\\\s*$/, '')
    .trim();
}

/** The prose of a document, used to harvest "where ..." declarations. */
export function extractProse(src: string): string[] {
  const out: string[] = [];
  const lines = src.split('\n');
  let inMath = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.includes('\\begin{') || t.includes('\\end{')) {
      inMath = !t.includes('\\end{');
      continue;
    }
    if (inMath) continue;
    if (t.startsWith('%')) continue;
    if (t.includes('$$') || t.includes('\\[') || t.includes('\\]')) continue;
    out.push(t);
  }
  return out;
}

/** Harvests declarations written in prose, such as "where A ∈ R^{n×n}". */
export function harvestProseDecls(prose: string[]): string[] {
  const found: string[] = [];
  for (const line of prose) {
    const m = line.match(/\bwhere\b\s*([\s\S]+)$/i);
    if (!m) continue;
    const rest = m[1];
    for (const piece of rest.split(/[,;]\s*(?=[A-Za-z\\])/)) {
      const t = piece.trim();
      if (!t) continue;
      if (/\\in\s*\\mathbb|\\succ|\\succeq|\\sim|\\top\s*\w*\s*=|:/.test(t)) {
        found.push(t);
      }
    }
  }
  return found;
}

/**
 * The declarations that live around the mathematics, not inside it: the
 * `% samosa:` comments and the where lines (review 4.7).
 *
 * Every caller passes the raw source, so the checker itself reads these:
 * the CLI, the MCP server and the app all see the same declarations.
 */
export function harvestDecls(src: string): string[] {
  const comments: string[] = [];
  const whereLines: string[] = [];
  for (const line of src.split('\n')) {
    const trimmed = line.trim();
    const comment = trimmed.match(/%\s*samosa:\s*(.+)$/);
    if (comment) {
      comments.push(comment[1].trim());
      continue;
    }
    if (!trimmed || trimmed.startsWith('%')) continue;
    if (/\bwhere\b/i.test(trimmed)) whereLines.push(trimmed);
  }
  return [...comments, ...harvestProseDecls(whereLines)];
}

/** The span of a row inside the source. */
export function rowSpan(row: SourceRow): Span {
  return { from: row.from, to: row.to };
}
