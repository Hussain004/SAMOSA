import { useEffect, useRef, useState } from 'react';
import TEX from '../generated-tex.json';

/**
 * The head of a section. A headline is optional: most sections say what they
 * are about in a sentence that carries information, and then the small label
 * is the heading of the section, so the outline of the page stays whole.
 */
export function SectionHead({ eyebrow, title, body }: { eyebrow: string; title?: string; body: string }) {
  if (!title) {
    return (
      <div>
        <h2 className="text-[0.6875rem] font-normal tracking-[0.3em] text-[var(--color-faint)]">{eyebrow.toUpperCase()}</h2>
        <p className="mt-4 max-w-[820px] text-[1.0625rem] leading-relaxed tracking-wide text-[var(--color-text)]">{body}</p>
      </div>
    );
  }
  return (
    <div>
      <span className="text-[0.6875rem] tracking-[0.3em] text-[var(--color-faint)]">{eyebrow.toUpperCase()}</span>
      <h2 className="font-display mt-2 text-[clamp(28px,4vw,46px)] leading-tight">{title}</h2>
      <p className="mt-3 max-w-[680px] text-[0.875rem] leading-relaxed text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

/** The rendered math of the landing page, made at build time. */
export const RENDERED = TEX as { bugs: string[]; menu: Record<string, string>; fix: { term: string; edit: string } };

/** The section that reveals itself when it scrolls into view. */
export function useReveal(): void {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        node.classList.add('in');
        observer.disconnect();
      }
    });
    observer.observe(node);
  }, []);
}

export function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-[0.8125rem] text-[var(--color-text)] transition-colors hover:border-[var(--color-gold)]"
    >
      {copied ? '✓ copied' : text}
    </button>
  );
}
