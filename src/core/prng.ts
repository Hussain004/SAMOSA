/**
 * Seeded pseudo random numbers.
 *
 * Invariant 2 from AGENTS.md: no Math.random anywhere in the core. Every
 * verdict has to be reproducible from (seed, step, trial), so all randomness
 * goes through sfc32, which is small, fast and has a long period.
 */

export type Rng = () => number;

/** sfc32: a small, fast, well distributed counter based generator. */
export function sfc32(a: number, b: number, c: number, d: number): Rng {
  let s0 = a >>> 0;
  let s1 = b >>> 0;
  let s2 = c >>> 0;
  let s3 = d >>> 0;
  return function next(): number {
    s0 >>>= 0;
    s1 >>>= 0;
    s2 >>>= 0;
    s3 >>>= 0;
    let t = (s0 + s0) | 0;
    s0 = s1 ^ (s1 >>> 9);
    s1 = (s2 + (s2 << 3)) | 0;
    s2 = (s2 << 21) | (s2 >>> 11);
    s3 = (s3 + 1) | 0;
    t = (t + s3) | 0;
    s2 = (s2 + t) | 0;
    const r = (t >>> 0) / 4294967296;
    return r;
  };
}

/** FNV-1a over a string, mixed with a numeric seed. Used for stable hashing. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine any number of parts into a 32 bit seed. Order matters. */
export function hashSeed(...parts: Array<string | number>): number {
  let h = 0x9e3779b9;
  for (const part of parts) {
    const text = typeof part === 'number' ? part.toString(36) : part;
    h = (Math.imul(h ^ hashString(text), 0x85ebca6b) >>> 0) ^ (h >>> 13);
    h = h >>> 0;
  }
  return h >>> 0;
}

/** A seeded generator for one unit of work (a step, a trial, a prime). */
export function rngFor(...parts: Array<string | number>): Rng {
  const h = hashSeed(...parts);
  return sfc32(h, h ^ 0x9e3779b9, h ^ 0x85ebca6b, h ^ 0xc2b2ae35);
}

/** Uniform integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n) % n;
}

/** Uniform element of a finite field given as [0, p). */
export function randField(rng: Rng, p: number): number {
  // Two 16 bit draws keep the product below 2^53.
  const hi = Math.floor(rng() * 65536) % 65536;
  const lo = Math.floor(rng() * 65536) % 65536;
  return (hi * 65536 + lo) % p;
}
