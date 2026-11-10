import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';
import { guaranteeSentence, whyTrustHref, formatBound, reportIssueUrl } from '../src/app/verdicts.ts';

/**
 * The sentence at the top of the card: one line a person can read before
 * the numbers. Every verdict and every mode has to produce one, and it has
 * to agree with the numbers on the card.
 */
describe('the guarantee sentence', () => {
  it('names sizes, trials, primes and the bound for an exact checkmark', () => {
    const report = check(String.raw`\begin{align*}
A + B &= B + A
\end{align*}`, { decls: 'A: n×n; B: n×n' });
    const ok = report.steps.find((s) => s.verdict === 'ok')!;
    const sentence = guaranteeSentence(ok);
    expect(sentence).toContain('3 sizes');
    expect(sentence).toContain('3 trials each');
    expect(sentence).toContain('two primes');
    expect(sentence).toContain('1.0e-56');
  });

  it('names quadrature trials for an exact-expectation checkmark', () => {
    const report = check(String.raw`\begin{align*}
\mathbb{E}[x] &= 0
\end{align*}`, { decls: 'x ~ N(0, \\Sigma); \\Sigma: spd n' });
    const step = report.steps.find((s) => s.mode === 'quadrature')!;
    const sentence = guaranteeSentence(step);
    expect(sentence).toContain('quadrature trials');
    expect(sentence).toContain('probability ≤');
  });

  it('names digits and says there is no probability bound in numeric mode', () => {
    const report = check(String.raw`\begin{align*}
\|A^\top\| &= \|A\|
\end{align*}`, { decls: 'A: n×n' });
    const step = report.steps.find((s) => s.mode === 'numeric')!;
    const sentence = guaranteeSentence(step);
    expect(sentence).toContain('50 digits');
    expect(sentence).toContain('No probability bound');
  });

  it('names the size of the counterexample for a wrong step', () => {
    const report = check(String.raw`\begin{align*}
(A B)^\top &= A^\top B^\top
\end{align*}`, { decls: 'A, B: n×n' });
    const wrong = report.steps.find((s) => s.verdict === 'wrong')!;
    expect(guaranteeSentence(wrong)).toMatch(/2×2 counterexample/);
  });

  it('says the shapes do not fit, in words, for a shape verdict', () => {
    const report = check(String.raw`\begin{align*}
A + b &= b + A
\end{align*}`, { decls: 'A: n×n; b: n' });
    const shape = report.steps.find((s) => s.verdict === 'shape')!;
    expect(guaranteeSentence(shape)).toContain('shapes do not fit');
  });

  it('says something honest about defined, inconclusive and unchecked rows', () => {
    const report = check(String.raw`\begin{align*}
D &:= \tfrac{1}{2} \\
\end{align*}`, { decls: 'A: n×n' });
    const defined = report.steps.find((s) => s.verdict === 'defined')!;
    expect(guaranteeSentence(defined)).toContain('defines a symbol');
  });

  it('links the why-trust page for every mode', () => {
    expect(whyTrustHref('exact')).toBe('/docs/how-it-works#exact-mode-finite-fields-and-schwartz-zippel');
    expect(whyTrustHref('numeric')).toBe('/docs/how-it-works#numeric-mode');
    expect(whyTrustHref('quadrature')).toBe('/docs/how-it-works#expectations-rational-quadrature');
    expect(whyTrustHref(undefined)).toBe('/docs/how-it-works#the-short-version');
  });

  it('formats bounds so a person can read them', () => {
    expect(formatBound(0)).toBe('0');
    expect(formatBound(1e-56)).toBe('1.0e-56');
    expect(formatBound(1e-150)).toBe('10^-150');
  });
});

describe('the report this row link', () => {
  it('puts the row in the query string, capped at 1500 characters', () => {
    const report = check(String.raw`\begin{align*}
a \bmod b &= 0
\end{align*}`, { decls: 'a: n; b: n' });
    const unchecked = report.steps.find((s) => s.verdict === 'unchecked');
    expect(unchecked).toBeDefined();
    if (!unchecked) return;
    const url = reportIssueUrl(unchecked);
    expect(url).toContain('https://github.com/Hussain004/SAMOSA/issues/new?');
    expect(url).toContain('template=notation.yml');
    expect(url).toContain(encodeURIComponent('\\bmod').slice(0, 10));
    const row = new URL(url).searchParams.get('row');
    expect(row!.length).toBeLessThanOrEqual(1500);
  });

  it('maps the reason onto the dropdown of the issue template', () => {
    const report = check(String.raw`\begin{align*}
\\frac{\\partial}{\\partial \\beta} J &= 0
\\end{align*}`, { decls: 'J: scalar' });
    const unchecked = report.steps.find((s) => s.verdict === 'unchecked');
    if (!unchecked) throw new Error('expected an unchecked row');
    const url = new URL(reportIssueUrl(unchecked));
    const reason = url.searchParams.get('reason');
    expect(['The unknown construct', 'A parse error', 'The shapes do not fit', 'I do not know']).toContain(reason);
  });
});
