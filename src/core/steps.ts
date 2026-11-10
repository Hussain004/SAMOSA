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

/** The environments whose text is never mathematics. */
const VERBATIM_ENVS = new Set(['verbatim', 'verbatim*', 'lstlisting', 'minted', 'comment', 'filecontents']);

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
      if (MATH_ENVS.has(envName) || ROW_GROUP_ENVS.has(envName)) {
        // a math environment, or a row group outside any math region:
        // a standalone `gathered` is math, wherever it sits, and its lines
        // are claims of their own. Nested inside another region it never
        // reaches here, and the other region's rows stay untouched.
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
      if (VERBATIM_ENVS.has(envName)) {
        // code and comments are never mathematics, even when they hold a $$
        flushProse(src.slice(contentStart, contentEnd));
        i = endIdx >= 0 ? endIdx + 1 : len;
        continue;
      }
      // a non math environment (the document, a proof, a figure) is read
      // inside: the mathematics of a paper lives in them. Stepping over the
      // whole body sent every paper to the line by line fallback, which cut
      // an align row that spans two lines in half
      flushProse(src.slice(next, contentStart));
      i = contentStart;
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
        // the env name and its closing brace are not mathematics: step
        // past them, or the stray brace is counted as a group and every
        // row after a block matrix that carries braces never splits
        const closeBrace = content.indexOf('}', i);
        i = closeBrace >= 0 ? closeBrace + 1 : i + 7;
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
        const closeBrace = content.indexOf('}', i);
        i = closeBrace >= 0 ? closeBrace + 1 : i + 5;
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
        if (envDepth === 0 && (braceDepth === 0 || bracesStayOpen(content, i, braceDepth))) {
          // a group that never closes recovers here: one unclosed `{` does
          // not swallow the rest of the derivation into one unreadable row
          // (review 5.9)
          braceDepth = 0;
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

/**
 * Whether the braces open at this separator stay open past the next one.
 *
 * A group that closes before the next `\\` owns the separator, the way
 * `\substack{a \\ b}` does. A group that does not close is an unclosed `{`,
 * and the row recovers at the separator instead of swallowing the rest of
 * the derivation (review 5.9).
 */
function bracesStayOpen(content: string, at: number, depth: number): boolean {
  let d = depth;
  for (let j = at + 2; j < content.length; j++) {
    const ch = content[j];
    if (ch === '\\') {
      if (content[j + 1] === '\\') return true;
      j++;
      continue;
    }
    if (ch === '{') d++;
    else if (ch === '}') {
      d--;
      if (d <= 0) return false;
    }
  }
  return true;
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

/** A symbol in the papers: plain, or with an accent command. */
const SYM_SRC = String.raw`(?:\\[A-Za-z][A-Za-z0-9]*(?:\{[A-Za-z0-9_]+\}|_[A-Za-z0-9]+)?|[A-Za-z][A-Za-z0-9_]*)`;

/** A declaration read from prose, with where it came from. */
export interface HarvestedDecl {
  /** the declaration, in the compact syntax */
  decl: string;
  /** the name it declares */
  name: string;
  /** the line the sentence came from, 1 based */
  line: number;
  /** the sentence, for the chip */
  sentence: string;
}

/** The adjectives and what they declare, longest name first. */
const ADJECTIVES: Array<[RegExp, string]> = [
  [/symmetric positive definite/i, 'spd'],
  [/symmetric positive semidefinite/i, 'psd'],
  [/symmetric/i, 'sym'],
  [/positive semidefinite/i, 'psd'],
  [/positive definite/i, 'spd'],
  [/orthogonal/i, 'orth'],
  [/diagonal/i, 'diag'],
  [/skew[- ]symmetric/i, 'skew'],
  [/idempotent/i, 'idem'],
  [/projection/i, 'proj'],
  [/stochastic/i, 'stoch'],
];

/** Reads the sizes out of a \\mathbb{R} notation, in canonical order. */
function sizeOf(dim: string): string | null {
  const t = dim.replace(/\s/g, '').replace(/\\times/g, 'x');
  const m = t.match(/^([0-9a-zA-Z]+)x([0-9a-zA-Z]+)$/);
  if (m) {
    if (/^[0-9a-zA-Z]+$/.test(m[1]) && /^[0-9a-zA-Z]+$/.test(m[2])) return `${m[1]}×${m[2]}`;
    return null;
  }
  if (/^[0-9a-zA-Z]+$/.test(t)) return t;
  return null;
}

/**
 * Harvests declarations written in prose, such as "where A ∈ R^{n×n}".
 *
 * Real papers write the declaration in words, in the surrounding sentence,
 * and not in a where clause. The trigger is any of the usual words, the
 * inline math is lifted out before matching, and the adjectives are read
 * the way a person reads them: "symmetric positive definite $\\Sigma$"
 * is one declaration.
 */
export function harvestProseDeclsDetailed(proseLines: Array<{ line: number; text: string }>): HarvestedDecl[] {
  const found: HarvestedDecl[] = [];
  const push = (decl: string, name: string, line: number, sentence: string): void => {
    if (found.some((f) => f.name === name)) return;
    found.push({ decl, name, line, sentence });
  };
  for (const { line, text } of proseLines) {
    const trigger = text.match(/\b(where|let|given|for|with|suppose|assume|denote|consider)\b([\s\S]*)$/i);
    if (!trigger) continue;
    const rest = trigger[2] ?? '';
    const sentence = text.trim();
    // the inline math the sentence carries
    const maths: Array<{ text: string; from: number }> = [];
    for (const pattern of [/\$([^$]+)\$/g, /\\\(([^)]+)\\\)/g]) {
      for (const m of rest.matchAll(pattern)) {
        maths.push({ text: m[1].trim(), from: m.index ?? 0 });
      }
    }
    for (const math of maths) {
      // $A \\in \\mathbb{R}^{n\\times n}$ or $A \\in \\mathbb{R}^M$
      // the assignment form: $\mathbf{v} = \dots \in \mathbb{R}^M$ — the subject is the first symbol
      const assignMatch = math.text.match(new RegExp(`^(${SYM_SRC})\\s*=[\\s\\S]*?\\\\in\\s*\\\\mathbb\\{R\\}\\^\\s*\\{?\\s*([0-9a-zA-Z]+(?:\\s*\\\\times\\s*[0-9a-zA-Z]+)?)\\s*\\}?`));
      const inMatch = assignMatch ?? math.text.match(new RegExp(`(${SYM_SRC})\\s*\\\\in\\s*\\\\mathbb\\{R\\}\\^\\s*\\{?\\s*([0-9a-zA-Z]+(?:\\s*\\\\times\\s*[0-9a-zA-Z]+)?)\\s*\\}?`));
      if (inMatch) {
        const size = sizeOf(inMatch[2]);
        if (size) {
          push(`${inMatch[1]}: ${size}`, inMatch[1], line, sentence);
          continue;
        }
      }
      // $B \\sim \\mathcal{N}(\\mu, \\Sigma)$
      const simMatch = math.text.match(new RegExp(`(${SYM_SRC})\\s*\\\\sim\\s*\\\\mathcal\\{N\\}\\(([^)]*)\\)`));
      if (simMatch) {
        push(`${simMatch[1]} ~ N(${simMatch[2]})`, simMatch[1], line, sentence);
        continue;
      }
      // $\\Sigma \\succ 0$ or $\\Sigma \\succeq 0$
      const succMatch = math.text.match(new RegExp(`(${SYM_SRC})\\s*\\\\succ(?:eq)?\\s*0`));
      if (succMatch) {
        push(`${succMatch[1]}: spd n`, succMatch[1], line, sentence);
        continue;
      }
    }
    // the adjectives in the prose, attached to the next symbol in math
    const adjMatches = [...rest.matchAll(new RegExp(`([A-Za-z][A-Za-z ]+?)\\s*\\$(${SYM_SRC})\\$`, 'g'))];
    for (const m of adjMatches) {
      for (const [pattern, prop] of ADJECTIVES) {
        if (pattern.test(m[1])) {
          push(`${m[2]}: ${prop} n`, m[2], line, sentence);
          break;
        }
      }
    }
    // a symbol all by itself in math, with an adjective anywhere in the sentence
    if (!found.some((f) => f.line === line)) {
      for (const [pattern, prop] of ADJECTIVES) {
        if (!pattern.test(rest)) continue;
        for (const math of maths) {
          const bare = math.text.match(new RegExp(`^(${SYM_SRC})$`));
          if (bare) {
            push(`${bare[1]}: ${prop} n`, bare[1], line, sentence);
            break;
          }
        }
      }
    }
  }
  return found;
}

/** Harvests declarations written in prose, such as "where A ∈ R^{n×n}". */
export function harvestProseDecls(prose: string[]): string[] {
  return harvestProseDeclsDetailed(prose.map((text) => ({ line: 0, text }))).map((h) => h.decl);
}

/**
 * The declarations that live around the mathematics, not inside it: the
 * `% samosa:` comments and the where lines (review 4.7).
 *
 * Every caller passes the raw source, so the checker itself reads these:
 * the CLI, the MCP server and the app all see the same declarations.
 */
/** The harvested declarations, with their origin for the chips. */
export interface HarvestResult {
  /** the declarations, in the compact syntax */
  decls: string[];
  /** the declarations that came from prose, with the line they came from */
  fromProse: HarvestedDecl[];
}

export function harvestDeclsDetailed(src: string): HarvestResult {
  const comments: string[] = [];
  const proseLines: Array<{ line: number; text: string }> = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const comment = trimmed.match(/%\s*samosa:\s*(.+)$/);
    if (comment) {
      comments.push(comment[1].trim());
      continue;
    }
    if (!trimmed || trimmed.startsWith('%')) continue;
    if (/\b(where|let|given|for|with|suppose|assume|denote|consider)\b/i.test(trimmed)) {
      proseLines.push({ line: i + 1, text: trimmed });
    }
  }
  const detailed = harvestProseDeclsDetailed(proseLines);
  return { decls: [...comments, ...detailed.map((d) => d.decl)], fromProse: detailed };
}

export function harvestDecls(src: string): string[] {
  return harvestDeclsDetailed(src).decls;
}

/** The span of a row inside the source. */

/** The span of a row inside the source. */
export function rowSpan(row: SourceRow): Span {
  return { from: row.from, to: row.to };
}
