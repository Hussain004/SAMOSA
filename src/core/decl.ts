import { canonicalizeSymbol, toDisplay } from './notation.ts';

/**
 * Declarations: what the symbols in a derivation are.
 *
 * People already write declarations in LaTeX, so that is what we read first:
 *
 *   A, B \in \mathbb{R}^{n\times n}
 *   \Sigma \succ 0
 *   Q^\top Q = I
 *   x \sim \mathcal{N}(\mu, \Sigma)
 *
 * A compact form is also accepted, for the CLI and the MCP server:
 *
 *   A, B: n×n; \Sigma: spd n; x, \mu: n; f: fn n→1
 */

/** A dimension is either a fixed number or the name of a dimension variable. */
export type Dim = number | { v: string };

export type Prop =
  | 'sym'
  | 'spd'
  | 'psd'
  | 'orth'
  | 'rot'
  | 'diag'
  | 'triu'
  | 'tril'
  | 'skew'
  | 'idem'
  | 'proj'
  | 'unit'
  | 'stoch'
  | 'pos'
  | 'int'
  | 'ident'
  | 'zero'
  | 'ones'
  | { rank: Dim }
  | { commutes: string };

export type Dist =
  | { kind: 'normal'; mu: string; sigma: string }
  | { kind: 'uniform'; a: string; b: string }
  | { kind: 'bernoulli'; p: string }
  | { kind: 'categorical'; p: string };

export type SymKind = 'matrix' | 'vector' | 'scalar' | 'function' | 'random';

export interface SymbolDecl {
  name: string;
  display: string;
  kind: SymKind;
  rows?: Dim;
  cols?: Dim;
  props: Prop[];
  dist?: Dist;
  /** for functions: the argument dimensions and the result dimension */
  dom?: Dim[];
  cod?: Dim;
  /** a LaTeX definition, for `K := ...` */
  def?: string;
  source: 'declared' | 'preset';
}

export interface DeclResult {
  decls: SymbolDecl[];
  /** pinned dimension values, such as `n = 3` */
  pinned: Record<string, number>;
  errors: string[];
}

const PROP_WORDS: Record<string, Prop> = {
  sym: 'sym',
  symmetric: 'sym',
  spd: 'spd',
  psd: 'psd',
  orth: 'orth',
  orthogonal: 'orth',
  rot: 'rot',
  rotation: 'rot',
  diag: 'diag',
  diagonal: 'diag',
  triu: 'triu',
  tril: 'tril',
  skew: 'skew',
  idem: 'idem',
  idempotent: 'idem',
  proj: 'proj',
  projector: 'proj',
  unit: 'unit',
  stoch: 'stoch',
  stochastic: 'stoch',
  ones: 'ones',
  pos: 'pos',
  positive: 'pos',
  int: 'int',
  integer: 'int',
};

export function emptyDeclResult(): DeclResult {
  return { decls: [], pinned: {}, errors: [] };
}

/** Parses a declaration block. Both the LaTeX and the compact form work. */
export function parseDeclarations(text: string): DeclResult {
  const result = emptyDeclResult();
  if (!text.trim()) return result;

  // LaTeX declarations first: they are the ones people write.
  const latexItems = splitLatexItems(text);
  for (const item of latexItems) {
    if (!item.trim()) continue;
    if (!parseLatexItem(item, result)) {
      const compact = parseCompactItem(item, result);
      if (!compact) result.errors.push(`could not read the declaration: ${item.trim()}`);
    }
  }
  return result;
}

