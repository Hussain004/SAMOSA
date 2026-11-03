# Changelog

All notable changes to SAMOSA. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-03

The checker is stricter about what it will call right, the browser enforces
nothing leaving the page, and the release is built from the manifest.

### Added

- The `% samosa:` comments and the where lines are read by the CLI, the MCP
  server, the app and the checker alike, so a declaration travels with the
  text.
- The macros a paper defines are expanded: `\newcommand` and
  `\DeclareMathOperator` mean what the author wrote.
- Declarations for `zero`, `ones` and `ident`, and sizes can be pinned with
  `n = 3`; an unknown type is an error that says so, never a silence.
- The declarations are in the open in the app: a strip above the panes
  shows what the check ran with, and a symbol the checker had to guess is
  declared with one click.
- The content security policy and `Referrer-Policy: no-referrer` are served
  by the host, so the browser, not just the test, refuses what would leave
  the page; boot scripts are files, so the policy needs no inline
  allowances.
- The matrix property tests generate typed n×n expressions, apply true
  rewrites and mutants, and the float64 oracle backs every harmless mutant
  the catalogue calls harmless.
- The README Cookbook numbers are regenerated from `pnpm check:corpus`,
  and CI fails on drift.
- The KL of two Gaussians menu item checks its claims and carries a
  planted bug; the rotation menu item checks `det(R) = 1` and carries one
  too.

### Fixed

- The checkmarks the checker had not earned: the orth components are
  declared, `abs` is out of exact mode, the degree rules bound det, tr,
  derivatives and blocks, and the structured samplers (spd, orth, stoch,
  unit, tril, triu) draw from the structure they claim.
- The identity is square in the type system, in the sampler and in the
  printer, so det and tr no longer meet a non-square one.
- A shape error carries the sizes that do not fit, never an assignment
  where the shapes happen to agree.
- The step-ID drift between check and explain is gone: one builder builds
  the steps for both, so a fix is never offered for the wrong row, and a
  fix whose coefficient is 0 is never offered at all.
- The CLI does not crash on real papers: comments, nested environments,
  conditionals, display math and the macros the author defines.
- The landing page makes no network request: the star count was fetched
  from the GitHub API at runtime, and it is gone.
- Contrast passes WCAG AA on the landing and the app, and the first paint
  holds a placeholder instead of a wrong empty state.

### Changed

- Budgets are counts of evaluations, not milliseconds, so the engine does
  the same work on any machine.
- Fixes of the right side are offered before fixes of the claim, because a
  fix of the derivation is the one the author wants.
- The version the CLI, the MCP server and the engine print is read from
  `package.json` at build time; a release cannot drift from the code that
  was released.
- A tag builds the package, publishes it to npm with provenance, and
  creates the GitHub release from this file; CI runs the Cookbook, and
  fails on drift in the README numbers.

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
