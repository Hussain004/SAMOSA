/**
 * Exact rational numbers.
 *
 * The core keeps every literal as a fraction of two 32 bit integers so that
 * 0.5 is exactly one half, and so that the finite field code can turn a
 * rational into a field element with one modular inverse.
 */

export interface Rational {
  /** numerator */
  n: number;
  /** denominator, always > 0 */
  d: number;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

export function rat(n: number, d = 1): Rational {
  if (d === 0) throw new Error('rational with zero denominator');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const ZERO: Rational = { n: 0, d: 1 };
export const ONE: Rational = { n: 1, d: 1 };

export function isZeroRat(a: Rational): boolean {
  return a.n === 0;
}

export function eqRat(a: Rational, b: Rational): boolean {
  return a.n * b.d === b.n * a.d;
}

export function addRat(a: Rational, b: Rational): Rational {
  return rat(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function mulRat(a: Rational, b: Rational): Rational {
  return rat(a.n * b.n, a.d * b.d);
}

export function divRat(a: Rational, b: Rational): Rational {
  if (b.n === 0) throw new Error('rational division by zero');
  return rat(a.n * b.d, a.d * b.n);
}

/** Parse a decimal literal such as 1, 1.5, .5 or 2.25 into an exact fraction. */
export function ratFromDecimal(text: string): Rational {
  const s = text.trim();
  if (!/^\d*\.?\d+$/.test(s)) throw new Error(`not a decimal literal: ${text}`);
  const dot = s.indexOf('.');
  if (dot < 0) return rat(Number(s), 1);
  const whole = s.slice(0, dot) || '0';
  const frac = s.slice(dot + 1);
  const den = 10 ** frac.length;
  return rat(Number(whole) * den + Number(frac), den);
}

export function ratToString(a: Rational): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`;
}
