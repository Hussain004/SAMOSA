import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, shareUrl, runCheck, DEFAULT_SOURCE } from './store.ts';
import { SourceEditor } from './SourceEditor.tsx';
import { RenderedRows } from './RenderedRows.tsx';
import { Inspector } from './Inspector.tsx';
import { CommandPalette, Menu, PresetList, type Command } from './Menu.tsx';
import { exportJson, exportMarkdown, exportLatex } from './export.ts';
import { MENU } from '../../corpus/menu.ts';
import { VERDICT_LABEL } from './verdicts.ts';

const HEADER_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]';

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
  const [headerMenu, setHeaderMenu] = useState(false);
  const [mobilePane, setMobilePane] = useState<'rendered' | 'source'>('rendered');
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

  // The header actions are the same on a wide screen and in the panel that
  // the phone opens, so they are written once.
  const headerActions = useMemo(
    () => [
      { id: 'menu', label: 'Menu', run: () => setMenuOpen((v) => !v) },
      {
        id: 'spot',
        label: spotTheBug ? 'Stop the game' : 'Spot the bug',
        run: () => (spotTheBug ? stopSpotTheBug() : nextBug()),
      },
      { id: 'presets', label: 'Presets', run: () => setShowSettings((v) => !v) },
      { id: 'share', label: 'Share', run: share },
      {
        id: 'theme',
        label: theme === 'dark' ? 'Light' : 'Dark',
        run: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
      },
    ],
    [nextBug, share, spotTheBug, stopSpotTheBug, theme],
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
      { id: 'json', label: 'Export as JSON', run: () => download('samosa.json', exportJson(report, source, settings)) },
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
      { id: 'reset', label: 'Start over', run: () => setSource(DEFAULT_SOURCE) },
    ],
    [copy, report, reroll, setSettings, setSource, settings, source],
  );

  const step = report?.steps.find((s) => s.id === selectedStep) ?? null;
  const counts = useMemo(() => {
    const out = { ok: 0, wrong: 0, shape: 0, unchecked: 0, defined: 0, inconclusive: 0 };
    for (const s of report?.steps ?? []) out[s.verdict] += 1;
    return out;
  }, [report]);

  return (
    <div className="flex h-full flex-col bg-[var(--color-ink)] text-[var(--color-text)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
        <a href="/" className="flex items-center gap-2 text-sm text-[var(--color-gold)]">
          <span className="text-lg leading-none">∇</span>
          <span className="tracking-[0.18em]">SAMOSA</span>
        </a>
        <div className="hidden items-center gap-3 md:flex">
          {headerActions.map((action) => (
            <button key={action.id} onClick={action.run} className={HEADER_BUTTON}>
              {action.label}
            </button>
          ))}
          <a
            href="https://github.com/Hussain004/SAMOSA"
            target="_blank"
            rel="noreferrer"
            className={HEADER_BUTTON}
          >
            ★ GitHub
          </a>
        </div>
        <button
          onClick={() => setHeaderMenu((v) => !v)}
          className={`${HEADER_BUTTON} md:hidden`}
          aria-label="more actions"
          aria-expanded={headerMenu}
        >
          ⋯
        </button>
        {spotTheBug && (
          <span className="rounded border border-[var(--color-saffron)]/60 px-2 py-1 text-[11px] text-[var(--color-saffron)]">
            spot the bug
          </span>
        )}
        <div className="ml-auto hidden items-center gap-2 text-[11px] text-[var(--color-faint)] sm:flex">
          <kbd>ctrl</kbd>
          <kbd>K</kbd>
          <span>for the commands</span>
        </div>
      </header>

      {headerMenu && (
        <div className="flex flex-wrap gap-2 border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 md:hidden">
          {headerActions.map((action) => (
            <button key={action.id} onClick={action.run} className={HEADER_BUTTON}>
              {action.label}
            </button>
          ))}
          <a
            href="https://github.com/Hussain004/SAMOSA"
            target="_blank"
            rel="noreferrer"
            className={HEADER_BUTTON}
          >
            ★ GitHub
          </a>
        </div>
      )}

      {spotTheBug && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-[11px]">
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
            className="ml-auto text-[10px] text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            leave the game
          </button>
        </div>
      )}

      <div className="flex shrink-0 border-b border-[var(--color-line)] text-[10px] md:hidden">
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
        <div className="border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
          <h3 className="pane-title">presets</h3>
          <div className="mt-2">
            <PresetList onPick={(id) => setSettings({ preset: id })} />
          </div>
          <h3 className="pane-title mt-4">declarations</h3>
          <textarea
            value={settings.decls}
            onChange={(e) => setSettings({ decls: e.target.value })}
            spellCheck={false}
            className="mt-2 h-20 w-full resize-y rounded border border-[var(--color-line)] bg-black/40 p-2 font-mono text-xs outline-none focus:border-[var(--color-gold)]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[var(--color-muted)]">
            <label className="flex items-center gap-2">
              seed
              <input
                type="number"
                value={settings.seed}
                onChange={(e) => setSettings({ seed: Number(e.target.value) >>> 0 })}
                className="w-24 rounded border border-[var(--color-line)] bg-black/40 px-1.5 py-1 text-xs outline-none"
              />
            </label>
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

      {menuOpen && (
        <div className="absolute inset-0 z-20 overflow-auto bg-black/70 p-6" onClick={() => setMenuOpen(false)}>
          <div
            className="mx-auto max-h-[80vh] max-w-4xl overflow-auto rounded border border-[var(--color-line)] bg-[var(--color-panel)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Menu
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
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 grid-cols-1 grid-rows-1 md:grid md:grid-cols-2">
        <section
          className={`${
            mobilePane === 'source' ? 'flex' : 'hidden'
          } min-h-0 flex-col border-b border-[var(--color-line)] md:flex md:border-b-0 md:border-r`}
        >
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="pane-title">source</span>
            <span className="text-[10px] text-[var(--color-faint)]">{source.length} characters</span>
          </div>
          <div className="min-h-0 flex-1">
            <SourceEditor
              value={source}
              onChange={setSource}
              report={report}
              selectedStep={selectedStep}
              onSelectStep={select}
              hideDiagnostics={spotTheBug && !revealed}
            />
          </div>
        </section>

        <section className={`${mobilePane === 'rendered' ? 'flex' : 'hidden'} min-h-0 flex-col md:flex`}>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="pane-title">rendered</span>
            {busy && <span className="text-[10px] text-[var(--color-saffron)]">checking…</span>}
          </div>
          <div className="min-h-0 flex-1">
            <RenderedRows
              source={source}
              report={report}
              selectedStep={selectedStep}
              onSelectStep={(id) => {
                select(id);
                // on a phone the card is a bottom sheet, so a tap opens it
                if (window.matchMedia('(max-width: 767px)').matches) {
                  setInspectorOpen(true);
                  setSheetOpen(true);
                }
              }}
              hoverStep={null}
              onHoverStep={() => {}}
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
              <span className="text-[10px] text-[var(--color-faint)]">
                row {step.row} · {step.mode ?? VERDICT_LABEL[step.verdict]}
              </span>
            )}
            <button
              onClick={() => setInspectorOpen((v) => !v)}
              aria-label={inspectorOpen ? 'collapse the inspector' : 'expand the inspector'}
              className="hidden text-[10px] text-[var(--color-faint)] hover:text-[var(--color-text)] md:inline"
            >
              {inspectorOpen ? '▾' : '▸'}
            </button>
            <button
              onClick={() => setSheetOpen(false)}
              aria-label="close the inspector"
              className="text-[13px] text-[var(--color-faint)] hover:text-[var(--color-text)] md:hidden"
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

      <footer className="flex shrink-0 items-center gap-4 overflow-x-auto border-t border-[var(--color-line)] px-4 py-1.5 text-[11px] whitespace-nowrap text-[var(--color-muted)]">
        <span className="text-[var(--color-chutney)]">●</span>
        <span className="hidden sm:inline">all checks local, nothing uploaded</span>
        <span className="hidden text-[var(--color-faint)] sm:inline">·</span>
        <span>seed {settings.seed}</span>
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

      <CommandPalette commands={commands} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
