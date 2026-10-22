/**
 * Notation helpers: the bridge between what people write and what the engine
 * understands.
 *
 * Two jobs live here:
 *
 *  1. Unicode folding. Somebody pasting from a PDF gets `x̂ᵀ`, `Σ̄⁻¹`, `ℝⁿ`.
 *     Every one of those is folded to its LaTeX equivalent before tokenizing.
 *  2. Symbol identity. `\hat{x}_{k|k-1}` is one symbol, displayed as
 *     x̂_{k|k-1}. `\Sigma_t` and `\bar\Sigma_t` are two different symbols.
 */

/** Unicode characters that are folded to LaTeX before the tokenizer runs. */
export const UNICODE_MAP: Record<string, string> = {
  'ᵀ': '^{\\top}',
  '′': "'",
  '″': "''",
  '⁻': '^{-}',
  '¹': '^{1}',
  '⁰': '^{0}',
  '⁺': '^{+}',
  '⁻¹': '^{-1}',
  '∑': '\\sum',
  '∏': '\\prod',
  '∇': '\\nabla',
  'ℝ': '\\mathbb{R}',
  '𝔼': '\\mathbb{E}',
  'ℕ': '\\mathbb{N}',
  'ℤ': '\\mathbb{Z}',
  '≤': '\\le',
  '≥': '\\ge',
  '⪯': '\\preceq',
  '⪰': '\\succeq',
  '≈': '\\approx',
  '≠': '\\neq',
  '≡': '\\equiv',
  '·': '\\cdot',
  '⊗': '\\otimes',
  '⊙': '\\odot',
  '⊘': '\\oslash',
  '‖': '\\|',
  '⟨': '\\langle',
  '⟩': '\\rangle',
  '√': '\\sqrt',
  '∂': '\\partial',
  '∃': '\\exists',
  '∀': '\\forall',
  '∈': '\\in',
  '∉': '\\notin',
  '⊂': '\\subset',
  '⊆': '\\subseteq',
  '∞': '\\infty',
  'π': '\\pi',
  'α': '\\alpha',
  'β': '\\beta',
  'γ': '\\gamma',
  'δ': '\\delta',
  'ε': '\\epsilon',
  'ζ': '\\zeta',
  'η': '\\eta',
  'θ': '\\theta',
  'ι': '\\iota',
  'κ': '\\kappa',
  'λ': '\\lambda',
  'μ': '\\mu',
  'ν': '\\nu',
  'ξ': '\\xi',
  'ρ': '\\rho',
  'σ': '\\sigma',
  'τ': '\\tau',
  'υ': '\\upsilon',
  'φ': '\\phi',
  'ϕ': '\\varphi',
  'χ': '\\chi',
  'ψ': '\\psi',
  'ω': '\\omega',
  'Γ': '\\Gamma',
  'Δ': '\\Delta',
  'Θ': '\\Theta',
  'Λ': '\\Lambda',
  'Ξ': '\\Xi',
  'Π': '\\Pi',
  'Σ': '\\Sigma',
  'Φ': '\\Phi',
  'Ψ': '\\Psi',
  'Ω': '\\Omega',
  '−': '-',
  '–': '-',
  '—': '-',
  '→': '\\to',
  '←': '\\leftarrow',
  '⇒': '\\Rightarrow',
  '⇐': '\\Leftarrow',
  '⇔': '\\iff',
  '⟺': '\\iff',
  '≜': ':=',
  '≔': ':=',
  '∶': ':',
  'ℒ': '\\mathcal{L}',
  '⋅': '\\cdot',
  '∘': '\\circ',
};

/** LaTeX commands that decorate a symbol without changing its identity. */
export const ACCENTS = new Set([
  'hat',
  'widehat',
  'bar',
  'overline',
  'tilde',
  'widetilde',
  'check',
  'dot',
  'ddot',
  'vec',
  'mathbf',
  'boldsymbol',
  'bm',
  'mathcal',
  'mathscr',
  'mathfrak',
  'mathrm',
  'mathsf',
  'mathtt',
  'mathbb',
  'text',
]);

/** Accents that change the glyph but keep the same base letter. */
export const GLYPH_ACCENTS = new Set([
  'hat',
  'widehat',
  'bar',
  'overline',
  'tilde',
  'widetilde',
  'check',
  'dot',
  'ddot',
  'vec',
  'mathbf',
  'boldsymbol',
  'bm',
  'mathscr',
  'mathfrak',
]);

/** Greek letter names, used to decide whether a symbol looks like a matrix. */
export const GREEK = new Set([
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'varepsilon',
  'zeta',
  'eta',
  'theta',
  'vartheta',
  'iota',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'xi',
  'pi',
  'varpi',
  'rho',
  'varrho',
  'sigma',
  'tau',
  'upsilon',
  'phi',
  'varphi',
  'chi',
  'psi',
  'omega',
  'Gamma',
  'Delta',
  'Theta',
  'Lambda',
  'Xi',
  'Pi',
  'Sigma',
  'Phi',
  'Psi',
  'Omega',
]);

