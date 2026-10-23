# Changelog

All notable changes to SAMOSA. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-10-23

The parser reads the whole row, and the measurement is corrected.

### Fixed

- A row now ends at its real punctuation, and a trailing comma or period no
  longer hides the rest of the line.
- A row with several top level clauses is split into claims; a relation
  inside a group becomes a named `raw` node instead of an error.
- An accented lowercase call, a powered call such as `d^2(f, g)`, and a
  condition inside an expectation are read as written.
- A trailing `\text{...}` is an annotation, not a parse failure.

### Changed

- The coverage is measured on the whole row. On 36 papers, 686 of 1219
  claim rows parse end to end (56.3%), and 304 have no named unknown
  construct (24.9%); that is 21.5% of the 1416 display rows. The method and
  the correction are in [docs/COVERAGE.md](docs/COVERAGE.md).
- On a phone the inspector is a bottom sheet, and the header actions live in
  the overflow menu.

## [1.0.0] - 2026-10-21

The first release.

### Added

- The engine: a tokenizer and a Pratt parser for the LaTeX that people
  actually write, declarations in both the LaTeX and the compact syntax,
  shape inference with a union find over the dimension variables, and degree
  bounds for the guarantee on every checkmark.
- Exact mode over GF(2^31-1) and GF(2147483629), with the bound computed
  per size and shown on the card.
- Gradients and Hessians by dual and hyper-dual numbers, with the layout
  convention diagnosed rather than guessed.
- Exact expectations by rational quadrature, so the expectation of a
  polynomial under a Gaussian is exact too.
- Implications by constraint completion, so "set the gradient to zero and
  solve" is checked rather than skipped.
- Counterexamples, shrunk until they are small enough to read, with a NumPy
  snippet that reproduces them.
- The repairs: a mutation search over the mistake catalog, the residual
  fingerprint, the missing assumption and the shape repair.
- The app: the source and the rendered panes, the inspector with the
  guarantee card, the command palette, the spot the bug game, the share
  links and the exports.
- The CLI, with the pretty, JSON, SARIF and GitHub formats.
- The MCP server and the Agent Skill.
- The GitHub Action, with the CLI shipped inside it.
- The npm package `samosa-math`, with the `samosa` CLI and the `samosa-mcp`
  server, so `npx samosa-math check paper.tex` works with no install.
- Sixteen derivations in the Menu, each with its planted bug.

### Measured

- 56.3% of the claim rows in the display math of 36 recent arXiv papers
  parses end to end, and 24.9% is read with no named unknown construct. That
  is 21.5% of all display rows. The first measurement was lenient; the
  correction and the method are in
  [docs/COVERAGE.md](docs/COVERAGE.md).

[1.0.1]: https://github.com/Hussain004/SAMOSA/releases/tag/v1.0.1
[1.0.0]: https://github.com/Hussain004/SAMOSA/releases/tag/v1.0.0
