import { useEffect, useRef, useState } from 'react';
import { AsciiSamosa } from './AsciiSamosa.tsx';
import { TypedDemo } from './typed-demo.tsx';
import { MENU } from '../../corpus/menu.ts';
import { MOCKS } from './demo-scripts.ts';
import { openApp } from './open-transition.ts';
import { FontSizeControl } from '../font-size.tsx';
import TEX from './generated-tex.json';
import ANNOUNCEMENTS from './generated-announcements.json';

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
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-bar)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1560px] items-center gap-4 px-6 lg:px-10 py-4 sm:gap-6">
        <a href="/" className="flex items-center gap-2 text-[var(--color-gold)]">
          <span className="text-lg leading-none">∇</span>
          <span className="text-sm tracking-[0.2em]">SAMOSA</span>
        </a>
        <span className="hidden whitespace-nowrap text-xs text-[var(--color-faint)] 2xl:inline">
          step auditor for matrix math
        </span>
        <nav className="ml-auto flex items-center gap-4 whitespace-nowrap text-[0.8125rem] text-[var(--color-muted)] lg:gap-5">
          <a href="#how" className="hidden hover:text-[var(--color-text)] md:inline">
            How it works
          </a>
          <a href="#menu" className="hidden hover:text-[var(--color-text)] md:inline">
            Menu
          </a>
          <a href="#install" className="hidden hover:text-[var(--color-text)] md:inline">
            Install
          </a>
          <a href="/docs/HOW_IT_WORKS" className="hidden hover:text-[var(--color-text)] xl:inline">
            Docs
          </a>
          <a href="/docs/CHANGELOG" className="hidden hover:text-[var(--color-text)] xl:inline">
            Changelog
          </a>
          <a
            href="https://github.com/Hussain004/SAMOSA"
            target="_blank"
            rel="noreferrer"
            className="hidden whitespace-nowrap hover:text-[var(--color-text)] sm:inline"
          >
            ★ GitHub
          </a>
          <FontSizeControl className="hidden sm:flex" />
          <ThemeToggle />
          <a
            href="/app"
            onClick={openApp}
            className="rounded bg-[var(--color-gold)] px-3 py-1.5 font-medium text-[var(--color-ink)] transition-colors hover:bg-[#f3c368]"
          >
            Open app →
          </a>
        </nav>
      </div>
    </header>
  );
}

/** The paper and the ink: the choice is kept, and the app reads it too. */
function ThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light');
  // the page is dressed by the stylesheet now, so the colours of the first
  // paint can go
  useEffect(() => {
    document.getElementById('samosa-boot')?.remove();
  }, []);
  const flip = () => {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? 'light' : 'dark';
    document.documentElement.style.colorScheme = next ? 'light' : 'dark';
    try {
      localStorage.setItem('samosa-theme', next ? 'light' : 'dark');
    } catch {
      // a private window can refuse storage; the page still changes
    }
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={light ? 'Switch to the dark theme' : 'Switch to the light theme'}
      title={light ? 'Dark theme' : 'Light theme'}
      className="rounded border border-[var(--color-line)] px-2 py-1 leading-none text-[var(--color-muted)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
    >
      <span aria-hidden="true">{light ? '☾' : '☀'}</span>
    </button>
  );
}

const PHRASES = [
  'a verdict on every row of your align block',
  'a wrong row comes with a counterexample and a fix',
  'every checkmark says how sure it is',
  'no language model decides anything',
  'it runs in this tab, and nothing is uploaded',
];

function Hero() {
  return (
    <section className="dotted relative">
      <div className="mx-auto grid max-w-[1560px] items-start gap-10 px-6 lg:px-10 py-16 md:grid-cols-[1fr_1.15fr] md:py-24">
        <div className="order-2 md:order-1">
          <h1 className="font-display text-[clamp(34px,4.6vw,70px)] leading-[1.02]">
            <span className="whitespace-nowrap">Derive more.</span>
            <br />
            <span className="whitespace-nowrap text-[var(--color-muted)]">Doubt less.</span>
          </h1>
          <PhraseList />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/app"
              onClick={openApp}
              className="rounded bg-[var(--color-gold)] px-5 py-3 font-medium text-[var(--color-ink)] transition-colors hover:bg-[#f3c368]"
            >
              Open SAMOSA →
            </a>
            <CopyChip text="npx samosa-math check paper.tex" />
          </div>
        </div>
        <div className="order-1 md:order-2">
          <AsciiSamosa />
        </div>
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
    <ul className="mt-8 space-y-1 text-[0.9375rem] text-[var(--color-muted)]" aria-label="What SAMOSA does">
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
      className="rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-[0.8125rem] text-[var(--color-text)] transition-colors hover:border-[var(--color-gold)]"
    >
      {copied ? '✓ copied' : text}
    </button>
  );
}

