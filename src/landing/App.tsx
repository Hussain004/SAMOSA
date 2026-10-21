import { useEffect, useRef, useState } from 'react';
import { AsciiSamosa } from './AsciiSamosa.tsx';
import { TypedDemo } from './typed-demo.tsx';
import { MENU } from '../../corpus/menu.ts';
import { MOCKS } from './demo-scripts.ts';
import TEX from './generated-tex.json';

/**
 * The landing page.
 *
 * The structure follows the plan: a hero with the ASCII samosa, the agent
 * demo, six feature cards with live mocks, a playful divider, the hall of
 * bugs, five deep dives, the menu, the install tabs and the footer.
 */

export function Landing() {
  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--color-text)]">
      <Header />
      <main>
        <Hero />
        <Intro />
        <AgentDemo />
        <Tour />
        <Features />
        <Divider />
        <HallOfBugs />
        <DeepDives />
        <MenuSection />
        <Install />
        <Changelog />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem('samosa:stars');
    if (cached) {
      setStars(Number(cached));
      return;
    }
    // the star count is fetched once and cached for an hour
    fetch('https://api.github.com/repos/Hussain004/SAMOSA')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.stargazers_count === 'number') {
          setStars(data.stargazers_count);
          localStorage.setItem('samosa:stars', String(data.stargazers_count));
          localStorage.setItem('samosa:stars:at', String(Date.now()));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[#0b0a08cc] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-6 py-4">
        <a href="/" className="flex items-center gap-2 text-[var(--color-gold)]">
          <span className="text-lg leading-none">∇</span>
          <span className="text-sm tracking-[0.2em]">SAMOSA</span>
        </a>
        <span className="hidden text-xs text-[var(--color-faint)] md:inline">
          step auditor for matrix math
        </span>
        <nav className="ml-auto flex items-center gap-5 text-[13px] text-[var(--color-muted)]">
          <a href="#how" className="hover:text-[var(--color-text)]">
            How it works
          </a>
          <a href="#menu" className="hover:text-[var(--color-text)]">
            Menu
          </a>
          <a href="#install" className="hover:text-[var(--color-text)]">
            Install
          </a>
          <a
            href="https://github.com/Hussain004/SAMOSA"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-text)]"
          >
            ★ GitHub{stars ? ` ${stars}` : ''}
          </a>
          <a
            href="/app"
            className="rounded bg-[var(--color-gold)] px-3 py-1.5 font-medium text-[var(--color-ink)] transition-colors hover:bg-[#f3c368]"
          >
            Open app →
          </a>
        </nav>
      </div>
    </header>
  );
}

const PHRASES = [
  'every step, checked',
  'counterexamples, not vibes',
  'no AI in the verdict',
  'runs in your browser',
  'your agent can use it too',
];

function Hero() {
  return (
    <section className="dotted relative">
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 py-16 md:grid-cols-[1fr_1.15fr] md:py-24">
        <div>
          <h1 className="font-display text-[clamp(34px,4.6vw,70px)] leading-[1.02]">
            <span className="whitespace-nowrap">Derive more.</span>
            <br />
            <span className="whitespace-nowrap text-[var(--color-muted)]">Doubt less.</span>
          </h1>
          <PhraseList />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/app"
              className="rounded bg-[var(--color-gold)] px-5 py-3 font-medium text-[var(--color-ink)] transition-colors hover:bg-[#f3c368]"
            >
              Open SAMOSA →
            </a>
            <CopyChip text="npx samosa-math check paper.tex" />
          </div>
        </div>
        <AsciiSamosa />
      </div>
    </section>
  );
}

function PhraseList() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(PHRASES.length);
      return;
    }
    const timers: number[] = [];
    PHRASES.forEach((_, i) => {
      timers.push(window.setTimeout(() => setCount(i + 1), 400 + i * 900));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
  return (
    <ul className="mt-8 space-y-1 text-[15px] text-[var(--color-muted)]" aria-label="What SAMOSA does">
      {PHRASES.slice(0, count).map((phrase) => (
        <li key={phrase} className="reveal in">
          <span className="mr-1 text-[var(--color-chutney)]">›</span>
          {phrase}
        </li>
      ))}
    </ul>
  );
}

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-[13px] text-[var(--color-text)] transition-colors hover:border-[var(--color-gold)]"
    >
      {copied ? '✓ copied' : `$ ${text}`}
    </button>
  );
}

