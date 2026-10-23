import { renderTokens, tokenize, type Token } from './lex.ts';
import { ACCENTS, GREEK, GLYPH_ACCENTS, toDisplay } from './notation.ts';
import { ratFromDecimal } from './rational.ts';
import { ParseFailure, type Assertion, type Node, type Op, type ParsedRow, type Relation, type RowPart, type Span } from './ir.ts';

/**
 * The parser: a Pratt parser over the tokens produced by lex.ts.
 *
 * Precedence, highest first:
 *
 *   1. postfix: ^ _ ' !
 *   2. prefix: unary minus, \nabla, \partial, and the expectation operators
 *   3. juxtaposition and \cdot \times \otimes \odot \oslash
 *   4. /, which binds looser than juxtaposition, so a/bc means a/(bc)
 *   5. + and -
 *   6. relations, handled at the row level
 */

export interface ParseOptions {
  /** names that are functions, so that f(x) is an application and not a product */
  knownFns?: Set<string>;
}

export const DEFAULT_FUNCTIONS = new Set([
  'exp',
  'log',
  'ln',
  'sin',
  'cos',
  'tan',
  'tanh',
  'det',
  'tr',
  'trace',
  'sigmoid',
  'sigma',
  'relu',
  'softmax',
  'logdet',
  'norm',
  'abs',
  'sech',
  'sqrt',
  'var',
  'cov',
]);

/** Commands that name a symbol rather than an operation. */
const SYMBOL_COMMANDS = new Set([
  'imath',
  'jmath',
  'ell',
  'hbar',
  'Re',
  'Im',
  'Pr',
  'varnothing',
  'aleph',
  'wp',
]);

/** Commands that act as relations. */
const RELATION_COMMANDS: Record<string, Relation> = {
  le: 'le',
  leq: 'le',
  ge: 'ge',
  geq: 'ge',
  preceq: 'le',
  succeq: 'ge',
  approx: 'approx',
  sim: 'approx',
  simeq: 'approx',
  equiv: '=',
  neq: 'other',
  ne: 'other',
  propto: 'propto',
  coloneqq: ':=',
  Rightarrow: '=>',
  implies: '=>',
  iff: '<=>',
  Leftrightarrow: '<=>',
  to: 'other',
  mapsto: 'other',
  in: 'other',
  notin: 'other',
  subset: 'other',
  subseteq: 'other',
  supset: 'other',
  supseteq: 'other',
  models: 'other',
  indep: 'other',
  independent: 'other',
};

/** Commands that stop implicit multiplication (they are not operands). */
const NON_OPERAND_COMMANDS = new Set([
  ...Object.keys(RELATION_COMMANDS),
  'text',
  'nonumber',
  'notag',
  'label',
  'tag',
  'hline',
  'cline',
  'rangle',
]);

/** A token used past the end of a slice, so the parser always sees an end. */
const EOF_TOKEN: Token = { type: 'eof', value: '', from: 0, to: 0 };

/**
 * The functions whose double bar separates two arguments.
 *
 * In the information theory literature the double bar is a divergence, and in
 * the probability literature the vertical bar is a conditioning. Both are
 * written with a bar that looks like the one of a norm.
 */
const DIVERGENCES = new Set(['d', 'kl', 'd_kl', 'dkl', 'div', 'chi']);

/** The name without its accents: `\mathrm{KL}` is `KL`. */
function plainName(name: string): string {
  return name.replace(/^(\\[A-Za-z]+)+/, '').toLowerCase();
}

export class Parser {
  /** how far the parser has read: the tokens after it are the ones it did not use */
  pos = 0;
  /** is the next factor the first of its product? */
  private firstFactor = false;
  /** is the parser inside the arguments of a divergence? */
  private inDivergence = false;
  /** stop a product at a bar, so a call can read a condition */
  private stopAtBar = false;

  private readonly tokens: Token[];
  private readonly opts: ParseOptions;

  constructor(tokens: Token[], _src: string, opts: ParseOptions = {}) {
    this.tokens = tokens;
    this.opts = opts;
  }

  private get cur(): Token {
    return this.tokens[this.pos] ?? EOF_TOKEN;
  }

  /** The type of the current token, without narrowing the token itself. */
  private kind(): Token['type'] {
    return (this.tokens[this.pos] ?? EOF_TOKEN).type;
  }

  private expect(type: Token['type'], what: string): Token {
    if (this.kind() !== type) {
      throw new ParseFailure(`expected ${what}`, { from: this.cur.from, to: this.cur.to });
    }
    const t = this.cur;
    this.pos++;
    return t;
  }

  // ---------------------------------------------------------------- symbols

  /**
   * Does this name look like a function?
   *
   * The known functions always do. A name that starts with a lowercase letter
   * usually does, because a capital name is a matrix in this notation.
   */
  private looksLikeCall(name: string): boolean {
    if (this.isFnName(name)) return true;
    if (this.opts.knownFns?.has(name)) return true;
    if (this.firstFactor) return true;
    const first = name[0];
    return first !== undefined && /[a-z]/.test(first);
  }

  private isFnName(name: string): boolean {
    if (this.opts.knownFns?.has(name)) return true;
    return DEFAULT_FUNCTIONS.has(name);
  }

  private makeSym(accents: string[], base: string, sub: string | null, labelSup: string | null, span: Span): Node {
    const prefix = accents.map((a) => `\\${a}`).join('');
    let name = prefix + base;
    if (sub) name += `_${sub}`;
    if (labelSup) name += `^${labelSup}`;
    return { k: 'sym', name, display: toDisplay(name), span };
  }

  /** Reads the body of a braced group as raw text, for subscripts and labels. */
  private rawGroupText(): { text: string; span: Span } {
    const open = this.expect('lbrace', '{');
    const start = this.pos;
    let depth = 1;
    let end = open.to;
    while (this.pos < this.tokens.length) {
      const t = this.cur;
      if (t.type === 'lbrace') depth++;
      if (t.type === 'rbrace') {
        depth--;
        if (depth === 0) {
          end = t.to;
          this.pos++;
          break;
        }
      }
      this.pos++;
    }
    const text = renderTokens(this.tokens.slice(start, this.pos - 1)).trim();
    return { text, span: { from: open.from, to: end } };
  }

  /**
   * Reads the two halves of a fraction.
   *
   * \frac{1}{2} is the usual form, but \frac12 is also common, where the two
   * digits share one token.
   */
  private readFractionParts(): { num: { text: string; span: Span }; den: { text: string; span: Span } } {
    if (this.kind() === 'lbrace') {
      const num = this.rawGroupText();
      const den = this.readGroupOrToken();
      return { num, den };
    }
    const first = this.cur;
    if (first.type === 'num' && first.value.length >= 2) {
      this.pos++;
      const numText = first.value.slice(0, 1);
      const denText = first.value.slice(1);
      return {
        num: { text: numText, span: { from: first.from, to: first.from + 1 } },
        den: { text: denText, span: { from: first.from + 1, to: first.to } },
      };
    }
    const num = this.readGroupOrToken();
    const den = this.readGroupOrToken();
    return { num, den };
  }

  /** Reads a group, or a single token when the group is omitted (\frac12). */
  private readGroupOrToken(): { text: string; span: Span } {
    if (this.kind() === 'lbrace') return this.rawGroupText();
    const t = this.cur;
    this.pos++;
    return { text: t.type === 'cmd' ? `\\${t.value}` : t.value, span: { from: t.from, to: t.to } };
  }

  /**
   * Reads the variable of a proportionality, the subscript of \\propto.
   *
   * It returns the name of the variable and how many tokens it took, so the
   * caller can drop them from the right hand side.
   */
  readProportionalityVariable(): { name: string; tokens: number } {
    const start = this.pos;
    this.pos++; // the underscore
    const sub = this.readSubscript();
    return { name: sub.text, tokens: this.pos - start };
  }

  /** Reads a subscript, which may be a group or a single token. */
  private readSubscript(): { text: string; span: Span } {
    if (this.kind() === 'lbrace') return this.rawGroupText();
    const t = this.cur;
    this.pos++;
    return { text: t.value, span: { from: t.from, to: t.to } };
  }

  /** Reads a superscript, which may be a group or a single token. */
  private readSuperscript(): { text: string; tokens: Token[]; span: Span } {
    if (this.kind() === 'lbrace') {
      const start = this.pos;
      const { text, span } = this.rawGroupText();
      const tokens = this.tokens.slice(start + 1, this.pos - 1);
      return { text, tokens, span };
    }
    const t = this.cur;
    this.pos++;
    const text = t.type === 'cmd' ? `\\${t.value}` : t.value;
    return { text, tokens: [t], span: { from: t.from, to: t.to } };
  }

  // --------------------------------------------------------------- scripts

