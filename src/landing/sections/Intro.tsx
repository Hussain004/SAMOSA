export function Intro() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-10">
        <p className="max-w-[900px] text-[1.0625rem] leading-relaxed tracking-wide text-[var(--color-text)]">
          SAMOSA targets the step that lecture notes and papers leave to the reader: <em>after some algebraic manipulation, we may obtain ...</em> It evaluates that step on sampled matrices, exactly, and reports the row that breaks.
        </p>
      </div>
    </section>
  );
}

