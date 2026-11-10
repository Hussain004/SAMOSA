import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';

/**
 * The distribution claim, `f ~ \mathcal{N}(m, S)`.
 *
 * For a Gaussian the first two moments determine the law, so the claim is
 * decided by matching the mean and the covariance exactly, over the primes,
 * with the rational quadrature. The Gaussianity of the left side is an
 * assumption, and the card says so.
 */

const DECLS = 'x_t ~ N(\\mu, \\Sigma); A: m×n; b: m; \\mu: n; \\Sigma: spd n';
const source = (row: string, decls = DECLS): string => `% samosa: ${decls}
\\begin{align*}
${row}
\\end{align*}`;

const verdictOf = (row: string, decls?: string) => {
  const report = check(source(row, decls), {});
  return report.steps[0];
};

describe('the distribution claim', () => {
  it('holds for an affine map of a Gaussian', () => {
    const step = verdictOf('A x_t + b \\sim \\mathcal{N}(A \\mu + b, A \\Sigma A^\\top)');
    expect(step.verdict).toBe('ok');
    expect(step.message).toContain('first two moments');
  });

  it('is wrong when the claimed mean is off', () => {
    const step = verdictOf('A x_t + b \\sim \\mathcal{N}(A \\mu - b, A \\Sigma A^\\top)');
    expect(step.verdict).toBe('wrong');
    expect(step.message).toContain('mean');
  });

  it('is wrong when the claimed covariance is off', () => {
    const step = verdictOf('A x_t + b \\sim \\mathcal{N}(A \\mu + b, A \\Sigma A)');
    expect(step.verdict).toBe('wrong');
    expect(step.message).toContain('covariance');
  });

  it('is wrong when the affine offset is missing from the left side', () => {
    const step = verdictOf('A x_t \\sim \\mathcal{N}(A \\mu + b, A \\Sigma A^\\top)');
    expect(step.verdict).toBe('wrong');
  });

  it('lists the Gaussianity assumption in the card', () => {
    const step = verdictOf('A x_t + b \\sim \\mathcal{N}(A \\mu + b, A \\Sigma A^\\top)');
    expect(step.card.assumptions.join(' ')).toContain('Gaussian');
  });

  it('does not pretend to verify the law, only the moments', () => {
    // a non-affine left side with the same first two moments is NOT ok:
    // the moments match here (both sides computed from the same Gaussian),
    // and SAMOSA still says no, because a non-Gaussian is not a Gaussian
    const step = verdictOf(
      'x_t^2 - \\mu - \\Sigma \\sim \\mathcal{N}(\\mu^2 - \\mu, 2 \\Sigma^2 + 4 \\mu^2 \\Sigma)',
      'x_t ~ N(\\mu, \\Sigma); \\mu: scalar; \\Sigma: spd 1',
    );
    expect(step.verdict).toBe('unchecked');
    expect(step.message).toContain('affine');
  });

  it('is unchecked for a uniform density claim', () => {
    const step = verdictOf('A x_t + b \\sim \\mathcal{U}(0, 1)');
    expect(step.verdict).toBe('unchecked');
    expect(step.message).toContain('normal');
  });

  it('is unchecked when no random variable is declared', () => {
    const step = verdictOf('A x_t + b \\sim \\mathcal{N}(A \\mu + b, A \\Sigma A^\\top)', 'A: m×n; b: m; \\mu: n; \\Sigma: spd n');
    expect(step.verdict).toBe('unchecked');
    expect(step.message).toContain('declare the random variable');
  });

  it('checks a scalar standard normal claim', () => {
    const step = verdictOf('x \\sim \\mathcal{N}(0, 1)', 'x ~ N(0, 1)');
    expect(step.verdict).toBe('ok');
  });

  it('never certifies a claim with a wrong mean, whatever the seed', () => {
    // the claim is false at every seed, so the verdict never flips
    for (let seed = 1; seed <= 10; seed++) {
      const report = check(source('A x_t + b \\sim \\mathcal{N}(A \\mu + b + 1, A \\Sigma A^\\top)'), { seed });
      expect(report.steps[0].verdict).toBe('wrong');
    }
  });
});
