import type { Verdict } from '../core/index.ts';

/**
 * The verdict vocabulary.
 *
 * Never colour alone: every badge carries an icon and a word, so the verdict
 * is readable without colour vision and by a screen reader.
 */

/** The seed, in the one format everywhere: hex, uppercase, 0x. */
export const seedText = (seed: number): string => `0x${seed.toString(16).toUpperCase().padStart(6, '0')}`;

/** Reads a seed in either form: hex (0x…) or decimal. */
export function parseSeed(input: string): number | null {
  const text = input.trim();
  if (/^0x[0-9a-fA-F]{1,8}$/.test(text)) return parseInt(text, 16) >>> 0;
  if (/^\d{1,10}$/.test(text)) return Number(text) >>> 0;
  return null;
}

export const VERDICT_ICON: Record<Verdict, string> = {
  ok: '✓',
  wrong: '✗',
  shape: '⊘',
  inconclusive: '⚠',
  unchecked: '?',
  defined: '≡',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  ok: 'holds',
  wrong: 'wrong',
  shape: 'shape',
  inconclusive: 'inconclusive',
  unchecked: 'not checked',
  defined: 'defined',
};

export const VERDICT_TITLE: Record<Verdict, string> = {
  ok: 'This step holds',
  wrong: 'This step is wrong',
  shape: 'The shapes do not fit',
  inconclusive: 'SAMOSA could not decide',
  unchecked: 'SAMOSA did not check this step',
  defined: 'This row defines a symbol',
};

/** The snack mode vocabulary, an Easter egg that is off by default. */
export const SNACK_LABEL: Record<Verdict, string> = {
  ok: 'crispy',
  wrong: 'soggy',
  shape: 'burnt',
  inconclusive: 'lukewarm',
  unchecked: 'raw',
  defined: 'raw',
};

export const SNACK_ICON: Record<Verdict, string> = {
  ok: '✦',
  wrong: '~',
  shape: '◌',
  inconclusive: '≈',
  unchecked: '?',
  defined: '≡',
};
