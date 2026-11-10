import ANNOUNCEMENTS from '../generated-announcements.json';

/** The same entries as CHANGELOG.md, written by the generator. */
const CHANGELOG = ANNOUNCEMENTS as Array<{ date: string; version: string; body: string }>;

export function Changelog() {
  return (
    <section className="border-t border-[var(--color-line)]">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16">
        <h2 className="text-sm tracking-[0.2em] text-[var(--color-faint)]">ANNOUNCEMENTS</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="rounded border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <span className="text-[0.6875rem] text-[var(--color-faint)]">{entry.date}</span>
              <h3 className="mt-1 text-[0.875rem]">SAMOSA {entry.version}</h3>
              <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--color-muted)]">{entry.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