  /**
   * Applies the sub and superscripts of a symbol.
   *
   * A superscript can mean transpose, inverse, a power, or nothing at all
   * (a label such as the plus in P^+). Only the first three change the
   * meaning of the expression.
   */
  private applyScripts(base: Node, accents: string[], baseLatex: string): Node {
    let sub: string | null = null;
    let labelSup: string | null = null;
    let spanEnd = base.span.to;
    const scripts: Array<{ kind: 'transpose' | 'inverse' | 'inverseT' | 'power'; text?: string; to: number }> = [];

    // the scripts may come in either order, so P^\kappa_{B_R} works
    for (;;) {
      if (this.kind() === 'sub' && sub === null) {
        this.pos++;
        const s = this.readSubscript();
        sub = s.text;
        spanEnd = s.span.to;
        continue;
      }
      if (this.kind() === 'sup') {
        this.pos++;
        const sup = this.readSuperscript();
        const classified = classifySuperscript(sup.text);
        spanEnd = sup.span.to;
        if (classified.kind === 'label') {
          labelSup = sup.text;
          continue;
        }
        scripts.push({
          kind: classified.kind,
          text: classified.kind === 'power' ? classified.powerText : undefined,
          to: sup.span.to,
        });
        continue;
      }
      break;
    }

    // the symbol keeps its subscript and its label, whatever happens to the scripts
    let node: Node = base;
    if (node.k === 'sym') {
      // `p_i` and `z_j` are components of an indexed family, not a name with
      // a time step. The engine has no model of index notation, so it says so
      // instead of treating the component as a free scalar.
      const indexNotation =
        sub !== null &&
        /^[ijk]$/.test(sub.trim()) &&
        /^[A-Za-z]$/.test(baseLatex);
      node = indexNotation
        ? {
            k: 'raw',
            text: `an indexed symbol ${baseLatex}_${sub}`,
            span: { from: node.span.from, to: spanEnd },
          }
        : this.makeSym(accents, baseLatex, sub, labelSup, {
            from: node.span.from,
            to: spanEnd,
          });
    }

    for (const script of scripts) {
      const span = { from: node.span.from, to: script.to };
      if (script.kind === 'transpose') {
        node = { k: 'op', op: 'T', args: [node], span };
      } else if (script.kind === 'inverse') {
        node = { k: 'op', op: 'inv', args: [node], span };
      } else if (script.kind === 'inverseT') {
        node = { k: 'op', op: 'invT', args: [node], span };
      } else {
        const exp = { k: 'num' as const, value: ratFromDecimal(script.text ?? '2'), span: { from: node.span.from, to: script.to } };
        node = { k: 'op', op: 'pow', args: [node, exp], span };
      }
    }
    return node;
  }

  // ------------------------------------------------------------ expressions

  /** Parses a full expression at the lowest precedence level. */
  parseExpression(): Node {
    return this.parseAdditive();
  }

