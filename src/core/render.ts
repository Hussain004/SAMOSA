import type { Node } from './ir.ts';
import { toDisplay } from './notation.ts';

/**
 * Rendering the IR back to LaTeX.
 *
 * Two uses: the quick fixes need to show what the corrected step would look
 * like, and the round trip property test needs to check that IR to LaTeX to
 * IR is stable.
 */

export function renderNode(node: Node): string {
  switch (node.k) {
    case 'num': {
      const v = node.value;
      if (v.d === 1) return String(v.n);
      if (v.d < 0) return `-${-v.n}/${-v.d}`;
      return `\\frac{${v.n}}{${v.d}}`;
    }
    case 'sym':
      return renderSymbol(node.name);
    case 'op':
      return renderOp(node);
    case 'call':
      return `${node.fn}\\left(${node.args.map(renderNode).join(', ')}\\right)`;
    case 'deriv': {
      const wrt = node.wrt.map((w) => `\\partial ${renderNode(w)}`).join(' ');
      return `\\frac{\\partial${node.order === 2 ? '^2' : ''} ${renderNode(node.f)}}{${wrt}}`;
    }
    case 'expect': {
      const op = node.op === 'E' ? '\\mathbb{E}' : node.op === 'Var' ? '\\operatorname{Var}' : '\\operatorname{Cov}';
      return `${op}\\left[${node.args.map(renderNode).join(', ')}\\right]`;
    }
    case 'bigop': {
      const op = node.kind === 'sum' ? '\\sum' : '\\prod';
      const lo = node.lo ? renderNode(node.lo) : '';
      const hi = node.hi ? renderNode(node.hi) : '';
      return `${op}_{${node.idx}=${lo}}^{${hi}} ${renderNode(node.body)}`;
    }
    case 'block': {
      const rows = node.rows.map((row) => row.map(renderNode).join(' & ')).join(' \\\\ ');
      return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
    }
    case 'raw':
      return node.text;
  }
}

function renderSymbol(name: string): string {
  // the name is already LaTeX, but the label and the subscript are folded in
  const supIndex = name.indexOf('^');
  const subIndex = name.indexOf('_');
  let base = name;
  let sub = '';
  let sup = '';
  if (subIndex >= 0 && (supIndex < 0 || subIndex < supIndex)) {
    base = name.slice(0, subIndex);
    const rest = name.slice(subIndex + 1);
    if (supIndex > subIndex) {
      sub = rest.slice(0, supIndex - subIndex - 1);
      sup = rest.slice(supIndex - subIndex);
    } else {
      sub = rest;
    }
  } else if (supIndex >= 0) {
    base = name.slice(0, supIndex);
    sup = name.slice(supIndex);
  }
  let out = base;
  if (sub) out += sub.length === 1 ? `_${sub}` : `_{${sub}}`;
  if (sup) out += sup.length === 1 ? `^${sup}` : `^{${sup}}`;
  return out;
}

function renderOp(node: Extract<Node, { k: 'op' }>): string {
  const a = node.args.map(renderNode);
  switch (node.op) {
    case 'add':
      return `${operand(node.args[0])} + ${operand(node.args[1])}`;
    case 'sub':
      return `${operand(node.args[0])} - ${operand(node.args[1])}`;
    case 'neg':
      return `-${operand(node.args[0])}`;
    case 'mul':
      return `${operand(node.args[0])} ${operand(node.args[1])}`;
    case 'div':
      return `\\frac{${a[0]}}{${a[1]}}`;
    case 'pow':
      return `{${a[0]}}^{${a[1]}}`;
    case 'inv':
      return `{${a[0]}}^{-1}`;
    case 'invT':
      return `{${a[0]}}^{-\\top}`;
    case 'T':
      return `{${a[0]}}^\\top`;
    case 'tr':
      return `\\operatorname{tr}\\left(${a[0]}\\right)`;
    case 'det':
      return `\\det\\left(${a[0]}\\right)`;
    case 'adj':
      return `\\operatorname{adj}\\left(${a[0]}\\right)`;
    case 'kron':
      return `${a[0]} \\otimes ${a[1]}`;
    case 'had':
      return `${a[0]} \\odot ${a[1]}`;
    case 'inner':
      return `\\left\\langle ${a[0]}, ${a[1]} \\right\\rangle`;
    case 'norm2':
      return `\\left\\|${a[0]}\\right\\|^{2}`;
    case 'frob':
      return `\\left\\|${a[0]}\\right\\|_{F}^{2}`;
    case 'vec':
      return `\\operatorname{vec}\\left(${a[0]}\\right)`;
    case 'diag':
      return `\\operatorname{diag}\\left(${a[0]}\\right)`;
    case 'abs':
      return `\\left|${a[0]}\\right|`;
    case 'sqrtm':
      return `\\sqrt{${a[0]}}`;
  }
}

/**
 * An operand of a sum, a difference or a product.
 *
 * A compound operand is written in braces, because a sum inside a product
 * without them means something else: `I - K C \bar\Sigma` is not
 * `(I - K C) \bar\Sigma`.
 */
function operand(node: Node | undefined): string {
  if (!node) return '';
  const text = renderNode(node);
  if (node.k === 'op' && (node.op === 'add' || node.op === 'sub' || node.op === 'mul' || node.op === 'neg')) {
    return `{${text}}`;
  }
  return text;
}

/** A short, human readable name of a symbol. */
export function shortName(name: string): string {
  return toDisplay(name);
}
