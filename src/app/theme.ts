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
    '.samosa-hoverLine': { backgroundColor: '#e8b04b0d' },
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

/**
 * The colours of the LaTeX, one per role a token plays in a derivation.
 *
 * The names stay plain, so the eye lands on what changes from row to row:
 * the relation, the scripts, the commands. The layout marks (`&`, `\\`,
 * spacing) and the brackets recede. The values live in `styles.css`, one
 * set per theme.
 */
export const samosaHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.variableName, color: 'var(--syn-name)' },
    { tag: tags.function(tags.variableName), color: 'var(--syn-command)' },
    { tag: tags.compareOperator, color: 'var(--syn-relation)', fontWeight: '600' },
    { tag: tags.special(tags.operator), color: 'var(--syn-script)' },
    { tag: tags.arithmeticOperator, color: 'var(--syn-operator)' },
    { tag: tags.number, color: 'var(--syn-number)' },
    { tag: tags.bracket, color: 'var(--syn-bracket)' },
    { tag: tags.punctuation, color: 'var(--syn-layout)' },
    { tag: tags.keyword, color: 'var(--syn-environment)' },
    { tag: tags.meta, color: 'var(--syn-declaration)', fontStyle: 'italic' },
    { tag: tags.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  ]),
);
