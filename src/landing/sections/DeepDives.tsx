import { SectionHead } from './common.tsx';

const DEEP_DIVES = [
  {
    n: '01',
    title: 'Exact, not approximate',
    body: 'Rational steps run over a finite field, where a wrong step survives with odds at most d/p.',
    link: '/docs/HOW_IT_WORKS',
  },
  {
    n: '02',
    title: 'Gradients by dual numbers',
    body: 'A value and a tangent, carried together. The chain rule falls out, exactly.',
    link: '/docs/HOW_IT_WORKS',
  },
  {
    n: '03',
    title: 'Counterexamples that shrink',
    body: 'A failing case is shrunk to small integers, the way a fuzzer does it.',
    link: '/docs/HOW_IT_WORKS',
  },
  {
    n: '04',
    title: 'Built for agents',
    body: 'An MCP server and an Agent Skill, so your agent checks before it answers.',
    link: '/docs/MCP',
  },
  {
    n: '05',
    title: 'In your pipeline',
    body: 'Lint the align blocks of a paper, and fail the build on a wrong step.',
    link: '/docs/CLI',
  },
  {
    n: '06',
    title: 'Measured on real papers',
    body: 'On 36 recent papers, 56.3% of claim rows parse end to end, and 24.9% read with nothing unknown.',
    link: '/docs/COVERAGE',
  },
];

