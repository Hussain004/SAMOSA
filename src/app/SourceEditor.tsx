import { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, Transaction } from '@codemirror/state';
import { EditorView, Decoration, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { lintGutter, lintKeymap, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { StreamLanguage, bracketMatching, indentOnInput } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import type { Report } from '../core/index.ts';
import { samosaHighlight, samosaTheme } from './theme.ts';

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  report: Report | null;
  selectedStep: string | null;
  onSelectStep: (id: string) => void;
  /** the spot the bug game: the squiggles would give the answer away */
  hideDiagnostics?: boolean;
  /** the step the other pane hovers, if any */
  hoverStep?: string | null;
  onHoverStep?: (id: string | null) => void;
}

/**
 * The line of the editor that belongs to the step the other pane hovers.
 * The decoration maps through edits, so hovering survives typing.
 */
const setHoverLine = StateEffect.define<number | null>();

const hoverLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decos, tr) {
    let next = tr.docChanged ? decos.map(tr.changes) : decos;
    for (const effect of tr.effects) {
      if (effect.is(setHoverLine)) {
        next = effect.value === null ? Decoration.none : Decoration.set([hoverLine.range(effect.value)]);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const hoverLine = Decoration.line({ class: 'samosa-hoverLine' });

/**
 * The source pane.
 *
 * CodeMirror with the lint gutter, so a wrong step gets a squiggle and a
 * click on the squiggle opens the card of that step.
 */
export function SourceEditor({
  value,
  onChange,
  report,
  selectedStep,
  onSelectStep,
  hideDiagnostics,
  hoverStep,
  onHoverStep,
}: EditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelectStep);
  const onHoverRef = useRef(onHoverStep);
  const reportRef = useRef(report);

  // the callbacks are read from the refs, so the editor is created once
  useEffect(() => {
    onChangeRef.current = onChange;
    onSelectRef.current = onSelectStep;
    onHoverRef.current = onHoverStep;
    reportRef.current = report;
  });

  useEffect(() => {
    if (!host.current) return;
    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        indentOnInput(),
        bracketMatching(),
        lintGutter(),
        StreamLanguage.define(stex),
        samosaHighlight,
        samosaTheme,
        keymap.of([...defaultKeymap, ...historyKeymap, ...lintKeymap, indentWithTab]),
        EditorView.lineWrapping,
        hoverLineField,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          if (u.selectionSet || u.docChanged) {
            const head = u.state.selection.main.head;
            const hoverRef = onHoverRef.current;
            const currentReport = reportRef.current;
            if (hoverRef && currentReport) {
              const step = currentReport.steps.find(
                (s) => head >= s.span.from && head <= s.span.to,
              );
              hoverRef(step?.id ?? null);
            }
          }
        }),
      ],
    });
    const v = new EditorView({ state: startState, parent: host.current });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // the editor is created once; the value is pushed in from the outside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push the external value in, when it is not the one the editor has: the
  // smallest edit that turns one into the other, so the cursor, the
  // selection and the undo history survive a fix (review §2.4)
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === value) return;
    let prefix = 0;
    const limit = Math.min(current.length, value.length);
    while (prefix < limit && current.charCodeAt(prefix) === value.charCodeAt(prefix)) prefix++;
    let suffix = 0;
    const aTail = current.length - prefix;
    const bTail = value.length - prefix;
    const tail = Math.min(aTail, bTail);
    while (suffix < tail && current.charCodeAt(current.length - 1 - suffix) === value.charCodeAt(value.length - 1 - suffix)) {
      suffix++;
    }
    v.dispatch({
      changes: { from: prefix, to: current.length - suffix, insert: value.slice(prefix, value.length - suffix) },
      // an external push is its own undo unit: it must not merge into the
      // typing the user did a moment ago, or ctrl+z throws away the whole
      // derivation instead of the fix (review §2.4)
      annotations: [Transaction.userEvent.of('samosa.sync')],
    });
  }, [value]);

  // the diagnostics: one squiggle per step
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const length = v.state.doc.length;
    const diagnostics: CmDiagnostic[] = [];
    for (const step of hideDiagnostics ? [] : (report?.steps ?? [])) {
      if (step.verdict === 'defined') continue;
      const severity =
        step.verdict === 'wrong' || step.verdict === 'shape'
          ? 'error'
          : step.verdict === 'inconclusive'
            ? 'warning'
            : 'info';
      diagnostics.push({
        from: Math.min(Math.max(0, step.span.from), length),
        to: Math.min(Math.max(0, step.span.to), length),
        severity,
        message: step.message,
        source: 'samosa',
        actions: [
          {
            name: 'open',
            apply: (target) => {
              onSelectRef.current(step.id);
              target.focus();
            },
          },
        ],
      });
    }
    v.dispatch(setDiagnostics(v.state, diagnostics));
  }, [report, selectedStep, hideDiagnostics]);

  // the other pane said which row is being hovered; decorate its line
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const step = reportRef.current?.steps.find((s) => s.id === hoverStep);
    if (step && hoverStep) {
      v.dispatch({ effects: setHoverLine.of(step.span.from) });
    } else {
      v.dispatch({ effects: setHoverLine.of(null) });
    }
  }, [hoverStep]);

  return <div className="h-full min-h-0 overflow-hidden" ref={host} />;
}
