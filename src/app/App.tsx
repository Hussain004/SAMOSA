import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, shareUrl, runCheck, DEFAULT_SOURCE } from './store.ts';
import { SourceEditor } from './SourceEditor.tsx';
import { RenderedRows } from './RenderedRows.tsx';
import { Inspector } from './Inspector.tsx';
import { CommandPalette, Menu, PresetList, type Command } from './Menu.tsx';
import { exportJson, exportMarkdown, exportLatex } from './export.ts';

export function App() {
  const {
    source,
    settings,
    report,
    selectedStep,
    explanations,
    busy,
    error,
    setSource,
    setSettings,
    select,
    reroll,
    loadShare,
  } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadShare();
    runCheck(useApp.getState().source, useApp.getState().settings);
  }, [loadShare]);

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

  const commands = useMemo<Command[]>(
    () => [
      { id: 'menu', label: 'Open the menu', hint: 'fifteen derivations', run: () => setMenuOpen(true) },
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
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          Menu
        </button>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          Presets
        </button>
        <button
          onClick={() => {
            const url = shareUrl(source, settings);
            // the fragment keeps the derivation in the browser, so the address
            // bar is a share link too
            window.history.replaceState(null, '', `#v1.${url.split('#v1.')[1]}`);
            copy(url);
          }}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          {copied ? '✓ copied' : 'Share'}
        </button>
        <a
          href="https://github.com/Hussain004/SAMOSA"
          target="_blank"
          rel="noreferrer"
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          ★ GitHub
        </a>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-[var(--color-faint)]">
          <kbd>ctrl</kbd>
          <kbd>K</kbd>
          <span>for the commands</span>
        </div>
      </header>

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
              onSpotTheBug={(src) => {
                setSource(src);
                setMenuOpen(false);
              }}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <section className="flex min-h-0 flex-col border-b border-[var(--color-line)] md:border-b-0 md:border-r">
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
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="pane-title">rendered</span>
            {busy && <span className="text-[10px] text-[var(--color-saffron)]">checking…</span>}
          </div>
          <div className="min-h-0 flex-1">
            <RenderedRows
              source={source}
              report={report}
              selectedStep={selectedStep}
              onSelectStep={select}
              hoverStep={null}
              onHoverStep={() => {}}
            />
          </div>
        </section>
      </div>

      <section className="flex max-h-[38vh] min-h-[160px] flex-col border-t border-[var(--color-line)]">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="pane-title">inspector</span>
          {step && (
            <span className="text-[10px] text-[var(--color-faint)]">
              row {step.row} · {step.mode ?? 'defined'}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <Inspector
            step={step}
            report={report}
            explanation={selectedStep ? explanations[selectedStep] : undefined}
            onApplyFix={(fix) => {
              if (!fix.edit) return;
              const from = fix.edit.span.from;
              const to = fix.edit.span.to;
              setSource(source.slice(0, from) + fix.edit.insert + source.slice(to));
            }}
            onCopy={copy}
            onClose={() => select(null)}
          />
        </div>
      </section>

      <footer className="flex shrink-0 items-center gap-4 border-t border-[var(--color-line)] px-4 py-1.5 text-[11px] text-[var(--color-muted)]">
        <span className="text-[var(--color-chutney)]">●</span>
        <span>all checks local, nothing uploaded</span>
        <span className="text-[var(--color-faint)]">·</span>
        <span>seed 0x{settings.seed.toString(16).toUpperCase()}</span>
        <span className="text-[var(--color-faint)]">·</span>
        {counts.ok > 0 && <span className="text-[var(--color-chutney)]">✓ {counts.ok}</span>}
        {counts.wrong > 0 && <span className="text-[var(--color-tamarind)]">✗ {counts.wrong}</span>}
        {counts.shape > 0 && <span className="text-[var(--color-tamarind)]">⊘ {counts.shape}</span>}
        {counts.unchecked > 0 && <span className="text-[var(--color-slate)]">? {counts.unchecked}</span>}
        {report && (
          <>
            <span className="text-[var(--color-faint)]">·</span>
            <span>{report.ms} ms</span>
          </>
        )}
        {error && (
          <>
            <span className="text-[var(--color-faint)]">·</span>
            <span className="text-[var(--color-tamarind)]">{error}</span>
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
