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
| claim rows that parse end to end | 686 (**56.3%**) |
| claim rows with no unknown construct | 304 (**24.9%**) |
| of all display rows, the share with no unknown construct | 304 of 1416 (**21.5%**) |

**56.3%** is the parse coverage: the whole row becomes a tree, so SAMOSA can
look at it. The plan's gate G3 asks for 70%. The gate is not met.

**24.9%** is the share with no named unknown construct: every part of the
row is something the parser has a rule for. This is an upper bound on the
checkable share. The run parses each row on its own and does not read the
paper's preamble, so a function the paper declares counts as a call here,
and the verdict path will still say unchecked. The parse coverage is the
number the gate asks for.

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
| 158 | `expected )`, a `cases` block or a condition inside a probability |
| 133 | a script on something that is not a symbol |
| 61 | `expected {`, usually a `\left\{` set the parser cannot close |
| 52 | `unexpected ,`, a second clause with no claim of its own |
| 46 | a conditional distribution, `p(x \mid y)` |
| 43 | `unexpected |`, a set builder or a conditional outside a call |
| 42 | `expected ]`, a conditional inside a bracket |
| 39 | `unexpected \|`, a double bar used as a separator |
| 23 | a relation inside a group, named and left unchecked |
| 22 | `unexpected rbrace`, a macro that emits its own braces |
| 19 | `unexpected nl`, a row break inside a nested environment |
| 18 | `\*`, a macro of the authors |
| 17 | `unexpected end of input`, an unbalanced row |
| 13 | the unsquared norm, `\|2\|` |
| 13 | `\norm`, a macro of the authors |
| 13 | `expected \rangle`, an inner product |
| 13 | `unexpected sub`, a subscript on an operator |
| 12 | `unexpected \\`, a row break inside a nested environment |
| 8 | `expected }`, a macro of the authors that takes a block |
| 9 | an expectation without an argument list |

The top of the list is now notation, not punctuation. The trailing comma
fell from 390 rows to 52, because the punctuation of the sentence is
stripped and two claims separated by a comma are read as two clauses. What
is left is a `cases` block inside a probability, a script on an operator or
a call, a set the parser cannot close, and the macros the authors define.
The parser reads the relation and then meets notation it has no rule for.
The next ones are below.

## What this pass fixed

- The punctuation at the end of a row is stripped from the token stream.
  The tokenizer ends its list with an end of file token, and the earlier
  strip looked at that token instead of the comma before it, so the fix
  reaches most of the rows that ended in `,` or `.`.
- Two claims separated by a top-level comma, semicolon or period are read
  as two clauses. If either clause cannot be read, the whole row is
  unchecked, so a half-read row is never checked.
- A relation inside a group is a named `raw` node, not a parse error:
  `(M > \sqrt{n})`, `\{x_j = 1\}`, `P(X \neq Y)`. The row is readable and
  unchecked, never guessed at.
- An accented lowercase name followed by parentheses is a call:
  `\hat{l}(f, y)` is a loss, not a product of a hat and a group. A capital
  name in a product is still a matrix product.
- A function with a power, `d^2(f, g)` or `\chi^2(p, q)`, is a call under a
  power, not a product of the power and a group.
- A condition inside an expectation, `\mathbb{E}[X \mid Y = 1]`, becomes a
  named `raw` node, so the row is readable and unchecked.
- `\mid` and `\middle|` are read as conditioning bars. A conditional call
  or expectation becomes a named `raw` node, so the row is readable and
  unchecked, never guessed at.
- `\lVert`, `\rVert` and `\Vert` are the long forms of the norm and the
  divergence bar. A squared long norm is checkable; an unsquared one comes
  back with the reason.
- A `\text{...}` group is an annotation only when it ends the row. A claim
  after one is no longer dropped: the row is read or unchecked, never
  half-checked.
- An unknown control symbol and `\operatorname*` are named rather than
  thrown away.
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

1. `cases` blocks, and conditions inside a probability: the largest bucket,
   `expected )`.
2. A script on something that is not a symbol, such as an index on an
   operator or a call. It is readable today and left unchecked.
3. The macros the authors define: the CLI could read the preamble and
   expand the `\newcommand`s.
4. Set builder bars and conditionals outside a call, `\{x : x > 0\}` and
   `p(x | y)`.
5. The unsquared norms, checked in the 50 digit mode, with the card saying
   "numeric".
6. Inner products, `\langle x, y \rangle`.

Then the sample should be a thousand papers, the size the plan asks for,
and the number published again.

## What this measurement is not

It is not a measure of correctness. A row that SAMOSA reads may still be
checked wrongly, and the golden suite and the Cookbook are what say
something about that. It is a measure of how much notation SAMOSA knows, on
papers that were written for other readers.
