import { useEffect, useRef, useState } from 'react';

/**
 * The mini checker, in the hero.
 *
 * One editable row: the reader sees a wrong step flagged as they type, with
 * no install and no account. The engine (the same one the app runs) loads
 * on the first focus of the input, so the landing bundle never carries it,
 * and the 120 KB budget holds.
 */

type MiniVerdict = 'idle' | 'checking' | 'ok' | 'wrong' | 'shape' | 'unchecked' | 'defined';

const INITIAL = String.raw`(A B)^\top = A^\top B^\top`;

export function MiniChecker() {
  const [value, setValue] = useState(INITIAL);
  const [verdict, setVerdict] = useState<MiniVerdict>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const genRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  const ensureWorker = (): Worker => {
    if (!workerRef.current) {
      const worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ gen: number; type: string; report?: { steps: Array<{ verdict: string; message: string }> } }>) => {
        const data = event.data;
        if (data.gen !== genRef.current || !data.report) return;
        const wrong = data.report.steps.find((s) => s.verdict === 'wrong');
        if (wrong) {
          setVerdict('wrong');
          setMessage('this step is not equal');
          return;
        }
        const first = data.report.steps[0];
        if (!first) {
          setVerdict('idle');
          return;
        }
        if (first.verdict === 'ok') {
          setVerdict('ok');
          setMessage('holds at every size tested');
          return;
        }
        if (first.verdict === 'shape') {
          setVerdict('shape');
          setMessage('the shapes do not fit');
          return;
        }
        if (first.verdict === 'defined') {
          setVerdict('defined');
          setMessage('this row defines a symbol');
          return;
        }
        setVerdict('unchecked');
        setMessage('SAMOSA cannot check this one');
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  };

  const run = (source: string) => {
    const trimmed = source.trim();
    if (!trimmed) {
      setVerdict('idle');
      setMessage(null);
      return;
    }
    const worker = ensureWorker();
    genRef.current += 1;
    setVerdict('checking');
    setMessage(null);
    worker.postMessage({ type: 'check', gen: genRef.current, src: `\\begin{align*}\n${trimmed}\n\\end{align*}`, options: {} });
  };

  useEffect(() => {
    // the check runs when the typing pauses
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => run(value), 350);
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      workerRef.current?.terminate();
    };
  }, []);

  const badge =
    verdict === 'ok'
      ? { text: '✓ holds', tone: 'text-[var(--color-chutney)] border-[var(--color-chutney)]' }
      : verdict === 'wrong'
        ? { text: '✗ wrong', tone: 'text-[var(--color-tamarind)] border-[var(--color-tamarind)]' }
        : verdict === 'shape'
          ? { text: '◌ shape', tone: 'text-[var(--color-saffron)] border-[var(--color-saffron)]' }
          : verdict === 'defined'
            ? { text: '≡ defines', tone: 'text-[var(--color-muted)] border-[var(--color-line)]' }
            : verdict === 'unchecked'
              ? { text: '? not checked', tone: 'text-[var(--color-muted)] border-[var(--color-line)]' }
              : verdict === 'checking'
                ? { text: '…', tone: 'text-[var(--color-faint)] border-[var(--color-line)]' }
                : { text: '?', tone: 'text-[var(--color-faint)] border-[var(--color-line)]' };

  return (
    <div className="mt-8 max-w-[520px] rounded border border-[var(--color-line)] bg-[var(--color-panel)] p-3">
      <label htmlFor="mini-checker" className="pane-title block text-[0.625rem] uppercase tracking-widest text-[var(--color-faint)]">
        try it — edit the row
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="mini-checker"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => run(value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-w-0 flex-1 rounded border border-[var(--color-line)] bg-black/30 px-2 py-2 font-mono text-[0.8125rem] text-[var(--color-text)] outline-none focus:border-[var(--color-gold)]"
          aria-label="a derivation row to check"
        />
        <span
          aria-live="polite"
          className={`shrink-0 rounded border px-2 py-2 font-mono text-[0.75rem] leading-none ${badge.tone}`}
        >
          {badge.text}
        </span>
      </div>
      {message && <p className="mt-2 text-[0.6875rem] text-[var(--color-muted)]">{message}</p>}
    </div>
  );
}
