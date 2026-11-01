import { describe, expect, it } from 'vitest';
import { check } from '../src/core/index.ts';
import { harvestMacros } from '../src/core/parse.ts';

/**
 * The macros a paper defines.
 *
 * Authors write `\newcommand{\norm}[1]{\lVert #1 \rVert}` and
 * `\DeclareMathOperator{\Tr}{Tr}`, and the checker reads the mathematics
 * the way the author meant it (review 5.6). A macro that is not defined is
 * named, never blamed on the field or the reals.
 */

describe('the macros a paper defines', () => {
  it('a norm macro with one argument is read, squared like any norm', () => {
    const src = [
      '\\newcommand{\\norm}[1]{\\lVert #1 \\rVert}',
      '\\begin{align*}',
      '  \\norm{x}^2 &= x^\\top x',
      '\\end{align*}',
    ].join('\n');
    const report = check(src, { decls: 'x: n' });
    expect(report.steps[0].verdict).toBe('ok');
  });

  it('an operator macro is the function its body names', () => {
    const src = [
      '\\DeclareMathOperator{\\Tr}{Tr}',
      '\\begin{align*}',
      '  \\Tr(AB) &= \\Tr(BA)',
      '\\end{align*}',
    ].join('\n');
    const report = check(src, { decls: 'A: n×n; B: n×n' });
    expect(report.steps[0].verdict).toBe('ok');
  });

  it('a macro without arguments stands where it is used', () => {
    const src = [
      '\\newcommand{\\Id}{I}',
      '\\begin{align*}',
      '  \\Id A &= A',
      '\\end{align*}',
    ].join('\n');
    const report = check(src, { decls: 'A: n×n' });
    expect(report.steps[0].verdict).toBe('ok');
  });

  it('a macro body may use another macro', () => {
    const src = [
      '\\newcommand{\\uu}{u}',
      '\\newcommand{\\uv}{\\uu^\\top v}',
      '\\begin{align*}',
      '  \\uv &= v^\\top \\uu',
      '\\end{align*}',
    ].join('\n');
    const report = check(src, { decls: 'u: n; v: n' });
    expect(report.steps[0].verdict).toBe('ok');
  });

  it('a macro that is not defined is named, and the row is a question', () => {
    const report = check('\\begin{align*} \\foo{x} &= x \\end{align*}');
    expect(report.steps[0].verdict).toBe('unchecked');
    expect(report.steps[0].message).toContain('unknown macro \\foo');
  });

  it('a definition that sits in the middle of the mathematics is no mathematics', () => {
    const src = [
      '\\begin{align*}',
      '  \\newcommand{\\Id}{I}',
      '  \\Id A &= A \\\\',
      '\\end{align*}',
    ].join('\n');
    const report = check(src, { decls: 'A: n×n' });
    // the definition does not become a step of its own, and it does not
    // stop the claim from being checked
    expect(report.steps.length).toBe(1);
    expect(report.steps[0].verdict).toBe('ok');
  });
});

describe('which macros are taken', () => {
  it('a definition in a comment defines nothing', () => {
    expect(harvestMacros('% \\newcommand{\\x}{y}').size).toBe(0);
  });

  it('a macro cannot redefine what SAMOSA reads itself', () => {
    expect(harvestMacros('\\renewcommand{\\det}{x}').has('det')).toBe(false);
    expect(harvestMacros('\\newcommand{\\alpha}{y}').has('alpha')).toBe(false);
    expect(harvestMacros('\\newcommand{\\norm}[1]{\\lVert #1 \\rVert}').get('norm')?.arity).toBe(1);
  });

  it('a body with parameters and no count is not read', () => {
    expect(harvestMacros('\\newcommand{\\bad}{#1 + #2}').has('bad')).toBe(false);
  });
});
