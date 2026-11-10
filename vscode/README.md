# SAMOSA for VS Code

A linter for matrix algebra, in your LaTeX. Every row of a derivation is
checked exactly (finite field or 50 digits) or with a stated error bound,
as you type. Rows that are wrong get a red squiggle and a quick fix.

## What it does

- **Diagnostics.** `wrong` and `shape` are errors, `inconclusive` is a
  warning, `not checked` is information. The message says which row and
  what the engine found.
- **Hover.** The guarantee of the step: how many sizes were tried, how
  many trials, which primes, and the probability that a wrong step would
  pass. For a wrong row, the counterexample, as a NumPy snippet.
- **Quick fixes.** The engine's own repair search offers the verified
  fix. One click applies it in the editor, undo with Ctrl+Z.
- **Commands.**
  - `SAMOSA: open this derivation in SAMOSA` opens the web app with your
    derivation and declarations in the link (nothing is uploaded; the link
    carries the text).
  - `SAMOSA: copy the counterexample as NumPy` copies the values that
    break the step to the clipboard.

## What it checks

`align*` blocks, `theorem`/`proof` bodies, inline math, whole documents.
Declarations are read from a `% samosa:` comment in the file, for example:

```latex
% samosa: A: n×n; \Sigma: spd n; x: n
```

If nothing is declared, SAMOSA guesses (everything unknown is a square
matrix) and says so in the output panel.

## What it never does

Nothing leaves the editor. The engine runs in a worker thread inside the
language server on this machine. There is no account, no telemetry, and no
network request. The share link is built locally and opened only when you
ask for it.

A checkmark always carries a guarantee: the sizes tested, the trials, the
primes, the degree bound and the assumptions. Inequalities are searched
for counterexamples, never certified.

## Requirements

VS Code 1.85 or newer. Nothing else; the extension bundles the engine.

## License

MIT. The engine is [samosa-math.vercel.app](https://samosa-math.vercel.app).
