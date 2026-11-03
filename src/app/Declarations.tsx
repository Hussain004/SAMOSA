import type { Chip } from '../core/index.ts';
import { canonicalizeSymbol } from '../core/index.ts';

/**
 * The declarations, in the open.
 *
 * The declarations of a derivation decide everything the checker takes for
 * granted, and they used to live behind the Presets button. This strip shows
 * them above the panes, offers a one-click declaration for every symbol the
 * checker had to guess, and opens the full panel for the rest.
 */

export interface DeclarationsStripProps {
  /** the declarations the check ran with */
  decls: string;
  /** the chips of the current report, if any */
  chips: Chip[];
  /** set the declaration of a symbol, replacing what was there */
  onDeclare: (name: string, type: string) => void;
  /** open the full declarations panel */
  onEdit: () => void;
}

/** The one-click shapes, the way the review asked for them. */
const DECLARE = [
  { label: 'n×n', type: 'n×n' },
  { label: 'sym n', type: 'sym n' },
  { label: 'spd n', type: 'spd n' },
  { label: 'scalar', type: 'scalar' },
];

/** The names a declarations string declares, the way the parser reads them. */
function declaredNames(decls: string): Set<string> {
  const out = new Set<string>();
  for (const segment of decls.split(';')) {
    const match = segment.match(/^(.+?)\s*:/);
    if (!match) continue;
    for (const name of match[1].split(',')) {
      const trimmed = name.trim();
      if (trimmed) out.add(canonicalizeSymbol(trimmed));
    }
  }
  return out;
}

export function DeclarationsStrip({ decls, chips, onDeclare, onEdit }: DeclarationsStripProps) {
  const declared = declaredNames(decls);
  const segments = decls.split(';').map((segment) => segment.trim()).filter(Boolean);
  const suggestions = chips.filter(
    (chip) => chip.id === 'shape-guess' && chip.symbol && !declared.has(canonicalizeSymbol(chip.symbol)),
  );

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-1.5 text-[0.6875rem]">
      <button
        onClick={onEdit}
        title="edit the declarations"
        className="pane-title hover:text-[var(--color-gold)]"
      >
        declarations
      </button>
      {segments.length === 0 ? (
        <button
          onClick={onEdit}
          className="text-[var(--color-faint)] hover:text-[var(--color-text)]"
        >
          nothing declared yet, the checker is guessing
        </button>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {segments.map((segment, index) => (
            <span
              key={index}
              className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[0.625rem] text-[var(--color-muted)]"
            >
              {segment}
            </span>
          ))}
        </div>
      )}
      {suggestions.map((chip) => (
        <div key={chip.id + (chip.symbol ?? '')} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[var(--color-faint)]">
            <span className="font-mono text-[var(--color-muted)]">{chip.symbol}</span> guessed
          </span>
          {DECLARE.map(({ label, type }) => (
            <button
              key={type}
              onClick={() => chip.symbol && onDeclare(chip.symbol, type)}
              title={`declare ${chip.symbol} as ${type}`}
              className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
            >
              {label}
            </button>
          ))}
        </div>
      ))}
      <button
        onClick={onEdit}
        className="ml-auto text-[0.625rem] text-[var(--color-faint)] hover:text-[var(--color-text)]"
      >
        edit
      </button>
    </div>
  );
}
