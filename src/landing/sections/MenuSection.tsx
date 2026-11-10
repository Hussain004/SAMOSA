import { MENU } from '../../../corpus/menu.ts';
import { SectionHead, RENDERED } from './common.tsx';

export function MenuSection() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]" id="menu">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="the menu"
          body={`${MENU.length} real derivations, each with one planted error. Try to find it before running the check.`}
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MENU.map((item) => (
            <a
              key={item.id}
              href={`/app#menu=${item.id}`}
              className="block min-w-0 max-w-full overflow-hidden rounded border border-[var(--color-line)] bg-[var(--color-ink)] p-4 transition-colors hover:border-[var(--color-gold)]/60"
            >
              <h3 className="text-[0.875rem] font-medium">{item.title}</h3>
              <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--color-faint)]">{item.blurb}</p>
              <div className="mt-3 max-w-full overflow-hidden text-[0.875rem]" dangerouslySetInnerHTML={{ __html: RENDERED.menu[item.id] ?? '' }} />
              <p className="mt-2 text-[0.6875rem] text-[var(--color-faint)]">spot the bug →</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}


