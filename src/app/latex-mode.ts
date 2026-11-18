import { StreamLanguage, type StreamParser } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * The LaTeX of a derivation, coloured by what each piece does in it.
 *
 * The stock stex mode reads an `align` body as prose, so everything but the
 * commands came out in one colour. A derivation has a grammar the eye wants
 * to see: the relation in the middle of each row, the scripts, the commands,
 * the alignment marks that only lay the row out. Each gets a role here, and
 * the theme gives each role a colour (`theme.ts`).
 */

/** The relations a step makes, which are the first thing a reader looks for. */
const RELATIONS = new Set([
  'implies', 'impliedby', 'iff', 'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'Longrightarrow', 'longrightarrow',
  'le', 'leq', 'ge', 'geq', 'lt', 'gt', 'ne', 'neq', 'sim', 'simeq', 'approx', 'equiv', 'propto', 'coloneqq',
  'eqqcolon', 'triangleq', 'doteq', 'succ', 'succeq', 'prec', 'preceq', 'preccurlyeq', 'succcurlyeq', 'in',
  'notin', 'subset', 'subseteq', 'supset', 'supseteq', 'mid', 'to', 'mapsto', 'models', 'perp', 'parallel',
  'leqslant', 'geqslant', 'll', 'gg', 'cong',
]);

/** The letters, which read as names, the same as `x` or `K`. */
const GREEK = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa',
  'lambda', 'mu', 'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi', 'varphi',
  'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  'ell', 'nabla', 'partial', 'infty', 'Tau',
]);

/** The marks that ride on a script, so `^\top` reads as one thing: the transpose. */
const SCRIPT_MARKS = new Set(['top', 'intercal', 'dagger', 'ast', 'star', 'prime', 'circ']);

/** Spacing commands lay the row out and say nothing, like the alignment marks. */
const SPACING = new Set(['quad', 'qquad', 'nonumber', 'notag', 'displaystyle', 'textstyle', 'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'middle']);

interface State {
  /** the next brace group names an environment */
  envName: boolean;
}

const parser: StreamParser<State> = {
  name: 'latex-math',
  startState: () => ({ envName: false }),
  token(stream, state) {
    if (stream.eatSpace()) return null;

    if (state.envName) {
      state.envName = false;
      if (stream.match(/^\{[^}]*\}/)) return 'environment';
    }

    // a comment, and the comment that declares the symbols
    if (stream.peek() === '%') {
      const declaration = stream.match(/^%\s*samosa:/, false);
      stream.skipToEnd();
      return declaration ? 'declaration' : 'comment';
    }

    if (stream.peek() === '\\') {
      // the row break, with its optional spacing
      if (stream.match(/^\\\\(\[[^\]]*\])?/)) return 'layout';
      // a one character command: \, \; \! \{ \| and the rest
      if (stream.match(/^\\[^a-zA-Z]/)) {
        const ch = stream.current()[1];
        if (ch === ',' || ch === ';' || ch === '!' || ch === ':' || ch === ' ') return 'layout';
        return ch === '{' || ch === '}' || ch === '|' ? 'bracket' : 'command';
      }
      stream.next();
      stream.eatWhile(/[a-zA-Z]/);
      const name = stream.current().slice(1);
      if (name === 'begin' || name === 'end') {
        state.envName = true;
        return 'environment';
      }
      if (RELATIONS.has(name)) return 'relation';
      if (SCRIPT_MARKS.has(name)) return 'script';
      if (GREEK.has(name)) return 'name';
      if (SPACING.has(name)) return 'layout';
      return 'command';
    }

    if (stream.match(/^:=|^=:/)) return 'relation';
    const ch = stream.next()!;
    if (ch === '&') return 'layout';
    if (ch === '=' || ch === '<' || ch === '>') return 'relation';
    if (ch === '^' || ch === '_') return 'script';
    if ('{}()[]'.includes(ch)) return 'bracket';
    if (/[0-9]/.test(ch)) {
      stream.eatWhile(/[0-9.]/);
      return 'number';
    }
    if (/[a-zA-Z]/.test(ch)) return 'name';
    if ("+-*/|',.;:!".includes(ch)) return 'operator';
    return null;
  },
  tokenTable: {
    environment: tags.keyword,
    declaration: tags.meta,
    comment: tags.comment,
    layout: tags.punctuation,
    bracket: tags.bracket,
    command: tags.function(tags.variableName),
    relation: tags.compareOperator,
    script: tags.special(tags.operator),
    number: tags.number,
    name: tags.variableName,
    operator: tags.arithmeticOperator,
  },
};

export const latexMath = StreamLanguage.define(parser);
