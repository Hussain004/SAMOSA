/**
 * Matrices, as LaTeX.
 *
 * The counterexample of a wrong step is drawn as the matrices it is made of.
 * The rows of a matrix are separated by two backslashes; one backslash is a
 * space, and a 2 by 2 matrix would be drawn as a single row of four.
 */

/** A value as a matrix, in the shape it was found at. */
export function matrixLatex(value: number[] | number, shape: [number, number], highlight = false): string {
  if (typeof value === 'number') return cellLatex(value, highlight);
  let [rows, cols] = shape;
  if (!rows || !cols || rows * cols !== value.length) {
    rows = 1;
    cols = value.length;
  }
  const body: string[] = [];
  for (let i = 0; i < rows; i++) {
    const cells: string[] = [];
    for (let j = 0; j < cols; j++) cells.push(cellLatex(value[i * cols + j] ?? 0, highlight));
    body.push(cells.join(' & '));
  }
  return String.raw`\begin{bmatrix} ${body.join(' \\\\ ')} \end{bmatrix}`;
}

/** A number, short enough to read, and in red when it is the difference. */
function cellLatex(x: number, highlight: boolean): string {
  const short = Number(x.toFixed(4));
  const text = String(short);
  return highlight && short !== 0 ? String.raw`\color{#e25555}{${text}}` : text;
}