export function DeepDives() {
  return (
    <section className="dotted" id="how">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="how it works"
          body="No model in the loop. Arithmetic, a finite field and a bound."
        />
        <div className="mt-12 space-y-16">
          {DEEP_DIVES.map((dive, i) => (
            <div key={dive.n} className="grid items-center gap-8 md:grid-cols-2">
              <div className={`min-w-0 ${i % 2 ? 'md:order-2' : ''}`}>
                <span className="font-display text-[0.8125rem] tracking-[0.25em] text-[var(--color-gold)]">
                  {dive.n}
                </span>
                <h3 className="mt-2 text-xl">{dive.title}</h3>
                <p className="mt-3 max-w-[520px] text-[0.875rem] leading-relaxed text-[var(--color-muted)]">
                  {dive.body}
                </p>
                <a
                  href={dive.link}
                  className="mt-3 inline-block text-[0.8125rem] text-[var(--color-gold)] hover:underline"
                >
                  read more →
                </a>
              </div>
              <div className={`min-w-0 ${i % 2 ? 'md:order-1' : ''}`}>
                <DiveVisual index={i} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DiveVisual({ index }: { index: number }) {
  const box =
    'rounded-lg border border-[var(--color-line)] bg-[var(--color-inset)] p-5 font-mono text-[0.6875rem] leading-relaxed text-[var(--color-muted)]';
  const row = 'flex items-baseline justify-between gap-4';

  switch (index) {
    case 0:
      return (
        <div className={box}>
          <div className="text-[var(--color-gold)]">the guarantee card</div>
          <div className={`${row} mt-3`}>
            <span>sizes</span>
            <span className="text-[var(--color-text)]">(3,2) (2,3) (4,3)</span>
          </div>
          <div className={row}>
            <span>trials per size</span>
            <span className="text-[var(--color-text)]">3</span>
          </div>
          <div className={row}>
            <span>primes</span>
            <span className="text-[var(--color-text)]">2³¹−1 · 2147483629</span>
          </div>
          <div className={row}>
            <span>degree bound</span>
            <span className="text-[var(--color-text)]">d = 9</span>
          </div>
          <div className={`${row} mt-2 border-t border-[var(--color-line)] pt-2`}>
            <span>a false ✓ is at most</span>
            <span className="text-[var(--color-chutney)]">5.4 × 10⁻⁵¹</span>
          </div>
        </div>
      );
    case 1:
      return (
        <div className={box}>
          <div className="text-[var(--color-gold)]">a derivative is a pair</div>
          <div className="mt-3 text-[var(--color-text)]">(v, v̇) ⊗ (w, ẇ)</div>
          <div className="text-[var(--color-chutney)]">= (v w, v̇ w + v ẇ)</div>
          <div className="mt-4 text-[var(--color-text)]">(x, 1) ⊗ (x, 1)</div>
          <div className="text-[var(--color-chutney)]">= (x², 2x)</div>
          <p className="mt-3 text-[var(--color-faint)]">
            the tangent is carried exactly, over the same field
          </p>
        </div>
      );
    case 2: {
      const four = [
        [2, 1, 0, 1],
        [0, 3, 1, 0],
        [1, 0, 2, 1],
        [0, 1, 0, 1],
      ];
      return (
        <div className={box}>
          <div className="text-[var(--color-gold)]">shrunk to a readable case</div>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div>
              <div className="grid grid-cols-4 gap-1">
                {four.flat().map((value, i) => (
                  <span
                    key={i}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-line)] text-[0.625rem] text-[var(--color-muted)]"
                  >
                    {value}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-center text-[0.625rem] text-[var(--color-faint)]">4 by 4</div>
            </div>
            <span className="text-lg text-[var(--color-gold)]">→</span>
            <div>
              <div className="flex h-7 w-12 items-center justify-center rounded border border-[var(--color-chutney)]/50 text-[0.6875rem] text-[var(--color-chutney)]">
                [ 1 ]
              </div>
              <div className="mt-2 text-center text-[0.625rem] text-[var(--color-faint)]">1 by 1</div>
            </div>
          </div>
          <p className="mt-4 text-[var(--color-faint)]">still a counterexample, and now readable</p>
        </div>
      );
    }
    case 3:
      return (
        <div className={box}>
          <div className="text-[var(--color-gold)]">an agent verifying its own derivation</div>
          <div className="mt-3">
            <span className="text-[var(--color-slate)]">tool</span> samosa.check_derivation
          </div>
          <div>
            <span className="text-[var(--color-slate)]">args</span> kalman.tex
          </div>
          <div className="mt-1 text-[var(--color-tamarind)]">
            → row 7 ✗ wrong
          </div>
          <div className="text-[var(--color-muted)]">  an inverse where there should be none</div>
          <div className="mt-2 text-[var(--color-chutney)]">→ fix applied · 8/8 rows hold</div>
        </div>
      );
    case 4:
      return (
        <div className={box}>
          <div className="text-[var(--color-gold)]">the pull request, annotated</div>
          <div className="mt-3 rounded border-l-2 border-[var(--color-tamarind)] bg-[var(--color-tamarind)]/10 p-3">
            <div className="text-[var(--color-tamarind)]">
              ::error file=paper/appendix.tex,line=132,col=18
            </div>
            <div className="mt-1 text-[var(--color-text)]">the two sides are not equal</div>
            <div className="text-[var(--color-muted)]">off by exactly + K_t Q_t K_tᵀ</div>
          </div>
          <div className="mt-3 text-[var(--color-tamarind)]">the job failed with 1 error</div>
        </div>
      );
    default:
      return (
        <div className={box}>
          <div className="text-[var(--color-gold)]">36 papers, measured</div>
          <div className={`${row} mt-2`}>
            <span>claim rows</span>
            <span className="text-[var(--color-text)]">1219</span>
          </div>
          <div className="text-[var(--color-faint)]">197 rows make no claim, and are not counted</div>
          <div className="mt-3">
            <div className={row}>
              <span>parses end to end</span>
              <span className="text-[var(--color-text)]">56.3%</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-[var(--color-line)]">
              <div className="h-full rounded bg-[var(--color-gold)]" style={{ width: '56.3%' }} />
            </div>
          </div>
          <div className="mt-4">
            <div className={row}>
              <span>no unknown construct</span>
              <span className="text-[var(--color-text)]">24.9%</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-[var(--color-line)]">
              <div className="h-full rounded bg-[var(--color-chutney)]" style={{ width: '24.9%' }} />
            </div>
          </div>
          <p className="mt-4 text-[var(--color-faint)]">the first number was lenient; this one parses the whole row. the second is an upper bound, because the run does not read the preamble</p>
        </div>
      );
  }
}

