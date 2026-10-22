import type { Dim, Dist, Prop, SymbolDecl } from './decl.ts';
import type { Node, Span } from './ir.ts';
import { canonicalizeSymbol, GREEK, toDisplay } from './notation.ts';

/**
 * Types, shapes and degree bounds.
 *
 * A derivation says "A is n by m" in prose, in a declaration, or not at all.
 * This module works out what every symbol is, unifies the dimensions with a
 * union find, and reports the shape mistakes in words.
 *
 * The degree bound is computed in the same pass: it is the degree of the
 * polynomial that the step asserts, in the independent sampled parameters.
 * That number is what turns a checkmark into a probability.
 */

export type { Dim, Dist, Prop };

export type Ty =
  | { t: 'scalar' }
  | { t: 'mat'; r: Dim; c: Dim }
  | { t: 'poly' }
  | { t: 'fn'; dom: Ty[]; cod: Ty }
  | { t: 'rv'; of: Ty; dist: Dist };

export interface ShapeError {
  message: string;
  span: Span;
}

export interface SymbolInfo {
  name: string;
  display: string;
  ty: Ty;
  props: Prop[];
  source: 'declared' | 'preset' | 'inferred';
  /** true when SAMOSA had to guess */
  guessed: boolean;
  /** the assumption that was made, for the guarantee card */
  assumption?: string;
}

export interface Chip {
  id: string;
  message: string;
  span: Span;
  /** the symbol the chip is about */
  symbol?: string;
  /** the choices the user can pick from */
  options?: Array<{ label: string; value: string }>;
}

/** A degree bound: the numerator and the denominator degree of a rational function. */
export interface Deg {
  n: number;
  d: number;
}

export const ZERO_DEG: Deg = { n: 0, d: 0 };
export const LEAF_DEG: Deg = { n: 1, d: 0 };

/** Union find over the dimension variables. */
export class Dims {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  find(v: string): string {
    const p = this.parent.get(v);
    if (p === undefined) {
      this.parent.set(v, v);
      return v;
    }
    if (p !== v) {
      const root = this.find(p);
      this.parent.set(v, root);
      return root;
    }
    return v;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;
    if (rankA < rankB) this.parent.set(ra, rb);
    else if (rankA > rankB) this.parent.set(rb, ra);
    else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }

  /** The dimension variables in a stable order. */
  all(): string[] {
    const roots = new Set<string>();
    for (const key of this.parent.keys()) roots.add(this.find(key));
    return [...roots].sort();
  }
}

export interface TypeContext {
  decls: Map<string, SymbolDecl>;
  /** the definitions that have been established so far */
  defs: Map<string, Node>;
  /** the symbols whose type is being inferred, to stop a cycle */
  inferring: Set<string>;
  dims: Dims;
  symbols: Map<string, SymbolInfo>;
  chips: Chip[];
  errors: ShapeError[];
  /** the dimension variables that the step uses */
  dimVars: string[];
  /** fresh dimension names, for the undeclared symbols */
  freshCount: number;
  /** the index variables bound by the enclosing sums */
  bound: Set<string>;
  /** the layout convention for gradients */
  layout: 'denominator' | 'numerator';
}

export function createContext(
  decls: SymbolDecl[],
  layout: 'denominator' | 'numerator' = 'denominator',
): TypeContext {
  const map = new Map<string, SymbolDecl>();
  for (const d of decls) map.set(d.name, d);
  // a random variable takes the shape of its mean
  for (const d of decls) {
    if (d.kind !== 'random' || d.rows) continue;
    const dist = d.dist;
    if (!dist) continue;
    const meanName = dist.kind === 'normal' ? dist.mu : dist.kind === 'uniform' ? dist.a : null;
    if (!meanName) continue;
    const mean = map.get(canonicalizeSymbol(meanName));
    if (mean && mean.rows) {
      d.rows = mean.rows;
      d.cols = mean.cols;
    }
  }
  const dimVars: string[] = [];
  for (const d of decls) {
    for (const dim of [d.rows, d.cols, d.cod, ...(d.dom ?? [])]) {
      if (dim && typeof dim !== 'number' && !dimVars.includes(dim.v)) dimVars.push(dim.v);
    }
  }
  return {
    decls: map,
    defs: new Map(),
    inferring: new Set(),
    dims: new Dims(),
    symbols: new Map(),
    chips: [],
    errors: [],
    dimVars,
    freshCount: 0,
    bound: new Set(),
    layout,
  };
}