function Intro() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto max-w-[1180px] px-6 py-10">
        <p className="max-w-[900px] text-[17px] leading-relaxed tracking-wide text-[var(--color-text)]">
          SAMOSA checks every step of your derivation by evaluating it on random matrices: exactly,
          over finite fields. Wrong steps come with a 2×2 counterexample and a fix.
        </p>
      </div>
    </section>
  );
}

function AgentDemo() {
  return (
    <section className="dotted">
      <div className="mx-auto max-w-[1180px] px-6 py-20">
        <SectionHead
          eyebrow="the agent session"
          title="Your agent can check its own math"
          body="SAMOSA ships an MCP server and an Agent Skill, so Claude Code, Codex or Cursor can verify a derivation before they hand it to you. The verdict comes from the engine, never from the model."
        />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <TypedDemo />
          <ul className="space-y-4 text-[13px] text-[var(--color-muted)]">
            <li className="flex gap-3">
              <span className="text-[var(--color-chutney)]">›</span>
              <span>
                <b className="text-[var(--color-text)]">The tool call is small.</b> One function, one
                derivation, one report.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--color-chutney)]">›</span>
              <span>
                <b className="text-[var(--color-text)]">The verdict is evidence.</b> Every checkmark
                carries the sizes, the trials, the primes and the bound.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--color-chutney)]">›</span>
              <span>
                <b className="text-[var(--color-text)]">Nothing is uploaded.</b> The link that comes
                back keeps the derivation in the fragment of the URL.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Tour() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto max-w-[1180px] px-6 py-16">
        <SectionHead
          eyebrow="nineteen seconds"
          title="The line nobody checks"
          body="The moment every derivation has: after some algebraic manipulation, we may obtain. SAMOSA reads that line, evaluates it over a finite field, and brings a counterexample you can read."
        />
        <video
          className="mt-8 w-full rounded-lg border border-[var(--color-line)]"
          src="/brag.mp4"
          poster="/brag.jpg"
          autoPlay
          muted
          loop
          playsInline
        />
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: 'Counterexamples',
    body: 'Not "the numbers differ". A 2 by 2 instance, shrunk until it is small enough to read, that breaks the step.',
    mock: <CounterexampleMock />,
  },
  {
    title: 'Fixes',
    body: 'The common mistakes, tried for you: a transposed product, a missing noise term, a factor of two.',
    mock: <FixMock />,
  },
  {
    title: 'Shape errors',
    body: 'When the sizes do not fit, SAMOSA says which sizes do not fit, and suggests the transpose you forgot.',
    mock: <ShapeMock />,
  },
  {
    title: 'Gradients',
    body: 'Gradients and Hessians are checked with dual numbers, so the layout convention is diagnosed, not guessed.',
    mock: <GradientMock />,
  },
  {
    title: 'Guarantees',
    body: 'A checkmark without a bound is a guess. Every verdict carries the probability that a wrong step slipped through.',
    mock: <GuaranteeMock />,
  },
  {
    title: 'Your pipeline',
    body: 'A CLI, a GitHub Action and an MCP server. The same engine, so the verdicts never disagree.',
    mock: <TerminalMock />,
  },
];

