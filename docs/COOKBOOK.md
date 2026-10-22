# The Cookbook

The identities people write, and the mistakes they make in them.

The Cookbook is the corpus that measures the engine against the two gates
that matter: no false checkmark, and most of the mistakes caught on the right
row.

## What is in it

`corpus/cookbook/identities.ts` holds 48 identities in matrix algebra, matrix
calculus and stochastics. Each one has the declarations it needs and the
derivation in LaTeX, the way a person would write it.

`corpus/cookbook/mutants.ts` makes the mistakes. A mutant is a derivation with
one thing wrong in it, taken from the mistake catalog: the same list the
repairs use, seen from the other side. So a mutant the engine does not catch
is a real gap, and not a mistake that happens to be true.

## The numbers

Measured by `pnpm check:corpus`:

| | |
| --- | --- |
| the identities | 48 |
| the mutants | 262 |
| **the false checkmarks** | **0** |
| the identities SAMOSA cannot check | 10 |
| the caught mutants | 196 of 262 (**74.8%**) |
| the harmless mutants, where the mistake changes nothing | 30 |

The plan's gate G2 asks for 95% of the planted bugs caught with the expected
repair in the top three. The cookbook is at 73.4%, and the difference is
named below.

### The ten identities SAMOSA cannot check

These are not lies, they are gaps:

| the identity | why |
| --- | --- |
| the spectral norm of a transpose | the spectral norm is not a rational function |
| a stationary point | the pivot of an implication has no value |
| the variance of a sum | an expectation needs a random variable |
| the covariance of a scaled variable | the same |
| the second moment of a Gaussian | the same |
| the mean of a Gaussian | the same |
| the trace of a Gaussian covariance | the same |
| the normal equations | the derivative of an expression, not of a named function |
| the gradient of a ridge regression | the shapes of the claim do not agree |
| the softmax cross entropy | the sum in the definition is not read |

### The misses

Every mutant the engine does not catch is a step it could not decide, never a
step it thinks holds. The `unchecked` ones are the mutants of the identities
above, and the rest are the mutations that make an expression the evaluator
cannot compute, such as the transpose of a matrix inside a denominator.

## What the corpus found

The corpus is not only a measurement. It found real bugs, and they are fixed:

- the counterexample sampled the symbols the derivation defines, so the
  instance did not satisfy the derivation
- the residual fingerprint built its terms with a `mul` node that had one
  argument, so it never evaluated
- the residual fingerprint compared the term with the difference on different
  random instances, so it never matched
- the repair engine could not evaluate a derivative, so a gradient row never
  got a fix
- the group of a parenthesis did not include the parenthesis in its span, so
  an edit over it left the parenthesis behind
- a shape mismatch was reported as "not checked" instead of a shape error

## The gates, honestly

| gate | what the plan asks | what we measure |
| --- | --- | --- |
| G1: no false checkmark | the golden suite and the Cookbook | 0 false checkmarks in 48 identities, and 0 in the 15 Menu derivations |
| G2: the bugs caught | 95%, with the repair in the top three | 73.4% of the Cookbook mutants; the four planted bugs of the golden suite all get their expected repair in the top three |
| G3: the parse coverage | 70% | 78.3%, measured in [COVERAGE.md](COVERAGE.md) |

The number that does not meet the gate is published rather than hidden. The
misses are the steps the engine cannot decide, and each one says so.

## Running it

```bash
pnpm check:corpus
```

It prints the two numbers and the names of everything it did not catch, and
it fails when there is a false checkmark.