function freshDim(ctx: TypeContext): Dim {
  ctx.freshCount += 1;
  const v = `#${ctx.freshCount}`;
  ctx.dims.union(v, v);
  return { v };
}

function dimName(d: Dim): string {
  return typeof d === 'number' ? String(d) : d.v;
}

export function sameDim(a: Dim, b: Dim): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return false;
}

/**
 * Unifies two dimensions, reporting a mismatch when they cannot agree.
 *
 * Two different dimension variables never merge: `n` and `m` are different
 * sizes, and a step that needs them to be equal has a shape error. That is
 * what catches the transposes that only work when everything is square.
 */
export function unifyDim(ctx: TypeContext, a: Dim, b: Dim, what: string, span: Span): Dim | null {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a !== b) {
      ctx.errors.push({ message: `${what}: the sizes ${a} and ${b} do not match`, span });
      return null;
    }
    return a;
  }
  if (typeof a === 'number') {
    ctx.dims.union((b as { v: string }).v, `#fixed${a}`);
    return a;
  }
  if (typeof b === 'number') {
    ctx.dims.union((a as { v: string }).v, `#fixed${b}`);
    return b;
  }
  const av = (a as { v: string }).v;
  const bv = (b as { v: string }).v;
  if (av !== bv && !isFreshDim(av) && !isFreshDim(bv)) {
    ctx.errors.push({
      message: `${what}: the sizes ${av} and ${bv} do not match`,
      span,
    });
  }
  ctx.dims.union(av, bv);
  return a;
}

/** A dimension variable that SAMOSA invented, which may merge with anything. */
function isFreshDim(v: string): boolean {
  return v.startsWith('#');
}

function isMatrix(t: Ty): t is { t: 'mat'; r: Dim; c: Dim } {
  return t.t === 'mat';
}

function isScalar(t: Ty): boolean {
  return t.t === 'scalar';
}

/** The shape of a type as text, for the messages. */
export function shapeText(t: Ty, ctx: TypeContext): string {
  if (t.t === 'scalar') return 'a scalar';
  if (t.t === 'poly') return 'a shape that is still open';
  if (t.t === 'fn') return 'a function';
  if (t.t === 'rv') return shapeText(t.of, ctx);
  return `${dimText(t.r, ctx)} by ${dimText(t.c, ctx)}`;
}

function dimText(d: Dim, ctx: TypeContext): string {
  if (typeof d === 'number') return String(d);
  const root = ctx.dims.find(d.v);
  const named = ctx.dimVars.includes(root) ? root : '?';
  return named;
}

/** The name of a dimension variable, if it has one we can show. */
export function dimLabel(ctx: TypeContext, d: Dim): string {
  if (typeof d === 'number') return String(d);
  return ctx.dims.find(d.v);
}

const CONSTANTS = new Set(['e', 'pi', '\\pi', 'i', 'j']);

/**
 * Infers the type of an expression.
 *
 * The rules are the ones of F3: declared symbols win, then the presets, then
 * the heuristics. Every heuristic leaves a chip behind.
 */