/** Splits a declaration block into items, keeping LaTeX math together. */
function splitLatexItems(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0 && (ch === '\n' || ch === ';')) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    if (depth === 0 && ch === ',' && looksLikeLatexList(text, i)) {
      current += ch;
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * A comma separates names inside a LaTeX declaration (`A, B \in ...`), but it
 * also separates two declarations (`x \in R^n, y \in R^n`). We only split on
 * it when what follows looks like the start of a new declaration.
 */
function looksLikeLatexList(text: string, commaIndex: number): boolean {
  const after = text.slice(commaIndex + 1).trimStart();
  return /^[A-Za-z\\][A-Za-z0-9_^{}\\]*(\s*,\s*[A-Za-z\\][A-Za-z0-9_^{}\\]*)*\s*(\\in|\\sim|\\succ|\\succeq|>:=|=|>)/.test(after);
}

/** Reads one LaTeX declaration. Returns false when it is not one. */
function parseLatexItem(item: string, result: DeclResult): boolean {
  const text = item.trim();

  // K := ...  (a definition)
  const defMatch = text.match(/^(.+?)\s*:=\s*([\s\S]+)$/);
  if (defMatch && !text.includes('\\in')) {
    const name = canonicalizeSymbol(defMatch[1].trim());
    if (name && !name.includes('\\')) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: 'matrix',
        props: [],
        def: defMatch[2].trim(),
        source: 'declared',
      });
      return true;
    }
  }

  // A, B \in \mathbb{R}^{n\times n}
  const inR = text.match(/^(.+?)\s*\\in\s*\\mathbb\{R\}\s*\^\s*\{([^}]*)\}/);
  if (inR) {
    const names = splitNames(inR[1]);
    const dims = parseDims(inR[2]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: dims.length === 1 ? 'vector' : 'matrix',
        rows: dims[0],
        cols: dims.length > 1 ? dims[1] : 1,
        props: [],
        source: 'declared',
      });
    }
    return true;
  }

  // A, B \in \mathbb{S}^n_{++}  (symmetric positive definite)
  const inS = text.match(/^(.+?)\s*\\in\s*\\mathbb\{S\}\s*\^\s*\{?(\w+)\}?\s*_\s*\{(\+\+|\+)\}/);
  if (inS) {
    const names = splitNames(inS[1]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: 'matrix',
        rows: parseDim(inS[2]) ?? undefined,
        cols: parseDim(inS[2]) ?? undefined,
        props: [inS[3] === '++' ? 'spd' : 'psd', 'sym'],
        source: 'declared',
      });
    }
    return true;
  }

  // A, B \in \mathbb{R}^{n}  without braces, and plain \mathbb{R}
  const inRPlain = text.match(/^(.+?)\s*\\in\s*\\mathbb\{R\}\s*\^\s*(\w+)/);
  if (inRPlain) {
    const names = splitNames(inRPlain[1]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: 'vector',
        rows: parseDim(inRPlain[2]) ?? undefined,
        cols: 1,
        props: [],
        source: 'declared',
      });
    }
    return true;
  }

  // \Sigma \succ 0  and \Sigma \succeq 0
  const spd = text.match(/^(.+?)\s*\\succ\s*0$/);
  if (spd) {
    const names = splitNames(spd[1]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: 'matrix',
        props: ['spd', 'sym'],
        source: 'declared',
      });
    }
    return true;
  }
  const psd = text.match(/^(.+?)\s*\\succeq\s*0$/);
  if (psd) {
    const names = splitNames(psd[1]);
    for (const name of names) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: 'matrix',
        props: ['psd', 'sym'],
        source: 'declared',
      });
    }
    return true;
  }

  // Q^\top Q = I   (orthogonal)
  const orth = text.match(/^(.+?)\s*\^\s*\\top\s*(.+?)\s*=\s*I\s*$/);
  if (orth) {
    const a = canonicalizeSymbol(orth[1].trim());
    const b = canonicalizeSymbol(orth[2].trim());
    for (const name of [a, b]) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: 'matrix',
        props: ['orth'],
        source: 'declared',
      });
    }
    return true;
  }

  // A = A^\top   (symmetric)
  const sym = text.match(/^(.+?)\s*=\s*(.+?)\s*\^\s*\\top\s*$/);
  if (sym && canonicalizeSymbol(sym[1].trim()) === canonicalizeSymbol(sym[2].trim())) {
    const name = canonicalizeSymbol(sym[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: 'matrix',
      props: ['sym'],
      source: 'declared',
    });
    return true;
  }

  // P^2 = P   (idempotent)
  const idem = text.match(/^(.+?)\s*\^\s*\{?2\}?\s*=\s*(.+?)$/);
  if (idem && canonicalizeSymbol(idem[1].trim()) === canonicalizeSymbol(idem[2].trim())) {
    const name = canonicalizeSymbol(idem[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: 'matrix',
      props: ['idem', 'proj'],
      source: 'declared',
    });
    return true;
  }

  // \operatorname{rank}(A) = k
  const rank = text.match(/\\operatorname\{rank\}\s*\(\s*(.+?)\s*\)\s*=\s*(.+)$/);
  if (rank) {
    const name = canonicalizeSymbol(rank[1].trim());
    const k = parseDim(rank[2].trim());
    if (k !== null) {
      result.decls.push({
        name,
        display: toDisplay(name),
        kind: 'matrix',
        props: [{ rank: k }],
        source: 'declared',
      });
      return true;
    }
  }

  // x \sim \mathcal{N}(\mu, \Sigma)
  const simN = text.match(/^(.+?)\s*\\sim\s*\\mathcal\{N\}\s*\(([^)]*)\)/);
  if (simN) {
    const name = canonicalizeSymbol(simN[1].trim());
    const args = splitNames(simN[2]);
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: 'random',
      props: [],
      dist: { kind: 'normal', mu: args[0] ?? '0', sigma: args[1] ?? 'I' },
      source: 'declared',
    });
    return true;
  }
  const simU = text.match(/^(.+?)\s*\\sim\s*\\mathcal\{U\}\s*\(([^)]*)\)/);
  if (simU) {
    const name = canonicalizeSymbol(simU[1].trim());
    const args = splitNames(simU[2]);
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: 'random',
      props: [],
      dist: { kind: 'uniform', a: args[0] ?? '0', b: args[1] ?? '1' },
      source: 'declared',
    });
    return true;
  }
  const simB = text.match(/^(.+?)\s*\\sim\s*\\mathrm\{Bern\}\s*\(([^)]*)\)/);
  if (simB) {
    const name = canonicalizeSymbol(simB[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: 'random',
      props: [],
      dist: { kind: 'bernoulli', p: simB[2].trim() },
      source: 'declared',
    });
    return true;
  }

  // f: \mathbb{R}^n \to \mathbb{R}
  const fn = text.match(/^(.+?)\s*:\s*\\mathbb\{R\}\s*\^\s*\{?([^}]*)\}?\s*\\to\s*\\mathbb\{R\}\s*\^\s*\{?([^}]*)\}?$/);
  if (fn) {
    const name = canonicalizeSymbol(fn[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: 'function',
      dom: parseDims(fn[2]),
      cod: parseDim(fn[3].trim()) ?? undefined,
      props: [],
      source: 'declared',
    });
    return true;
  }

  // \sigma > 0
  const pos = text.match(/^(.+?)\s*>\s*0$/);
  if (pos) {
    const name = canonicalizeSymbol(pos[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: 'scalar',
      props: ['pos'],
      source: 'declared',
    });
    return true;
  }

  return false;
}