  private parseAdditive(): Node {
    let left = this.parseRatio();
    for (;;) {
      const t = this.cur;
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.pos++;
        const right = this.parseRatio();
        left = {
          k: 'op',
          op: t.value === '+' ? 'add' : 'sub',
          args: [left, right],
          span: { from: left.span.from, to: right.span.to },
        };
        continue;
      }
      if (t.type === 'csym' && (t.value === '+' || t.value === '-')) {
        this.pos++;
        const right = this.parseRatio();
        left = {
          k: 'op',
          op: t.value === '+' ? 'add' : 'sub',
          args: [left, right],
          span: { from: left.span.from, to: right.span.to },
        };
        continue;
      }
      return left;
    }
  }

  private parseRatio(): Node {
    let left = this.parseProduct();
    while (this.kind() === 'op' && this.cur.value === '/') {
      this.pos++;
      const right = this.parseProduct();
      left = { k: 'op', op: 'div', args: [left, right], span: { from: left.span.from, to: right.span.to } };
    }
    return left;
  }

  private parseProduct(): Node {
    // the first factor of a product may be a call, such as J(x, y)
    this.firstFactor = true;
    let left = this.parseUnary();
    this.firstFactor = false;
    for (;;) {
      const t = this.cur;
      let op: Op | null = null;
      if (t.type === 'op' && t.value === '*') op = 'mul';
      else if (t.type === 'cmd' && (t.value === 'cdot' || t.value === 'times' || t.value === 'ast' || t.value === 'circ')) op = 'mul';
      else if (t.type === 'cmd' && t.value === 'otimes') op = 'kron';
      else if (t.type === 'cmd' && t.value === 'odot') op = 'had';
      else if (t.type === 'cmd' && t.value === 'oslash') op = 'had';
      else if (t.type === 'op' && t.value === '\\') op = 'mul';

      if (op) {
        this.pos++;
        const right = this.parseUnary();
        left = { k: 'op', op, args: [left, right], span: { from: left.span.from, to: right.span.to } };
        continue;
      }

      // implicit multiplication: A B, 2x, x y
      if (this.startsOperand()) {
        const right = this.parseUnary();
        left = { k: 'op', op: 'mul', args: [left, right], span: { from: left.span.from, to: right.span.to } };
        continue;
      }
      return left;
    }
  }

  /** Can the current token start an operand? */
  private startsOperand(): boolean {
    const t = this.cur;
    switch (t.type) {
      case 'num':
      case 'ident':
      case 'lbrace':
      case 'lparen':
      case 'lbrack':
      case 'begin':
        return true;
      case 'cmd':
        return (
          !NON_OPERAND_COMMANDS.has(t.value) &&
          !['left', 'right'].includes(t.value) &&
          t.value !== 'nonumber'
        );
      // A bar can start a norm or an absolute value. The parser finds the
      // matching bar before it parses what is inside, so the closing bar is
      // never mistaken for the start of another factor. In a call, the bar
      // is a condition and has to be left for parseArgs.
      case 'op':
        // An ellipsis is a factor in a list, `(a, ..., b)`, and not an operator.
        return (
          t.value === '.' &&
          this.tokens[this.pos + 1]?.value === '.' &&
          this.tokens[this.pos + 2]?.value === '.'
        );
      case 'csym':
        if (this.stopAtBar && (t.value === '|' || t.value === '\\|')) {
          // A bar with a matching bar ahead is a norm or an absolute value,
          // not the condition of a call: `2\|x\|` is still a product.
          return this.barAhead(t.value);
        }
        return t.value !== "'";
      default:
        return false;
    }
  }

  /** Is there a matching bar ahead, so this bar opens a norm or an absolute value? */
  private barAhead(kind: string): boolean {
    let depth = 0;
    for (let i = this.pos + 1; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type === 'lparen' || t.type === 'lbrack' || t.type === 'lbrace') depth++;
      else if (t.type === 'rparen' || t.type === 'rbrack' || t.type === 'rbrace') {
        if (depth > 0) depth--;
      } else if (depth === 0 && t.type === 'csym' && t.value === kind) {
        return true;
      }
    }
    return false;
  }

  private parseUnary(): Node {
    const t = this.cur;
    if (t.type === 'op' && t.value === '-') {
      this.pos++;
      const arg = this.parseUnary();
      return { k: 'op', op: 'neg', args: [arg], span: { from: t.from, to: this.closingParen(t.to, [arg]) } };
    }
    if (t.type === 'op' && t.value === '+') {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      const t = this.cur;
      if (t.type === 'sup') {
        this.pos++;
        const sup = this.readSuperscript();
        const classified = classifySuperscript(sup.text);
        if (classified.kind === 'transpose') {
          node = { k: 'op', op: 'T', args: [node], span: { from: node.span.from, to: sup.span.to } };
        } else if (classified.kind === 'inverse') {
          node = { k: 'op', op: 'inv', args: [node], span: { from: node.span.from, to: sup.span.to } };
        } else if (classified.kind === 'inverseT') {
          node = { k: 'op', op: 'invT', args: [node], span: { from: node.span.from, to: sup.span.to } };
        } else if (classified.kind === 'power') {
          const exp = { k: 'num' as const, value: ratFromDecimal(classified.powerText), span: sup.span };
          node = { k: 'op', op: 'pow', args: [node, exp], span: { from: node.span.from, to: sup.span.to } };
        } else {
          node = {
            k: 'raw',
            text: `superscript {${sup.text}} on a non symbol`,
            span: { from: node.span.from, to: sup.span.to },
          };
        }
        continue;
      }
      if (t.type === 'sub') {
        // a subscript on something that is not a symbol is a bound index
        this.pos++;
        const sub = this.readSubscript();
        node = {
          k: 'raw',
          text: `subscript {${sub.text}} on a non symbol`,
          span: { from: node.span.from, to: sub.span.to },
        };
        continue;
      }
      if (t.type === 'csym' && t.value === "'") {
        this.pos++;
        // A prime on a matrix or vector means transpose (the econometrics
        // convention). On a scalar it is part of the name.
        if (node.k === 'sym') {
          node = this.makeSym([], node.name + "'", null, null, { from: node.span.from, to: t.to });
        } else {
          node = { k: 'op', op: 'T', args: [node], span: { from: node.span.from, to: t.to } };
        }
        continue;
      }
      if (t.type === 'op' && t.value === '!') {
        this.pos++;
        node = { k: 'op', op: 'pow', args: [node, { k: 'num' as const, value: { n: 1, d: 1 }, span: { from: t.from, to: t.to } }], span: { from: node.span.from, to: t.to } };
        continue;
      }
      return node;
    }
  }

  private parsePrimary(): Node {
    const t = this.cur;
    switch (t.type) {
      case 'num': {
        this.pos++;
        return { k: 'num' as const, value: ratFromDecimal(t.value), span: { from: t.from, to: t.to } };
      }
      case 'ident': {
        this.pos++;
        // a run of letters is a product of single letter symbols, unless it
        // names a function: "cuv^\top" is c times u times v transpose
        if (t.value.length > 1 && !this.isFnName(t.value)) {
          const parts: Node[] = [];
          for (let i = 0; i < t.value.length; i++) {
            const ch = t.value[i];
            const sym = this.makeSym([], ch, null, null, { from: t.from + i, to: t.from + i + 1 });
            // the scripts belong to the last letter of the run
            parts.push(i === t.value.length - 1 ? this.applyScripts(sym, [], ch) : sym);
          }
          return parts.reduce((a, b) => ({
            k: 'op' as const,
            op: 'mul' as const,
            args: [a, b],
            span: { from: a.span.from, to: b.span.to },
          }));
        }
        if (t.value === 'e' && this.kind() === 'sup') {
          // e^x is exp(x)
          this.pos++;
          const sup = this.readSuperscript();
          const inner = new Parser(sup.tokens, '', this.opts).parseExpression();
          return { k: 'call', fn: 'exp', args: [inner], span: { from: t.from, to: sup.span.to } };
        }
        const sym = this.makeSym([], t.value, null, null, { from: t.from, to: t.to });
        const scripted = this.applyScripts(sym, [], t.value);
        // d^2(f, g) is a function with a square on its name, not a product
        // of d squared and a group. The same shape reads H^2(...)
        const power =
          scripted.k === 'op' && scripted.op === 'pow' && scripted.args[0]?.k === 'sym' ? scripted : null;
        if (this.kind() === 'lparen' && (scripted.k === 'sym' || power) && this.looksLikeCall(t.value)) {
          // A lowercase name with parentheses is a function call, even when
          // SAMOSA does not know the function. A capital name is a matrix, so
          // A(B) is a product, the way the notation reads.
          const wasDivergence = this.inDivergence;
          this.inDivergence = DIVERGENCES.has(plainName(t.value));
          const { args, unknown } = this.parseArgs();
          this.inDivergence = wasDivergence;
          const call = this.makeCall(t.value, t.from, args, unknown);
          const exponent = power?.args[1];
          if (!exponent) return call;
          return { k: 'op', op: 'pow', args: [call, exponent], span: { from: call.span.from, to: call.span.to } };
        }
        return scripted;
      }
      case 'lparen':
        return this.parseParenthesized();
      case 'lbrace': {
        return this.parseGroupAsExpression();
      }
      case 'op':
        if (t.value === '*') {
          // a star with nothing after it, as in f^*, is a label
          if (!this.startsOperand()) {
            this.pos++;
            return { k: 'raw', text: 'a star', span: { from: t.from, to: t.to } };
          }
          this.pos++;
          const right = this.parseUnary();
          return {
            k: 'op',
            op: 'mul',
            args: [
              { k: 'num', value: { n: 1, d: 1 }, span: { from: t.from, to: t.to } },
              right,
            ],
            span: { from: t.from, to: right.span.to },
          };
        }
        if (
          t.value === '.' &&
          this.tokens[this.pos + 1]?.type === 'op' &&
          this.tokens[this.pos + 1]?.value === '.' &&
          this.tokens[this.pos + 2]?.type === 'op' &&
          this.tokens[this.pos + 2]?.value === '.'
        ) {
          const last = this.tokens[this.pos + 2];
          this.pos += 3;
          return { k: 'raw', text: 'an ellipsis', span: { from: t.from, to: last.to } };
        }
        if (t.value === '.') {
          // the evaluation bar of \left. ... \right|_{x=a}
          this.pos++;
          return { k: 'raw', text: 'an evaluation bar', span: { from: t.from, to: t.to } };
        }
        break;
      case 'lbrack':
        return this.parseBareBracket();
      case 'cmd':
        return this.parseCommand();
      case 'csym':
        if (t.value === '\\|') return this.parseNorm();
        if (t.value === '|') return this.parseBars();
        if (t.value === '\\') {
          this.pos++;
          return { k: 'raw', text: 'line break', span: { from: t.from, to: t.to } };
        }
        // An unknown control symbol, usually an author macro such as \*: it
        // is named rather than guessed at, and the row is left unchecked.
        this.pos++;
        return { k: 'raw', text: `\\${t.value}`, span: { from: t.from, to: t.to } };
      case 'begin':
        return this.parseMatrixEnv();
      default:
        break;
    }
    throw new ParseFailure(`unexpected ${describeToken(t)}`, { from: t.from, to: t.to });
  }

  /** A parenthesised expression, a tuple, or a condition. */
  private parseParenthesized(): Node {
    const open = this.expect('lparen', '(');
    return this.parseDelimited(open, 'rparen', ')');
  }

  /** A bracketed expression, a tuple, or an expectation argument. */
  private parseBracketed(): Node {
    const open = this.expect('lbrack', '[');
    return this.parseDelimited(open, 'rbrack', ']');
  }

  /** One expression inside a group, stopped before a conditional bar. */
  private parseGroupExpression(): Node {
    const was = this.stopAtBar;
    this.stopAtBar = true;
    try {
      return this.parseExpression();
    } finally {
      this.stopAtBar = was;
    }
  }

  /**
   * Reads a delimited group.
   *
   * A group can hold a list, `(a, b)`, or a condition, `(x \mid y)`. Neither
   * is an expression of its own, so both become one named unknown instead of
   * a parse error.
   */
  private parseDelimited(
    open: Token,
    closeType: 'rparen' | 'rbrack' | 'rbrace',
    closeText: string,
  ): Node {
    const condition = this.groupRelation();
    if (condition) {
      const close = this.tokens[condition.close];
      this.pos = condition.close + 1;
      return { k: 'raw', text: 'a relation inside a group', span: { from: open.from, to: close.to } };
    }
    const parts: Node[] = [];
    if (this.kind() !== closeType) {
      parts.push(this.parseGroupExpression());
      while (this.kind() === 'comma' || this.kind() === 'semi') {
        this.pos++;
        parts.push(this.parseGroupExpression());
      }
      // A bar after the first part is a condition. The product rule was told
      // to stop at it, so it is still here to be named.
      if (this.kind() === 'csym' && (this.cur.value === '|' || this.cur.value === '\\|')) {
        this.pos++;
        this.skipToClose(closeType);
        if (this.kind() === closeType) {
          const close = this.cur;
          this.pos++;
          return { k: 'raw', text: 'a relation inside a group', span: { from: open.from, to: close.to } };
        }
        return { k: 'raw', text: 'an unclosed group', span: { from: open.from, to: open.to } };
      }
    }
    // `\left\{ ... \right.` closes the visible left brace with an invisible
    // right one. The tokenizer has already dropped the invisible delimiter,
    // so the group ends at the end of the side.
    if (this.kind() === 'eof' || this.kind() === 'end') {
      const last = this.tokens[Math.max(0, this.pos - 1)] ?? open;
      return { k: 'raw', text: 'an unclosed group', span: { from: open.from, to: last.to } };
    }
    const close = this.expect(closeType, closeText);
    if (parts.length > 1) {
      return { k: 'raw', text: 'a list', span: { from: open.from, to: close.to } };
    }
    if (!parts.length) {
      return { k: 'raw', text: 'an empty group', span: { from: open.from, to: close.to } };
    }
    return { ...parts[0], span: { from: open.from, to: close.to } };
  }

  /**
   * Finds a relation inside the group that starts at the previous token.
   *
   * A condition such as `(M > \sqrt{n})` or a set such as `\{x : x = 1\}`
   * is not an expression SAMOSA can evaluate, but it is not a parse error
   * either. The whole group becomes one named unknown.
   */
  private groupRelation(): { close: number } | null {
    const open = this.tokens[this.pos - 1];
    if (!open) return null;
    const stack: Array<Token['type']> = [
      open.type === 'lparen' ? 'rparen' : open.type === 'lbrack' ? 'rbrack' : 'rbrace',
    ];
    for (let i = this.pos; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type === 'lparen') stack.push('rparen');
      else if (t.type === 'lbrack') stack.push('rbrack');
      else if (t.type === 'lbrace') stack.push('rbrace');
      else if (t.type === 'rparen' || t.type === 'rbrack' || t.type === 'rbrace') {
        if (stack[stack.length - 1] !== t.type) return null;
        stack.pop();
        if (!stack.length) {
          return findRelations(this.tokens.slice(this.pos, i)).length ? { close: i } : null;
        }
      }
    }
    return null;
  }

  private parseGroupAsExpression(): Node {
    const open = this.expect('lbrace', '{');
    return this.parseDelimited(open, 'rbrace', '}');
  }

  private parseBareBracket(): Node {
    return this.parseBracketed();
  }

  /**
   * The end of a call.
   *
   * The closing bracket is part of the call, so the span of the call has to
   * cover it: an edit over the call replaces the whole of it.
   */
  private closingParen(fallback: number, args: Node[]): number {
    const last = this.tokens[this.pos - 1];
    if (last && (last.type === 'rparen' || last.type === 'rbrack')) return last.to;
    return args.at(-1)?.span.to ?? fallback;
  }

  private parseArgs(): { args: Node[]; unknown: string | null } {
    this.expect('lparen', '(');
    const args: Node[] = [];
    let unknown: string | null = null;
    if (this.kind() !== 'rparen') {
      for (;;) {
        args.push(this.parseArgExpression());
        // P(X \neq Y) and f(x = 1): a relation inside the arguments is a
        // condition, not something the engine can evaluate. The call is
        // named and left unchecked.
        if (this.atRelation()) {
          this.skipToCloseParen();
          this.expect('rparen', ')');
          unknown ??= 'a relation inside a group';
          return { args, unknown };
        }
        if (this.kind() === 'comma' || this.kind() === 'semi') {
          this.pos++;
          continue;
        }
        // In a divergence the double bar separates the two distributions:
        // D(P||Q) is a distance, not a norm of P. The same goes for the
        // conditioning bar of a conditional expectation.
        if (this.kind() === 'csym' && this.cur.value === '\\|' && this.inDivergence) {
          this.pos++;
          args.push(this.parseArgExpression());
          if (this.kind() === 'comma' || this.kind() === 'semi') {
            this.pos++;
            continue;
          }
          break;
        }
        // p(x \mid y) and N(x \mid \mu, \Sigma): the bar is the condition,
        // and the call is not one the engine can evaluate.
        if (this.kind() === 'csym' && this.cur.value === '|') {
          this.pos++;
          unknown = 'a conditional distribution';
          args.push(this.parseArgExpression());
          if (this.atRelation()) {
            this.skipToCloseParen();
            this.expect('rparen', ')');
            return { args, unknown };
          }
          if (this.kind() === 'comma' || this.kind() === 'semi') {
            this.pos++;
            continue;
          }
          break;
        }
        break;
      }
    }
    this.expect('rparen', ')');
    return { args, unknown };
  }

  /**
   * One argument of a call.
   *
   * The bar is the separator of a conditional, so the product rule must not
   * swallow it as the start of another absolute value.
   */
  private parseArgExpression(): Node {
    const was = this.stopAtBar;
    this.stopAtBar = true;
    try {
      return this.parseExpression();
    } finally {
      this.stopAtBar = was;
    }
  }

  /** Is the next token a relation that the expression parser stopped at? */
  private atRelation(): boolean {
    const t = this.cur;
    if (t.type === 'op' && (t.value === '=' || t.value === '<' || t.value === '>' || t.value === ':')) return true;
    return t.type === 'cmd' && RELATION_COMMANDS[t.value] !== undefined;
  }

  /** Moves to the closing delimiter of the group being read. */
  private skipToClose(close: 'rparen' | 'rbrack' | 'rbrace'): void {
    let depth = 0;
    for (; this.pos < this.tokens.length; this.pos++) {
      const t = this.tokens[this.pos];
      if (t.type === 'lparen' || t.type === 'lbrack' || t.type === 'lbrace') depth++;
      else if (t.type === 'rparen' || t.type === 'rbrack' || t.type === 'rbrace') {
        if (depth === 0 && t.type === close) return;
        if (depth > 0) depth--;
      }
    }
  }

  private skipToCloseParen(): void {
    this.skipToClose('rparen');
  }

  /**
   * A call, unless its arguments hold a conditional bar. The engine has no
   * model of a conditional distribution, so the row is read and left
   * unchecked with that reason rather than guessed at.
   */
  private makeCall(fn: string, from: number, args: Node[], unknown: string | null): Node {
    const span = { from, to: this.closingParen(from, args) };
    if (unknown) return { k: 'raw', text: unknown, span };
    return { k: 'call', fn, args, span };
  }

  private parseCommand(): Node {
    const t = this.cur;
    const name = t.value;

    switch (name) {
      case 'frac':
      case 'dfrac':
      case 'tfrac': {
        this.pos++;
        const parts = this.readFractionParts();
        return this.parseFraction(parts.num, parts.den, { from: t.from, to: parts.den.span.to });
      }
      case 'sqrt': {
        this.pos++;
        // optional index
        if (this.kind() === 'lbrack') {
          this.pos++;
          this.parseExpression();
          this.expect('rbrack', ']');
        }
        const arg = this.kind() === 'lbrace' ? this.parseGroupAsExpression() : this.parsePrimary();
        return { k: 'call', fn: 'sqrt', args: [arg], span: { from: t.from, to: this.closingParen(t.to, [arg]) } };
      }
      case 'nabla': {
        this.pos++;
        return this.parseDerivativeAfterNabla(t);
      }
      case 'partial': {
        this.pos++;
        return this.parseDerivativeAfterPartial(t);
      }
      case 'sum':
      case 'prod': {
        this.pos++;
        return this.parseBigOp(t);
      }
      case 'langle':
      case 'rangle': {
        this.pos++;
        if (name === 'langle') {
          const a = this.parseExpression();
          if (this.kind() !== 'comma') {
            // an angle bracket with a single argument is not an inner product
            const close = this.expect('cmd', '\\rangle');
            return { k: 'raw', text: 'an angle bracket with one argument', span: { from: t.from, to: close.to } };
          }
          this.pos++;
          const b = this.parseExpression();
          const close = this.expect('cmd', '\\rangle');
          return { k: 'op', op: 'inner', args: [a, b], span: { from: t.from, to: close.to } };
        }
        break;
      }
      case 'mathrm':
      case 'operatorname':
      case 'mathsf':
      case 'mathtt': {
        this.pos++;
        // \operatorname* is the starred form: the limits go above and below,
        // which changes nothing about what the name means.
        if (name === 'operatorname' && this.kind() === 'op' && this.cur.value === '*') this.pos++;
        // \mathrm{d} and \mathrm d are both common
        const g =
          this.kind() === 'lbrace'
            ? this.rawGroupText()
            : (() => {
                const t = this.cur;
                this.pos++;
                return { text: t.type === 'cmd' ? `\\${t.value}` : t.value, span: { from: t.from, to: t.to } };
              })();
        const text = g.text.trim();
        if (text === 'd') {
          const arg = this.parsePrimary();
          return {
            k: 'deriv',
            f: arg,
            wrt: [],
            order: 1,
            form: 'diff',
            span: { from: t.from, to: this.closingParen(t.to, [arg]) },
          };
        }
        if (this.kind() === 'lparen') {
          const { args, unknown } = this.parseArgs();
          return this.makeCall(text.toLowerCase(), t.from, args, unknown);
        }
        const sym = this.makeSym([name], text, null, null, { from: t.from, to: g.span.to });
        const scripted = this.applyScripts(sym, [name], text);
        if (text.toLowerCase() === 'e' || text.toLowerCase() === 'var' || text.toLowerCase() === 'cov') {
          if (this.kind() === 'lbrack') {
            return this.finishExpectation({ from: t.from, to: g.span.to }, text.toLowerCase());
          }
          return scripted;
        }
        return scripted;
      }
      case 'mathbb': {
        this.pos++;
        const g =
          this.kind() === 'lbrace'
            ? this.rawGroupText()
            : (() => {
                const t = this.cur;
                this.pos++;
                return { text: t.type === 'cmd' ? `\\${t.value}` : t.value, span: { from: t.from, to: t.to } };
              })();
        const base = g.text.trim();
        const sym = this.makeSym(['mathbb'], base, null, null, { from: t.from, to: g.span.to });
        if (base === 'E' || base === 'V') {
          return this.finishExpectation({ from: t.from, to: g.span.to }, base === 'E' ? 'E' : 'Var');
        }
        // \mathbb{P}(A \mid B) is a probability, and the bar in its argument
        // makes it a conditional one, not a product of sets.
        if (base === 'P' && this.kind() === 'lparen') {
          const { args, unknown } = this.parseArgs();
          return this.makeCall('P', t.from, args, unknown);
        }
        return this.applyScripts(sym, ['mathbb'], base);
      }
      case 'det':
      case 'exp':
      case 'log':
      case 'ln':
      case 'sin':
      case 'cos':
      case 'tan':
      case 'tanh':
      case 'sigmoid':
      case 'sigma':
      case 'relu':
      case 'softmax': {
        this.pos++;
        if (name === 'sigma' && this.kind() !== 'lparen') {
          // \sigma on its own is the standard deviation
          const sym = this.makeSym([], '\\sigma', null, null, { from: t.from, to: t.to });
          return this.applyScripts(sym, [], '\\sigma');
        }
        if (this.kind() === 'lparen') {
          const { args, unknown } = this.parseArgs();
          return this.makeCall(name === 'sigma' ? 'sigmoid' : name, t.from, args, unknown);
        }
        if (this.kind() === 'lbrace') {
          const arg = this.parseGroupAsExpression();
          return { k: 'call', fn: name === 'sigma' ? 'sigmoid' : name, args: [arg], span: { from: t.from, to: this.closingParen(t.to, [arg]) } };
        }
        // \log x and \log\sigma(z): the argument is the next operand
        const nextKind = this.kind();
        if (nextKind === 'ident' || (nextKind === 'cmd' && !NON_OPERAND_COMMANDS.has(this.cur.value))) {
          const arg = this.parsePrimary();
          return {
            k: 'call',
            fn: name === 'sigma' ? 'sigmoid' : name,
            args: [arg],
            span: { from: t.from, to: this.closingParen(t.to, [arg]) },
          };
        }
        const sym = this.makeSym([], name, null, null, { from: t.from, to: t.to });
        return this.applyScripts(sym, [], name);
      }
      case 'text': {
        this.pos++;
        const g = this.rawGroupText();
        return { k: 'raw', text: g.text, span: { from: t.from, to: g.span.to } };
      }
      default:
        break;
    }

    if (GREEK.has(name) || SYMBOL_COMMANDS.has(name)) {
      this.pos++;
      const sym = this.makeSym([], `\\${name}`, null, null, { from: t.from, to: t.to });
      const scripted = this.applyScripts(sym, [], `\\${name}`);
      const power =
        scripted.k === 'op' && scripted.op === 'pow' && scripted.args[0]?.k === 'sym' ? scripted : null;
      if (this.kind() === 'lparen' && (scripted.k === 'sym' || power)) {
        const { args, unknown } = this.parseArgs();
        const call = this.makeCall(`\\${name}`, t.from, args, unknown);
        const exponent = power?.args[1];
        if (!exponent) return call;
        return { k: 'op', op: 'pow', args: [call, exponent], span: { from: call.span.from, to: call.span.to } };
      }
      return scripted;
    }

    if (ACCENTS.has(name)) {
      const accentSpan = { from: t.from, to: t.to };
      this.pos++;
      const base = this.parseAccentBase(name, accentSpan);
      if (base.k === 'sym' && this.kind() === 'lparen') {
        const density = base.name.match(/^\\mathcal([NU])$/);
        if (density) {
          const { args, unknown } = this.parseArgs();
          return this.makeCall(
            density[1] === 'N' ? 'normalDensity' : 'uniformDensity',
            base.span.from,
            args,
            unknown,
          );
        }
        // an accented lowercase name with parentheses is still a call:
        // \hat{l}(f, y) is a loss, not a product of a hat and a group.
        // A capital name stays a matrix product.
        const plain = base.name.startsWith(`\\${name}`) ? base.name.slice(name.length + 1) : plainName(base.name);
        if (this.looksLikeCall(plain)) {
          const { args, unknown } = this.parseArgs();
          return this.makeCall(base.name, base.span.from, args, unknown);
        }
      }
      return base;
    }

    if (name === 'begin') {
      return this.parseMatrixEnv();
    }

    // unknown command
    this.pos++;
    return { k: 'raw', text: `\\${name}`, span: { from: t.from, to: t.to } };
  }

  /** Reads the base of an accent: a letter, a single symbol, or a one item group. */
  private parseAccentBase(accent: string, accentSpan: Span): Node {
    let baseLatex: string;
    // the span starts at the accent, so the whole symbol is covered
    let span: Span = { from: accentSpan.from, to: accentSpan.to };
    let accents: string[] = [];

    if (this.kind() === 'ident') {
      const t = this.cur;
      this.pos++;
      baseLatex = t.value;
      span = { from: accentSpan.from, to: t.to };
    } else if (this.kind() === 'lbrace') {
      const g = this.rawGroupText();
      span = { from: accentSpan.from, to: g.span.to };
      const inner = new Parser(tokenize(g.text), g.text, this.opts);
      const node = inner.parsePrimary();
      if (node.k === 'sym') {
        baseLatex = node.name;
        span = { from: g.span.from, to: g.span.to };
      } else {
        // \bar{...} over something that is not a symbol
        return { k: 'raw', text: `\\${accent}{...}`, span };
      }
    } else if (this.kind() === 'cmd') {
      // \bar\mathbb{R} and \bar\Sigma
      if (GREEK.has(this.cur.value) || SYMBOL_COMMANDS.has(this.cur.value)) {
        const t = this.cur;
        this.pos++;
        baseLatex = `\\${t.value}`;
        span = { from: accentSpan.from, to: t.to };
      } else {
        const sub = this.parseCommand();
        if (sub.k === 'sym') {
          baseLatex = sub.name;
          span = { from: sub.span.from, to: sub.span.to };
        } else {
          return { k: 'raw', text: `\\${accent}{...}`, span };
        }
      }
    } else {
      const t = this.cur;
      this.pos++;
      baseLatex = t.value;
      span = { from: accentSpan.from, to: t.to };
    }

    // stacking accents, such as \bar{\hat{x}}
    if (baseLatex.startsWith('\\') && GLYPH_ACCENTS.has(baseLatex.slice(1).split('{')[0])) {
      const innerAccent = baseLatex.slice(1).split('{')[0];
      const rest = baseLatex.slice(1 + innerAccent.length).replace(/^\{|\}$/g, '');
      accents = [innerAccent];
      baseLatex = rest;
    }

    const sym = this.makeSym([accent], baseLatex, null, null, span);
    const scripted = this.applyScripts(sym, [accent, ...accents], baseLatex);
    return scripted;
  }

  /** \frac{...}{...}: either an ordinary fraction or a derivative. */
  private parseFraction(
    num: { text: string; span: Span },
    den: { text: string; span: Span },
    span: Span,
  ): Node {
    const numTokens = tokenize(num.text);
    const denTokens = tokenize(den.text);
    const numIsPartial = numTokens[0]?.type === 'cmd' && numTokens[0].value === 'partial';
    const denIsPartial = denTokens[0]?.type === 'cmd' && denTokens[0].value === 'partial';

    if (numIsPartial || denIsPartial) {
      return this.buildDerivative(numTokens, denTokens, span);
    }

    const numParser = new Parser(numTokens, num.text, this.opts);
    const denParser = new Parser(denTokens, den.text, this.opts);
    const numerator = numParser.parseExpression();
    const denominator = denParser.parseExpression();
    return {
      k: 'op',
      op: 'div',
      args: [numerator, denominator],
      span,
    };
  }

  /** Builds a derivative node from a numerator and denominator token slice. */
  private buildDerivative(numTokens: Token[], denTokens: Token[], span: Span): Node {
    let order: 1 | 2 = 1;
    let numStart = 0;
    if (numTokens[0]?.value === 'partial') {
      numStart = 1;
      if (numTokens[numStart]?.type === 'sup') {
        const text = numTokens[numStart + 1]?.value ?? '';
        if (text === '2') order = 2;
        numStart += 2;
      }
    }
    const numParser = new Parser(numTokens.slice(numStart), '', this.opts);
    const f = numParser.parseExpression();

    // denominator: one or more \partial <symbol> groups
    const wrt: Node[] = [];
    let denOrder = 1;
    let i = 0;
    while (i < denTokens.length) {
      const t = denTokens[i];
      if (t.type === 'cmd' && t.value === 'partial') {
        i++;
        // the symbol may carry scripts
        let nameEnd = i;
        let text = '';
        if (denTokens[i]?.type === 'ident') {
          text = denTokens[i].value;
          nameEnd = i + 1;
        } else if (denTokens[i]?.type === 'lbrace') {
          let depth = 1;
          let j = i + 1;
          while (j < denTokens.length && depth > 0) {
            if (denTokens[j].type === 'lbrace') depth++;
            if (denTokens[j].type === 'rbrace') {
              depth--;
              if (depth === 0) break;
            }
            j++;
          }
          text = renderTokens(denTokens.slice(i + 1, j));
          nameEnd = j;
        }
        // scripts on the denominator symbol
        let sub: string | null = null;
        let k = nameEnd;
        while (k < denTokens.length && (denTokens[k].type === 'sub' || denTokens[k].type === 'sup')) {
          if (denTokens[k].type === 'sub') {
            k++;
            if (denTokens[k]?.type === 'lbrace') {
              let depth = 1;
              let j = k + 1;
              while (j < denTokens.length && depth > 0) {
                if (denTokens[j].type === 'lbrace') depth++;
                if (denTokens[j].type === 'rbrace') {
                  depth--;
                  if (depth === 0) break;
                }
                j++;
              }
              sub = renderTokens(denTokens.slice(k + 1, j));
              k = j + 1;
            } else if (denTokens[k]) {
              sub = denTokens[k].value;
              k += 1;
            }
          } else {
            // a superscript on the denominator symbol
            const sup = denTokens[k + 1];
            const supText = sup?.value ?? '';
            if (supText === '2') denOrder = 2;
            k += 2;
          }
        }
        wrt.push({
          k: 'sym',
          name: sub ? `${text}_${sub}` : text,
          display: toDisplay(sub ? `${text}_${sub}` : text),
          span: { from: t.from, to: k > 0 ? denTokens[Math.min(k, denTokens.length) - 1].to : t.to },
        });
        i = k;
        continue;
      }
      i++;
    }

    if (wrt.length >= 2) denOrder = 2;
    if (order === 1 && denOrder === 2) order = 2;

    const form: 'grad' | 'jac' | 'hess' | 'diff' = order === 2 ? 'hess' : 'grad';
    return { k: 'deriv', f, wrt, order, form, span };
  }

  private parseDerivativeAfterNabla(t: Token): Node {
    const wrt: Node[] = [];
    if (this.kind() === 'sub') {
      this.pos++;
      const s = this.readSubscript();
      wrt.push({ k: 'sym', name: s.text, display: toDisplay(s.text), span: s.span });
    }
    let order: 1 | 2 = 1;
    if (this.kind() === 'sup') {
      this.pos++;
      const sup = this.readSuperscript();
      if (sup.text === '2') order = 2;
    }
    const f = this.parsePrimary();
    return {
      k: 'deriv',
      f,
      wrt,
      order,
      form: order === 2 ? 'hess' : 'grad',
      span: { from: t.from, to: f.span.to },
    };
  }

  private parseDerivativeAfterPartial(t: Token): Node {
    const f = this.parsePrimary();
    return {
      k: 'deriv',
      f,
      wrt: [],
      order: 1,
      form: 'grad',
      span: { from: t.from, to: f.span.to },
    };
  }

  private finishExpectation(span: Span, kind: string): Node {
    let over: string[] = [];
    let idxText: string | null = null;
    if (this.kind() === 'sub') {
      this.pos++;
      const s = this.readSubscript();
      idxText = s.text;
    }
    if (idxText) {
      const m = idxText.match(/([A-Za-z]+)\s*~/);
      if (m) over = [m[1]];
    }
    const op: 'E' | 'Var' | 'Cov' = kind === 'var' ? 'Var' : kind === 'cov' ? 'Cov' : 'E';
    if (this.kind() === 'lbrack') {
      this.pos++;
      const args: Node[] = [];
      if (this.kind() !== 'rbrack') {
        for (;;) {
          args.push(this.parseArgExpression());
          if (this.atRelation()) {
            this.skipToClose('rbrack');
            const close = this.expect('rbrack', ']');
            return { k: 'raw', text: 'a relation inside a group', span: { from: span.from, to: close.to } };
          }
          if (this.kind() === 'comma') {
            this.pos++;
            continue;
          }
          // E[X \mid Y] is read, but the engine has no model of a conditional
          // distribution, so it is left unchecked with that reason.
          if (this.kind() === 'csym' && this.cur.value === '|') {
            this.pos++;
            for (;;) {
              args.push(this.parseArgExpression());
              if (this.atRelation()) {
                this.skipToClose('rbrack');
                const close = this.expect('rbrack', ']');
                return { k: 'raw', text: 'a conditional expectation', span: { from: span.from, to: close.to } };
              }
              if (this.kind() === 'comma') {
                this.pos++;
                continue;
              }
              break;
            }
            const close = this.expect('rbrack', ']');
            return { k: 'raw', text: 'a conditional expectation', span: { from: span.from, to: close.to } };
          }
          break;
        }
      }
      const close = this.expect('rbrack', ']');
      return { k: 'expect', op, args, over, span: { from: span.from, to: close.to } };
    }
    return { k: 'raw', text: 'expectation without an argument list', span };
  }

  private parseBigOp(t: Token): Node {
    let idx = 'i';
    let lo: Node | null = null;
    let hi: Node | null = null;

    if (this.kind() === 'sub') {
      this.pos++;
      // `\\sum_{k=1}^K` and `\\sum_k` are both written. A subscript without
      // braces is one token, not a parse error.
      const g = this.readGroupOrToken();
      const m = g.text.match(/^\s*([A-Za-z]+)\s*=\s*(.*)$/);
      if (m) {
        idx = m[1];
        const loText = m[2];
        if (loText.trim()) {
          const p = new Parser(tokenize(loText), loText, this.opts);
          try {
            lo = p.parseExpression();
          } catch {
            lo = null;
          }
        }
      }
    }
    if (this.kind() === 'sup') {
      this.pos++;
      const g = this.readGroupOrToken();
      const p = new Parser(tokenize(g.text), g.text, this.opts);
      try {
        hi = p.parseExpression();
      } catch {
        hi = null;
      }
    }
    const body = this.parseProduct();
    return {
      k: 'bigop',
      kind: t.value === 'sum' ? 'sum' : 'prod',
      idx,
      lo,
      hi,
      body,
      span: { from: t.from, to: body.span.to },
    };
  }

  private parseMatrixEnv(): Node {
    const t = this.cur;
    this.pos++;
    const env = t.value;
    // array and alignedat take a column specification before their rows.
    if ((env === 'array' || env === 'alignedat') && this.kind() === 'lbrace') {
      this.rawGroupText();
    }
    const rows: Node[][] = [];
    let row: Node[] = [];
    while (this.kind() !== 'end' && this.kind() !== 'eof') {
      if (this.kind() === 'amp') {
        this.pos++;
        continue;
      }
      if (this.kind() === 'nl') {
        this.pos++;
        rows.push(row);
        row = [];
        continue;
      }
      // A cases cell is often a condition, `x > 0` or `x \leq 0`, and not
      // an expression of its own. The whole cell is named and left
      // unchecked, so the environment still parses.
      if (this.startsRelation()) {
        row.push(this.skipCell());
        continue;
      }
      row.push(this.parseExpression());
      if (this.kind() === 'amp' || this.kind() === 'nl') continue;
      if (this.kind() === 'end' || this.kind() === 'eof') break;
      if (this.startsRelation()) {
        row.push(this.skipCell());
        continue;
      }
      // A comma after a cell is punctuation, not the end of the row.
      if (this.kind() === 'comma' || this.kind() === 'semi') {
        this.pos++;
        continue;
      }
      // unexpected token, stop to avoid an infinite loop
      break;
    }
    if (row.length) rows.push(row);
    const endTok = this.kind() === 'end' ? this.cur : null;
    if (endTok) this.pos++;
    const span = { from: t.from, to: endTok ? endTok.to : t.to };
    void env;
    return { k: 'block', rows, span };
  }

  /** Does the current token begin a relation or a condition? */
  private startsRelation(): boolean {
    const t = this.cur;
    if (t.type === 'op' && ['=', '<', '>', '!', ':'].includes(t.value)) return true;
    return t.type === 'cmd' && RELATION_COMMANDS[t.value] !== undefined;
  }

  /** Consumes the rest of a cases cell, up to `&`, `\\\\` or the end. */
  private skipCell(): Node {
    const first = this.cur;
    let depth = 0;
    let last = first;
    while (this.pos < this.tokens.length) {
      const t = this.cur;
      if (depth === 0 && (t.type === 'amp' || t.type === 'nl' || t.type === 'end' || t.type === 'eof')) break;
      if (t.type === 'lparen' || t.type === 'lbrack' || t.type === 'lbrace') depth++;
      else if (t.type === 'rparen' || t.type === 'rbrack' || t.type === 'rbrace') {
        if (depth > 0) depth--;
      }
      last = t;
      this.pos++;
    }
    return { k: 'raw', text: 'a relation inside a group', span: { from: first.from, to: last.to } };
  }

  /**
   * A norm: \|x\| and \|A\|_F.
   *
   * A squared norm is a sum of squares, so it is exact. The unsquared ones
   * are not rational, so they are left unsupported rather than approximated.
   *
   * The matching bar is found before the inside is parsed. Otherwise the
   * product rule sees the closing bar and starts another norm, and a norm on
   * the right of a product, as in `2\|x\|`, is never read.
   */
  private parseNorm(): Node {
    const open = this.cur;
    this.pos++;
    const closeIndex = this.barClose(open, '\\|');
    if (closeIndex < 0) {
      this.pos = this.tokens.length;
      return { k: 'raw', text: 'an unbalanced norm', span: { from: open.from, to: open.to } };
    }
    const inner = this.parseInside(open, closeIndex);
    const close = this.tokens[closeIndex];
    this.pos = closeIndex + 1;
    let kind = '2';
    let squared = false;
    let scriptEnd = close.to;
    if (this.kind() === 'sub') {
      this.pos++;
      const sub = this.readSubscript();
      kind = sub.text;
      scriptEnd = sub.span.to;
    }
    if (this.kind() === 'sup') {
      this.pos++;
      const sup = this.readSuperscript();
      squared = sup.text === '2';
      scriptEnd = sup.span.to;
    }
    const span = { from: open.from, to: scriptEnd };
    if (squared) {
      if (kind === 'F' || kind === 'f') return { k: 'op', op: 'frob', args: [inner], span };
      return { k: 'op', op: 'norm2', args: [inner], span };
    }
    return { k: 'raw', text: `the unsquared norm \\|${kind}\\|`, span: { from: open.from, to: scriptEnd } };
  }

  private parseBars(): Node {
    const open = this.cur;
    this.pos++;
    const closeIndex = this.barClose(open, '|');
    if (closeIndex < 0) {
      this.pos = this.tokens.length;
      return { k: 'raw', text: 'unbalanced |', span: { from: open.from, to: open.to } };
    }
    const inner = this.parseInside(open, closeIndex);
    const close = this.tokens[closeIndex];
    this.pos = closeIndex + 1;
    return { k: 'op', op: 'abs', args: [inner], span: { from: open.from, to: close.to } };
  }

  /** The next bar of the same kind at the top level, or -1. */
  private barClose(open: Token, kind: string): number {
    let depth = 0;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type === 'lparen' || t.type === 'lbrack' || t.type === 'lbrace') depth++;
      else if (t.type === 'rparen' || t.type === 'rbrack' || t.type === 'rbrace') {
        if (depth > 0) depth--;
      } else if (depth === 0 && t.type === 'csym' && t.value === kind) {
        return i;
      }
    }
    return -1;
  }

  /** Parses the tokens between an opening delimiter and its match. */
  private parseInside(open: Token, closeIndex: number): Node {
    const inner = this.tokens.slice(this.pos, closeIndex);
    const parser = new Parser(inner, '', this.opts);
    try {
      return parser.parseExpression();
    } catch {
      // The inside is not something the engine can read. The row still has
      // a name for the whole construct, so it is left unchecked rather than
      // reported as a parse error.
      const last = inner.at(-1) ?? open;
      return { k: 'raw', text: 'an unreadable group', span: { from: open.to, to: last.to } };
    }
  }
}