export function inferType(ctx: TypeContext, node: Node): Ty {
  switch (node.k) {
    case 'num':
      return { t: 'scalar' };
    case 'sym':
      return symbolType(ctx, node.name, node.span);
    case 'op':
      return opType(ctx, node);
    case 'call':
      return callType(ctx, node.fn, node.args, node.span);
    case 'deriv':
      return derivType(ctx, node);
    case 'expect':
      return expectType(ctx, node);
    case 'bigop': {
      const saved = new Set(ctx.bound);
      ctx.bound.add(node.idx);
      const t = inferType(ctx, node.body);
      ctx.bound = saved;
      return t;
    }
    case 'block': {
      const rows = node.rows.length || 1;
      const cols = node.rows[0]?.length ?? 1;
      for (const row of node.rows) for (const cell of row) inferType(ctx, cell);
      return { t: 'mat', r: rows, c: cols };
    }
    case 'raw':
      return { t: 'poly' };
  }
}

/** The type of a symbol, from its declaration or from the heuristics. */
export function symbolType(ctx: TypeContext, name: string, span: Span): Ty {
  const existing = ctx.symbols.get(name);
  if (existing) return existing.ty;

  // a symbol that was defined earlier takes the shape of its definition
  const def = ctx.defs.get(name);
  if (def && !ctx.inferring.has(name)) {
    ctx.inferring.add(name);
    const ty = inferType(ctx, def);
    ctx.inferring.delete(name);
    ctx.symbols.set(name, {
      name,
      display: toDisplay(name),
      ty,
      props: [],
      source: 'declared',
      guessed: false,
      assumption: `${name} is the symbol that was defined earlier`,
    });
    return ty;
  }

  const decl = ctx.decls.get(name);
  if (decl) {
    const ty = declType(decl);
    ctx.symbols.set(name, {
      name,
      display: decl.display || toDisplay(name),
      ty,
      props: decl.props,
      source: decl.source,
      guessed: false,
    });
    return ty;
  }

  // the heuristics of F3
  const base = baseLetter(name);
  const guess = guessType(ctx, name, base);
  ctx.symbols.set(name, {
    name,
    display: toDisplay(name),
    ty: guess.ty,
    props: guess.props,
    source: 'inferred',
    guessed: true,
    assumption: guess.assumption,
  });
  if (guess.chip) ctx.chips.push({ ...guess.chip, span, symbol: name });
  return guess.ty;
}

function declType(decl: SymbolDecl): Ty {
  if (decl.kind === 'scalar') return { t: 'scalar' };
  if (decl.kind === 'function') {
    return { t: 'fn', dom: (decl.dom ?? []).map((d) => ({ t: 'mat', r: d, c: d })), cod: { t: 'scalar' } };
  }
  if (decl.kind === 'random') {
    const of = decl.rows ? { t: 'mat' as const, r: decl.rows, c: decl.cols ?? decl.rows } : { t: 'scalar' as const };
    return { t: 'rv', of, dist: decl.dist ?? { kind: 'normal', mu: '0', sigma: '1' } };
  }
  const r = decl.rows ?? freshDimCtx(decl);
  const c = decl.cols ?? r;
  return { t: 'mat', r, c };
}

function freshDimCtx(decl: SymbolDecl): Dim {
  return { v: `#${decl.name}` };
}

function baseLetter(name: string): string {
  const stripped = name.replace(/^(\\[A-Za-z]+)+/, '');
  const m = stripped.match(/^([A-Za-z]+)/);
  return m ? m[1] : stripped;
}

interface Guess {
  ty: Ty;
  props: Prop[];
  assumption?: string;
  chip?: Omit<Chip, 'span'>;
}

