import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';
import { GFp2Field, P1_2, P2_2 } from '../src/core/fields/gfp2.ts';

/**
 * Complex matrices, in GF(p^2).
 *
 * U^\dagger U = I for a unitary U. Without the conjugation, U^T U is not
 * the identity: SAMOSA samples in the field GF(p^2), where both p are prime
 * and congruent to 3 modulo 4, and a complex structure (unitary, complex)
 * routes the whole check there. A claim that holds in GF(p^2) holds; a
 * claim that does not, fails.
 */

const source = (decls: string, row: string): string => `% samosa: ${decls}
\\begin{align*}
${row}
\\end{align*}`;

const verdictOf = (decls: string, row: string) => {
  const report = check(source(decls, row), {});
  return report.steps[0];
};

describe('the GF(p^2) primes', () => {
  it('are prime and congruent to 3 modulo 4', () => {
    expect(P1_2 % 4).toBe(3);
    expect(P2_2 % 4).toBe(3);
    expect(P1_2).toBe(2147483647);
  });

  it('support the inverse identity', () => {
    const field = new GFp2Field(P1_2);
    for (let i = 0; i < 50; i++) {
      const x = field.random(() => Math.random());
      if (field.isZero(x)) continue;
      expect(field.eq(field.mul(x, field.inv(x)), field.one)).toBe(true);
    }
  });

  it('the conjugate is the Frobenius image', () => {
    const field = new GFp2Field(P1_2);
    const x = { a: 12345, b: 67890 };
    const conj = field.conj(x);
    expect(conj.a).toBe(x.a);
    expect(conj.b).toBe(field.base.neg(x.b));
    // conj is a ring homomorphism: conj(x y) = conj(x) conj(y)
    const y = { a: 777, b: 888 };
    const left = field.conj(field.mul(x, y));
    const right = field.mul(field.conj(x), field.conj(y));
    expect(field.eq(left, right)).toBe(true);
  });

  it('the norm is a^2 + b^2', () => {
    const field = new GFp2Field(P1_2);
    const x = { a: 3, b: 4 };
    expect(field.norm(x).a).toBe(25);
  });
});

describe('the unitary structure', () => {
  it('checks U^dagger U = I', () => {
    const step = verdictOf('U: unitary n×n', String.raw`U^\dagger U = I`);
    expect(step.verdict).toBe('ok');
  });

  it('checks U U^dagger = I', () => {
    const step = verdictOf('U: unitary n×n', String.raw`U U^\dagger = I`);
    expect(step.verdict).toBe('ok');
  });

  it('does NOT check U^T U = I: the conjugation is what makes it true', () => {
    const step = verdictOf('U: unitary n×n', String.raw`U^\top U = I`);
    expect(step.verdict).toBe('wrong');
  });

  it('does NOT check U^dagger = U^T', () => {
    const step = verdictOf('U: unitary n×n', String.raw`U^\dagger = U^\top`);
    expect(step.verdict).toBe('wrong');
  });

  it('checks (X X^dagger)^dagger = X X^dagger for complex X', () => {
    const step = verdictOf('X: complex n×n', String.raw`(X X^\dagger)^\dagger = X X^\dagger`);
    expect(step.verdict).toBe('ok');
  });

  it('checks conj(conj(x)) = x', () => {
    const step = verdictOf('x: complex', String.raw`\operatorname{conj}(\operatorname{conj}(x)) = x`);
    expect(step.verdict).toBe('ok');
  });

  it('does NOT check conj(x) = x for a complex x', () => {
    const step = verdictOf('x: complex', String.raw`\operatorname{conj}(x) = x`);
    expect(step.verdict).toBe('wrong');
  });

  it('does NOT check conj(x)^2 = x^2', () => {
    const step = verdictOf('x: complex', String.raw`\operatorname{conj}(x)^2 = x^2`);
    expect(step.verdict).toBe('wrong');
  });

  it('the card reports the p^2 primes', () => {
    const report = check(source('U: unitary n×n', String.raw`U^\dagger U = I`), {});
    const step = report.steps[0];
    expect(step.card.primes).toEqual([2147483647, 2147483587]);
  });
});