function describeToken(t: Token): string {
  switch (t.type) {
    case 'eof':
      return 'end of input';
    case 'ident':
      return `identifier ${t.value}`;
    case 'num':
      return `number ${t.value}`;
    case 'cmd':
      return `command \\${t.value}`;
    case 'op':
      return `operator ${t.value}`;
    default:
      return t.type;
  }
}

type SupKind =
  | { kind: 'transpose' }
  | { kind: 'inverse' }
  | { kind: 'inverseT' }
  | { kind: 'power'; powerText: string }
  | { kind: 'label' };

export function classifySuperscript(text: string): SupKind {
  const s = text.replace(/\s+/g, '');
  if (s === '\\top' || s === 'T' || s === '\\mathsf{T}' || s === '\\intercal' || s === '^\\top') {
    return { kind: 'transpose' };
  }
  if (s === '-1') return { kind: 'inverse' };
  if (s === '-\\top' || s === '-T' || s === '-\\mathsf{T}') return { kind: 'inverseT' };
  if (/^\d+$/.test(s)) return { kind: 'power', powerText: s };
  return { kind: 'label' };
}

// ------------------------------------------------------------------- rows

/**
 * Is there a relation inside a cases or array block?
 *
 * A standalone cases block is a piecewise definition, not prose. It has no
 * top-level relation, so it cannot be parsed as a claim, but it still belongs
 * in the denominator of the coverage measurement. A relation inside an
 * ordinary brace, such as the condition of a set, does not make the row a
 * claim: the review classes that row as prose and keeps it out.
 */
