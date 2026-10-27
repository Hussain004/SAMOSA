import { describe, expect, it } from 'vitest';
import { matrixLatex } from '../src/app/matrix.ts';

describe('the matrices of a counterexample', () => {
  it('separates the rows with two backslashes', () => {
    const latex = matrixLatex([1, 2, 3, 4], [2, 2]);
    expect(latex).toBe(String.raw`\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}`);
  });

  it('draws a column as a column, and a row as a row', () => {
    expect(matrixLatex([1, 2, 3], [3, 1])).toBe(String.raw`\begin{bmatrix} 1 \\ 2 \\ 3 \end{bmatrix}`);
    expect(matrixLatex([1, 2, 3], [1, 3])).toBe(String.raw`\begin{bmatrix} 1 & 2 & 3 \end{bmatrix}`);
  });

  it('colours the entries that are not zero in a difference', () => {
    expect(matrixLatex([0, 2], [1, 2], true)).toContain(String.raw`\color{#e25555}{2}`);
  });
});
