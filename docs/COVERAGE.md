# The coverage

How much of a real paper SAMOSA reads, measured over the display math of
recent arXiv papers.

The method is in `scripts/coverage.ts`, the sample is in
`.coverage/coverage.json`, and the run is:

```bash
node_modules/.bin/vite-node scripts/coverage.ts
```

The sample is 39 recent papers from cs.LG, cs.RO and stat.ML, and 1498
display math rows.

## The numbers

| | |
| --- | --- |
| rows SAMOSA can parse | 1300 (**86.8%**) |
| rows SAMOSA reads with no unknown construct | 749 (**50.0%**) |

**86.8%** is the parse coverage, the number the plan's gate G3 asks for.

**50.0%** is the checkable coverage: the rows where every part of the row
is something SAMOSA knows, so it can check the row rather than only read it.
This is the second number, and it is honestly lower than the gate.

The measurement is the engine's own parser, on the rows the engine's own
row splitter produces, so the number is what the app does with a paper and
not an approximation of it.

## What stops the rest

The failures, bucketed by the first unknown construct:

| rows | the construct |
| --- | --- |
| 198 | a row with no relation in it, such as a definition of a tuple of sets |
| 57 | `\mid`, the conditional bar |
| 29 | the unsquared norm, which is not a rational function |
| 16 | `\norm`, a macro the authors defined themselves |
| 14 | an expectation without an argument list, `\mathbb{E}_x` |
| 12 | `\min` and `\max` over a set |
| 12 | a subscript on something that is not a symbol, as in `\int_A` |
| 12 | a superscript on something that is not a symbol, as in `h_{K,b}` |
| 12 | `\cX` and the other macros of the authors |
| 12 | `\lVert`, the double bar norm |
| 11 | `\abs`, a macro of the authors |

(The counts are from the run that produced the table above; the sample is
listed in `.coverage/coverage.json`, and the same sample gives the same
numbers.)

Three quarters of the failures are the same three things: a bar that means
conditioning and not a norm, a macro the authors defined in their own
preamble, and a row that is not a claim at all.

## The double bar

The `\|` that separates two distributions, as in `D(P\|Q)`, is now read as
what it is: the argument separator of a divergence, and not the norm of `P`.
The same goes for `KL`, `d_{KL}` and the chi squared divergence. A `\|`
inside a norm is still a norm.

The unsquared norm, `\|x\|`, is still not supported: the square root of a
rational function is not rational, so the exact mode cannot check it. It
comes back with the reason, and the 50 digit mode is the answer for it.

## The next ones

In the order the measurement says they are worth:

1. `\mid` and `\middle|`, the conditional bar, as in
   `\mathbb{E}[x \mid y]` and `p(x \mid y)`.
2. The single argument angle bracket, `\langle c_1\rangle`, which is an
   expectation.
3. The macros the authors define: the CLI could read the preamble and
   expand the `\newcommand`s.
4. The unsquared norms, checked in the 50 digit mode, with the card saying
   "numeric".
5. The relations inside expressions, `\leq` and `\ge`, with a counterexample
   search for the rows that break them.

Then the sample should be a thousand papers, the size the plan asks for,
and the number published again.

## What this measurement is not

It is not a measure of correctness. A row that SAMOSA reads may still be
checked wrongly, and the golden suite and the Cookbook are what say
something about that. It is a measure of how much notation SAMOSA knows, on
papers that were written for other readers.
