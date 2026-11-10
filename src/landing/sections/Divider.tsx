import { useEffect, useState } from 'react';

export function Divider() {
  const bubbles = [
    '(AB)ᵀ ≠ AᵀBᵀ',
    'dropped term: + KQKᵀ',
    'numerator vs denominator layout',
    '≈ is not =',
  ];
  const states = ['crispy', 'soggy', 'burnt', 'raw'] as const;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % bubbles.length), 4000);
    return () => window.clearInterval(timer);
  }, [bubbles.length]);

  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-center gap-6 px-6 lg:px-10 py-12">
        <span className="text-[0.8125rem] tracking-[0.3em] text-[var(--color-faint)]">TYPICAL SLIPS</span>
        {bubbles.map((bubble, i) => (
          <div
            key={bubble}
            className="flex items-center gap-2"
          >
            {/* the inactive sprite dims, the text stays at full contrast */}
            <div
              className={`transition-opacity duration-500 ${i === active ? 'opacity-100' : 'opacity-55'}`}
              aria-hidden="true"
            >
              <PixelSamosa state={states[i]} />
            </div>
            <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[0.75rem] text-[var(--color-muted)]">
              {bubble}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * A 16 by 16 pixel samosa.
 *
 * The four states are the verdict states: crispy is a step that holds,
 * soggy is one the engine could not decide, burnt is one that is wrong and
 * raw is one that was not read. The sprite is a triangle with a crimped top,
 * drawn as one rect per pixel so it stays crisp at any size.
 */
function PixelSamosa({ state }: { state: 'crispy' | 'soggy' | 'burnt' | 'raw' }) {
  const palettes = {
    crispy: { body: '#e8b04b', shade: '#c48a24', edge: '#8a5a12', crimp: '#f2c96a', highlight: '#f7dc94' },
    soggy: { body: '#b9a06a', shade: '#8f7a4b', edge: '#5f4f2e', crimp: '#cbb684', highlight: '#d6c79a' },
    burnt: { body: '#5a4632', shade: '#3b2d20', edge: '#22190f', crimp: '#6d563e', highlight: '#8a5a3a' },
    raw: { body: '#d9c9a3', shade: '#b9a980', edge: '#8a7c58', crimp: '#e6d9b8', highlight: '#f2e8cd' },
  };
  const palette = palettes[state];
  const pixels: React.ReactNode[] = [];

  const put = (x: number, y: number, fill: string) => {
    pixels.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
  };

  // the crimped edge: a serrated band, wider than the body it sits on
  const crimpRows: Array<[number, number[]]> = [
    [1, [4, 6, 8, 10]],
    [2, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    [3, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  ];
  for (const [y, xs] of crimpRows) {
    for (const x of xs) put(x, y, y === 1 ? palette.crimp : palette.body);
  }

  // the body: a triangle that widens to the base
  for (let y = 4; y <= 14; y++) {
    const width = 4 + (y - 4);
    const startX = Math.floor((16 - width) / 2);
    for (let i = 0; i < width; i++) {
      const x = startX + i;
      const edge = i === 0 || i === width - 1 || y === 14;
      const shade = i >= width - 3;
      const highlight = y >= 5 && y <= 8 && i === 1;
      put(
        x,
        y,
        edge ? palette.edge : shade ? palette.shade : highlight ? palette.highlight : palette.body,
      );
    }
  }

  return (
    <svg
      viewBox="0 0 16 16"
      width="30"
      height="30"
      role="img"
      aria-label={`a ${state} samosa`}
      shapeRendering="crispEdges"
    >
      {pixels}
    </svg>
  );
}