function hasRelationInEnv(tokens: Token[]): boolean {
  let inEnv = 0;
  for (const t of tokens) {
    if (t.type === 'begin') {
      inEnv++;
      continue;
    }
    if (t.type === 'end') {
      if (inEnv > 0) inEnv--;
      continue;
    }
    if (inEnv === 0) continue;
    if (t.type === 'op' && ['=', '<', '>'].includes(t.value)) return true;
    if (t.type === 'cmd' && RELATION_COMMANDS[t.value] !== undefined) return true;
  }
  return false;
}

/** Finds the relation tokens of a row, at brace depth zero. */
export function findRelations(
  tokens: Token[],
): Array<{ index: number; relation: Relation; text: string; length: number }> {
  const out: Array<{ index: number; relation: Relation; text: string; length: number }> = [];
  let depth = 0;
  let inEnv = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'begin') {
      inEnv++;
      continue;
    }
    if (t.type === 'end') {
      if (inEnv > 0) inEnv--;
      continue;
    }
    if (inEnv > 0) continue;
    // The argument of \text is prose. A relation inside it, such as the
    // "and" between two claims, is not a relation of the row.
    if (t.type === 'cmd' && t.value === 'text') {
      let braces = 0;
      let j = i;
      for (; j < tokens.length; j++) {
        if (tokens[j].type === 'lbrace') braces++;
        else if (tokens[j].type === 'rbrace') {
          braces--;
          if (braces === 0) break;
        }
      }
      i = j;
      continue;
    }
    if (t.type === 'lbrace' || t.type === 'lparen' || t.type === 'lbrack') {
      depth++;
      continue;
    }
    if (t.type === 'rbrace' || t.type === 'rparen' || t.type === 'rbrack') {
      depth--;
      continue;
    }
    if (depth > 0) continue;

    if (t.type === 'op' && t.value === '=') {
      out.push({ index: i, relation: '=', text: '=', length: 1 });
      continue;
    }
    if (t.type === 'op' && t.value === ':' && tokens[i + 1]?.type === 'op' && tokens[i + 1]?.value === '=') {
      out.push({ index: i, relation: ':=', text: ':=', length: 2 });
      i++;
      continue;
    }
    if (t.type === 'op' && t.value === '<') {
      out.push({ index: i, relation: 'lt', text: '<', length: 1 });
      continue;
    }
    if (t.type === 'op' && t.value === '>') {
      out.push({ index: i, relation: 'gt', text: '>', length: 1 });
      continue;
    }
    if (t.type === 'cmd') {
      const rel = RELATION_COMMANDS[t.value];
      if (rel) out.push({ index: i, relation: rel, text: `\\${t.value}`, length: 1 });
    }
  }
  return out;
}

