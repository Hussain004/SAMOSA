import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';
import { decodeShare, encodeShare, readShareLink, shareLink } from '../src/core/share.ts';

/**
 * The share codec.
 *
 * A link carries the whole derivation in the fragment, so nothing is
 * uploaded. The codec lives in the core, so the app, the CLI and the MCP
 * server all write links the app can open.
 */

const SRC = String.raw`\begin{align*}
A^\top B = (A B)^\top
\end{align*}`;
const DECLS = 'A, B: n×n';

describe('the share codec', () => {
  it('round trips a derivation', () => {
    const hash = encodeShare({ src: SRC, decls: DECLS });
    const payload = decodeShare(hash);
    expect(payload.src).toBe(SRC);
    expect(payload.decls).toBe(DECLS);
  });

  it('writes a link to the app, not to the landing page', () => {
    const link = shareLink('https://samosa-math.vercel.app', { src: SRC, decls: DECLS });
    expect(link.startsWith('https://samosa-math.vercel.app/app/#v1.')).toBe(true);
  });

  it('reads the payload back from a link', () => {
    const link = shareLink('https://samosa-math.vercel.app', { src: SRC, decls: DECLS });
    const payload = readShareLink(link);
    expect(payload?.src).toBe(SRC);
    expect(payload?.decls).toBe(DECLS);
  });

  it('gives the same verdicts when the link is opened', () => {
    const link = shareLink('https://samosa-math.vercel.app', { src: SRC, decls: DECLS });
    const payload = readShareLink(link);
    if (!payload) throw new Error('the link did not open');
    const before = check(payload.src, { decls: payload.decls });
    const after = check(payload.src, { decls: payload.decls });
    expect(after.steps.map((s) => s.verdict)).toEqual(before.steps.map((s) => s.verdict));
    expect(after.steps[0].verdict).toBe('wrong');
  });

  it('says nothing about a link it cannot read', () => {
    expect(readShareLink('https://samosa-math.vercel.app/app/')).toBeNull();
    expect(readShareLink('https://samosa-math.vercel.app/app/#v9.abc')).toBeNull();
    expect(readShareLink('https://samosa-math.vercel.app/app/#v1.not-base64!!')).toBeNull();
  });
});
