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

/** A bound like 1.2e-47, in a way a person can read. */
export function formatBound(bound: number): string {
  if (bound === 0) return '0';
  if (bound < 1e-100) return `10^${Math.round(Math.log10(bound))}`;
  return bound.toExponential(1);
}

/** How a person reads the size of a counterexample, like "3×3". */
function counterexampleShape(dims: Record<string, number> | undefined): string | null {
  if (!dims) return null;
  const values = Object.values(dims);
  if (values.length === 0) return null;
  // the common case: one size named n or m
  const sizes = [...new Set(values)];
  if (sizes.length === 1) return `${sizes[0]}×${sizes[0]}`;
  return values.join(' by ');
}

/**
 * One plain sentence for the card, so a person sees what happened
 * before the numbers. Rule 2, in words.
 */
export function guaranteeSentence(step: import('../core/index.ts').StepResult): string {
  const card = step.card;
  const trials = card.trialsPerSize;
  const sizes = card.sizes.length;
  const counterexample = counterexampleShape(step.counterexample?.dims);
  if (step.verdict === 'ok') {
    if (step.mode === 'numeric') {
      return `Holds in ${trials} instances at 50 digits, over ${sizes} size${sizes === 1 ? '' : 's'}. No probability bound comes with a digit-based check.`;
    }
    const bound = card.bound;
    const boundText = bound !== undefined && bound > 0 ? ` A wrong step would slip through with probability ≤ ${formatBound(bound)}.` : '';
    if (step.mode === 'quadrature') {
      return `Holds in ${trials} quadrature trials over ${sizes} size${sizes === 1 ? '' : 's'}.${boundText}`;
    }
    const primes = card.primes ? ', in two primes' : '';
    return `Holds at ${sizes} size${sizes === 1 ? '' : 's'}, ${trials} trials each${primes}.${boundText}`;
  }
  if (step.verdict === 'wrong') {
    return counterexample
      ? `This step is wrong. Here is a ${counterexample} counterexample.`
      : 'This step is wrong. The card shows what the engine found.';
  }
  if (step.verdict === 'shape') return 'The shapes do not fit: these two sides cannot be compared.';
  if (step.verdict === 'inconclusive') return 'SAMOSA could not decide this step, and says so.';
  if (step.verdict === 'unchecked') return 'SAMOSA did not check this step, and says so.';
  return 'This row defines a symbol.';
}

/** The exact section of the docs that this card's mode is about. */
export function whyTrustHref(mode: 'exact' | 'numeric' | 'quadrature' | undefined): string {
  switch (mode) {
    case 'exact':
      return '/docs/how-it-works#exact-mode-finite-fields-and-schwartz-zippel';
    case 'quadrature':
      return '/docs/how-it-works#expectations-rational-quadrature';
    case 'numeric':
      return '/docs/how-it-works#numeric-mode';
    default:
      return '/docs/how-it-works#the-short-version';
  }
}

/**
 * The one way text leaves the app: a link the user clicks, with the row in
 * the URL, opening a prefilled GitHub issue. The row is visible to the
 * user before they submit anything.
 */
export function reportIssueUrl(step: import('../core/index.ts').StepResult): string {
  const row = (step.text ?? '').trim();
  const capped = row.length > 1500 ? row.slice(0, 1500) : row;
  const said = `${step.message ?? ''} ${step.reason ?? ''}`.toLowerCase();
  const reason = /unknown construct|not read/.test(said)
    ? 'The unknown construct'
    : /parse|unexpected|end of input|expected/.test(said)
      ? 'A parse error'
      : /shape|sizes|do not fit/.test(said)
        ? 'The shapes do not fit'
        : 'I do not know';
  const params = new URLSearchParams({
    template: 'notation.yml',
    row: capped,
    reason,
  });
  return `https://github.com/Hussain004/SAMOSA/issues/new?${params.toString()}`;
}
