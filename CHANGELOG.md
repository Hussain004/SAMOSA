# Changelog

All notable changes to SAMOSA. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-11-11

The implication row checks, the distribution row checks, the counterexample
speaks three languages, and the editor is an extension.

### Fixed

- The sampler read a literal covariance as a generic symbol and drew a
  random root, so every `x ~ N(0, 1)` was wrong. The identity covariance is
  its own square root now, a nonzero literal mean for a vector is refused
  rather than sampled at random, and a Gaussian takes the shape of its law
  (the shape of the mean, or of the covariance, or a fresh dimension
  nobody pins).
- A Gaussian was always a scalar, so `x ~ N(\mu, \Sigma)` used as a vector
  sampled as a scalar. A random variable now has the shape of its law.
- An implication row carried no registry of its own, so a row with no
  earlier rows always came back unevaluated. The row populates it now, and
  the dimensions of the polymorphic symbols unify with the shapes they
  meet in: `Q Q^\top = I ==> Q = I` checks.
- A scalar pivot is a one by one matrix everywhere in the implication
  machinery, so scalar implications check too.
- A matrix zero compared with a zero scalar was decided before the zero
  matrix broadcast, and a true implication came back wrong. The broadcast
  decides now.
- The identity of a stationary point in the Cookbook was uncheckable: the
  identity (an unstructured quadratic's unique stationary point is the
  origin) is true only with an invertible structure, so it declares `spd`,
  and it checks. The implication was previously `?` everywhere because the
  row never evaluated.
- A row with a relation in `<= < >= >` was `?` with the reason missing.
  Inequalities are searched for counterexamples now: wrong with a
  counterexample when a violation is found, inconclusive never (see
  below), never a checkmark.
- `E[sin x]` went through the polynomial quadrature and came back with the
  wrong message instead of a verdict. Non-polynomial expectations go
  through a seeded Monte Carlo estimate now: wrong outside six standard
  errors, inconclusive otherwise, never a checkmark.
- `Ax + b ~ N(A mu + b, A Sigma A^T)` was unchecked. A distribution claim
  is checked by its two moments now, exactly, and a non-affine left side
  is refused rather than certified.

### Added

- Inequalities are checked by counterexample search: `|a+b| >= |a|+|b|`
  is wrong, Cauchy-Schwarz stays a question mark, and `A >= 0` broadcasts
  a zero scalar to the zero matrix.
- A distribution claim `f ~ \mathcal{N}(m, S)` is checked by its two
  moments: `E[f] = m` and `Var(f) = S`, exactly, by the rational
  quadrature in the primes. The card says the first two moments match and
  lists the assumption that the left side is Gaussian; an affine function
  of a Gaussian is, and SAMOSA checks that.
- The non-affine implication (a premise the polynomial solver cannot
  read) is solved by Newton's method at the reals: wrong at the root
  found, inconclusive otherwise, never a checkmark. Scalar pivots,
  vector pivots and matrix pivots (square systems up to 6 by 6) all
  work.
- The row badge and the card name the identity the step is: `the Kalman
  gain`, `the Joseph form`, `the push-through identity`. A row that does
  not hold is never named.
- Inequalities never get a checkmark; the mode invariant is tested.
- The VS Code extension: red squiggles for wrong rows, hover with the
  guarantee and the counterexample as a NumPy snippet, quick fixes from
  the repair search, and two commands (open in the app, copy the
  counterexample). The engine runs in a worker inside the language
  server; nothing leaves the editor. The `.vsix` packages; the
  Marketplace and Open VSX wait on the publisher account.
- The counterexample, in three languages: NumPy (Python, exact rationals
  via Fraction), Julia, and MATLAB. The card shows the language you ask
  for, and copies that snippet.
- The MCP server grew the tools agents use: suggest_declarations for the
  undeclared derivation (two calls to an all-checkmark one), explain_step
  for one row, spans on every step, two bundled resources (notation,
  Cookbook), and the check-my-derivation prompt.
- A whole paper opens in the app: drop a `.tex` on the source pane, and
  the outline rail lists every math block with its rows and verdicts.
  Click one to jump to it.
- The app is an installable offline PWA, and the report figures as a
  scannable PNG from the card.
- A `?` card invites a report of the exact row as a prefilled GitHub
  issue; the privacy page says what that link is, and that it is the only
  path for text to leave the app.
- The false friends corpus is in the open: the 40 plausible but false
  identities SAMOSA will never ratify, the dated list of the false
  checkmarks found and fixed, the issue form for the next one, and the
  ledger page that renders both. Accepted traps are credited by handle.
- The embed widget: a read-only derivation at `/embed`, checked once on
  mount, with `frame-ancestors *` and `connect-src 'none'`; the app stays
  frame-sealed. The overflow menu copies an iframe snippet.
- Four course packs (Backprop, EKF and the Riccati recursion, the
  inversion lemmas, TA solution keys), playable in spot the bug with the
  streak you keep.
- The landing page opens with a live mini-checker, the soundness ledger
  and the coverage curve; the landing is `sections/`, one file per
  section.
- Nightly CI runs the Menu, the Cookbook and the false friends at thirty
  seeds; the parser is fuzzed; Lighthouse gates accessibility at 0.95 on
  `/` and `/app/`; the release refuses a changelog with no section for
  the tag.

## [1.2.0] - 2026-11-04

The stochastic identities are checked, papers are read inside their
document body, and the docs are pages of the site.

### Fixed

- A symbol declared as a value is a factor before a parenthesis, so
  `A (B + C) = AB + AC` holds instead of reading `A` as an unknown function.
- The body of `\begin{document}` and of any other prose environment is read
  for its mathematics. It used to be skipped, so every paper went through a
  line by line fallback that cut a row spanning two lines in half and gave a
  false cross on a correct paper.
- `x \sim \mathcal{N}(0, \Sigma)` has mean zero, so `E[x x^\top] = \Sigma` holds.
- `\operatorname{Var}(g)` is `E[g g^\top] - E[g] E[g]^\top` for any polynomial
  `g`: the variance of a vector is a matrix, and `Var(A x)` and `Var(x + y)`
  are checked. The five stochastic Cookbook identities are checked now.
- A rational exponent is a power, not part of a new name: `x^{1/3} x^{2/3} = x`
  holds, `\sqrt[k]{x}` is `x^{1/k}`, and `x^{-2}` is the inverse of the square.
- The bound of a step with orthogonal matrices is priced on the trials of the
  least drawn corner, and every corner gets the full trial count.
- `/app` carries the content security policy too, not only `/app/`.
- The nav's changelog link resolves, and the docs are rendered pages.
- The poster of the tour is a frame of it, not a black one.
- A fix names the mistake first: "two factors are swapped, so change the right
  side to", followed by the new side, in the app and in the CLI.

### Added

- `a \times b` between two vectors is the cross product, and the rotations
  Menu item checks that a rotation carries it along.
- The two point rule for Gaussian expectations, exact to degree three, chosen
  whenever it is enough.

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
