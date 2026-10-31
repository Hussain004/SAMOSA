import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';

/**
 * The files a checker meets in the wild: a paper with a document class, a
 * list, a theorem and its proof, an equation that wraps an aligned block,
 * display mathematics in both notations, and mathematics that is commented
 * out or hidden behind a false conditional (review 5.2).
 *
 * None of them may crash the run, and only the mathematics that is live may
 * be checked.
 */

const fixture = (name: string): string => readFileSync(`tests/e2e/action/${name}.tex`, 'utf8');

describe('the files the Action runs on', () => {
  it('a document class and a document body do not hide the mathematics', () => {
    const report = check(fixture('documentclass'));
    expect(report.steps.map((s) => s.verdict)).toEqual(['ok']);
  });

  it('a list of prose is no mathematics, and it does not crash', () => {
    const report = check(fixture('itemize'));
    expect(report.steps.length).toBe(0);
  });

  it('the step inside a proof is checked', () => {
    const report = check(fixture('theorem-proof'));
    expect(report.steps.map((s) => s.verdict)).toEqual(['ok']);
  });

  it('an aligned block inside an equation is read, not left unread', () => {
    const report = check(fixture('equation-aligned'));
    expect(report.steps.length).toBe(1);
    expect(report.steps[0].verdict).toBe('ok');
    expect(report.steps[0].message).not.toContain('environment');
  });

  it('bracket and dollar display mathematics are both read', () => {
    const report = check(fixture('bracket-dollar'));
    expect(report.steps.map((s) => s.verdict)).toEqual(['ok', 'ok']);
  });

  it('commented out mathematics and a false conditional are not checked', () => {
    const report = check(fixture('commented'));
    // only the live derivation is a step; the removed and the hidden
    // derivation both claim the false order
    expect(report.steps.length).toBe(1);
    expect(report.steps[0].verdict).toBe('ok');
  });

  it('a small paper checks step by step', () => {
    const report = check(fixture('paper'));
    expect(report.steps.map((s) => s.verdict)).toEqual(['ok', 'ok', 'ok']);
    expect(report.steps.every((s) => s.verdict === 'ok')).toBe(true);
  });
});

describe('the command on a file with no display math', () => {
  const run = (...args: string[]) =>
    spawnSync('npx', ['vite-node', 'cli/bin.ts', 'check', ...args], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      timeout: 120_000,
    });

  it('warns, and passes unless the run asks for mathematics', () => {
    const plain = run('tests/e2e/action/itemize.tex');
    expect(plain.status).toBe(0);
    expect(plain.stderr).toContain('no display math');

    const required = run('tests/e2e/action/itemize.tex', '--require-math');
    expect(required.status).toBe(1);
    expect(required.stderr).toContain('no display math');
  });

  it('a seed that is not an integer stops the run', () => {
    const bad = run('tests/e2e/action/holds.tex', '--seed', 'abc');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('--seed');
  });

  it('a flag that takes no value leaves the arguments after it alone', () => {
    // the Action writes the SARIF with --require-math before --output; the
    // flag once consumed --output, the SARIF path became an input file, and
    // no SARIF was ever written
    const out = join(tmpdir(), `samosa-${process.pid}.sarif`);
    const run2 = spawnSync(
      'npx',
      ['vite-node', 'cli/bin.ts', 'check', 'tests/e2e/action/wrong.tex', '--format', 'sarif', '--require-math', '--output', out],
      { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', timeout: 120_000 },
    );
    expect(run2.status).toBe(1);
    expect(existsSync(out)).toBe(true);
    rmSync(out, { force: true });
  });
});
