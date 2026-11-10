import { useState } from 'react';
import type { Chip } from '../core/index.ts';
import { canonicalizeSymbol, parseDeclarations, PRESETS } from '../core/index.ts';

/**
 * The declarations, in the open.
 *
 * The declarations of a derivation decide everything the checker takes for
 * granted. Every pill here is editable in place: click one, pick the kind,
 * keep or change the size, and the declaration is written back. Guessed
 * symbols wear a dashed border, harvested ones wear a paragraph mark,
 * declarations that came from a % samosa: line wear a percent, and one the
 * engine does not use is underlined in tamarind.
 */

export interface DeclarationsStripProps {
  /** the declarations the check ran with */
  decls: string;
  /** the source text, to spot % samosa: comments */
  source: string;
  /** the chips of the current report, if any */
  chips: Chip[];
  /** set the declaration of a symbol, replacing what was there */
  onDeclare: (name: string, type: string) => void;
  /** replace a whole segment of the declarations string */
  onReplaceSegment: (index: number, next: string) => void;
  /** open the full declarations panel */
  onEdit: () => void;
  /** copy the declarations as a % samosa: line */
  onCopySamba: (text: string) => void;
  /** apply a named preset */
  onPreset: (id: string) => void;
}

/** The one-click shapes of the popover. */
const KINDS = [
  { label: 'vector n', value: 'n' },
  { label: 'matrix m×n', value: 'm×n' },
  { label: 'square n×n', value: 'n×n' },
  { label: 'sym n', value: 'sym n' },
  { label: 'spd n', value: 'spd n' },
  { label: 'psd n', value: 'psd n' },
  { label: 'orth n', value: 'orth n' },
  { label: 'diag n', value: 'diag n' },
  { label: 'skew n', value: 'skew n' },
  { label: 'idem n', value: 'idem n' },
  { label: 'stoch n', value: 'stoch n' },
  { label: 'scalar', value: 'scalar' },
  { label: 'pos', value: 'pos' },
  { label: '~ N(μ,Σ)', value: '~ N(0, \\Sigma)' },
] as const;

/** The origin of one segment, for the mark it wears. */
type Origin = 'typed' | 'comment' | 'harvested' | 'guessed';

interface Segment {
  /** the raw text of the segment */
  text: string;
  /** the names it declares */
  names: string[];
  /** the type it carries */
  type: string;
  origin: Origin;
  /** an unused-declaration chip marks this segment */
  unused: boolean;
}

const GUESSED = new Set(['shape-guess']);
const HARVESTED = new Set(['harvested']);
const UNUSED = new Set(['unused-declaration']);

/** Reads the origin of a name from the report chips and the source. */
function segmentOrigin(text: string, chips: Chip[], source: string): Origin {
  const names = segmentNames(text);
  const marked = (ids: Set<string>) =>
    chips.some((chip) => ids.has(chip.id) && chip.symbol && names.includes(canonicalizeSymbol(chip.symbol)));
  if (marked(GUESSED)) return 'guessed';
  if (marked(HARVESTED)) return 'harvested';
  const lines = source.split('\n');
  for (const name of names) {
    if (lines.some((l) => l.trim().startsWith('% samosa:') && l.includes(name))) return 'comment';
  }
  return 'typed';
}

function segmentNames(text: string): string[] {
  const match = text.match(/^(.+?)\s*:/);
  if (!match) return [];
  return match[1].split(',').map((n) => canonicalizeSymbol(n.trim())).filter(Boolean);
}

function segmentType(text: string): string {
  const match = text.match(/^.+?:\s*(.*)$/);
  return match ? match[1].trim() : text.trim();
}

function segmentUnused(text: string, chips: Chip[]): boolean {
  const names = segmentNames(text);
  return chips.some(
    (chip) => UNUSED.has(chip.id) && chip.symbol && names.includes(canonicalizeSymbol(chip.symbol)),
  );
}

const ORIGIN_MARK: Record<Origin, string | null> = {
  typed: null,
  comment: '%',
  harvested: '¶',
  guessed: null,
};

const ORIGIN_TITLE: Record<Origin, string> = {
  typed: 'typed',
  comment: 'came from a % samosa: line',
  harvested: 'read from the prose',
  guessed: 'guessed from use; declare it to pin it down',
};