function guessType(ctx: TypeContext, name: string, base: string): Guess {
  // I, 0 and the ones vector take the shape of whatever they are used with
  if (base === 'I' && !name.includes('_')) {
    return {
      ty: { t: 'mat', r: freshDim(ctx), c: freshDim(ctx) },
      props: ['ident'],
      assumption: 'I is the identity matrix',
    };
  }
  if (base === '0' && !name.includes('_')) {
    return {
      ty: { t: 'mat', r: freshDim(ctx), c: freshDim(ctx) },
      props: ['zero'],
      assumption: '0 is the zero matrix',
    };
  }
  if (name === '\\mathbf{1}' || name === '\\mathbf1' || base === '\\mathbf1') {
    return {
      ty: { t: 'mat', r: freshDim(ctx), c: freshDim(ctx) },
      props: ['ones'],
      assumption: 'the ones vector',
    };
  }
  if (CONSTANTS.has(name) || CONSTANTS.has(base)) {
    if (!name.includes('_')) {
      return { ty: { t: 'scalar' }, props: [], assumption: `${name} is a constant` };
    }
  }
  // the dimension variables
  if (/^[nmdkNTTP]$/.test(base) && !name.includes('_')) {
    return { ty: { t: 'scalar' }, props: [], assumption: `${name} is a size` };
  }
  // the index variables
  if (/^[ijk]$/.test(base) && ctx.bound.has(base)) {
    return { ty: { t: 'scalar' }, props: [], assumption: `${name} is an index` };
  }

  const isGreek = GREEK.has(base) || /\\[a-zA-Z]+$/.test(name);
  const isCapital = /^[A-Z]/.test(base);

  if (isGreek || isCapital) {
    const props: Prop[] = [];
    if (base === 'Sigma' || base === 'Lambda' || base === '\\Sigma' || base === '\\Lambda') props.push('sym');
    return {
      ty: { t: 'mat', r: freshDim(ctx), c: freshDim(ctx) },
      props,
      assumption: `${name} is a matrix${props.length ? ' (symmetric)' : ''}`,
      chip: {
        id: 'shape-guess',
        message: `${name} is treated as a matrix${props.length ? ' with symmetric structure' : ''}. Declare it to be sure.`,
        options: [
          { label: 'matrix', value: 'matrix' },
          { label: 'vector', value: 'vector' },
          { label: 'scalar', value: 'scalar' },
        ],
      },
    };
  }

  return {
    ty: { t: 'scalar' },
    props: [],
    assumption: `${name} is a scalar`,
    chip: {
      id: 'shape-guess',
      message: `${name} is treated as a scalar. Declare it to be sure.`,
      options: [
        { label: 'scalar', value: 'scalar' },
        { label: 'vector', value: 'vector' },
        { label: 'matrix', value: 'matrix' },
      ],
    },
  };
}