/**
 * The clauses of one row, split at a top-level comma, semicolon or period
 * that has a claim on both sides.
 *
 * A row such as `A = B, C = D` is two claims, and a comma is not an error.
 * A trailing comma, or a comma before a clause of prose, is not a split: the
 * row keeps its original shape, so the parser still says what it could not
 * read instead of dropping it.
 */
function clauseSplits(tokens: Token[]): Array<{ start: number; end: number }> {
  const separators: number[] = [];
  let depth = 0;
  let inEnv = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'begin') {
      inEnv++;
      continue;
    }
    if (t.type === 'end') {
      if (inEnv > 0) inEnv--;
      continue;
    }
    if (inEnv > 0) continue;
    if (t.type === 'lbrace' || t.type === 'lparen' || t.type === 'lbrack') {
      depth++;
      continue;
    }
    if (t.type === 'rbrace' || t.type === 'rparen' || t.type === 'rbrack') {
      if (depth > 0) depth--;
      continue;
    }
    if (depth > 0) continue;
    if (t.type === 'comma' || t.type === 'semi' || (t.type === 'op' && t.value === '.')) {
      separators.push(i);
    }
  }
  if (!separators.length) return [];

  const bounds = [-1, ...separators, tokens.length];
  const claims = bounds.slice(0, -1).map((b, k) => findRelations(tokens.slice(b + 1, bounds[k + 1])).length > 0);
  const splits: number[] = [];
  for (let k = 0; k < separators.length; k++) {
    if (claims[k] && claims[k + 1]) splits.push(separators[k]);
  }
  if (!splits.length) return [];

  const clauses: Array<{ start: number; end: number }> = [];
  let from = 0;
  for (const split of splits) {
    clauses.push({ start: from, end: split });
    from = split + 1;
  }
  clauses.push({ start: from, end: tokens.length });
  return clauses;
}

