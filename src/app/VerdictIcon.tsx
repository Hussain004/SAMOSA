import type { Verdict } from '../core/index.ts';

/**
 * The verdict icons, drawn rather than typed.
 *
 * The glyphs ✓ ✗ ⊘ ⚠ came from whatever fallback font the system had, so
 * each one had its own weight and baseline. These share one grid, one
 * stroke and round ends, and they take the colour of the text around them.
 */

type Shape = { d?: string; circle?: [number, number, number]; dot?: [number, number] };

const SHAPES: Record<Verdict, Shape[]> = {
  ok: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  wrong: [{ d: 'M7 7l10 10M17 7L7 17' }],
  shape: [{ circle: [12, 12, 8] }, { d: 'M6.6 17.4L17.4 6.6' }],
  inconclusive: [{ d: 'M12 4.5l8.5 15h-17z' }, { d: 'M12 10.2v3.6' }, { dot: [12, 16.8] }],
  unchecked: [
    { circle: [12, 12, 8.5] },
    { d: 'M9.7 9.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.4v.3' },
    { dot: [12, 16.6] },
  ],
  defined: [{ d: 'M6.5 8.5h11M6.5 12h11M6.5 15.5h11' }],
};

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';

/** The icon as an SVG string, for the places that are not React (the saved image). */
export function verdictIconSvg(verdict: Verdict, size = 16, color = 'currentColor'): string {
  const parts = SHAPES[verdict]
    .map((s) => {
      if (s.d) return `<path d="${s.d}" ${STROKE}/>`;
      if (s.circle) return `<circle cx="${s.circle[0]}" cy="${s.circle[1]}" r="${s.circle[2]}" ${STROKE}/>`;
      if (s.dot) return `<circle cx="${s.dot[0]}" cy="${s.dot[1]}" r="1.4" fill="currentColor"/>`;
      return '';
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="color:${color}" aria-hidden="true">${parts}</svg>`;
}

export function VerdictIcon({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 align-[-0.125em] ${className ?? ''}`}
    >
      {SHAPES[verdict].map((s, i) =>
        s.d ? (
          <path key={i} d={s.d} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        ) : s.circle ? (
          <circle key={i} cx={s.circle[0]} cy={s.circle[1]} r={s.circle[2]} fill="none" stroke="currentColor" strokeWidth={2.4} />
        ) : s.dot ? (
          <circle key={i} cx={s.dot[0]} cy={s.dot[1]} r={1.4} fill="currentColor" />
        ) : null,
      )}
    </svg>
  );
}
