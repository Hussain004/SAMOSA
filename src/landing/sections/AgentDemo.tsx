import { TypedDemo } from '../typed-demo.tsx';
import { SectionHead } from './common.tsx';

export function AgentDemo() {
  return (
    <section className="dotted">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="agent integration"
          body="Language models write algebra fluently and still err in the row that matters. SAMOSA lets an agent verify each step before it answers."
        />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <TypedDemo />
          <ul className="space-y-4 text-[0.8125rem] text-[var(--color-muted)]">
            <li className="flex gap-3">
              <span className="text-[var(--color-chutney)]">›</span>
              <span>
                <b className="text-[var(--color-text)]">One tool call.</b> LaTeX in, verdicts and
                fixes out.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--color-chutney)]">›</span>
              <span>
                <b className="text-[var(--color-text)]">Evidence, not opinion.</b> Every checkmark
                states how it was tested.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--color-chutney)]">›</span>
              <span>
                <b className="text-[var(--color-text)]">Nothing is uploaded.</b> The engine makes no
                network calls.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

