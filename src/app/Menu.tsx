import { useEffect, useMemo, useRef, useState } from 'react';
import { MENU } from '../../corpus/menu.ts';
import { PRESETS } from '../core/index.ts';

export interface MenuProps {
  onPick: (source: string, decls: string) => void;
  onClose: () => void;
  onSpotTheBug?: (source: string, decls: string) => void;
}

/** The Menu: fifteen derivations, with their planted bugs. */
export function Menu({ onPick, onClose, onSpotTheBug }: MenuProps) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm">The menu</h2>
        <button
          onClick={onClose}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          close
        </button>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        A derivation, with the declarations it needs. Every one of them is a test of the engine.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {MENU.map((item) => (
          <div
            key={item.id}
            className="group rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] p-3 transition-colors hover:border-[var(--color-gold)]/60"
          >
            <h3 className="text-xs font-medium">{item.title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">{item.blurb}</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => onPick(item.source, item.decls)}
                className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
              >
                open
              </button>
              {item.bugSource && onSpotTheBug && (
                <button
                  onClick={() => onSpotTheBug(item.bugSource!, item.decls)}
                  className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px] hover:border-[var(--color-tamarind)] hover:text-[var(--color-text)]"
                >
                  spot the bug
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The command palette, on a native dialog with a fuzzy filter. */
export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({
  commands,
  open,
  onClose,
}: {
  commands: Command[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || (c.hint ?? '').toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      window.setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      className="m-0 mt-[12vh] w-[min(560px,92vw)] border border-[var(--color-line)] bg-[var(--color-panel)] p-0 text-[var(--color-text)] backdrop:bg-black/60"
    >
      <input
        ref={input}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, filtered.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
          }
          if (e.key === 'Enter') {
            const command = filtered[index];
            if (command) {
              command.run();
              onClose();
            }
          }
        }}
        placeholder="Type a command"
        className="w-full border-b border-[var(--color-line)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-faint)]"
      />
      <ul className="max-h-[50vh] overflow-auto py-1">
        {filtered.map((command, i) => (
          <li key={command.id}>
            <button
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                command.run();
                onClose();
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-xs ${
                i === index ? 'bg-[#e8b04b18] text-[var(--color-text)]' : 'text-[var(--color-muted)]'
              }`}
            >
              <span>{command.label}</span>
              {command.hint && <span className="text-[10px] text-[var(--color-faint)]">{command.hint}</span>}
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-4 py-3 text-xs text-[var(--color-faint)]">No command</li>}
      </ul>
    </dialog>
  );
}

/** The presets, for the dropdown in the header. */
export function PresetList({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          title={preset.hint}
          onClick={() => onPick(preset.id)}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