export function DeclarationsStrip({
  decls,
  source,
  chips,
  onDeclare,
  onReplaceSegment,
  onEdit,
  onCopySamba,
  onPreset,
}: DeclarationsStripProps) {
  const declared = new Set(parseDeclarations(decls).decls.map((d) => d.name));
  const segments: Segment[] = decls
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((text) => ({
      text,
      names: segmentNames(text),
      type: segmentType(text),
      origin: segmentOrigin(text, chips, source),
      unused: segmentUnused(text, chips),
    }));
  const suggestions = chips.filter(
    (chip) => chip.id === 'shape-guess' && chip.symbol && !declared.has(canonicalizeSymbol(chip.symbol)),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [pick, setPick] = useState<Record<number, string>>({});

  const apply = (index: number) => {
    const segment = segments[index];
    const type = pick[index] ?? segment.type;
    const match = segment.text.match(/^(.+?)\s*:/);
    const names = match ? match[1] : segment.text;
    onReplaceSegment(index, `${names}: ${type}`);
    setEditing(null);
  };

  return (
    <div className="relative flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-1.5 text-[0.6875rem]">
      <select
        aria-label="load a preset"
        className="max-w-32 rounded border border-[var(--color-line)] bg-transparent px-1.5 py-0.5 text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
        value=""
        onChange={(e) => {
          if (e.target.value) onPreset(e.target.value);
          e.target.value = '';
        }}
      >
        <option value="">presets…</option>
        {PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
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
            <button
              key={index}
              onClick={() => setEditing(editing === index ? null : index)}
              title={`${ORIGIN_TITLE[segment.origin]}. Click to edit.`}
              className={`rounded border px-1.5 py-0.5 font-mono text-[0.625rem] transition-colors ${
                segment.unused
                  ? 'border-[var(--color-tamarind)] text-[var(--color-tamarind)] underline decoration-wavy underline-offset-2'
                  : segment.origin === 'guessed'
                    ? 'border-dashed border-[var(--color-saffron)] text-[var(--color-saffron)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]'
                    : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]'
              }`}
            >
              {ORIGIN_MARK[segment.origin]}
              {segment.text}
            </button>
          ))}
        </div>
      )}
      {suggestions.map((chip) => (
        <div key={chip.id + (chip.symbol ?? '')} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[var(--color-faint)]">
            <span className="font-mono text-[var(--color-muted)]">{chip.symbol}</span> guessed
          </span>
          {[
            { label: 'n×n', type: 'n×n' },
            { label: 'vector', type: 'n' },
            { label: 'sym n', type: 'sym n' },
            { label: 'spd n', type: 'spd n' },
          ].map(({ label, type }) => (
            <button
              key={type}
              onClick={() => chip.symbol && onDeclare(chip.symbol, type)}
              title={`declare ${chip.symbol} as ${type}`}
              className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[0.625rem] text-[var(--color-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
            >
              {label}
            </button>
          ))}
        </div>
      ))}
      <button
        onClick={() => onCopySamba(`% samosa: ${decls}`)}
        title="copy the declarations as a % samosa: line"
        className="ml-auto rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[0.625rem] text-[var(--color-faint)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
      >
        % samosa:
      </button>

      {editing !== null && segments[editing] && (
        <div
          role="dialog"
          aria-label="edit the declaration"
          className="absolute left-4 top-full z-30 mt-2 w-72 rounded border border-[var(--color-line)] bg-[var(--color-panel)] p-3 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.6875rem] text-[var(--color-text)]">
              {segments[editing].text.split(':')[0]}
            </span>
            <button
              aria-label="close the editor"
              onClick={() => setEditing(null)}
              className="text-[0.6875rem] text-[var(--color-faint)] hover:text-[var(--color-text)]"
            >
              ×
            </button>
          </div>
          <label className="mt-2 block text-[0.625rem] text-[var(--color-faint)]" htmlFor="decl-type">
            the kind
          </label>
          <select
            id="decl-type"
            className="mt-1 w-full rounded border border-[var(--color-line)] bg-black/30 px-2 py-1 text-xs outline-none focus:border-[var(--color-gold)]"
            value={pick[editing] ?? segments[editing].type}
            onChange={(e) => setPick((current) => ({ ...current, [editing]: e.target.value }))}
          >
            {KINDS.map(({ label, value }) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setEditing(null)}
              className="rounded border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              cancel
            </button>
            <button
              onClick={() => apply(editing)}
              className="rounded border border-[var(--color-gold)] bg-[var(--color-gold)] px-2 py-1 text-[0.625rem] font-semibold text-[var(--color-ink)]"
            >
              apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
