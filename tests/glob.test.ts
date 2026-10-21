import { describe, expect, it } from 'vitest';
import { expandGlob, patternMatches } from '../cli/glob.ts';

/**
 * The glob of the command line.
 *
 * The GitHub Action passes a pattern to the command, and the shell inside an
 * action does not expand `**`, so the command does it itself.
 */

const root = process.cwd();

describe('the glob', () => {
  it('finds the files in the folders', () => {
    const files = expandGlob('tests/e2e/action/*.tex', root);
    expect(files).toContain('tests/e2e/action/holds.tex');
    expect(files).toContain('tests/e2e/action/wrong.tex');
  });

  it('reaches into the folders with two stars', () => {
    const files = expandGlob('tests/**/*.tex', root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file.endsWith('.tex')).toBe(true);
  });

  it('keeps a plain name as it is', () => {
    expect(expandGlob('README.md', root)).toEqual(['README.md']);
  });

  it('matches a name against a pattern', () => {
    expect(patternMatches('a.md', '*.md')).toBe(true);
    expect(patternMatches('a/b.md', '*.md')).toBe(false);
    expect(patternMatches('a/b.md', '**/*.md')).toBe(true);
    expect(patternMatches('a.md', '?.md')).toBe(true);
    expect(patternMatches('ab.md', '?.md')).toBe(false);
    expect(patternMatches('a.md', '{a,b}.md')).toBe(true);
    expect(patternMatches('c.md', '{a,b}.md')).toBe(false);
  });

  it('finds nothing when nothing matches', () => {
    expect(expandGlob('tests/e2e/action/*.rs', root)).toEqual([]);
  });
});