function Intro() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-10">
        <p className="max-w-[900px] text-[1.0625rem] leading-relaxed tracking-wide text-[var(--color-text)]">
          I built SAMOSA for one line in my Mobile Robotics notes: <em>after some algebraic manipulation, we may obtain ...</em> It checks that line on sampled matrices, exactly, and shows you the row that breaks.
        </p>
      </div>
    </section>
  );
}

function AgentDemo() {
  return (
    <section className="dotted">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="your agent, checked"
          body="Agents write algebra fluently, and are sometimes wrong in the row that matters. SAMOSA lets them check it first."
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
                <b className="text-[var(--color-text)]">Evidence, not opinion.</b> Every checkmark says
                how it was tested.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--color-chutney)]">›</span>
              <span>
                <b className="text-[var(--color-text)]">Nothing is uploaded.</b> No network calls, ever.
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
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16">
        <SectionHead
          eyebrow="nineteen seconds"
          body="The Kalman gain, one dropped noise term, caught."
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
function TourVideo() {
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

const FEATURES = [
  {
    title: 'Counterexamples',
    body: 'The smallest instance that breaks the step, with a NumPy snippet to rerun it.',
    mock: <CounterexampleMock />,
  },
  {
    title: 'Fixes',
    body: 'The usual slips are tried for you, and a fix is offered only if it holds.',
    mock: <FixMock />,
  },
  {
    title: 'Shape errors',
    body: 'Which sizes do not fit, and the transpose that would fix them.',
    mock: <ShapeMock />,
  },
  {
    title: 'Gradients',
    body: 'Checked with dual numbers. A layout slip is named as one.',
    mock: <GradientMock />,
  },
  {
    title: 'Guarantees',
    body: 'Every checkmark says how it was tested. An exact one carries a bound, usually below 10⁻⁴⁶.',
    mock: <GuaranteeMock />,
  },
  {
    title: 'Your pipeline',
    body: 'App, CLI, Action and MCP server share one engine, so verdicts never disagree.',
    mock: <TerminalMock />,
  },
];

function Features() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="what you get back"
          body="A verdict and a reason for every row. It never guesses a checkmark."
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

function Divider() {
  const bubbles = [
    '(AB)ᵀ ≠ AᵀBᵀ, bestie',
    'you dropped + KQKᵀ',
    "that's numerator layout 👀",
    '≈ is not =',
  ];
  const states = ['crispy', 'soggy', 'burnt', 'raw'] as const;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % bubbles.length), 4000);
    return () => window.clearInterval(timer);
  }, [bubbles.length]);

  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-center gap-6 px-6 lg:px-10 py-12">
        <span className="text-[0.8125rem] tracking-[0.3em] text-[var(--color-faint)]">SAMOSA-SERVATIONS</span>
        {bubbles.map((bubble, i) => (
          <div
            key={bubble}
            className="flex items-center gap-2"
          >
            {/* the inactive sprite dims, the text stays at full contrast */}
            <div
              className={`transition-opacity duration-500 ${i === active ? 'opacity-100' : 'opacity-55'}`}
              aria-hidden="true"
            >
              <PixelSamosa state={states[i]} />
            </div>
            <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[0.75rem] text-[var(--color-muted)]">
              {bubble}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * A 16 by 16 pixel samosa.
 *
 * The four states are the verdict states: crispy is a step that holds,
 * soggy is one the engine could not decide, burnt is one that is wrong and
 * raw is one that was not read. The sprite is a triangle with a crimped top,
 * drawn as one rect per pixel so it stays crisp at any size.
 */
function PixelSamosa({ state }: { state: 'crispy' | 'soggy' | 'burnt' | 'raw' }) {
  const palettes = {
    crispy: { body: '#e8b04b', shade: '#c48a24', edge: '#8a5a12', crimp: '#f2c96a', highlight: '#f7dc94' },
    soggy: { body: '#b9a06a', shade: '#8f7a4b', edge: '#5f4f2e', crimp: '#cbb684', highlight: '#d6c79a' },
    burnt: { body: '#5a4632', shade: '#3b2d20', edge: '#22190f', crimp: '#6d563e', highlight: '#8a5a3a' },
    raw: { body: '#d9c9a3', shade: '#b9a980', edge: '#8a7c58', crimp: '#e6d9b8', highlight: '#f2e8cd' },
  };
  const palette = palettes[state];
  const pixels: React.ReactNode[] = [];

  const put = (x: number, y: number, fill: string) => {
    pixels.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
  };

  // the crimped edge: a serrated band, wider than the body it sits on
  const crimpRows: Array<[number, number[]]> = [
    [1, [4, 6, 8, 10]],
    [2, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    [3, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  ];
  for (const [y, xs] of crimpRows) {
    for (const x of xs) put(x, y, y === 1 ? palette.crimp : palette.body);
  }

  // the body: a triangle that widens to the base
  for (let y = 4; y <= 14; y++) {
    const width = 4 + (y - 4);
    const startX = Math.floor((16 - width) / 2);
    for (let i = 0; i < width; i++) {
      const x = startX + i;
      const edge = i === 0 || i === width - 1 || y === 14;
      const shade = i >= width - 3;
      const highlight = y >= 5 && y <= 8 && i === 1;
      put(
        x,
        y,
        edge ? palette.edge : shade ? palette.shade : highlight ? palette.highlight : palette.body,
      );
    }
  }

  return (
    <svg
      viewBox="0 0 16 16"
      width="30"
      height="30"
      role="img"
      aria-label={`a ${state} samosa`}
      shapeRendering="crispEdges"
    >
      {pixels}
    </svg>
  );
}

function HallOfBugs() {
  return (
    <section className="overflow-hidden border-b border-[var(--color-line)] py-16">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10">
        <SectionHead
          eyebrow="the hall of bugs"
          body="Each looks right on a careful read. Each is wrong."
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
    title: 'It reads real papers',
    body: 'On 36 recent papers, 56.3% of claim rows parse end to end, and 24.9% read with nothing unknown.',
    link: '/docs/COVERAGE',
  },
];

function DeepDives() {
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
            the tangent rides along, exactly, over the same field
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
          <div className="text-[var(--color-gold)]">shrink until a person can read it</div>
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
          <p className="mt-4 text-[var(--color-faint)]">still wrong, and now readable</p>
        </div>
      );
    }
    case 3:
      return (
        <div className={box}>
          <div className="text-[var(--color-gold)]">an agent, checking its own work</div>
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

function MenuSection() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-panel)]" id="menu">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="the menu"
          body={`${MENU.length} real derivations, each with a planted bug. Find it before SAMOSA does.`}
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


const TABS = [
  {
    id: 'web',
    label: 'Web',
    body: 'Paste a derivation, or start from the menu. Nothing to install.',
    snippet: 'https://samosa-math.vercel.app/app',
  },
  {
    id: 'cli',
    label: 'CLI',
    body: 'The CLI reads a paper, a note or the standard input, and prints the verdicts in the format you ask for.',
    snippet: 'npx samosa-math check paper.tex --format sarif',
  },
  {
    id: 'claude',
    label: 'Claude Code',
    body: 'The MCP server gives an agent the same engine, with the counterexamples and the fixes.',
    snippet: 'claude mcp add samosa -- npx -y -p samosa-math samosa-mcp',
  },
  {
    id: 'codex',
    label: 'Codex',
    body: 'The same server, in the config file Codex reads.',
    snippet: '[mcp_servers.samosa]\ncommand = "npx"\nargs = ["-y", "-p", "samosa-math", "samosa-mcp"]',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    body: 'The same server, in the config file Cursor reads.',
    snippet: '{ "mcpServers": { "samosa": { "command": "npx", "args": ["-y", "-p", "samosa-math", "samosa-mcp"] } } }',
  },
  {
    id: 'skill',
    label: 'Skill',
    body: 'The Agent Skill lives in the repository, and it teaches an agent how to write a derivation SAMOSA can check.',
    snippet: 'npx skills add Hussain004/SAMOSA',
  },
  {
    id: 'action',
    label: 'GitHub Action',
    body: 'The action checks every paper in a pull request, and a wrong step fails the build.',
    snippet: '- uses: Hussain004/SAMOSA@v1\n  with:\n    path: "paper/**/*.tex"\n    fail-on: "wrong,shape"',
  },
];


function Install() {
  const [tab, setTab] = useState(0);
  return (
    <section className="dotted" id="install">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-20">
        <SectionHead
          eyebrow="install"
          body="The web app needs nothing. The CLI and the MCP server are one npm package."
        />
        <div className="mt-10 flex flex-wrap gap-1.5">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTab(i)}
              className={`rounded px-3 py-1.5 text-[0.75rem] ${
                i === tab
                  ? 'bg-[var(--color-gold)] text-[var(--color-ink)]'
                  : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-gold)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-4 max-w-[640px] text-[0.8125rem] leading-relaxed text-[var(--color-muted)]">
          {TABS[tab].body}
        </p>
        <div className="mt-3">
          <CopyChip text={TABS[tab].snippet} />
        </div>
      </div>
    </section>
  );
}

/** The same entries as CHANGELOG.md, written by the generator. */
const CHANGELOG = ANNOUNCEMENTS as Array<{ date: string; version: string; body: string }>;

function Changelog() {
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

function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="mx-auto grid max-w-[1560px] gap-8 px-6 lg:px-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-gold)]">
            <span className="text-lg leading-none">∇</span>
            <span className="text-sm tracking-[0.2em]">SAMOSA</span>
          </div>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-[var(--color-muted)]">
            A step auditor for matrix algebra, stochastics and algebra. MIT licensed.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-[0.75rem] text-[var(--color-chutney)]">
            <span>●</span> all checks local, nothing uploaded
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            ['The app', '/app'],
            ['The menu', '/app#menu'],
            ['How it works', '/docs/HOW_IT_WORKS'],
          ]}
        />
        <FooterColumn
          title="Docs"
          links={[
            ['Notation', '/docs/NOTATION'],
            ['The CLI', '/docs/CLI'],
            ['The MCP server', '/docs/MCP'],
            ['Privacy', '/docs/PRIVACY'],
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
      <div className="border-t border-[var(--color-line)] px-6 lg:px-10 py-6 text-center text-[0.6875rem] text-[var(--color-faint)]">
        ∇ SAMOSA · a ∇ is just a samosa with filling
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="pane-title">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-[0.8125rem] text-[var(--color-muted)]">
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

/**
 * The head of a section. A headline is optional: most sections say what they
 * are about in a sentence that carries information, and then the small label
 * is the heading of the section, so the outline of the page stays whole.
 */
function SectionHead({ eyebrow, title, body }: { eyebrow: string; title?: string; body: string }) {
  if (!title) {
    return (
      <div>
        <h2 className="text-[0.6875rem] font-normal tracking-[0.3em] text-[var(--color-faint)]">{eyebrow.toUpperCase()}</h2>
        <p className="mt-4 max-w-[820px] text-[1.0625rem] leading-relaxed tracking-wide text-[var(--color-text)]">{body}</p>
      </div>
    );
  }
  return (
    <div>
      <span className="text-[0.6875rem] tracking-[0.3em] text-[var(--color-faint)]">{eyebrow.toUpperCase()}</span>
      <h2 className="font-display mt-2 text-[clamp(28px,4vw,46px)] leading-tight">{title}</h2>
      <p className="mt-3 max-w-[680px] text-[0.875rem] leading-relaxed text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

/** The rendered math of the landing page, made at build time. */
const RENDERED = TEX as { bugs: string[]; menu: Record<string, string>; fix: { term: string; edit: string } };

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
