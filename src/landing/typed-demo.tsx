import { useEffect, useRef, useState } from 'react';
import { DEMO_SCRIPTS, type DemoEvent } from './demo-scripts.ts';

/**
 * The typed agent demo.
 *
 * The user text types itself with a human jitter, the tool output arrives
 * line by line after a braille spinner, and the whole thing loops after a
 * pause. Under reduced motion the final state is rendered straight away.
 */
export function TypedDemo() {
  const [tab, setTab] = useState(0);
  const [lines, setLines] = useState<RenderedLine[]>([]);
  const [paused, setPaused] = useState(false);
  const timers = useRef<number[]>([]);

  const script = DEMO_SCRIPTS[tab];

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    if (reduce) {
      setLines(renderAll(script.events));
      return;
    }

    setLines([]);
    let at = 0;
    const step = () => {
      if (at >= script.events.length) {
        timers.current.push(window.setTimeout(() => {
          setLines([]);
          at = 0;
          step();
        }, 4000));
        return;
      }
      const event = script.events[at];
      at++;
      if (event.kind === 'user') {
        typeInto(event, (text) => {
          setLines((current) => [...current, { kind: 'user', text }]);
          timers.current.push(window.setTimeout(step, 500));
        }, timers.current);
        return;
      }
      if (event.kind === 'think') {
        setLines((current) => [...current, { kind: 'think', text: '' }]);
        timers.current.push(window.setTimeout(step, 900));
        return;
      }
      setLines((current) => [...current, toLine(event)]);
      timers.current.push(window.setTimeout(step, event.pauseMs ?? 450));
    };
    timers.current.push(window.setTimeout(step, 300));
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, [script]);

  return (
    <div
      className="panel scanlines relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e0533d66]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f28c2666]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#5bc27a66]" />
        <span className="ml-2 text-[11px] text-[var(--color-faint)]">{script.title}</span>
        <div className="ml-auto flex gap-1">
          {DEMO_SCRIPTS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setTab(i)}
              className={`rounded px-2 py-0.5 text-[10px] ${
                i === tab
                  ? 'border border-[var(--color-gold)]/60 text-[var(--color-gold)]'
                  : 'text-[var(--color-faint)] hover:text-[var(--color-muted)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[280px] p-4 text-[13px] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={lineClass(line)}>
            {line.text}
            {line.kind === 'user' && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-[var(--color-gold)] animate-pulse" />}
          </div>
        ))}
        {lines.length === 0 && <div className="text-[var(--color-faint)]">$ samosa</div>}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-line)] px-3 py-1.5 text-[10px] text-[var(--color-faint)]">
        <span>exact · seed 5A305A · ✓ 12/12</span>
        <span>{paused ? 'paused' : 'the demo loops'}</span>
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

function renderAll(events: DemoEvent[]): RenderedLine[] {
  return events.map((event) => toLine(event));
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

/** Types the text of an event, one character at a time. */
function typeInto(
  event: { kind: 'user'; text: string },
  done: (text: string) => void,
  timers: number[],
): void {
  let index = 0;
  const tick = () => {
    index += 1;
    const text = event.text.slice(0, index);
    if (index >= event.text.length) {
      done(event.text);
      return;
    }
    done(text);
    const jitter = 25 + Math.random() * 45 + (',.!?'.includes(event.text[index - 1]) ? 120 : 0);
    timers.push(window.setTimeout(tick, jitter));
  };
  tick();
}
