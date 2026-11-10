import { SectionHead } from './common.tsx';
import LEDGER from '../ledger.json';

/** The soundness ledger: the false friends, and the dated false-checkmark fixes. */
export function LedgerSection() {
  return (
    <section className="border-b border-[var(--color-line)] py-16">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10">
        <SectionHead
          eyebrow="soundness"
          title="The ledger."
          body={`Every plausible-but-false identity we know: ${LEDGER.friends.length} of them, none of which may ever come back ok. The list is generated from the test corpus, the same list the structures test holds the engine to, and CI fails on a new one.`}
        />
        <div className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LEDGER.friends.map((friend: { name: string; src: string; handle?: string }) => (
            <div
              key={friend.name}
              className="flex flex-col rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2"
            >
              <span className="text-[0.5625rem] uppercase tracking-widest text-[var(--color-tamarind)]">
                ✗ never ok
              </span>
              <code className="mt-1.5 block break-words font-mono text-[0.6875rem] leading-snug text-[var(--color-muted)]">
                {friend.src}
              </code>
              <span className="mt-1.5 text-[0.625rem] leading-snug text-[var(--color-faint)]">
                {friend.name}
                {friend.handle ? ` — @${friend.handle}` : ''}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-10 max-w-[760px]">
          <h3 className="text-[0.6875rem] font-normal uppercase tracking-[0.3em] text-[var(--color-faint)]">
            the dated list of false checkmarks found and fixed
          </h3>
          <ul className="mt-3 space-y-3">
            {LEDGER.dated.map((entry: { date: string; version: string; title: string }) => (
              <li key={entry.date + entry.version + entry.title} className="flex gap-4 text-[0.8125rem]">
                <span className="shrink-0 font-mono text-[var(--color-faint)]">{entry.date}</span>
                <span className="text-[var(--color-muted)]">
                  <span className="text-[var(--color-text)]">v{entry.version}</span> · {entry.title}
                </span>
              </li>
            ))}
          </ul>
          <a
            href="/docs/LEDGER"
            className="mt-6 inline-block text-[0.8125rem] text-[var(--color-gold)] underline decoration-dotted underline-offset-4 hover:text-[var(--color-text)]"
          >
            the full ledger, with the method →
          </a>
        </div>
      </div>
    </section>
  );
}

