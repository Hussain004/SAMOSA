import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp, shareUrl, runCheck, DEFAULT_SOURCE } from './store.ts';
import { SourceEditor } from './SourceEditor.tsx';
import { RenderedRows } from './RenderedRows.tsx';
import { Inspector } from './Inspector.tsx';
import { CommandPalette, Menu, PresetList, type Command } from './Menu.tsx';
import { DeclarationsStrip } from './Declarations.tsx';
import { canonicalizeSymbol } from '../core/index.ts';
import { exportJson, exportMarkdown, exportLatex } from './export.ts';
import { MENU } from '../../corpus/menu.ts';
import { VERDICT_LABEL, seedText, parseSeed } from './verdicts.ts';
import { FontSizeControl, applyFontScale, readFontScale, stepFontScale } from '../font-size.tsx';

const HEADER_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-[0.6875rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]';

/**
 * Set the declaration of a symbol, keeping the others.
 *
 * One declaration per symbol: a symbol that is declared again replaces what
 * was said about it before, the way `declare` reads in the panel.
 */
function declareSymbol(current: string, name: string, type: string): string {
  const wanted = canonicalizeSymbol(name);
  const kept = current
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => {
      const match = segment.match(/^(.+?)\s*:/);
      if (!match) return true;
      return !match[1].split(',').some((n) => canonicalizeSymbol(n.trim()) === wanted);
    });
  kept.push(`${name}: ${type}`);
  return kept.join('; ');
}