function opType(ctx: TypeContext, node: Extract<Node, { k: 'op' }>): Ty {
  // a random variable behaves like the matrix it is drawn from
  const args = node.args.map((a) => {
    const t = inferType(ctx, a);
    return t.t === 'rv' ? t.of : t;
  });
  switch (node.op) {
    case 'add':
    case 'sub': {
      const a = args[0];
      const b = args[1];
      if (a.t === 'poly' || b.t === 'poly') return { t: 'poly' };
      if (isScalar(a) && isScalar(b)) return { t: 'scalar' };
      if (isScalar(a) && isMatrix(b)) return b;
      if (isMatrix(a) && isScalar(b)) return a;
      if (isMatrix(a) && isMatrix(b)) {
        const rows = unifyDim(ctx, a.r, b.r, 'in a sum', node.span);
        const cols = unifyDim(ctx, a.c, b.c, 'in a sum', node.span);
        return { t: 'mat', r: rows ?? a.r, c: cols ?? a.c };
      }
      ctx.errors.push({ message: 'these two terms do not have the same shape', span: node.span });
      return { t: 'poly' };
    }
    case 'neg': {
      const a = args[0];
      return a;
    }
    case 'mul': {
      const a = args[0];
      const b = args[1];
      if (a.t === 'poly' || b.t === 'poly') return { t: 'poly' };
      if (isScalar(a) && isScalar(b)) return { t: 'scalar' };
      if (isScalar(a) && isMatrix(b)) return b;
      if (isMatrix(a) && isScalar(b)) return a;
      if (isMatrix(a) && isMatrix(b)) {
        unifyDim(ctx, a.c, b.r, 'in a product', node.span);
        return { t: 'mat', r: a.r, c: b.c };
      }
      ctx.errors.push({ message: 'these two factors do not have compatible shapes', span: node.span });
      return { t: 'poly' };
    }
    case 'div': {
      const a = args[0];
      const b = args[1];
      if (isScalar(a) && isScalar(b)) return { t: 'scalar' };
      if (isMatrix(a) && isScalar(b)) return a;
      if (isMatrix(a) && isMatrix(b)) {
        // a quotient of matrices keeps the shape of the numerator: the inner
        // sizes have to agree, and nothing else is constrained
        unifyDim(ctx, a.c, b.r, 'in a quotient', node.span);
        return { t: 'mat', r: a.r, c: a.c };
      }
      return { t: 'poly' };
    }
    case 'pow': {
      const a = args[0];
      return a;
    }
    case 'inv': {
      const a = args[0];
      if (isMatrix(a)) {
        unifyDim(ctx, a.r, a.c, 'in an inverse', node.span);
        return a;
      }
      return { t: 'scalar' };
    }
    case 'invT': {
      const a = args[0];
      if (isMatrix(a)) {
        unifyDim(ctx, a.r, a.c, 'in an inverse', node.span);
        return { t: 'mat', r: a.c, c: a.r };
      }
      return { t: 'scalar' };
    }
    case 'T': {
      const a = args[0];
      if (isMatrix(a)) return { t: 'mat', r: a.c, c: a.r };
      return { t: 'scalar' };
    }
    case 'tr':
    case 'det':
    case 'norm2':
    case 'frob':
    case 'abs':
      return { t: 'scalar' };
    case 'adj': {
      const a = args[0];
      if (isMatrix(a)) {
        unifyDim(ctx, a.r, a.c, 'in an adjugate', node.span);
        return a;
      }
      return { t: 'scalar' };
    }
    case 'kron': {
      const a = args[0];
      const b = args[1];
      if (isMatrix(a) && isMatrix(b)) {
        return { t: 'mat', r: mulDim(a.r, b.r), c: mulDim(a.c, b.c) };
      }
      return { t: 'poly' };
    }
    case 'had': {
      const a = args[0];
      const b = args[1];
      if (isMatrix(a) && isMatrix(b)) {
        const rows = unifyDim(ctx, a.r, b.r, 'in an element wise product', node.span);
        const cols = unifyDim(ctx, a.c, b.c, 'in an element wise product', node.span);
        return { t: 'mat', r: rows ?? a.r, c: cols ?? a.c };
      }
      return { t: 'poly' };
    }
    case 'inner':
      return { t: 'scalar' };
    case 'vec': {
      const a = args[0];
      if (isMatrix(a)) return { t: 'mat', r: mulDim(a.r, a.c), c: 1 };
      return { t: 'scalar' };
    }
    case 'diag': {
      const a = args[0];
      if (isMatrix(a)) return { t: 'mat', r: a.r, c: a.r };
      return { t: 'scalar' };
    }
    case 'sqrtm': {
      const a = args[0];
      return a;
    }
  }
}

function mulDim(a: Dim, b: Dim): Dim {
  if (typeof a === 'number' && typeof b === 'number') return a * b;
  if (typeof a === 'number') return { v: `${a}*${dimName(b)}` };
  if (typeof b === 'number') return { v: `${dimName(a)}*${b}` };
  return { v: `${dimName(a)}*${dimName(b)}` };
}