/** Reads one compact declaration, such as `A, B: n×n`. */
export function parseCompactItem(item: string, result: DeclResult): boolean {
  const text = item.trim();

  // name := latex
  const def = text.match(/^(.+?)\s*:=\s*([\s\S]+)$/);
  if (def) {
    const name = canonicalizeSymbol(def[1].trim());
    result.decls.push({
      name,
      display: toDisplay(name),
      kind: 'matrix',
      props: [],
      def: def[2].trim(),
      source: 'declared',
    });
    return true;
  }

  // names ~ dist
  const dist = text.match(/^(.+?)\s*~\s*(.+)$/);
  if (dist) {
    const names = splitNames(dist[1]);
    const d = parseDist(dist[2].trim());
    if (d) {
      for (const name of names) {
        result.decls.push({
          name,
          display: toDisplay(name),
          kind: 'random',
          props: [],
          dist: d,
          source: 'declared',
        });
      }
      return true;
    }
  }

  // names : type
  const typed = text.match(/^(.+?)\s*:\s*(.+)$/);
  if (typed) {
    const names = splitNames(typed[1]);
    const type = typed[2].trim();
    for (const name of names) {
      const decl = parseType(name, type);
      if (decl) {
        result.decls.push(decl);
        continue;
      }
    }
    if (names.length) return true;
  }

  // dimvar = int
  const pinned = text.match(/^([A-Za-z]\w*)\s*=\s*(\d+)$/);
  if (pinned) {
    result.pinned[pinned[1]] = Number(pinned[2]);
    return true;
  }

  return false;
}