export function App() {
  const {
    source,
    settings,
    report,
    selectedStep,
    explanations,
    busy,
    error,
    linkError,
    spotTheBug,
    guess,
    revealed,
    tries,
    streak,
    nextBug,
    stopSpotTheBug,
    setSource,
    setSettings,
    select,
    reroll,
    loadShare,
    startSpotTheBug,
  } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [mobilePane, setMobilePane] = useState<'rendered' | 'source'>('rendered');
  const [hoverStep, setHoverStep] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    window.localStorage.getItem('samosa-theme') === 'light' ? 'light' : 'dark',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('samosa-theme', theme);
  }, [theme]);

  useEffect(() => {
    const open = () => {
      loadShare();
      // a deep link to a menu item, such as /app#menu=kalman
      const hash = window.location.hash;
      const menu = hash.match(/menu=([\w-]+)/);
      if (menu) {
        const item = MENU.find((m) => m.id === menu[1]);
        if (item) {
          setSource(item.source);
          setSettings({ decls: item.decls });
        }
      }
      runCheck(useApp.getState().source, useApp.getState().settings);
    };
    open();
    // a link that is opened in the same tab does not reload the page, so the
    // hash is watched: the back button has to work too
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [loadShare, setSource, setSettings]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        reroll();
      }
      if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const steps = report?.steps ?? [];
        const at = steps.findIndex((s) => s.id === selectedStep);
        const next = event.key === 'ArrowDown' ? at + 1 : at - 1;
        const step = steps[Math.max(0, Math.min(steps.length - 1, next))];
        if (step) select(step.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [report, selectedStep, select, reroll]);

  // A first run has no row picked, and the inspector would sit on its empty
  // state. The first row that does not hold is the one its card is for, so a
  // check opens on the row worth reading instead of on a hint. The spot the
  // bug game picks its own rows, through its own guess, so it is left alone.
  const appliedFor = useRef<unknown>(null);
  useEffect(() => {
    if (selectedStep) return;
    if (spotTheBug) return;
    const steps = report?.steps ?? [];
    // a wrong row first, then a row SAMOSA could not settle, then the first
    // checkmark, whose card is the receipt. A definition has no card worth
    // opening on: "not ok" used to pick it, so a clean derivation opened on
    // row 1, which is usually a :=
    const first =
      steps.find((s) => s.verdict === 'wrong' || s.verdict === 'shape') ??
      steps.find((s) => s.verdict === 'inconclusive' || s.verdict === 'unchecked') ??
      steps.find((s) => s.verdict === 'ok') ??
      null;
    if (!first) return;
    if (appliedFor.current === report) return;
    appliedFor.current = report;
    select(first.id);
  }, [report, selectedStep, select, spotTheBug]);

  const copy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(text);
    window.setTimeout(() => setCopied(''), 1200);
  }, []);

  const share = useCallback(() => {
    const url = shareUrl(source, settings);
    // the fragment keeps the derivation in the browser, so the address bar
    // is a share link too
    window.history.replaceState(null, '', `#v1.${url.split('#v1.')[1]}`);
    copy(url);
  }, [copy, settings, source]);

  const declare = useCallback(
    (name: string, type: string) => {
      setSettings({ decls: declareSymbol(settings.decls, name, type) });
    },
    [setSettings, settings.decls],
  );

  // The header actions are the same on a wide screen and in the panel that
  // the phone opens, so they are written once.
  // primary: two things only. Everything else lives in the overflow menu.
  const primaryActions = useMemo(
    () => [
      { id: 'menu', label: 'Menu', run: () => setMenuOpen((v) => !v) },
      { id: 'share', label: 'Share', run: share },
    ],
    [share],
  );
  const overflowActions = useMemo(
    () => [
      {
        id: 'spot',
        label: spotTheBug ? 'Stop the game' : 'Spot the bug',
        run: () => (spotTheBug ? stopSpotTheBug() : nextBug()),
      },
      { id: 'presets', label: 'Presets', run: () => setShowSettings((v) => !v) },
      {
        id: 'theme',
        label: theme === 'dark' ? 'Light' : 'Dark',
        run: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
      },
      {
        id: 'json',
        label: 'Export as JSON',
        run: () => report && download('samosa.json', exportJson(report, source, settings), 'application/json'),
      },
      { id: 'md', label: 'Export as Markdown', run: () => report && download('samosa.md', exportMarkdown(report, source)) },
      { id: 'tex', label: 'Export as LaTeX', run: () => report && download('samosa.tex', exportLatex(report, source)) },
    ],
    [nextBug, spotTheBug, stopSpotTheBug, report, source, settings, theme],
  );

  const commands = useMemo<Command[]>(
    () => [
      { id: 'menu', label: 'Open the menu', hint: 'sixteen derivations', run: () => setMenuOpen(true) },
      { id: 'reroll', label: 'Re-roll the seed', hint: 'ctrl+enter', run: reroll },
      {
        id: 'share',
        label: 'Copy the share link',
        run: () => copy(shareUrl(source, settings)),
      },
      { id: 'json', label: 'Export as JSON', run: () => download('samosa.json', exportJson(report, source, settings), 'application/json') },
      { id: 'md', label: 'Export as Markdown', run: () => download('samosa.md', exportMarkdown(report, source)) },
      { id: 'tex', label: 'Export as LaTeX', run: () => download('samosa.tex', exportLatex(report, source)) },
      {
        id: 'snack',
        label: settings.snackMode ? 'Turn the snack mode off' : 'Turn the snack mode on',
        run: () => setSettings({ snackMode: !settings.snackMode }),
      },
      {
        id: 'layout',
        label: 'Switch the gradient layout',
        run: () =>
          setSettings({ layout: settings.layout === 'denominator' ? 'numerator' : 'denominator' }),
      },
      {
        id: 'bigger',
        label: 'Larger text',
        hint: 'the whole page',
        run: () => applyFontScale(stepFontScale(readFontScale(), 1)),
      },
      {
        id: 'smaller',
        label: 'Smaller text',
        hint: 'the whole page',
        run: () => applyFontScale(stepFontScale(readFontScale(), -1)),
      },
      { id: 'reset', label: 'Start over', run: () => setSource(DEFAULT_SOURCE) },
    ],
    [copy, report, reroll, setSettings, setSource, settings, source],
  );

  const step = report?.steps.find((s) => s.id === selectedStep) ?? null;
  // the top fix of each wrong row, extracted once the explanation lands
  const fixSpans = useMemo(() => {
    const out: Record<string, { from: number; to: number } | undefined> = {};
    for (const [id, explanation] of Object.entries(explanations)) {
      const edit = explanation.fixes[0]?.edit;
      if (edit) out[id] = edit.span;
    }
    return out;
  }, [explanations]);
  const counts = useMemo(() => {
    const out = { ok: 0, wrong: 0, shape: 0, unchecked: 0, defined: 0, inconclusive: 0 };
    for (const s of report?.steps ?? []) out[s.verdict] += 1;
    return out;
  }, [report]);
  // the sentence a screen reader hears, once per check, not on every keystroke
  const summary = useMemo(() => {
    const total = report?.steps.length ?? 0;
    if (!total) return '';
    const parts: string[] = [];
    if (counts.ok) parts.push(`${counts.ok} hold`);
    if (counts.wrong) parts.push(`${counts.wrong} wrong`);
    if (counts.shape) parts.push(`${counts.shape} shape`);
    if (counts.inconclusive) parts.push(`${counts.inconclusive} undecided`);
    if (counts.unchecked) parts.push(`${counts.unchecked} not checked`);
    if (counts.defined) parts.push(`${counts.defined} defined`);
    return `${total} rows: ${parts.join(', ')}`;
  }, [counts, report?.steps.length]);

  return (
    <main className="flex h-full flex-col overflow-y-auto bg-[var(--color-ink)] text-[var(--color-text)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
        <a href="/" className="flex items-center gap-2 text-sm text-[var(--color-gold)]">
          <span className="text-lg leading-none">∇</span>
          <span className="tracking-[0.18em]">SAMOSA</span>
        </a>
        <div className="flex items-center gap-3">
          {primaryActions.map((action) => (
            <button
              key={action.id}
              onClick={action.run}
              className={
                action.id === 'share'
                  ? 'rounded border border-[var(--color-gold)] bg-[var(--color-gold)] px-3 py-1 text-[0.6875rem] font-semibold text-[var(--color-ink)] hover:brightness-110'
                  : HEADER_BUTTON
              }
            >
              {action.label}
            </button>
          ))}
          <OverflowMenu actions={overflowActions} github />
        </div>
        {spotTheBug && (
          <span className="rounded border border-[var(--color-saffron)]/60 px-2 py-1 text-[0.6875rem] text-[var(--color-saffron)]">
            spot the bug
          </span>
        )}
        <FontSizeControl className="ml-auto hidden text-[0.6875rem] sm:flex" />
        <div className="hidden items-center gap-2 text-[0.6875rem] text-[var(--color-faint)] lg:flex">
          <kbd>ctrl</kbd>
          <kbd>K</kbd>
          <span>for the commands</span>
        </div>
      </header>



      {spotTheBug && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-[0.6875rem]">
          {revealed ? (
            <span className="text-[var(--color-chutney)]">
              ✓ found it in {tries} {tries === 1 ? 'try' : 'tries'}
            </span>
          ) : tries > 0 ? (
            <span className="text-[var(--color-tamarind)]">✗ not that row, try again</span>
          ) : (
            <span className="text-[var(--color-saffron)]">one row is wrong. click it.</span>
          )}
          {revealed && (
            <button onClick={nextBug} className={HEADER_BUTTON}>
              next bug →
            </button>
          )}
          {revealed && (
            <button
              onClick={() =>
                copy(
                  `I found the bug in ${tries} ${tries === 1 ? 'try' : 'tries'} on SAMOSA. Can you? ${window.location.origin}/app/`,
                )
              }
              className={HEADER_BUTTON}
            >
              {copied.startsWith('I found the bug') ? '✓ copied' : 'share the result'}
            </button>
          )}
          <span className="text-[var(--color-faint)]">streak {streak}</span>
          <button
            onClick={stopSpotTheBug}
            className="ml-auto text-[0.625rem] text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            leave the game
          </button>
        </div>
      )}

      <div className="flex shrink-0 border-b border-[var(--color-line)] text-[0.625rem] md:hidden">
        {(['rendered', 'source'] as const).map((pane) => (
          <button
            key={pane}
            onClick={() => setMobilePane(pane)}
            className={`flex-1 px-3 py-2 uppercase tracking-wider ${
              mobilePane === pane ? 'text-[var(--color-gold)]' : 'text-[var(--color-faint)]'
            }`}
          >
            {pane}
          </button>
        ))}
      </div>

      {showSettings && (
        <div className="max-h-72 shrink-0 overflow-y-auto border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
          <h3 className="pane-title">presets</h3>
          <div className="mt-2">
            <PresetList
              onPick={(id) => {
                setSettings({ preset: id });
                setShowSettings(false);
              }}
            />
          </div>
          <h3 className="pane-title mt-4">declarations</h3>
          <textarea
            value={settings.decls}
            onChange={(e) => setSettings({ decls: e.target.value })}
            spellCheck={false}
            className="mt-2 h-20 w-full resize-y rounded border border-[var(--color-line)] bg-black/40 p-2 font-mono text-xs outline-none focus:border-[var(--color-gold)]"
          />
          {report?.diagnostics.some((d) => d.severity !== 'error') && (
            <div className="mt-1 text-[0.6875rem] text-[var(--color-gold)]">
              {report.diagnostics
                .filter((d) => d.severity !== 'error')
                .map((d, i) => (
                  <p key={i}>{d.message}</p>
                ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.6875rem] text-[var(--color-muted)]">
            <SeedField value={settings.seed} onApply={(seed) => setSettings({ seed })} />
            <label className="flex items-center gap-2">
              trials
              <input
                type="number"
                min={1}
                max={8}
                value={settings.trials}
                onChange={(e) => setSettings({ trials: Math.max(1, Number(e.target.value)) })}
                className="w-16 rounded border border-[var(--color-line)] bg-black/40 px-1.5 py-1 text-xs outline-none"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.layout === 'numerator'}
                onChange={(e) => setSettings({ layout: e.target.checked ? 'numerator' : 'denominator' })}
              />
              the numerator layout for gradients
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.snackMode}
                onChange={(e) => setSettings({ snackMode: e.target.checked })}
              />
              the snack mode
            </label>
          </div>
        </div>
      )}

      <MenuDialog
        open={menuOpen}
        onPick={(src, decls) => {
          setSource(src);
          setSettings({ decls });
          setMenuOpen(false);
        }}
        onSpotTheBug={(src, decls, id) => {
          startSpotTheBug(src, decls, id);
          setMenuOpen(false);
        }}
        onClose={() => setMenuOpen(false)}
      />

      <DeclarationsStrip
        decls={settings.decls}
        chips={report?.chips ?? []}
        onDeclare={declare}
        onEdit={() => setShowSettings(true)}
      />

      <div className="min-h-[280px] flex-1 grid-cols-1 grid-rows-1 md:grid md:grid-cols-2">
        <section
          className={`${
            mobilePane === 'source' ? 'flex' : 'hidden'
          } min-h-0 flex-col border-b border-[var(--color-line)] md:flex md:border-b-0 md:border-r`}
        >
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="pane-title">source</span>
            <span className="text-[0.625rem] text-[var(--color-faint)]">{source.length} characters</span>
          </div>
          <div className="min-h-0 flex-1">
            <SourceEditor
              value={source}
              onChange={setSource}
              report={report}
              selectedStep={selectedStep}
              onSelectStep={select}
              hideDiagnostics={spotTheBug && !revealed}
              hoverStep={hoverStep}
              onHoverStep={setHoverStep}
            />
          </div>
        </section>

        <section className={`${mobilePane === 'rendered' ? 'flex' : 'hidden'} min-h-0 flex-col md:flex`}>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="pane-title">rendered</span>
            {busy && <span className="text-[0.625rem] text-[var(--color-saffron)]">checking…</span>}
          </div>
          <div className="min-h-0 flex-1">
            <RenderedRows
              source={source}
              report={report}
              busy={busy}
              selectedStep={selectedStep}
              hoverStep={hoverStep}
              onHoverStep={setHoverStep}
              stepOrder={report?.steps ?? []}
              fixSpans={fixSpans}
              onSelectStep={(id) => {
                select(id);
                // on a phone the card is a bottom sheet, so a tap opens it
                if (window.matchMedia('(max-width: 767px)').matches) {
                  setInspectorOpen(true);
                  setSheetOpen(true);
                }
              }}
              spotTheBug={spotTheBug}
              guess={guess}
              revealed={revealed}
            />
          </div>
        </section>
      </div>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      <section
        className={`${
          sheetOpen ? 'flex' : 'hidden'
        } fixed inset-x-0 bottom-0 z-40 max-h-[70vh] min-h-0 flex-col rounded-t-xl border-t border-[var(--color-line)] bg-[var(--color-panel)] shadow-2xl md:static md:z-auto md:flex md:flex-none md:rounded-none md:bg-transparent md:shadow-none ${
          inspectorOpen ? 'md:max-h-[38vh] md:min-h-[160px]' : 'md:max-h-none md:min-h-0'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="pane-title">inspector</span>
          <div className="flex items-center gap-3">
            {step && (
              <span className="text-[0.625rem] text-[var(--color-faint)]">
                row {step.row} · {step.mode ?? VERDICT_LABEL[step.verdict]}
              </span>
            )}
            <button
              onClick={() => setInspectorOpen((v) => !v)}
              aria-label={inspectorOpen ? 'collapse the inspector' : 'expand the inspector'}
              className="hidden text-[0.625rem] text-[var(--color-faint)] hover:text-[var(--color-text)] md:inline"
            >
              {inspectorOpen ? '▾' : '▸'}
            </button>
            <button
              onClick={() => setSheetOpen(false)}
              aria-label="close the inspector"
              className="text-[0.8125rem] text-[var(--color-faint)] hover:text-[var(--color-text)] md:hidden"
            >
              ×
            </button>
          </div>
        </div>
        <div className={`${inspectorOpen ? 'block' : 'hidden'} min-h-0 flex-1 overflow-auto`}>
          <Inspector
            step={step}
            report={report}
            explanation={selectedStep ? explanations[selectedStep] : undefined}
            onApplyFix={(fix) => {
              if (!fix.edit || !step) return;
              // the spans of a fix are offsets into its own row, so the row
              // offset is added before the edit is applied
              const offset = step.span.from;
              const from = Math.max(0, Math.min(source.length, fix.edit.span.from + offset));
              const to = Math.max(from, Math.min(source.length, fix.edit.span.to + offset));
              setSource(source.slice(0, from) + fix.edit.insert + source.slice(to));
            }}
            onCopy={copy}
            onClose={() => {
              select(null);
              setSheetOpen(false);
            }}
          />
        </div>
      </section>

      <footer className="flex shrink-0 items-center gap-4 overflow-x-auto border-t border-[var(--color-line)] px-4 py-1.5 text-[0.6875rem] whitespace-nowrap text-[var(--color-muted)]">
        <span className="text-[var(--color-chutney)]">●</span>
        <span className="hidden sm:inline">all checks local, nothing uploaded</span>
        <span className="hidden text-[var(--color-faint)] sm:inline">·</span>
        <span>seed {seedText(settings.seed)}</span>
        <span className="text-[var(--color-faint)]">·</span>
        {spotTheBug && !revealed ? (
          <span className="text-[var(--color-saffron)]">find the wrong row</span>
        ) : (
          <>
            {counts.ok > 0 && <span className="text-[var(--color-chutney)]">✓ {counts.ok}</span>}
            {counts.wrong > 0 && <span className="text-[var(--color-tamarind)]">✗ {counts.wrong}</span>}
            {counts.shape > 0 && <span className="text-[var(--color-tamarind)]">⊘ {counts.shape}</span>}
            {counts.unchecked > 0 && <span className="text-[var(--color-slate)]">? {counts.unchecked}</span>}
          </>
        )}
        {report && (
          <>
            <span className="text-[var(--color-faint)]">·</span>
            <span>{report.ms} ms</span>
          </>
        )}
        {(error ?? linkError) && (
          <>
            <span className="text-[var(--color-faint)]">·</span>
            <span className="text-[var(--color-tamarind)]">{error ?? linkError}</span>
          </>
        )}
      </footer>

      <span className="sr-only" role="status" aria-live="polite">{summary}</span>
      <CommandPalette commands={commands} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </main>
  );
}

/**
 * The Menu as a native dialog: focus is trapped, Escape closes, and the
 * backdrop click works too. The browser gives all of it for free.
 */
function MenuDialog({
  open,
  onPick,
  onSpotTheBug,
  onClose,
}: {
  open: boolean;
  onPick: (source: string, decls: string) => void;
  onSpotTheBug?: (source: string, decls: string, id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      aria-label="the derivation menu"
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 mx-auto mt-[5vh] max-h-[85vh] w-[min(920px,94vw)] overflow-auto border border-[var(--color-line)] bg-[var(--color-panel)] p-0 text-[var(--color-text)] backdrop:bg-black/60"
    >
      <Menu
        onPick={onPick}
        onSpotTheBug={onSpotTheBug}
        onClose={onClose}
      />
    </dialog>
  );
}

/**
 * The overflow menu: everything that is not Menu or Share, in one place,
 * behind a quiet ⋯. Native <details>, so it opens and closes without JS.
 */
function OverflowMenu({
  actions,
  github,
}: {
  actions: Array<{ id: string; label: string; run: () => void }>;
  github?: boolean;
}) {
  return (
    <details className="relative">
      <summary
        aria-label="more actions"
        className="list-none cursor-pointer rounded border border-[var(--color-line)] px-2 py-1 text-[0.8125rem] leading-none text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)] marker:hidden"
      >
        ⋯
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded border border-[var(--color-line)] bg-[var(--color-panel)] shadow-xl">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.run}
            className="block w-full px-3 py-2 text-left text-[0.6875rem] text-[var(--color-muted)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-text)]"
          >
            {action.label}
          </button>
        ))}
        {github && (
          <a
            href="https://github.com/Hussain004/SAMOSA"
            target="_blank"
            rel="noreferrer"
            className="block border-t border-[var(--color-line)] px-3 py-2 text-[0.6875rem] text-[var(--color-muted)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-text)]"
          >
            ★ GitHub
          </a>
        )}
      </div>
    </details>
  );
}

/**
 * The seed field: one small box that reads the seed in either form people
 * write it in, hex or decimal, and applies it live.
 */
function SeedField({ value, onApply }: { value: number; onApply: (seed: number) => void }) {
  const [raw, setRaw] = useState(() => seedText(value));
  // the store changed the seed somewhere else (the reroll), so keep the box in step
  useEffect(() => setRaw(seedText(value)), [value]);
  return (
    <label className="flex items-center gap-2">
      seed
      <input
        type="text"
        inputMode="text"
        spellCheck={false}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          const parsed = parseSeed(e.target.value);
          if (parsed !== null) onApply(parsed);
        }}
        className="w-24 rounded border border-[var(--color-line)] bg-black/40 px-1.5 py-1 text-xs outline-none"
      />
    </label>
  );
}

function download(name: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
