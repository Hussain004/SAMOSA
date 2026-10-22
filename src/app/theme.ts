import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * The theme of the source pane.
 *
 * The same palette as the rest of the app, so the editor does not look like
 * a different program pasted into the page.
 */
export const samosaTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--color-text)',
      backgroundColor: 'transparent',
      height: '100%',
    },
    '.cm-content': {
      caretColor: 'var(--color-gold)',
      fontFamily: 'var(--font-mono)',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-gold)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: '#e8b04b22',
    },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--color-faint)' },
    '.cm-activeLine': { backgroundColor: 'var(--color-wash)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-muted)' },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      borderBottom: '1px wavy var(--color-tamarind)',
    },
    '.cm-lintRange-warning': {
      backgroundImage: 'none',
      borderBottom: '1px wavy var(--color-saffron)',
    },
    '.cm-lintRange-info': {
      backgroundImage: 'none',
      borderBottom: '1px dotted var(--color-slate)',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--color-panel-2)',
      border: '1px solid var(--color-line)',
      borderRadius: '8px',
      color: 'var(--color-text)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: '#e8b04b1f',
      color: 'var(--color-text)',
    },
  },
  { dark: true },
);

/** The colours of the LaTeX, kept quiet on purpose. */
export const samosaHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--color-gold)' },
    { tag: tags.name, color: 'var(--color-text)' },
    { tag: tags.variableName, color: 'var(--color-text)' },
    { tag: tags.typeName, color: 'var(--color-saffron)' },
    { tag: tags.function(tags.variableName), color: 'var(--color-saffron)' },
    { tag: tags.number, color: 'var(--color-chutney)' },
    { tag: tags.operator, color: 'var(--color-muted)' },
    { tag: tags.punctuation, color: 'var(--color-faint)' },
    { tag: tags.bracket, color: 'var(--color-faint)' },
    { tag: tags.comment, color: 'var(--color-faint)', fontStyle: 'italic' },
    { tag: tags.string, color: 'var(--color-chutney)' },
    { tag: tags.definitionKeyword, color: 'var(--color-gold)' },
    { tag: tags.labelName, color: 'var(--color-muted)' },
  ]),
);