/**
 * Parses one row of text into its parts.
 *
 * A row can hold a single relation, a chain (a = b = c), an implication
 * (A = B => C = D) or two claims separated by a comma. Each of those becomes
 * one or more RowParts.
 */
export function parseRow(
  _src: string,
  rowText: string,
  offset: number,
  index: number,
  knownFns?: Set<string>,
): ParsedRow {
  let tokens = tokenize(rowText);
  // A display row often ends in the punctuation of the sentence around it:
  // "... = 0," or "... = 1;". It is not part of the claim. The tokenizer
  // ends its list with an eof, so the punctuation is just before it.
  for (;;) {
    const at = tokens.length - 2;
    const last = tokens[at];
    if (!last) break;
    if (last.type === 'comma' || last.type === 'semi' || (last.type === 'op' && last.value === '.')) {
      tokens = [...tokens.slice(0, at), tokens[tokens.length - 1]];
      continue;
    }
    break;
  }
  const annotation = extractAnnotation(tokens);
  tokens = stripAnnotation(tokens);
  tokens = blankAlignmentMarkers(tokens);
  const rels = findRelations(tokens);

  if (rels.length === 0) {
    // A relation inside a cases or array block is a condition of a piecewise
    // definition. It is a claim even when the row has no top-level relation.
    if (hasRelationInEnv(tokens)) {
      return {
        index,
        span: { from: offset, to: offset + rowText.length },
        parts: [],
        annotation,
        error: new ParseFailure('a relation inside an environment', {
          from: offset,
          to: offset + rowText.length,
        }),
      };
    }
    return {
      index,
      span: { from: offset, to: offset + rowText.length },
      parts: [],
      annotation,
      prose: true,
    };
  }

  // Two claims in one row, separated by a comma: read each one, and keep the
  // parts together. If either clause cannot be read, the whole row is
  // unchecked, so a half-read row is never checked.
  const clauses = clauseSplits(tokens);
  if (clauses.length > 1) {
    const merged: RowPart[] = [];
    for (const clause of clauses) {
      const first = tokens[clause.start];
      const last = tokens[clause.end - 1];
      if (!first || !last) continue;
      const parsed = parseRow(_src, rowText.slice(first.from, last.to), offset + first.from, index, knownFns);
      if (parsed.prose) continue;
      if (parsed.error) {
        return {
          index,
          span: { from: offset, to: offset + rowText.length },
          parts: [],
          annotation,
          error: parsed.error,
        };
      }
      merged.push(...parsed.parts);
    }
    if (merged.length) {
      return { index, span: { from: offset, to: offset + rowText.length }, parts: merged, annotation };
    }
  }

  const parts: RowPart[] = [];
  const impIndex = rels.findIndex((r) => r.relation === '=>' || r.relation === '<=>');

  // A row that cannot be read is reported, and never checked.
  const failure = (error: unknown): ParsedRow => ({
    index,
    span: { from: offset, to: offset + rowText.length },
    parts: [],
    annotation,
    error:
      error instanceof ParseFailure
        ? { message: error.message, span: { from: offset + error.span.from, to: offset + error.span.to } }
        : { message: String((error as Error)?.message ?? error), span: { from: offset, to: offset + rowText.length } },
  });

  if (impIndex >= 0) {
    const imp = rels[impIndex];
    const premiseTokens = tokens.slice(0, imp.index);
    const conclusionTokens = tokens.slice(imp.index + imp.length);
    let premise: Assertion | null;
    let conclusion: Assertion | null;
    try {
      premise = splitAssertion(premiseTokens, knownFns);
      conclusion = splitAssertion(conclusionTokens, knownFns);
    } catch (error) {
      return failure(error);
    }
    const part: RowPart = {
      relation: imp.relation,
      relText: imp.text,
      span: { from: offset, to: offset + rowText.length },
      premise: premise ?? undefined,
      conclusion: conclusion ?? undefined,
    };
    parts.push(part);
    return { index, span: { from: offset, to: offset + rowText.length }, parts, annotation };
  }

  // a chain: the segments between the relations
  const bounds: number[] = [];
  let start = 0;
  for (const r of rels) {
    bounds.push(start, r.index);
    start = r.index + r.length;
  }
  bounds.push(start, tokens.length);

  for (let i = 0; i < rels.length; i++) {
    const rel = rels[i];
    const lhsSeg = i === 0 ? tokens.slice(bounds[0], bounds[1]) : [];
    let rhsSeg = tokens.slice(bounds[2 * i + 2], bounds[2 * i + 3]);
    let proportionalTo: string | undefined;

    // \propto_x says which variable the proportionality is taken in
    if (rel.relation === 'propto' && rhsSeg[0]?.type === 'sub') {
      const parser = new Parser(rhsSeg, '', knownFns ? { knownFns } : {});
      const read = parser.readProportionalityVariable();
      proportionalTo = read.name;
      rhsSeg = rhsSeg.slice(read.tokens);
    }

    let lhs: Node | undefined;
    let rhs: Node | undefined;
    try {
      lhs = (lhsSeg.length ? parseNode(lhsSeg, knownFns) : null) ?? undefined;
      rhs = (rhsSeg.length ? parseNode(rhsSeg, knownFns) : null) ?? undefined;
    } catch (error) {
      return failure(error);
    }
    parts.push({
      lhs,
      relation: rel.relation,
      relText: rel.text,
      rhs,
      span: { from: offset, to: offset + rowText.length },
      lhsSpan: lhs?.span,
      rhsSpan: rhs?.span,
      proportionalTo,
    });
  }

  return { index, span: { from: offset, to: offset + rowText.length }, parts, annotation };
}

