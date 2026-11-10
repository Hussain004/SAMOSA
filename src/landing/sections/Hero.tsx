import { useEffect, useState } from 'react';
import { AsciiSamosa } from '../AsciiSamosa.tsx';
import { MiniChecker } from '../MiniChecker.tsx';
import { openApp } from '../open-transition.ts';
import { CopyChip } from './common.tsx';

const PHRASES = [
  'A verdict on every row of an align block',
  'Wrong rows come with a counterexample and a fix',
  'Each checkmark states its error bound',
  'No language model in the verdict path',
  'Runs in the browser. Nothing is uploaded.',
];

export function Hero() {
  return (
    <section className="dotted relative">
      <div className="mx-auto grid max-w-[1560px] items-start gap-10 px-6 lg:px-10 py-16 md:grid-cols-[1fr_1.15fr] md:py-24">
        <div className="order-2 md:order-1">
          <h1 className="font-display text-[clamp(34px,4.6vw,70px)] leading-[1.02]">
            <span className="whitespace-nowrap">Derive more.</span>
            <br />
            <span className="whitespace-nowrap text-[var(--color-muted)]">Doubt less.</span>
          </h1>
          <PhraseList />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/app"
              onClick={openApp}
              className="rounded bg-[var(--color-gold)] px-5 py-3 font-medium text-[var(--color-ink)] transition-colors hover:bg-[#f3c368]"
            >
              Open SAMOSA →
            </a>
            <CopyChip text="npx samosa-math check paper.tex" />
          </div>
          <MiniChecker />
        </div>
        <div className="order-1 md:order-2">
          <AsciiSamosa />
        </div>
      </div>
    </section>
  );
}

export function PhraseList() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(PHRASES.length);
      return;
    }
    const timers: number[] = [];
    PHRASES.forEach((_, i) => {
      timers.push(window.setTimeout(() => setCount(i + 1), 400 + i * 900));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
  return (
    <ul className="mt-8 space-y-1 text-[0.9375rem] text-[var(--color-muted)]" aria-label="What SAMOSA does">
      {PHRASES.slice(0, count).map((phrase) => (
        <li key={phrase} className="reveal in flex gap-1">
          <span className="shrink-0 text-[var(--color-chutney)]">›</span>
          {phrase}
        </li>
      ))}
    </ul>
  );
}
