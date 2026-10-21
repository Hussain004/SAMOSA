import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
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
}

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
}: EditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelectStep);

  // the callbacks are read from the refs, so the editor is created once
  useEffect(() => {
    onChangeRef.current = onChange;
    onSelectRef.current = onSelectStep;
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
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
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

  // push the external value in, when it is not the one the editor has
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
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

  return <div className="h-full min-h-0 overflow-hidden" ref={host} />;
}
