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

<!-- gen:cookbook -->
| | |
| --- | --- |
| the identities | 48 |
| the mutants | 287 |
| **the false checkmarks** | **0** |
| the identities SAMOSA cannot check | 5 |
| the mutation score | 235 of 240 (**97.9%**) |
| the harmless mutants the float64 oracle confirmed | 47 |
| the raw rate | 235 of 287 (**81.9%**) |
<!-- /gen:cookbook -->

The plan's gate G2 asks for 95% of the planted bugs caught with the expected
repair in the top three. The mutation score is what the plan means here, and
it excludes the mutants an independent float64 oracle confirmed to be
harmless. The raw rate is kept in the open next to it.

### The identities SAMOSA cannot check

These are not lies, they are gaps:

<!-- gen:cookbook-gaps -->
| the identity | why |
| --- | --- |
| the spectral norm of a transpose | the unsquared norm \|2\| |
| a stationary point | no value for x |
| the normal equations | unexpected end of input |
| the gradient of a ridge regression | the two sides of this derivative claim do not have comparable shapes |
| the gradient of the softmax cross entropy | an indexed symbol z_j |
<!-- /gen:cookbook-gaps -->

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

<!-- gen:cookbook-gates -->
| gate | what the plan asks | what we measure |
| --- | --- | --- |
| G1: no false checkmark | the golden suite and the Cookbook | 0 false checkmarks in 48 identities, and 0 in the 16 Menu derivations |
| G2: the bugs caught | 95%, with the repair in the top three | the mutation score is 97.9% (235 of 240, the 47 harmless mutants excluded and confirmed by the float64 oracle); the raw rate is 81.9% (235 of 287); the four planted bugs of the golden suite all get their expected repair in the top three |
| G3: the parse coverage | 70% | 56.3%, measured in [COVERAGE.md](COVERAGE.md); the gate is not met |
<!-- /gen:cookbook-gates -->

The number that does not meet the gate is published rather than hidden. The
misses are the steps the engine cannot decide, and each one says so.

## Running it

```bash
pnpm check:corpus
```

It prints the two numbers and the names of everything it did not catch, and
it fails when there is a false checkmark.
