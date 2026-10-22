# The coverage

How much of a real paper SAMOSA reads, measured over the display math of
recent arXiv papers.

The method is in `scripts/coverage.ts`, the sample is in
`.coverage/coverage.json`, and the run is:

```bash
node_modules/.bin/vite-node scripts/coverage.ts
```

The sample is 36 recent papers from cs.LG, cs.RO and stat.ML, and 1416
display math rows. One paper in the sample could not be opened, and it is
not counted.

## The numbers

| | |
| --- | --- |
| display math rows | 1416 |
| rows with no relation (prose, a tuple, a line of a definition) | 197 |
| claim rows | 1219 |
| claim rows that parse end to end | 117 (**9.6%**) |
| claim rows with no unknown construct | 41 (**3.4%**) |
| of all display rows, the checkable share | 41 of 1416 (**2.9%**) |

**9.6%** is the parse coverage: the whole row becomes a tree, so SAMOSA can
look at it. The plan's gate G3 asks for 70%. The gate is not met.

**3.4%** is the checkable coverage: every part of the row is something
SAMOSA knows, so it can decide whether the row is right. This is the number
that matters, and it is lower.

The first version of this page reported 86.8% and 50.0%. That measurement
parsed only the first expression of a row and did not require the parser to
consume the rest, so a row that began with a symbol counted as read even
when the relation after it was never touched. It was not the number the app
produces, and this page replaces it. The current measurement parses the
whole row, and every part of it.

The measurement is the engine's own parser on each display row. A row with
no relation is prose, and it is counted, but it is not in the denominator of
the claim rows.

## What stops the rest

The failures, bucketed by the first thing that stopped the row:

| rows | the construct |
| --- | --- |
| 390 | `unexpected ,`, a second clause after the claim |
| 227 | `expected )`, a `cases` block or a condition inside a probability |
| 187 | `unexpected .`, a period and a sentence after the claim |
| 51 | `expected {`, usually a `\left\{` set the parser cannot close |
| 39 | a script on something that is not a symbol |
| 39 | `unexpected |`, a set builder or a conditional outside a call |
| 39 | `expected }`, a macro of the authors that takes a block |
| 37 | `unexpected \|`, a double bar used as a separator |
| 37 | `expected ]`, a conditional inside a bracket |
| 18 | `unexpected rbrace`, a macro that emits its own braces |
| 16 | `unexpected end of input`, an unbalanced row |
| 13 | `expected \rangle`, an inner product |
| 13 | `unexpected sub`, a subscript on an operator |
| 10 | a conditional distribution, `p(x \mid y)` |
| 8 | `unexpected \\`, a row break inside a nested environment |
| 7 | `unbalanced }`, a macro that opens a brace it does not close |
| 5 | `\*`, a macro of the authors |
| 5 | the unsquared norm, `\|x\|` |

Most of the list is not a missing piece of notation. It is the end of the
row: a second clause, a `where` clause, a parenthetical condition, or a
`cases` block inside a probability. The parser reads the relation and then
meets the prose of the paper. The next work is to read those clauses as
clauses, instead of asking the expression parser to swallow them.

## What this pass fixed

- `\mid` and `\middle|` are read as conditioning bars. A conditional call
  or expectation becomes a named `raw` node, so the row is readable and
  unchecked, never guessed at.
- `\lVert`, `\rVert` and `\Vert` are the long forms of the norm and the
  divergence bar. A squared long norm is checkable; an unsquared one comes
  back with the reason.
- Trailing commas, semicolons and periods are the punctuation of the
  sentence, not parse errors.
- An unknown control symbol and `\operatorname*` are named rather than
  thrown away.
- A relation inside parentheses or brackets is not a top-level relation.
- A row with no relation is prose. It is excluded from the claim
  denominator, and a parse error is no longer hidden in that bucket.

## The double bar

The `\|` that separates two distributions, as in `D(P\|Q)`, is read as what
it is: the argument separator of a divergence, and not the norm of `P`. The
same goes for `KL`, `d_{KL}` and the chi squared divergence. A `\|` inside a
norm is still a norm.

The unsquared norm, `\|x\|`, is still not supported: the square root of a
rational function is not rational, so the exact mode cannot check it. It
comes back with the reason, and the 50 digit mode is the answer for it.

## The next ones

In the order the measurement says they are worth:

1. The end of the row: `where` clauses, parenthetical conditions and `cases`
   blocks. Read them as clauses, not as a failed expression.
2. The macros the authors define: the CLI could read the preamble and
   expand the `\newcommand`s.
3. The unsquared norms, checked in the 50 digit mode, with the card saying
   "numeric".
4. The relations inside expressions, `\leq` and `\ge`, with a counterexample
   search for the rows that break them.
5. Inner products, `\langle x, y \rangle`.

Then the sample should be a thousand papers, the size the plan asks for,
and the number published again.

## What this measurement is not

It is not a measure of correctness. A row that SAMOSA reads may still be
checked wrongly, and the golden suite and the Cookbook are what say
something about that. It is a measure of how much notation SAMOSA knows, on
papers that were written for other readers.
