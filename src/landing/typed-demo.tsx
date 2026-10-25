import { useEffect, useRef, useState } from 'react';
import { DEMO_SCRIPTS, type DemoEvent } from './demo-scripts.ts';

/**
 * The typed agent demo.
 *
 * The user text types itself with a human jitter, the tool output arrives
 * line by line after a braille spinner, and the whole thing loops after a
 * pause. It can be replayed, skipped and paused; hovering pauses it, and so
 * does the button, for a finger.
 *
 * Under reduced motion the final state is rendered straight away. The full
 * script is also in the DOM, visually hidden, for a screen reader.
 */
export function TypedDemo() {
  const [tab, setTab] = useState(0);
  const [lines, setLines] = useState<RenderedLine[]>([]);
  const [manualPaused, setManualPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [run, setRun] = useState(0);
  const pausedRef = useRef(false);
  const skipRef = useRef(false);
  const timers = useRef<number[]>([]);

  const script = DEMO_SCRIPTS[tab];
  const paused = manualPaused || hoverPaused;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const replay = () => {
    skipRef.current = false;
    setRun((value) => value + 1);
  };

  const skip = () => {
    skipRef.current = true;
    setRun((value) => value + 1);
  };

  useEffect(() => {
    // the run number is what restarts the effect on a replay
    void run;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];

    if (skipRef.current) {
      skipRef.current = false;
      setLines(script.events.map(toLine));
      return;
    }

    if (reduce) {
      setLines(script.events.map(toLine));
      return;
    }

    setLines([]);
    let at = 0;
    let stopped = false;

    const schedule = (run: () => void, delay: number) => {
      timers.current.push(window.setTimeout(run, delay));
    };

    const push = (line: RenderedLine) => setLines((current) => [...current, line]);
    const replaceLast = (text: string) =>
      setLines((current) => {
        if (!current.length) return current;
        const next = current.slice();
        next[next.length - 1] = { ...next[next.length - 1], text };
        return next;
      });

    const step = () => {
      if (stopped) return;
      if (pausedRef.current) {
        schedule(step, 120);
        return;
      }
      if (at >= script.events.length) {
        const loop = () => {
          if (stopped) return;
          if (pausedRef.current) {
            schedule(loop, 200);
            return;
          }
          setLines([]);
          at = 0;
          step();
        };
        schedule(loop, 4000);
        return;
      }
      const event = script.events[at];
      at++;

      if (event.kind === 'user') {
        push({ kind: 'user', text: '' });
        let index = 0;
        const tick = () => {
          if (stopped) return;
          if (pausedRef.current) {
            schedule(tick, 120);
            return;
          }
          index += 1;
          const text = event.text.slice(0, index);
          replaceLast(text);
          if (index >= event.text.length) {
            schedule(step, 500);
            return;
          }
          const jitter =
            25 + Math.random() * 45 + (',.!?:'.includes(event.text[index - 1]) ? 120 : 0);
          schedule(tick, jitter);
        };
        schedule(tick, 120);
        return;
      }

      if (event.kind === 'think') {
        push({ kind: 'think', text: 'Thinking…' });
        schedule(step, 900);
        return;
      }

      push(toLine(event));
      schedule(step, event.pauseMs ?? 450);
    };

    schedule(step, 300);
    return () => {
      stopped = true;
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [script, run]);

  return (
    <div className="panel theme-dark scanlines relative overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e0533d66]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f28c2666]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#5bc27a66]" />
        <span className="ml-2 text-[0.6875rem] text-[var(--color-faint)]">{script.title}</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          {DEMO_SCRIPTS.map((item, index) => (
            <button
              key={item.id}
              onClick={() => {
                skipRef.current = false;
                setTab(index);
              }}
              className={`rounded px-2 py-0.5 text-[0.625rem] ${
                index === tab
                  ? 'border border-[var(--color-gold)]/60 text-[var(--color-gold)]'
                  : 'text-[var(--color-faint)] hover:text-[var(--color-muted)]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
          <button
            onClick={() => setManualPaused((value) => !value)}
            aria-label={manualPaused ? 'play the demo' : 'pause the demo'}
            title={manualPaused ? 'play' : 'pause'}
            className="rounded px-1.5 py-0.5 text-[0.6875rem] text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            {manualPaused ? '▶' : '❚❚'}
          </button>
          <button
            onClick={replay}
            aria-label="replay the demo"
            title="replay"
            className="rounded px-1.5 py-0.5 text-[0.6875rem] text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            ↻
          </button>
          <button
            onClick={skip}
            aria-label="skip to the end"
            title="skip"
            className="rounded px-1.5 py-0.5 text-[0.6875rem] text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            ⏭
          </button>
        </div>
      </div>

      <div
        data-testid="demo-output"
        className="min-h-[280px] p-4 text-[0.8125rem] leading-relaxed"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        {lines.map((line, index) => (
          <div
            key={index}
            className={`${lineClass(line)} ${line.tone === 'bad' ? 'demo-bad' : ''}`}
          >
            {line.text.startsWith('::error') ? <Annotation text={line.text} /> : line.text}
            {line.kind === 'user' && line.text.length < 40 && (
              <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-[var(--color-gold)] animate-pulse" />
            )}
          </div>
        ))}
        {lines.length === 0 && <div className="text-[var(--color-faint)]">$ samosa</div>}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-line)] px-3 py-1.5 text-[0.625rem] text-[var(--color-faint)]">
        <span>exact · seed 5A305A · ✓ 12/12</span>
        <span>{paused ? 'paused' : 'the demo loops'}</span>
      </div>

      {/* A transcript for a screen reader: the typing is decoration, and this
          is the text it decorates. */}
      <div className="sr-only">
        <h3>Transcript of the {script.label} demo</h3>
        <ol>
          {script.events.map((event, index) => (
            <li key={index}>{event.text}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

interface RenderedLine {
  kind: DemoEvent['kind'];
  text: string;
  tone?: 'ok' | 'bad' | 'plain';
}

function toLine(event: DemoEvent): RenderedLine {
  return { kind: event.kind, text: event.text, tone: 'tone' in event ? event.tone : undefined };
}

/** A GitHub annotation, with its fields as fields. */
function Annotation({ text }: { text: string }) {
  const cut = text.indexOf('::', 2);
  const command = cut >= 0 ? text.slice(0, cut) : text;
  const message = cut >= 0 ? text.slice(cut + 2) : '';
  const fields = command.replace(/^::\w+\s*/, '').split(',').filter(Boolean);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="rounded bg-[var(--color-tamarind)]/15 px-1 text-[0.625rem] uppercase tracking-wider text-[var(--color-tamarind)]">
        error
      </span>
      {fields.map((field) => (
        <span
          key={field}
          className="rounded border border-[var(--color-line)] px-1 text-[0.625rem] text-[var(--color-muted)]"
        >
          {field}
        </span>
      ))}
      <span className="text-[var(--color-text)]">{message}</span>
    </span>
  );
}

function lineClass(line: RenderedLine): string {
  switch (line.kind) {
    case 'user':
      return 'text-[var(--color-text)]';
    case 'think':
      return 'text-[var(--color-faint)]';
    case 'tool':
      return 'text-[var(--color-slate)]';
    case 'result':
      return line.tone === 'ok'
        ? 'text-[var(--color-chutney)]'
        : line.tone === 'bad'
          ? 'text-[var(--color-tamarind)]'
          : 'text-[var(--color-muted)]';
    case 'agent':
      return line.tone === 'ok'
        ? 'text-[var(--color-chutney)]'
        : line.tone === 'bad'
          ? 'text-[var(--color-tamarind)]'
          : 'text-[var(--color-text)]';
    default:
      return 'text-[var(--color-muted)]';
  }
}
