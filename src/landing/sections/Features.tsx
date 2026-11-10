import { MOCKS } from '../demo-scripts.ts';
import { SectionHead, RENDERED } from './common.tsx';

const FEATURES = [
  {
    title: 'Counterexamples',
    body: 'The smallest instance that breaks the step, with a NumPy snippet to rerun it.',
    mock: <CounterexampleMock />,
  },
  {
    title: 'Fixes',
    body: 'Common slips are tried automatically, and a fix is offered only if the corrected row holds.',
    mock: <FixMock />,
  },
  {
    title: 'Shape errors',
    body: 'The sizes that do not conform, and the transpose that would fix them.',
    mock: <ShapeMock />,
  },
  {
    title: 'Gradients',
    body: 'Checked with dual numbers. A layout slip is named as one.',
    mock: <GradientMock />,
  },
  {
    title: 'Guarantees',
    body: 'Every checkmark states how it was tested. An exact one carries a bound, usually below 10⁻⁴⁶.',
    mock: <GuaranteeMock />,
  },
  {
    title: 'Your pipeline',
    body: 'App, CLI, Action and MCP server share one engine, so verdicts never disagree.',
    mock: <TerminalMock />,
  },
];

export function Features() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="what you get back"
          body="A verdict and a reason for every row. A checkmark is issued only after evaluation."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group min-w-0 rounded border border-[var(--color-line)] bg-[var(--color-ink)] p-5 transition-colors hover:border-[var(--color-gold)]/50"
            >
              <h3 className="text-[0.9375rem] font-medium">{feature.title}</h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--color-muted)]">{feature.body}</p>
              <div className="mt-4">{feature.mock}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CounterexampleMock() {
  const names = MOCKS.counterexample.names;
  const lines: string[] = [];
  const show = (texName: string, value: number[] | number) => {
    if (typeof value === 'number') {
      lines.push(`${texName} = ${value}`);
      return;
    }
    const size = Math.max(1, Math.round(Math.sqrt(value.length)));
    lines.push(`${texName} =`);
    for (let i = 0; i < value.length; i += size) {
      lines.push(`  [ ${value.slice(i, i + size).join(', ')} ]`);
    }
  };
  for (const [name, value] of Object.entries(MOCKS.counterexample.values)) {
    show(names[name] ?? name, value);
  }
  for (const [name, value] of Object.entries(MOCKS.counterexample.derived)) {
    show(`${names[name] ?? name} (computed)`, value);
  }

  return (
    <Mock>
      <MockLine tone="bad">
        ✗ row {MOCKS.counterexample.row} · the two sides are not equal
      </MockLine>
      <pre
        className="mt-2 whitespace-pre-wrap break-words text-[0.6875rem] leading-relaxed text-[var(--color-muted)]"
        dangerouslySetInnerHTML={{ __html: lines.join('\n') }}
      />
    </Mock>
  );
}

function FixMock() {
  return (
    <Mock>
      <MockLine tone="plain">
        this step is off by exactly{' '}
        <span className="text-[0.8125rem]" dangerouslySetInnerHTML={{ __html: RENDERED.fix.term }} />
      </MockLine>
      <div className="mt-3 text-[0.8125rem] text-[var(--color-muted)]">
        <div className="text-[0.625rem] uppercase tracking-widest text-[var(--color-faint)]">change the right side to</div>
        <div className="mt-1 max-w-full overflow-hidden" dangerouslySetInnerHTML={{ __html: RENDERED.fix.edit }} />
      </div>
    </Mock>
  );
}

function ShapeMock() {
  return (
    <Mock>
      <MockLine tone="bad">
        ⊘ row {MOCKS.shape.row} · {MOCKS.shape.message}
      </MockLine>
      <pre className="mt-2 whitespace-pre-wrap break-words text-[0.6875rem] leading-relaxed text-[var(--color-muted)]">
        {`C_t is m by n
the inner sizes do not match

${MOCKS.shape.fix ?? ''}`}
      </pre>
    </Mock>
  );
}

function GradientMock() {
  return (
    <Mock>
      <MockLine tone="bad">✗ row {MOCKS.layout.row} · the numerator layout</MockLine>
      <pre className="mt-2 whitespace-pre-wrap break-words text-[0.6875rem] leading-relaxed text-[var(--color-muted)]">
        {`the gradient has the shape
of the variable it is taken with
respect to. Transpose it.`}
      </pre>
    </Mock>
  );
}

function GuaranteeMock() {
  return (
    <Mock>
      <MockLine tone="ok">✓ row 11 · holds at every size tested</MockLine>
      <pre className="mt-2 whitespace-pre-wrap break-words text-[0.6875rem] leading-relaxed text-[var(--color-muted)]">
        {`sizes (3,2) (2,3) (4,3)
6 trials each · 2 primes
d ≤ 43 · false-✓ ≤ 1e-46`}
      </pre>
    </Mock>
  );
}

function TerminalMock() {
  return (
    <Mock>
      <pre className="text-[0.6875rem] leading-relaxed text-[var(--color-muted)]">
        {`$ npx samosa-math check paper.tex
  132:18  ✗ wrong  not equal
  141:5   ⊘ shape  n ≠ m
✗ 1 wrong · ⊘ 1 shape · ✓ 41 · 38 ms`}
      </pre>
    </Mock>
  );
}

function Mock({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-[var(--color-line)] bg-[var(--color-inset)] p-3">{children}</div>;
}

function MockLine({ children, tone }: { children: React.ReactNode; tone: 'ok' | 'bad' | 'plain' }) {
  return (
    <div
      className={`text-[0.6875rem] ${
        tone === 'ok'
          ? 'text-[var(--color-chutney)]'
          : tone === 'bad'
            ? 'text-[var(--color-tamarind)]'
            : 'text-[var(--color-muted)]'
      }`}
    >
      {children}
    </div>
  );
}

