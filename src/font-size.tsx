import { useEffect, useState } from 'react';

/**
 * The size of the text, chosen by the visitor.
 *
 * Every size of the site is written in rem, so the whole page follows one
 * number: --font-scale on the root. The landing page and the app share the
 * choice, because it is kept under the same key.
 */

export const FONT_STEPS = [0.875, 1, 1.125, 1.25, 1.4, 1.6, 1.8];
/** The size nobody chose: a step up on a desktop, a smaller one on a phone. */
export const defaultFontScale = (): number => (window.innerWidth >= 1024 ? 1.25 : 1.125);
const KEY = 'samosa-font';

/** The size the visitor chose, or the default if they never did. */
export function readFontScale(): number {
  try {
    const saved = Number(window.localStorage.getItem(KEY));
    if (FONT_STEPS.includes(saved)) return saved;
  } catch {
    // a private window can refuse storage; the default is fine
  }
  return defaultFontScale();
}

/** Applies a size to the whole page, and keeps it. */
export function applyFontScale(scale: number): void {
  document.documentElement.style.setProperty('--font-scale', String(scale));
  try {
    window.localStorage.setItem(KEY, String(scale));
  } catch {
    // the page still changes, it just does not remember
  }
  // the controls on the page show the size, and the editor measures its
  // characters, so both are told that the size changed
  window.dispatchEvent(new CustomEvent('samosa:font', { detail: scale }));
  window.dispatchEvent(new Event('resize'));
}

/** The next size up (1) or down (-1), never past the ends. */
export function stepFontScale(from: number, direction: 1 | -1): number {
  const at = FONT_STEPS.indexOf(from);
  const next = Math.min(FONT_STEPS.length - 1, Math.max(0, (at < 0 ? FONT_STEPS.indexOf(defaultFontScale()) : at) + direction));
  return FONT_STEPS[next];
}

const BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 leading-none text-[var(--color-muted)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-text)] disabled:cursor-default disabled:opacity-35 disabled:hover:border-[var(--color-line)] disabled:hover:text-[var(--color-muted)]';

/** Two small buttons: the text gets smaller, the text gets larger. */
export function FontSizeControl({ className = '' }: { className?: string }) {
  const [scale, setScale] = useState(readFontScale);
  // the size can also change from the command palette
  useEffect(() => {
    const follow = (event: Event) => setScale((event as CustomEvent<number>).detail);
    window.addEventListener('samosa:font', follow);
    return () => window.removeEventListener('samosa:font', follow);
  }, []);
  const change = (direction: 1 | -1) => {
    applyFontScale(stepFontScale(scale, direction));
  };
  const percent = `${Math.round((scale / 1.125) * 100)}%`;
  return (
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label="Text size">
      <button
        type="button"
        className={BUTTON}
        onClick={() => change(-1)}
        disabled={scale === FONT_STEPS[0]}
        aria-label="Smaller text"
        title={`Smaller text (${percent})`}
      >
        <span aria-hidden="true" className="text-[0.75em]">A</span>
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className={BUTTON}
        onClick={() => change(1)}
        disabled={scale === FONT_STEPS[FONT_STEPS.length - 1]}
        aria-label="Larger text"
        title={`Larger text (${percent})`}
      >
        <span aria-hidden="true" className="text-[1.15em]">A</span>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