/** Latin letters, for the capital/lowercase heuristics of F3. */
export const LATIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Fold a source string from Unicode math into LaTeX. */
export function foldUnicode(input: string): string {
  let out = '';
  for (const ch of input) {
    const mapped = UNICODE_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    // Superscript digits and minus are common in pasted text.
    const sup = SUPERSCRIPTS[ch];
    if (sup !== undefined) {
      out += `^{${sup}}`;
      continue;
    }
    out += ch;
  }
  return out;
}

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  'ᵃ': 'a',
  'ᵇ': 'b',
  'ᶜ': 'c',
  'ᵈ': 'd',
  'ᵉ': 'e',
  'ᶠ': 'f',
  'ᵍ': 'g',
  'ʰ': 'h',
  'ⁱ': 'i',
  'ʲ': 'j',
  'ᵏ': 'k',
  'ˡ': 'l',
  'ᵐ': 'm',
  'ⁿ': 'n',
  'ᵒ': 'o',
  'ᵖ': 'p',
  'ʳ': 'r',
  'ˢ': 's',
  'ᵗ': 't',
  'ᵘ': 'u',
  'ᵛ': 'v',
  'ʷ': 'w',
  'ˣ': 'x',
  'ʸ': 'y',
  'ᶻ': 'z',
};

/** Pretty unicode rendering of a symbol name, for the UI. */
export function toDisplay(name: string): string {
  let out = name;
  const map: Array<[RegExp, string]> = [
    // an accent over a command, as in \\bar\\Sigma_t, before the command itself
    [/\\bar\{?(\\[A-Za-z]+)\}?/g, '$1̄'],
    [/\\hat\{?(\\[A-Za-z]+)\}?/g, '$1̂'],
    [/\\tilde\{?(\\[A-Za-z]+)\}?/g, '$1̃'],
    [/\\vec\{?(\\[A-Za-z]+)\}?/g, '$1⃗'],
    [/\\bar\{?([A-Za-z]+)\}?/g, '$1̄'],
    [/\\hat\{?([A-Za-z]+)\}?/g, '$1̂'],
    [/\\tilde\{?([A-Za-z]+)\}?/g, '$1̃'],
    [/\\vec\{?([A-Za-z]+)\}?/g, '$1⃗'],
    [/\\mathbb\{R\}/g, 'ℝ'],
    [/\\mathbb\{E\}/g, '𝔼'],
    [/\\Sigma/g, 'Σ'],
    [/\\Lambda/g, 'Λ'],
    [/\\Delta/g, 'Δ'],
    [/\\Phi/g, 'Φ'],
    [/\\Theta/g, 'Θ'],
    [/\\Psi/g, 'Ψ'],
    [/\\Omega/g, 'Ω'],
    [/\\Gamma/g, 'Γ'],
    [/\\Xi/g, 'Ξ'],
    [/\\Pi/g, 'Π'],
    [/\\mu/g, 'μ'],
    [/\\sigma/g, 'σ'],
    [/\\Sigma/g, 'Σ'],
    [/\\theta/g, 'θ'],
    [/\\phi/g, 'φ'],
    [/\\lambda/g, 'λ'],
    [/\\omega/g, 'ω'],
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\gamma/g, 'γ'],
    [/\\delta/g, 'δ'],
    [/\\epsilon/g, 'ε'],
    [/\\rho/g, 'ρ'],
    [/\\kappa/g, 'κ'],
    [/\\tau/g, 'τ'],
    [/\\psi/g, 'ψ'],
    [/\\chi/g, 'χ'],
    [/\\eta/g, 'η'],
    [/\\nu/g, 'ν'],
    [/\\pi/g, 'π'],
    [/\\varepsilon/g, 'ε'],
    [/\\varphi/g, 'φ'],
    [/\\top/g, 'ᵀ'],
    [/\\partial/g, '∂'],
    [/\\nabla/g, '∇'],
    [/\\in/g, '∈'],
  ];
  for (const [re, sub] of map) out = out.replace(re, sub);
  return out;
}

/** Is this character part of a multi letter symbol name? */
export function isLetter(ch: string): boolean {
  return /[A-Za-z]/.test(ch);
}

/**
 * Canonical form of a symbol name.
 *
 * The parser and the declaration parser must agree on what a symbol is
 * called, otherwise a declaration such as `\bar\Sigma_t: spd n` would not
 * match the `\bar\Sigma_t` in a derivation. The rules are:
 *
 *   - whitespace is dropped
 *   - the braces of a glyph accent are dropped: \bar{\Sigma} is \bar\Sigma
 *   - \mathbb keeps its braces: \mathbb{R} stays \mathbb{R}
 *   - a braced subscript collapses: x_{k|k-1} is x_k|k-1
 */
export function canonicalizeSymbol(raw: string): string {
  let s = raw.replace(/\s+/g, '');
  let previous = '';
  while (previous !== s) {
    previous = s;
    s = s.replace(/\\(hat|bar|overline|tilde|widetilde|check|dot|ddot|vec|mathbf|boldsymbol|bm|mathcal|mathrm|mathsf|mathtt)\{([^{}]*)\}/g, '\\$1$2');
  }
  s = s.replace(/_\{([^{}]*)\}/g, '_$1');
  s = s.replace(/\^\{([^{}]*)\}/g, '^$1');
  return s;
}

/** Remove whitespace and redundant braces so two spellings of a symbol match. */
export function normalizeName(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/\{([A-Za-z0-9|\\]+)\}/g, '$1')
    .replace(/\\/g, '\\');
}