function Features() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto max-w-[1180px] px-6 py-20">
        <SectionHead
          eyebrow="what it does"
          title="Six things, all of them useful"
          body="SAMOSA never guesses. When it does not know, it says so, and tells you what to declare."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded border border-[var(--color-line)] bg-[var(--color-ink)] p-5 transition-colors hover:border-[var(--color-gold)]/50"
            >
              <h3 className="text-[15px] font-medium">{feature.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">{feature.body}</p>
              <div className="mt-4">{feature.mock}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CounterexampleMock() {
  return (
    <Mock>
      <MockLine tone="bad">
        ✗ row {MOCKS.counterexample.row} · the two sides are not equal
      </MockLine>
      <pre className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
        {formatValues(MOCKS.counterexample.values, MOCKS.counterexample.derived)}
      </pre>
    </Mock>
  );
}

/** The values of a counterexample, as the engine found them. */
function formatValues(
  values: Record<string, number[] | number>,
  derived: Record<string, number[] | number>,
): string {
  const lines: string[] = [];
  const show = (name: string, value: number[] | number) => {
    if (typeof value === 'number') {
      lines.push(`${name} = ${value}`);
      return;
    }
    const size = Math.max(1, Math.round(Math.sqrt(value.length)));
    lines.push(`${name} =`);
    for (let i = 0; i < value.length; i += size) {
      lines.push(`  [ ${value.slice(i, i + size).join(', ')} ]`);
    }
  };
  for (const [name, value] of Object.entries(values)) show(name, value);
  for (const [name, value] of Object.entries(derived)) show(`${name} (computed)`, value);
  return lines.join('\n');
}

function FixMock() {
  return (
    <Mock>
      <MockLine tone="plain">{MOCKS.fix.title}</MockLine>
      <pre className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
        {MOCKS.fix.edit}
      </pre>
    </Mock>
  );
}

function ShapeMock() {
  return (
    <Mock>
      <MockLine tone="bad">
        ⊘ row {MOCKS.shape.row} · {MOCKS.shape.message}
      </MockLine>
      <pre className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
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
      <pre className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
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
      <pre className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
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
      <pre className="text-[11px] leading-relaxed text-[var(--color-muted)]">
        {`$ npx samosa-math check paper.tex
  132:18  ✗ wrong  not equal
  141:5   ⊘ shape  n ≠ m
✗ 1 wrong · ⊘ 1 shape · ✓ 41 · 38 ms`}
      </pre>
    </Mock>
  );
}

function Mock({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-[var(--color-line)] bg-black/25 p-3">{children}</div>;
}

function MockLine({ children, tone }: { children: React.ReactNode; tone: 'ok' | 'bad' | 'plain' }) {
  return (
    <div
      className={`text-[11px] ${
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

function Divider() {
  const bubbles = [
    '(AB)ᵀ ≠ AᵀBᵀ, bestie',
    'you dropped + KQKᵀ',
    "that's numerator layout 👀",
    '≈ is not =',
  ];
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-center gap-6 px-6 py-12">
        <span className="text-[13px] tracking-[0.3em] text-[var(--color-faint)]">SAMOSA-SERVATIONS</span>
        {bubbles.map((bubble, i) => (
          <div key={bubble} className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">
              {['🥟', '🥠', '🔥', '🫓'][i]}
            </span>
            <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[12px] text-[var(--color-muted)]">
              {bubble}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}



function HallOfBugs() {
  return (
    <section className="overflow-hidden border-b border-[var(--color-line)] py-16">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="the hall of bugs"
          title="Real mistakes, caught by a machine"
          body="The kinds of slip that survive a proof, a code review and a careful read of the paper."
        />
      </div>
      <div className="mt-10 flex overflow-hidden">
        <div className="flex shrink-0 animate-[marquee_40s_linear_infinite] gap-8 pr-8">
          {[...RENDERED.bugs, ...RENDERED.bugs].map((bug, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center gap-3 rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-4"
            >
              <span className="text-[var(--color-tamarind)]">✗</span>
              <span className="text-[15px]" dangerouslySetInnerHTML={{ __html: bug }} />
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </section>
  );
}

const DEEP_DIVES = [
  {
    n: '01',
    title: 'Exact, not approximate',
    body: 'A step that only uses rational operations is checked over a finite field, where a wrong step survives with probability at most d/p. SAMOSA computes that d, and shows it to you.',
    link: '/docs/HOW_IT_WORKS.md',
  },
  {
    n: '02',
    title: 'Gradients by dual numbers',
    body: 'A derivative is a pair, a value and a tangent. Multiply them, and the tangent chain rule comes out on its own, exactly, over the same field.',
    link: '/docs/HOW_IT_WORKS.md',
  },
  {
    n: '03',
    title: 'Counterexamples that shrink',
    body: 'A counterexample over a finite field is unreadable. SAMOSA looks for a small integer instance that still breaks the step, the way a fuzzer shrinks a failing case.',
    link: '/docs/HOW_IT_WORKS.md',
  },
  {
    n: '04',
    title: 'Built for agents',
    body: 'An MCP server and an Agent Skill, so your agent can check the matrix algebra before it hands the derivation to you.',
    link: '/docs/MCP.md',
  },
  {
    n: '05',
    title: 'In your pipeline',
    body: 'A CLI and a GitHub Action that lint the align blocks of a paper, and fail the build when a step is wrong.',
    link: '/docs/CLI.md',
  },
  {
    n: '06',
    title: 'It reads real papers',
    body: 'Of the display math of 39 recent papers, 78% parses and 55% is understood well enough to check. The number is measured, and published.',
    link: '/docs/COVERAGE.md',
  },
];

function DeepDives() {
  return (
    <section className="dotted" id="how">
      <div className="mx-auto max-w-[1180px] px-6 py-20">
        <SectionHead
          eyebrow="how it works"
          title="Five ideas, no magic"
          body="There is no model in the loop. There is arithmetic, a finite field and a probability bound."
        />
        <div className="mt-12 space-y-10">
          {DEEP_DIVES.map((dive, i) => (
            <div
              key={dive.n}
              className={`grid items-start gap-6 md:grid-cols-[auto_1fr] ${i % 2 ? 'md:pl-16' : ''}`}
            >
              <span className="font-display text-4xl text-[var(--color-gold)]">{dive.n}</span>
              <div>
                <h3 className="text-lg">{dive.title}</h3>
                <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-[var(--color-muted)]">
                  {dive.body}
                </p>
                <a
                  href={dive.link}
                  className="mt-2 inline-block text-[13px] text-[var(--color-gold)] hover:underline"
                >
                  read more →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MenuSection() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]" id="menu">
      <div className="mx-auto max-w-[1180px] px-6 py-20">
        <SectionHead
          eyebrow="the menu"
          title="Fifteen derivations to try"
          body="Woodbury, the Kalman update, backprop, Gaussian expectations. Each one has a planted bug, and a spot the bug game."
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MENU.map((item) => (
            <a
              key={item.id}
              href={`/app#menu=${item.id}`}
              className="rounded border border-[var(--color-line)] bg-[var(--color-ink)] p-4 transition-colors hover:border-[var(--color-gold)]/60"
            >
              <h3 className="text-[14px] font-medium">{item.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-faint)]">{item.blurb}</p>
              <div className="mt-3 overflow-x-auto text-[14px]" dangerouslySetInnerHTML={{ __html: RENDERED.menu[item.id] ?? '' }} />
              <p className="mt-2 text-[11px] text-[var(--color-faint)]">spot the bug →</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}


const TABS = [
  {
    id: 'web',
    label: 'Web',
    body: 'Open the app, paste a derivation, read the verdicts. Everything runs in your browser, and the share link keeps it in the URL fragment.',
  },
  {
    id: 'cli',
    label: 'CLI',
    body: 'npx samosa-math check paper.tex\nnpx samosa-math check notes.md --format sarif --fail-on wrong,shape',
  },
  {
    id: 'claude',
    label: 'Claude Code',
    body: 'claude mcp add samosa -- npx -y -p samosa-math samosa-mcp',
  },
  {
    id: 'codex',
    label: 'Codex',
    body: '[mcp_servers.samosa]\ncommand = "npx"\nargs = ["-y", "-p", "samosa-math", "samosa-mcp"]',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    body: '{ "mcpServers": { "samosa": { "command": "npx", "args": ["-y", "-p", "samosa-math", "samosa-mcp"] } } }',
  },
  {
    id: 'action',
    label: 'GitHub Action',
    body: '- uses: Hussain004/SAMOSA@v1\n  with:\n    path: "paper/**/*.tex"\n    fail-on: "wrong,shape"',
  },
];

function Install() {
  const [tab, setTab] = useState(0);
  return (
    <section className="dotted" id="install">
      <div className="mx-auto max-w-[1180px] px-6 py-20">
        <SectionHead
          eyebrow="install"
          title="One click, or one line"
          body="The web app needs nothing. The CLI and the MCP server need npm, and that is all."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="panel p-5">
            <h3 className="text-sm">In your browser</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
              No account, no upload, no server. The engine runs in a worker, in the tab, and the
              derivation never leaves the device.
            </p>
            <a
              href="/app"
              className="mt-4 inline-block rounded bg-[var(--color-gold)] px-4 py-2 text-[13px] font-medium text-[var(--color-ink)]"
            >
              Open the app
            </a>
          </div>
          <div className="panel p-5">
            <h3 className="text-sm">In your agent and your CI</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
              The npm package carries the CLI, the MCP server and the GitHub Action. The same engine
              gives the same verdicts everywhere.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {['npx samosa-math check paper.tex', 'claude mcp add samosa', 'uses: Hussain004/SAMOSA@v1'].map(
                (line) => (
                  <span
                    key={line}
                    className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px] text-[var(--color-faint)]"
                  >
                    {line}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-1.5">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTab(i)}
              className={`rounded px-3 py-1.5 text-[12px] ${
                i === tab
                  ? 'bg-[var(--color-gold)] text-[var(--color-ink)]'
                  : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-gold)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyChip text={TABS[tab].body} />
      </div>
    </section>
  );
}

/** The same entries as CHANGELOG.md. */
const CHANGELOG = [
  {
    date: '2026-10-21',
    title: 'The first release',
    body: 'The engine, the app, the CLI, the MCP server and fifteen derivations.',
  },
  {
    date: '2026-10-21',
    title: 'The Joseph form',
    body: 'The Kalman update of Lecture 8, with its two planted bugs.',
  },
  {
    date: '2026-10-21',
    title: 'Dual numbers',
    body: 'Gradients and Hessians, checked exactly over a finite field.',
  },
];

function Changelog() {
  return (
    <section className="border-t border-[var(--color-line)]">
      <div className="mx-auto max-w-[1180px] px-6 py-16">
        <h2 className="text-sm tracking-[0.2em] text-[var(--color-faint)]">ANNOUNCEMENTS</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {CHANGELOG.map((entry) => (
            <div key={entry.title} className="rounded border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <span className="text-[11px] text-[var(--color-faint)]">{entry.date}</span>
              <h3 className="mt-1 text-[14px]">{entry.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{entry.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-6 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-gold)]">
            <span className="text-lg leading-none">∇</span>
            <span className="text-sm tracking-[0.2em]">SAMOSA</span>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-muted)]">
            A step auditor for matrix algebra, stochastics and algebra. MIT licensed.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-[12px] text-[var(--color-chutney)]">
            <span>●</span> all checks local, nothing uploaded
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            ['The app', '/app'],
            ['The menu', '/app#menu'],
            ['How it works', '/docs/HOW_IT_WORKS.md'],
          ]}
        />
        <FooterColumn
          title="Docs"
          links={[
            ['Notation', '/docs/NOTATION.md'],
            ['The CLI', '/docs/CLI.md'],
            ['The MCP server', '/docs/MCP.md'],
            ['Privacy', '/docs/PRIVACY.md'],
          ]}
        />
        <FooterColumn
          title="Community"
          links={[
            ['GitHub', 'https://github.com/Hussain004/SAMOSA'],
            ['Discussions', 'https://github.com/Hussain004/SAMOSA/discussions'],
            ['Cite', 'https://github.com/Hussain004/SAMOSA/blob/main/CITATION.cff'],
          ]}
        />
      </div>
      <div className="border-t border-[var(--color-line)] px-6 py-6 text-center text-[11px] text-[var(--color-faint)]">
        ∇ SAMOSA · a ∇ is just a samosa with filling
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="pane-title">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-[13px] text-[var(--color-muted)]">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="hover:text-[var(--color-text)]">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div>
      <span className="text-[11px] tracking-[0.3em] text-[var(--color-faint)]">{eyebrow.toUpperCase()}</span>
      <h2 className="font-display mt-2 text-[clamp(28px,4vw,46px)] leading-tight">{title}</h2>
      <p className="mt-3 max-w-[680px] text-[14px] leading-relaxed text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

/** The rendered math of the landing page, made at build time. */
const RENDERED = TEX as { bugs: string[]; menu: Record<string, string> };

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
