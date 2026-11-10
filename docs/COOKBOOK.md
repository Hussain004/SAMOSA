# The Cookbook

The identities people write, and the mistakes they make in them.

The Cookbook is the corpus that measures the engine against the two gates
that matter: no false checkmark, and most of the mistakes caught on the right
row.

## What is in it

`corpus/cookbook/identities.ts` holds 94 identities in matrix algebra, matrix
calculus and stochastics, grown from the 48 the Cookbook started with: the
Kronecker identities, the derivatives of the determinant and of the inverse,
the block matrices and the Schur complements, the Householder and projection
geometry, and the normal moment identities. Each one has the declarations it
needs and the derivation in LaTeX, the way a person would write it.

`corpus/cookbook/mutants.ts` makes the mistakes. A mutant is a derivation with
one thing wrong in it, taken from the mistake catalog: the same list the
repairs use, seen from the other side. So a mutant the engine does not catch
is a real gap, and not a mistake that happens to be true.

## The numbers

Measured by `pnpm check:corpus`:

<!-- gen:cookbook -->
| | |
| --- | --- |
| the identities | 94 |
| the mutants | 451 |
| **the false checkmarks** | **0** |
| the identities SAMOSA cannot check | 0 |
| the mutation score | 343 of 343 (**100.0%**) |
| the harmless mutants the float64 oracle confirmed | 108 |
| the raw rate | 343 of 451 (**76.1%**) |
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
- the row splitter counted the closing brace of an environment's name as a
  group, so a derivation with a block matrix that carried braces in the row
  after it never split into rows
- the "Hadamard product of a sum" identity was written with
  `\circ`, which this engine reads as ordinary multiplication, so the
  identity checked the distributive law and not Hadamard's; it now uses
  `\odot`, the element wise product
- the derivative denominator silently dropped a Greek symbol, so
  `\frac{\partial J}{\partial \beta}` differentiated with respect to an
  empty name; a bare `\partial` numerator is now read as an operator whose
  operand is the expression that follows
- a sum with a size-variable bound, like `\sum_{i=1}^n`, unrolled against
  the random scalar that `n` sampled as and never finished; a bound that
  names a dimension variable is the current size, and a sum without a
  given range names the one it inferred, with a chip
- the indexed component of a vector or a matrix, `z_i` and `A_{ij}`, was
  named and not read; it is the parent's entry now, and it is checked on
  the sampled parent, so `\sum_i x_i y_i = x^\top y` holds

## The gates, honestly

<!-- gen:cookbook-gates -->
| gate | what the plan asks | what we measure |
| --- | --- | --- |
| G1: no false checkmark | the golden suite and the Cookbook | 0 false checkmarks in 94 identities, and 0 in the 16 Menu derivations |
| G2: the bugs caught | 95%, with the repair in the top three | the mutation score is 100.0% (343 of 343, the 108 harmless mutants excluded and confirmed by the float64 oracle); the raw rate is 76.1% (343 of 451); the four planted bugs of the golden suite all get their expected repair in the top three |
| G3: the parse coverage | 70% | 78.9% of the claim rows of the sample parse end to end, measured in [COVERAGE.md](COVERAGE.md); the gate is met |
<!-- /gen:cookbook-gates -->

All three gates are met, and the misses are the steps the engine cannot
decide; each one says so, and the gaps are named.

## Running it

```bash
pnpm check:corpus
```

It prints the two numbers and the names of everything it did not catch, and
it fails when there is a false checkmark.
