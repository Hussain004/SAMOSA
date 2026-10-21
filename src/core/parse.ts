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
]);

/** A token used past the end of a slice, so the parser always sees an end. */
const EOF_TOKEN: Token = { type: 'eof', value: '', from: 0, to: 0 };

export class Parser {
  private pos = 0;

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

    if (this.kind() === 'sub') {
      this.pos++;
      const s = this.readSubscript();
      sub = s.text;
      spanEnd = s.span.to;
    }

    while (this.kind() === 'sup') {
      this.pos++;
      const sup = this.readSuperscript();
      const classified = classifySuperscript(sup.text);
      spanEnd = sup.span.to;
      if (classified.kind === 'label') {
        labelSup = sup.text;
        continue;
      }
      scripts.push({ kind: classified.kind, text: classified.kind === 'power' ? classified.powerText : undefined, to: sup.span.to });
    }

    // the symbol keeps its subscript and its label, whatever happens to the scripts
    let node: Node = base;
    if (node.k === 'sym') {
      node = this.makeSym(accents, baseLatex, sub, labelSup, {
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
    let left = this.parseUnary();
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
        return true;
      case 'cmd':
        return (
          !NON_OPERAND_COMMANDS.has(t.value) &&
          !['left', 'right'].includes(t.value) &&
          t.value !== 'nonumber'
        );
      case 'csym':
        return t.value !== "'" && t.value !== '|';
      default:
        return false;
    }
  }

  private parseUnary(): Node {
    const t = this.cur;
    if (t.type === 'op' && t.value === '-') {
      this.pos++;
      const arg = this.parseUnary();
      return { k: 'op', op: 'neg', args: [arg], span: { from: t.from, to: arg.span.to } };
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
        if (this.kind() === 'lparen' && this.isFnName(t.value)) {
          const args = this.parseArgs();
          return { k: 'call', fn: t.value, args, span: { from: t.from, to: args.at(-1)?.span.to ?? t.to } };
        }
        return scripted;
      }
      case 'lparen': {
        this.pos++;
        const inner = this.parseExpression();
        const close = this.expect('rparen', ')');
        return { ...inner, span: { from: inner.span.from, to: close.to } };
      }
      case 'lbrace': {
        return this.parseGroupAsExpression();
      }
      case 'lbrack':
        return this.parseBareBracket();
      case 'cmd':
        return this.parseCommand();
      case 'csym':
        if (t.value === '|') return this.parseBars();
        if (t.value === '\\') {
          this.pos++;
          return { k: 'raw', text: 'line break', span: { from: t.from, to: t.to } };
        }
        break;
      case 'begin':
        return this.parseMatrixEnv();
      default:
        break;
    }
    throw new ParseFailure(`unexpected ${describeToken(t)}`, { from: t.from, to: t.to });
  }

  private parseGroupAsExpression(): Node {
    const open = this.expect('lbrace', '{');
    const inner = this.parseExpression();
    const close = this.expect('rbrace', '}');
    return { ...inner, span: { from: open.from, to: close.to } };
  }

  private parseBareBracket(): Node {
    const open = this.expect('lbrack', '[');
    const inner = this.parseExpression();
    const close = this.expect('rbrack', ']');
    return { ...inner, span: { from: open.from, to: close.to } };
  }