function parseType(name: string, type: string): SymbolDecl | null {
  const base = { name, display: toDisplay(name), source: 'declared' as const };

  if (type === 'scalar') return { ...base, kind: 'scalar', props: [] };
  if (type === 'pos') return { ...base, kind: 'scalar', props: ['pos'] };
  if (type === 'int') return { ...base, kind: 'scalar', props: ['int'] };

  // fn n→1
  const fn = type.match(/^fn\s*(.+?)\s*(?:->|→)\s*(.+)$/);
  if (fn) {
    return {
      ...base,
      kind: 'function',
      dom: parseDims(fn[1]),
      cod: parseDim(fn[2]) ?? undefined,
      props: [],
    };
  }

  // props and dimensions
  const words = type.split(/\s+/);
  const props: Prop[] = [];
  const dims: Dim[] = [];
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (w === 'rank') {
      const k = parseDim(words[++i] ?? '');
      if (k === null) return null;
      props.push({ rank: k });
      continue;
    }
    if (PROP_WORDS[w]) {
      props.push(PROP_WORDS[w]);
      continue;
    }
    break;
  }
  const rest = words.slice(i).join(' ');
  const dimText = rest.replace(/[x×]/g, '×');
  const parts = dimText.split('×').map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    const d = parseDim(p);
    if (d === null) return null;
    dims.push(d);
  }

  if (!dims.length) {
    if (!props.length) return null;
    return { ...base, kind: 'matrix', props };
  }
  if (dims.length === 1) {
    // one dimension means a column vector, unless the structure says matrix
    const matrixish = props.some((p) =>
      typeof p === 'string' &&
      ['sym', 'spd', 'psd', 'orth', 'rot', 'diag', 'triu', 'tril', 'skew', 'idem', 'proj', 'stoch'].includes(p),
    );
    return {
      ...base,
      kind: matrixish ? 'matrix' : 'vector',
      rows: dims[0],
      cols: matrixish ? dims[0] : 1,
      props,
    };
  }
  return {
    ...base,
    kind: 'matrix',
    rows: dims[0],
    cols: dims[1],
    props,
  };
}

function parseDist(text: string): Dist | null {
  const m = text.match(/^N\s*\((.*)\)$/);
  if (m) {
    const args = splitNames(m[1]);
    return { kind: 'normal', mu: args[0] ?? '0', sigma: args[1] ?? 'I' };
  }
  const u = text.match(/^U\s*\((.*)\)$/);
  if (u) {
    const args = splitNames(u[1]);
    return { kind: 'uniform', a: args[0] ?? '0', b: args[1] ?? '1' };
  }
  const b = text.match(/^Bern\s*\((.*)\)$/);
  if (b) return { kind: 'bernoulli', p: b[1].trim() };
  const c = text.match(/^Cat\s*\((.*)\)$/);
  if (c) return { kind: 'categorical', p: c[1].trim() };
  return null;
}

function splitNames(text: string): string[] {
  return text
    .split(',')
    .map((s) => canonicalizeSymbol(s.trim()))
    .filter(Boolean);
}

export function parseDim(text: string): Dim | null {
  const t = text.trim().replace(/^\\mathbb\{[A-Za-z]+\}$/, '');
  if (/^\d+$/.test(t)) return Number(t);
  if (/^[A-Za-z]\w*$/.test(t)) return { v: t };
  return null;
}

/** Parses `n\times n` or `n×n` into a list of dimensions. */
export function parseDims(text: string): Dim[] {
  const parts = text
    .replace(/\\times/g, '×')
    .replace(/\s+/g, '')
    .split('×')
    .map((p) => parseDim(p))
    .filter((d): d is Dim => d !== null);
  return parts;
}
