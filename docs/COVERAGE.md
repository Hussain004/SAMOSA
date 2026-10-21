# The coverage of a real paper

The plan asks for a number: how much of the display math of real papers can
SAMOSA read? Here it is, measured rather than guessed.

## The sample

39 papers from cs.LG, cs.RO and stat.ML, fetched from the arXiv e-prints
(the LaTeX sources, not the PDFs), taken from the most recent submissions.
The sample is kept out of the repository.

The measurement is over the **display math rows**: the rows of the `align`,
`aligned`, `gather`, `split`, `equation`, `multline` and `eqnarray`
environments. The prose, the inline math and the figures are not counted,
because SAMOSA checks rows.

```bash
npx vite-node scripts/coverage.ts 40
```

## The number

| | |
| --- | --- |
| papers | 39 |
| display math rows | 1498 |
| rows SAMOSA can parse | 1173 (**78.3%**) |
| rows SAMOSA reads with no unknown construct | 818 (**54.6%**) |

Two numbers, because they answer two different questions:

* **78.3%** is the parse coverage, the number the plan's gate G3 asks for.
  Those rows come out of the parser as a tree, so SAMOSA can look at them.
* **54.6%** is the checkable coverage: the rows where every part of the row
  is something SAMOSA understands, so it can actually decide whether the row
  is right. The gap between the two is rows that parse but contain a
  construct SAMOSA has never heard of, such as `\mid` or a macro the authors
  defined in their own preamble.

The second number is the one that matters for the product, and it is the one
that is honestly lower than the gate.

## What stops the rest

The failures, bucketed by the first unknown construct:

| rows | the construct |
| --- | --- |
| 168 | `\|` used as a double bar, as in the KL divergence `P\|Q`, where SAMOSA reads a norm |
| 101 | an angle bracket with a single argument, `\langle c_1\rangle` |
| 36 | `\mid`, the conditional bar |
| 26 | the unsquared norm, which is not a rational function |
| 23 | `\middle\|`, the conditional bar of a bracket |
| 21 | `\leq` and `\le` inside an expression |
| 14 | `\norm`, a macro the authors defined themselves |

(The counts are from the run that produced the table above; the sample is
listed in `.coverage/coverage.json`, and the same sample gives the same
numbers.)

Two thirds of the failures are one ambiguity: `\|` is a norm in most of the
matrix calculus literature and a double bar in the information theory
literature, and SAMOSA has to pick one.

The other big group is the authors' own macros. The plan lists
`\newcommand` expansion as something SAMOSA should do, and that is where
those rows go.

## What this measurement is not

It is not a measure of correctness. A row that SAMOSA reads may still be
checked wrongly, and the golden suite is what says something about that.
It is a measure of how much notation SAMOSA knows, on papers that were
written for other readers.