  private parseArgs(): Node[] {
    this.expect('lparen', '(');
    const args: Node[] = [];
    if (this.kind() !== 'rparen') {
      for (;;) {
        args.push(this.parseExpression());
        if (this.kind() === 'comma' || this.kind() === 'semi') {
          this.pos++;
          continue;
        }
        break;
      }
    }
    this.expect('rparen', ')');
    return args;
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
        return { k: 'call', fn: 'sqrt', args: [arg], span: { from: t.from, to: arg.span.to } };
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
          this.expect('comma', ',');
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
        const g = this.rawGroupText();
        const text = g.text.trim();
        if (text === 'd') {
          const arg = this.parsePrimary();
          return {
            k: 'deriv',
            f: arg,
            wrt: [],
            order: 1,
            form: 'diff',
            span: { from: t.from, to: arg.span.to },
          };
        }
        if (this.kind() === 'lparen') {
          const args = this.parseArgs();
          return { k: 'call', fn: text.toLowerCase(), args, span: { from: t.from, to: args.at(-1)?.span.to ?? t.to } };
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
        const g = this.rawGroupText();
        const base = g.text.trim();
        const sym = this.makeSym(['mathbb'], base, null, null, { from: t.from, to: g.span.to });
        if (base === 'E' || base === 'V') {
          return this.finishExpectation({ from: t.from, to: g.span.to }, base === 'E' ? 'E' : 'Var');
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
          const args = this.parseArgs();
          return {
            k: 'call',
            fn: name === 'sigma' ? 'sigmoid' : name,
            args,
            span: { from: t.from, to: args.at(-1)?.span.to ?? t.to },
          };
        }
        if (this.kind() === 'lbrace') {
          const arg = this.parseGroupAsExpression();
          return { k: 'call', fn: name === 'sigma' ? 'sigmoid' : name, args: [arg], span: { from: t.from, to: arg.span.to } };
        }
        // \log x and \log\sigma(z): the argument is the next operand
        const nextKind = this.kind();
        if (nextKind === 'ident' || (nextKind === 'cmd' && !NON_OPERAND_COMMANDS.has(this.cur.value))) {
          const arg = this.parsePrimary();
          return {
            k: 'call',
            fn: name === 'sigma' ? 'sigmoid' : name,
            args: [arg],
            span: { from: t.from, to: arg.span.to },
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
      return this.applyScripts(sym, [], `\\${name}`);
    }

    if (ACCENTS.has(name)) {
      const accentSpan = { from: t.from, to: t.to };
      this.pos++;
      const base = this.parseAccentBase(name, accentSpan);
      if (base.k === 'sym' && this.kind() === 'lparen') {
        const density = base.name.match(/^\\mathcal([NU])$/);
        if (density) {
          const args = this.parseArgs();
          return {
            k: 'call',
            fn: density[1] === 'N' ? 'normalDensity' : 'uniformDensity',
            args,
            span: { from: base.span.from, to: args.at(-1)?.span.to ?? base.span.to },
          };
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
          args.push(this.parseExpression());
          if (this.kind() === 'comma') {
            this.pos++;
            continue;
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
      const g = this.rawGroupText();
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
      const g = this.rawGroupText();
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
      row.push(this.parseExpression());
      if (this.kind() === 'amp' || this.kind() === 'nl') continue;
      if (this.kind() === 'end' || this.kind() === 'eof') break;
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

  private parseBars(): Node {
    const open = this.cur;
    this.pos++;
    const inner = this.parseExpression();
    const close = this.cur;
    if (close.type === 'csym' && close.value === '|') {
      this.pos++;
      return { k: 'op', op: 'abs', args: [inner], span: { from: open.from, to: close.to } };
    }
    return { k: 'raw', text: 'unbalanced |', span: { from: open.from, to: inner.span.to } };
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

/** Finds the relation tokens of a row, at brace depth zero. */
export function findRelations(
  tokens: Token[],
): Array<{ index: number; relation: Relation; text: string; length: number }> {
  const out: Array<{ index: number; relation: Relation; text: string; length: number }> = [];
  let depth = 0;
  let inText = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'lbrace') {
      depth++;
      continue;
    }
    if (t.type === 'rbrace') {
      depth--;
      continue;
    }
    if (t.type === 'cmd' && t.value === 'text') {
      inText = 1;
      continue;
    }
    if (inText) {
      const kind = t.type as string;
      if (kind === 'lbrace') inText++;
      else if (kind === 'rbrace') inText--;
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
 * Parses one row of text into its parts.
 *
 * A row can hold a single relation, a chain (a = b = c) or an implication
 * (A = B => C = D). Each of those becomes one or more RowParts.
 */
export function parseRow(
  _src: string,
  rowText: string,
  offset: number,
  index: number,
  knownFns?: Set<string>,
): ParsedRow {
  let tokens = tokenize(rowText);
  const annotation = extractAnnotation(tokens);
  tokens = stripAnnotation(tokens);
  const rels = findRelations(tokens);

  if (rels.length === 0) {
    return {
      index,
      span: { from: offset, to: offset + rowText.length },
      parts: [],
      annotation,
      prose: true,
    };
  }

  const parts: RowPart[] = [];
  const impIndex = rels.findIndex((r) => r.relation === '=>' || r.relation === '<=>');

  if (impIndex >= 0) {
    const imp = rels[impIndex];
    const premiseTokens = tokens.slice(0, imp.index);
    const conclusionTokens = tokens.slice(imp.index + imp.length);
    const premise = splitAssertion(premiseTokens, knownFns);
    const conclusion = splitAssertion(conclusionTokens, knownFns);
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
    const rhsSeg = tokens.slice(bounds[2 * i + 2], bounds[2 * i + 3]);
    const lhs = (lhsSeg.length ? parseNode(lhsSeg, knownFns) : null) ?? undefined;
    const rhs = (rhsSeg.length ? parseNode(rhsSeg, knownFns) : null) ?? undefined;
    parts.push({
      lhs,
      relation: rel.relation,
      relText: rel.text,
      rhs,
      span: { from: offset, to: offset + rowText.length },
      lhsSpan: lhs?.span,
      rhsSpan: rhs?.span,
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

function parseNode(tokens: Token[], knownFns?: Set<string>): Node | null {
  if (!tokens.length) return null;
  const parser = new Parser(tokens, '', knownFns ? { knownFns } : {});
  try {
    return parser.parseExpression();
  } catch {
    return null;
  }
}

function extractAnnotation(tokens: Token[]): string | undefined {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type === 'cmd' && tokens[i].value === 'text') {
      const next = tokens[i + 1];
      if (next && next.type === 'lbrace') {
        let depth = 1;
        let j = i + 2;
        while (j < tokens.length && depth > 0) {
          const kind = (tokens[j] as Token).type as string;
          if (kind === 'lbrace') depth++;
          if (kind === 'rbrace') {
            depth--;
            if (depth === 0) break;
          }
          j++;
        }
        return renderTokens(tokens.slice(i + 2, j)).trim();
      }
    }
  }
  return undefined;
}

/** Drops a trailing \text{...} group from the token stream. */
function stripAnnotation(tokens: Token[]): Token[] {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type === 'cmd' && tokens[i].value === 'text') {
      return tokens.slice(0, i);
    }
  }
  return tokens;
}