function callType(ctx: TypeContext, fn: string, args: Node[], span: Span): Ty {
  const types = args.map((a) => inferType(ctx, a));
  switch (fn) {
    case 'det':
    case 'tr':
    case 'trace':
    case 'norm':
    case 'logdet':
    case 'var':
      return { t: 'scalar' };
    case 'cov': {
      const a = types[0];
      const b = types[1];
      if (a && b && isMatrix(a) && isMatrix(b)) return { t: 'mat', r: a.r, c: b.r };
      return { t: 'scalar' };
    }
    case 'exp':
    case 'log':
    case 'ln':
    case 'sqrt':
    case 'sin':
    case 'cos':
    case 'tan':
    case 'tanh':
    case 'sigmoid':
    case 'relu':
    case 'softmax':
      // these act element wise, so they keep the shape of their argument
      return types[0] ?? { t: 'scalar' };
    case 'normalDensity':
    case 'uniformDensity':
      return { t: 'scalar' };
    default: {
      // a user declared function
      const decl = ctx.decls.get(fn);
      if (decl && decl.kind === 'function') {
        return {
          t: 'fn',
          dom: (decl.dom ?? []).map((d) => ({ t: 'mat', r: d, c: d })),
          cod: { t: 'scalar' },
        };
      }
      ctx.errors.push({ message: `unknown function ${fn}`, span });
      return { t: 'poly' };
    }
  }
}

function derivType(ctx: TypeContext, node: Extract<Node, { k: 'deriv' }>): Ty {
  const f = inferType(ctx, node.f);
  const wrtTypes = node.wrt.map((w) => inferType(ctx, w));
  if (node.form === 'diff') return { t: 'scalar' };
  if (node.order === 2) {
    const w = wrtTypes[0];
    if (w && isMatrix(w)) {
      unifyDim(ctx, w.r, w.c, 'in a second derivative', node.span);
      return { t: 'mat', r: w.r, c: w.c };
    }
    return { t: 'scalar' };
  }
  // a one by one matrix is a scalar that happens to be written as a product
  const scalarish = f.t === 'scalar' || (f.t === 'mat' && f.r === 1 && f.c === 1);
  if (scalarish) {
    const w = wrtTypes[0];
    if (w && isMatrix(w)) {
      if (ctx.layout === 'numerator') return { t: 'mat', r: w.c, c: w.r };
      return { t: 'mat', r: w.r, c: w.c };
    }
    return { t: 'scalar' };
  }
  // a Jacobian
  const out = f.t === 'rv' ? f.of : f;
  const w = wrtTypes[0];
  if (isMatrix(out) && w && isMatrix(w)) {
    return { t: 'mat', r: out.r, c: w.c };
  }
  return { t: 'poly' };
}

function expectType(ctx: TypeContext, node: Extract<Node, { k: 'expect' }>): Ty {
  const types = node.args.map((a) => inferType(ctx, a));
  const body = types[0] ?? { t: 'scalar' };
  if (node.op === 'E') return body;
  if (node.op === 'Var') {
    if (isMatrix(body)) return { t: 'mat', r: body.r, c: body.r };
    return { t: 'scalar' };
  }
  const second = types[1];
  if (isMatrix(body) && second && isMatrix(second)) {
    return { t: 'mat', r: body.r, c: second.r };
  }
  return { t: 'scalar' };
}

/**
 * The degree bound of an expression, in the independent sampled parameters.
 *
 * The rules are the ones of section 3.3. A leaf symbol has degree one. A
 * symbol that SAMOSA builds itself (an orthogonal matrix from a Cayley
 * transform, for instance) has the degree of its recipe.
 */
