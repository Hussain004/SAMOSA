import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { check } from '../src/core/index.ts';
import { decodeShare, encodeShare, SHARE_MAX_BYTES } from '../src/core/share.ts';
import { summaryLine } from '../cli/format.ts';
import { clampSettings } from '../src/app/store.ts';

/**
 * The small things of review 5.9: the icon of the summary, the recovery
 * from an unclosed `{`, the cap on a share link, and the ranges of the
 * seed and the trials.
 */

describe('the icon of the summary is the worst verdict', () => {
  it('a green run does not wear the cross of a red one', () => {
    const green = check('\\begin{align*} A^\\top A &= A A^\\top \\end{align*}', { decls: 'A: sym n' });
    expect(summaryLine(green).startsWith('✓')).toBe(true);
    const red = check('\\begin{align*} A^\\top A &= A A^\\top \\end{align*}', { decls: 'A: n×n' });
    expect(summaryLine(red).startsWith('✗')).toBe(true);
  });

  it('a run with no steps at all asks, it does not pronounce', () => {
    const empty = check('% nothing but a comment\n');
    expect(summaryLine(empty).startsWith('?')).toBe(true);
  });
});

describe('one unclosed `{` does not swallow the derivation', () => {
  it('the rows after the brace are read and checked', () => {
    const src = [
      '\\begin{align*}',
      '  A &= {B \\\\',
      '  C &= D \\\\',
      '  E &= F',
      '\\end{align*}',
    ].join('\n');
    const report = check(src, { decls: 'A: n×n; B: n×n; C: n×n; D: n×n; E: n×n; F: n×n' });
    // the unclosed brace ends its row at the next separator, and the rest
    // of the derivation is checked like any other row
    expect(report.steps.length).toBe(3);
    expect(report.steps[0].verdict).toBe('unchecked');
    expect(report.steps[1].verdict).toBe('wrong');
    expect(report.steps[2].text).toMatch(/E\s*=\s*F/);
    expect(report.steps[2].verdict).toBe('wrong');
  });
});

describe('a share link is capped and its settings are clamped', () => {
  it('a fragment that inflates past the cap is a broken link', () => {
    expect(SHARE_MAX_BYTES).toBe(8 * 1024);
    const bomb = encodeShare({ src: 'x'.repeat(200000) });
    expect(() => decodeShare(bomb)).toThrow(/cap/);
    const normal = encodeShare({ src: 'A^\\top = A', decls: 'A: n×n' });
    expect(decodeShare(normal).src).toBe('A^\\top = A');
  });

  it('the seed, the trials and the layout are clamped', () => {
    const clean = clampSettings({ seed: 7, trials: 3, layout: 'numerator', snackMode: true });
    expect(clean).toEqual({ seed: 7, trials: 3, layout: 'numerator', snackMode: true });
    expect(clampSettings({ seed: -5 }).seed).toBe(4294967291);
    expect(clampSettings({ seed: Number.NaN }).seed).toBeUndefined();
    expect(clampSettings({ trials: 0 }).trials).toBeUndefined();
    expect(clampSettings({ trials: 100000 }).trials).toBeUndefined();
    expect(clampSettings({ layout: 'sideways' }).layout).toBeUndefined();
    // a link carries nothing the app does not know
    expect(clampSettings({ evil: 'yes' })).toEqual({});
    expect(clampSettings('not an object')).toEqual({});
  });
});

describe('the seed and the trials are range checked on the command line', () => {
  const run = (...args: string[]) =>
    spawnSync('npx', ['vite-node', 'cli/bin.ts', 'check', ...args], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      timeout: 120_000,
    });

  it('a negative seed stops the run', () => {
    const bad = run('tests/e2e/action/holds.tex', '--seed', '-1');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('--seed');
  });

  it('a trials count of zero stops the run', () => {
    const bad = run('tests/e2e/action/holds.tex', '--trials', '0');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('--trials');
  });
});
