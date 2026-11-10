import { SectionHead, RENDERED } from './common.tsx';

export function HallOfBugs() {
  return (
    <section className="overflow-hidden border-b border-[var(--color-line)] py-16">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10">
        <SectionHead
          eyebrow="plausible but wrong"
          body="Each passes a careful read. Each is wrong."
        />
      </div>
      <div className="mt-10 flex overflow-hidden">
        {/* the belt is duplicated so it is never narrower than twice the
            window: otherwise the tail end of the loop shows a blank strip
            on the right before it wraps (review: sometimes blank, then back) */}
        <div className="flex shrink-0 gap-8 pr-8 animate-[marquee_40s_linear_infinite] motion-reduce:animate-none">
          {[
            ...RENDERED.bugs,
            ...RENDERED.bugs,
            ...RENDERED.bugs,
            ...RENDERED.bugs,
            ...RENDERED.bugs,
            ...RENDERED.bugs,
          ].map((bug, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center gap-3 rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-4"
            >
              <span className="text-[var(--color-tamarind)]">✗</span>
              <span className="text-[0.9375rem]" dangerouslySetInnerHTML={{ __html: bug }} />
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </section>
  );
}