/** Splits a token slice at its first relation into an assertion. */
function splitAssertion(tokens: Token[], knownFns?: Set<string>): Assertion | null {
  const rels = findRelations(tokens);
  if (!rels.length) {
    const node = parseNode(tokens, knownFns);
    if (!node) return null;
    return { lhs: node, relation: 'other', relText: '', lhsSpan: node.span };
  }
  const r0 = rels[0];
  const lhsSeg = tokens.slice(0, r0.index);
  const rhsSeg = tokens.slice(r0.index + 1);
  const lhs = (lhsSeg.length ? parseNode(lhsSeg, knownFns) : null) ?? undefined;
  const rhs = (rhsSeg.length ? parseNode(rhsSeg, knownFns) : null) ?? undefined;
  return {
    lhs,
    relation: r0.relation,
    relText: r0.text,
    rhs,
    lhsSpan: lhs?.span,
    rhsSpan: rhs?.span,
  };
}

/**
 * Parses one side of a row.
 *
 * Anything the parser did not use is an error, and not the end of the side:
 * a row with a stray bracket in it is a row SAMOSA did not read, and it has
 * to say so instead of checking the part in front of the bracket.
 */
function parseNode(tokens: Token[], knownFns?: Set<string>): Node | null {
  if (!tokens.length) return null;
  const parser = new Parser(tokens, '', knownFns ? { knownFns } : {});
  const node = parser.parseExpression();
  // the tokens that carry nothing are not left over, they are the spaces
  let rest = parser.pos;
  while (rest < tokens.length && !tokens[rest].value) rest++;
  if (rest < tokens.length) {
    const leftover = tokens[rest];
    const closing = leftover.type === 'rparen' || leftover.type === 'rbrace' || leftover.type === 'rbrack';
    const what = closing ? 'unbalanced' : 'unexpected';
    throw new ParseFailure(
      `${what} \`${leftover.value}\` at column ${leftover.from + 1}`,
      { from: leftover.from, to: leftover.to },
    );
  }
  return node;
}

/**
 * Blanks the alignment markers of a row.
 *
 * The `&` of an align block is not part of the mathematics, so it is removed
 * before the row is parsed. The ones inside a group are kept, because a
 * matrix is written with them.
 */
function blankAlignmentMarkers(tokens: Token[]): Token[] {
  let depth = 0;
  return tokens.map((token) => {
    if (token.type === 'lbrace' || token.type === 'lparen' || token.type === 'lbrack') depth++;
    else if (token.type === 'rbrace' || token.type === 'rparen' || token.type === 'rbrack') depth--;
    else if (depth === 0 && token.value === '&') return { ...token, value: '' };
    return token;
  });
}

/** The range of a \\text{...} group that ends the row, if there is one. */
function trailingText(tokens: Token[]): { at: number; close: number } | null {
  const eof = tokens.length - 1;
  for (let i = eof; i >= 0; i--) {
    if (tokens[i].type !== 'cmd' || tokens[i].value !== 'text') continue;
    const next = tokens[i + 1];
    if (!next || next.type !== 'lbrace') continue;
    let depth = 1;
    let j = i + 2;
    while (j < tokens.length && depth > 0) {
      const t = tokens[j];
      if (t.type === 'lbrace') depth++;
      else if (t.type === 'rbrace') {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (depth !== 0) continue;
    // only a group at the very end is a note about the row, not part of it
    if (j !== eof - 1) continue;
    return { at: i, close: j };
  }
  return null;
}

function extractAnnotation(tokens: Token[]): string | undefined {
  const range = trailingText(tokens);
  return range ? renderTokens(tokens.slice(range.at + 2, range.close)).trim() : undefined;
}

/** Drops a trailing \\text{...} group from the token stream. */
function stripAnnotation(tokens: Token[]): Token[] {
  const range = trailingText(tokens);
  if (!range) return tokens;
  return [...tokens.slice(0, range.at), tokens[tokens.length - 1]];
}
