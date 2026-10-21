import { foldUnicode } from './notation.ts';

/**
 * The tokenizer.
 *
 * We write our own instead of using unified-latex because we need exact
 * sub-expression spans (for the squiggles and the quick fixes) and because
 * `\hat` does not take its argument the way a generic macro parser expects.
 * The spike `spikes/parse_probe.mjs` documents what went wrong with the
 * off-the-shelf option.
 *
 * Every token carries the UTF-16 offsets of its source text.
 */

export type TokenType =
  | 'num'
  | 'ident'
  | 'cmd'
  | 'csym'
  | 'lbrace'
  | 'rbrace'
  | 'lparen'
  | 'rparen'
  | 'lbrack'
  | 'rbrack'
  | 'sup'
  | 'sub'
  | 'amp'
  | 'nl'
  | 'comma'
  | 'semi'
  | 'op'
  | 'text'
  | 'begin'
  | 'end'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  from: number;
  to: number;
}

export class LexError extends Error {
  readonly from: number;
  readonly to: number;

  constructor(message: string, from: number, to: number) {
    super(message);
    this.from = from;
    this.to = to;
  }
}

/** Commands that carry no meaning for the parser and are simply dropped. */
const DROP_COMMANDS = new Set([
  'displaystyle',
  'textstyle',
  'scriptstyle',
  'limits',
  'nolimits',
  'left',
  'right',
  'big',
  'Big',
  'bigg',
  'Bigg',
  'bigl',
  'bigr',
  'Bigl',
  'Bigr',
  'mathstrut',
  'phantom',
  'vphantom',
  'hphantom',
  'medspace',
  'thinspace',
  'negthinspace',
  'thickspace',
  'nobreak',
  'allowbreak',
  'protect',
  'ensuremath',
  'newcommand',
  'renewcommand',
  'DeclareMathOperator',
  'def',
  'let',
]);

/** Spacing commands that are dropped outright. */
const SPACE_COMMANDS = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad', 'thinspace', 'negthinspace', 'medspace', 'thickspace', 'enspace', 'hfill']);

const OPERATOR_CHARS = '+-*/=<>!:';

export function tokenize(src: string): Token[] {
  const text = foldUnicode(src);
  const tokens: Token[] = [];
  let i = 0;
  const n = text.length;

  const push = (type: TokenType, value: string, from: number, to: number) => {
    tokens.push({ type, value, from, to });
  };

  while (i < n) {
    const ch = text[i];

    // whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // comments
    if (ch === '%') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }

    // backslash commands
    if (ch === '\\') {
      const start = i;
      i++;
      if (i >= n) {
        push('csym', '\\', start, i);
        break;
      }
      const c = text[i];
      if (/[A-Za-z]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z]/.test(text[j])) j++;
        const name = text.slice(i, j);
        i = j;
        // \begin{env} / \end{env}
        if (name === 'begin' || name === 'end') {
          const env = readBracedName(text, i);
          if (env) {
            i = env.next;
            push(name === 'begin' ? 'begin' : 'end', env.name, start, i);
            continue;
          }
        }
        if (SPACE_COMMANDS.has(name)) {
          // spacing commands swallow the following space
          continue;
        }
        if (DROP_COMMANDS.has(name)) {
          continue;
        }
        push('cmd', name, start, i);
        continue;
      }
      // control symbol: a single character, except for the row break \\
      const sym = text[i];
      i += 1;
      if (sym === '\\') {
        // \\ is the row separator
        if (text[i] === '\\') i += 1;
        push('nl', '\\\\', start, i);
        continue;
      }
      if (sym === '{' || sym === '}') {
        push(sym === '{' ? 'lbrace' : 'rbrace', sym, start, i);
        continue;
      }
      // spacing commands carry no meaning
      if (sym === ',' || sym === ';' || sym === ':' || sym === '!' || sym === ' ') continue;
      // \| is the norm, | is the absolute value or the determinant
      push('csym', sym === '|' ? '\\|' : sym, start, i);
      continue;
    }

    // braces and delimiters
    if (ch === '{') {
      push('lbrace', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === '}') {
      push('rbrace', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === '(') {
      push('lparen', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === ')') {
      push('rparen', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === '[') {
      push('lbrack', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === ']') {
      push('rbrack', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === '^') {
      push('sup', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === '_') {
      push('sub', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === '&') {
      push('amp', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === ',') {
      push('comma', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === ';') {
      push('semi', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === "'") {
      push('csym', "'", i, i + 1);
      i++;
      continue;
    }
    if (OPERATOR_CHARS.includes(ch)) {
      push('op', ch, i, i + 1);
      i++;
      continue;
    }
    if (ch === '|') {
      push('csym', '|', i, i + 1);
      i++;
      continue;
    }

    // numbers
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(text[i + 1] ?? ''))) {
      let j = i;
      while (j < n && /[0-9]/.test(text[j])) j++;
      if (text[j] === '.') {
        j++;
        while (j < n && /[0-9]/.test(text[j])) j++;
      }
      push('num', text.slice(i, j), i, j);
      i = j;
      continue;
    }

    // identifiers (letters, possibly several)
    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9]/.test(text[j])) j++;
      push('ident', text.slice(i, j), i, j);
      i = j;
      continue;
    }

    // anything else: keep it as an operator-ish token so the parser can report it
    push('op', ch, i, i + 1);
    i++;
  }

  push('eof', '', n, n);
  return tokens;
}

function readBracedName(text: string, i: number): { name: string; next: number } | null {
  let j = i;
  while (j < text.length && /\s/.test(text[j])) j++;
  if (text[j] !== '{') return null;
  const end = text.indexOf('}', j);
  if (end < 0) return null;
  return { name: text.slice(j + 1, end), next: end + 1 };
}

/**
 * Renders tokens back to LaTeX.
 *
 * The parser needs the raw LaTeX of a group (for a subscript, or for the base
 * of an accent) and the token values alone would lose the backslash of a
 * command such as \Sigma. A space is inserted where two tokens would
 * otherwise merge into a different token, such as \partial and J.
 */
export function renderTokens(tokens: Token[]): string {
  let out = '';
  let prev: Token | null = null;
  for (const t of tokens) {
    const piece = renderToken(t);
    if (prev && needsSpace(prev, t)) out += ' ';
    out += piece;
    prev = t;
  }
  return out;
}

function needsSpace(prev: Token, next: Token): boolean {
  const prevWord = prev.type === 'ident' || prev.type === 'cmd';
  const nextWord = next.type === 'ident' || next.type === 'cmd';
  if (!prevWord || !nextWord) return false;
  // \bar\Sigma stays as it is, \partial J needs the space
  if (prev.type === 'cmd' && next.type === 'cmd') return false;
  return true;
}

function renderToken(t: Token): string {
  switch (t.type) {
    case 'cmd':
      return `\\${t.value}`;
    case 'csym':
      return t.value;
    case 'lbrace':
      return '{';
    case 'rbrace':
      return '}';
    case 'sup':
      return '^';
    case 'sub':
      return '_';
    case 'amp':
      return '&';
    case 'nl':
      return '\\\\';
    case 'eof':
      return '';
    default:
      return t.value;
  }
}