export function degreeOf(
  ctx: TypeContext,
  node: Node,
  sizes: Map<string, number>,
  defs?: Map<string, Node>,
): Deg {
  switch (node.k) {
    case 'num':
      return ZERO_DEG;
    case 'sym': {
      const def = defs?.get(node.name);
      if (def) return degreeOf(ctx, def, sizes, defs);
      const info = ctx.symbols.get(node.name);
      if (info && info.source !== 'inferred') {
        const deg = recipeDegree(ctx, node.name, info.props, sizes);
        if (deg) return deg;
      }
      if (isConstantSymbol(node.name)) return ZERO_DEG;
      return LEAF_DEG;
    }
    case 'op': {
      const args = node.args.map((a) => degreeOf(ctx, a, sizes, defs));
      switch (node.op) {
        case 'add':
        case 'sub': {
          const a = args[0];
          const b = args[1];
          let n: number;
          if (a.d === 0 && b.d === 0) n = Math.max(a.n, b.n);
          else n = Math.max(a.n + b.d, b.n + a.d);
          return { n, d: a.d + b.d };
        }
        case 'neg':
          return args[0];
        case 'mul':
        case 'kron':
        case 'had':
          return { n: args[0].n + args[1].n, d: args[0].d + args[1].d };
        case 'div':
          return { n: args[0].n + args[1].d, d: args[0].d + args[1].n };
        case 'pow': {
          const k = node.args[1]?.k === 'num' ? node.args[1].value.n : 2;
          return { n: args[0].n * k, d: args[0].d * k };
        }
        case 'inv': {
          const size = matrixSize(ctx, node.args[0], sizes);
          return { n: args[0].d + (size - 1) * args[0].n, d: size * args[0].n };
        }
        case 'invT': {
          const size = matrixSize(ctx, node.args[0], sizes);
          return { n: args[0].d + (size - 1) * args[0].n, d: size * args[0].n };
        }
        case 'T':
        case 'tr':
        case 'vec':
        case 'diag':
        case 'adj':
          return args[0];
        case 'det': {
          const size = matrixSize(ctx, node.args[0], sizes);
          return { n: size * args[0].n, d: size * args[0].d };
        }
        case 'norm2':
        case 'frob':
        case 'abs':
        case 'inner':
          return { n: 2 * args[0].n, d: 2 * args[0].d };
        case 'sqrtm':
          return { n: Math.ceil(args[0].n / 2), d: Math.ceil(args[0].d / 2) };
      }
      return args[0] ?? ZERO_DEG;
    }
    case 'call': {
      // a transcendental function is not rational, so it has no rational degree
      return ZERO_DEG;
    }
    case 'deriv':
      return ZERO_DEG;
    case 'expect':
      return ZERO_DEG;
    case 'bigop':
      return degreeOf(ctx, node.body, sizes, defs);
    case 'block':
      return ZERO_DEG;
    case 'raw':
      return ZERO_DEG;
  }
}

function isConstantSymbol(name: string): boolean {
  return name === 'e' || name === '\\pi' || name === 'pi';
}

/** The degree of a symbol that SAMOSA builds with a recipe. */
function recipeDegree(ctx: TypeContext, name: string, props: Prop[], sizes: Map<string, number>): Deg | null {
  const has = (p: Prop) => props.some((x) => (typeof x === 'string' ? x === p : false));
  const info = ctx.symbols.get(name);
  const size = info && isMatrix(info.ty) ? dimSize(ctx, info.ty.r, sizes) : 3;
  if (has('orth')) return { n: size, d: size };
  if (has('idem') || has('proj')) return { n: 2 * size, d: size };
  if (has('unit')) return { n: 2, d: 2 };
  return null;
}

function dimSize(ctx: TypeContext, d: Dim, sizes: Map<string, number>): number {
  if (typeof d === 'number') return d;
  return sizes.get(ctx.dims.find(d.v)) ?? 3;
}

function matrixSize(ctx: TypeContext, node: Node, sizes: Map<string, number>): number {
  if (node.k === 'sym') {
    const info = ctx.symbols.get(node.name);
    if (info && isMatrix(info.ty)) return dimSize(ctx, info.ty.r, sizes);
  }
  if (node.k === 'op' && (node.op === 'T' || node.op === 'inv' || node.op === 'invT')) {
    return matrixSize(ctx, node.args[0], sizes);
  }
  return 3;
}

/** The size of a dimension variable under a given size setting. */
export function dimSizeOf(ctx: TypeContext, d: Dim, sizes: Map<string, number>): number {
  return dimSize(ctx, d, sizes);
}
