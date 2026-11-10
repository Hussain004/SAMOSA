import { useMemo } from 'react';
import katex from 'katex';

/**
 * The LaTeX pieces of the app, in one place.
 *
 * The counterexample card and the rendered rows both draw math with KaTeX,
 * and the escaping was written twice, once in each. One copy, so a bug in
 * one cannot hide behind the other.
 */

/** Renders a piece of LaTeX, and never throws at the reader. */
export function Tex({
  latex,
  display = false,
  className,
}: {
  latex: string;
  display?: boolean;
  className?: string;
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
        output: 'html',
      });
    } catch {
      return escapeHtml(latex);
    }
  }, [latex, display]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
