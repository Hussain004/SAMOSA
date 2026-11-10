# SAMOSA in VS Code

SAMOSA ships as a VS Code extension over the same engine the web app, the
CLI and the MCP server use. It checks a LaTeX derivation as you type and
says which rows are wrong, with the sizes it tested, the trials, the
primes and the bound.

## What you get

- **Diagnostics.** `wrong` and `shape` are errors, `inconclusive` is a
  warning, `not checked` is information. The squiggle sits on the row.
- **Hover.** The guarantee of the step: sizes, trials, primes, the bound,
  and for a wrong row the counterexample as a NumPy snippet you can run.
- **Quick fixes.** The engine's own repair search offers the verified
  fix. One click applies it, Ctrl+Z undoes it.
- **Commands.**
  - `SAMOSA: open this derivation in SAMOSA` opens the web app with your
    derivation and declarations in the link; the text travels in the URL
    fragment and nothing is uploaded.
  - `SAMOSA: copy the counterexample as NumPy` copies the values that
    break the row to the clipboard.

## Install

From a checkout of this repository:

```sh
pnpm install
pnpm build:vscode
cd vscode && npx @vscode/vsce package --out samosa.vsix
```

then install the `.vsix` in VS Code with `code --install-extension samosa.vsix`.

Marketplace and Open VSX publishing are wired in CI-friendly form but the
publisher accounts do not exist yet; until they do, the `.vsix` is the way
to install.

## Configuring a file

The checker reads the same `% samosa:` comment the app does:

```latex
% samosa: A: n×n; \Sigma: spd n; x: n

\begin{align*}
A x &= x + 0
\end{align*}
```

Declarations can also be harvested from prose ("where x is the state"), and
rows with no relation are not claims. The `action/` fixtures in this
repository show papers in the wild, with `\documentclass`, sections and
theorem environments.

## What it never does

Nothing leaves the editor: the engine runs in a worker thread inside the
language server process on this machine. The extension makes no network
request. The share link is built locally and opened only when you invoke
the command.

## Publishing

```sh
cd vscode
npx @vscode/vsce publish      # VS Code Marketplace (publisher: Hussain004)
npx ovsx publish              # Open VSX (needs an Open VSX account)
```

Both need an account and a token; the extension is otherwise ready.
