import { useEffect, useRef } from 'react';
import { SectionHead } from './common.tsx';

export function Tour() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16">
        <SectionHead
          eyebrow="walkthrough"
          body="A Kalman gain derivation with one dropped noise term, flagged at the failing row. 19 seconds."
        />
        <TourVideo />
      </div>
    </section>
  );
}

/**
 * The tour.
 *
 * The video is only fetched when it scrolls into the screen, so the page does
 * not pay for it before it is needed.
 */
export function TourVideo() {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void node.play().catch(() => {});
        else node.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      className="mt-8 w-full rounded-lg border border-[var(--color-line)]"
      src="/brag.mp4"
      poster="/brag.jpg"
      muted
      loop
      playsInline
      preload="none"
    />
  );
}

