# How SAMOSA works

SAMOSA is a linter for math derivations. This document explains what it
actually does, and where it stops. It is meant to be readable by somebody who
knows linear algebra and is suspicious of tools that claim to prove things.

## The short version

1. The derivation is split into rows, and every row is parsed into an
   expression tree.
2. The symbols are given shapes, from the declarations or from the
   heuristics. A shape that does not fit is a shape error.
3. Instances of those objects are sampled, with the structure the
   declarations ask for.
4. Both sides of every step are evaluated on the same instance.
5. If the two sides differ, the step is wrong, and SAMOSA looks for a small
   instance that breaks it.

There is no model anywhere in this. There is arithmetic, a finite field and
a probability bound.

## Why evaluating beats rewriting

A CAS rewrites symbols until the two sides look the same. That is powerful
and it is also fragile: a rewrite that is valid for scalars is not valid for
matrices, and a rewrite that assumes symmetry is not valid in general.

SAMOSA never rewrites. It evaluates. So non-commutativity comes for free:
`(AB)^T` is evaluated as `(AB)^T`, not as `A^T B^T`. Structure comes for free
too: if you declare a matrix symmetric, the sampler hands you a symmetric
matrix, and the check is done on that variety.

The price is that a check is a check of *instances*, not a proof. The next
section explains why that price is worth paying, and what the receipt looks
like.

## Exact mode: finite fields and Schwartz-Zippel

A step that only uses rational operations (addition, multiplication,
division, inverses, transposes, determinants, traces, and the derivatives of
those) is checked over a finite field GF(p), with

* p1 = 2^31 - 1 = 2147483647
* p2 = 2147483629

Both are prime. The arithmetic is exact: a product of two field elements
does not fit in a float64, so one operand is split into 16 bit limbs and the
multiplication is done in pieces, every intermediate staying below 2^53. The
spike `spikes/gfp_probe.mjs` validates that against BigInt on 10^5 random
pairs.

Now the argument. If a step is false at some size, then the numerator of
L - R is a nonzero polynomial in the sampled parameters. Let its degree be
d. By the Schwartz-Zippel lemma, a random point of GF(p) satisfies that
polynomial with probability at most d/p. So one trial errs with probability
at most d/p, and k trials per prime at two primes give

```
Pr[a wrong step looks right]  <=  (d / p1)^k * (d / p2)^k
```

SAMOSA computes d, the degree bound, with the rules of the plan: a leaf
symbol has degree one, a product adds the degrees, an inverse of an n by n
matrix has numerator degree `dD + (n-1) dN`, and so on. The card on every
checkmark shows the worst bound over the sizes that were tested.

The usual bound for the Kalman push-through identity, at the three default
sizes, is below 10^-46 per size.

### Two honest caveats

* The argument assumes the integer coefficients of the numerator are not all
  divisible by p. With two primes, they would have to be divisible by both,
  which is a number of about 4.6 times 10^18.
* Resampling on a singular matrix conditions the draw. The plan accounts for
  it with a factor of 1/(1 - dD/p), which is negligible.

### The sizes

The dimension variables of a step are sampled at three sizes, and the sizes
are chosen so that a mistake that only shows up when everything is square
gets caught. The default schedule is (n, m) = (3, 2), (2, 3) and (4, 3), and
each size gets three trials in each of the two primes.

The card names the sizes that were tested, because a check at one size is
not a check at another.

## Gradients: dual numbers

A dual number is a pair (value, tangent). The rules of forward mode
automatic differentiation are one line each:

```
(AB)'   = A'B + AB'
(A^-1)' = -A^-1 A' A^-1
(det A)' = det A * tr(A^-1 A')
```

Because the arithmetic is generic over the field, a derivative can be
computed exactly over a finite field. So a gradient claim is checked exactly,
not numerically.

The check compares the claimed gradient G with the directional derivative in
a random direction V:

```
Df[V]  ==  tr(G^T V)
```

The layout convention falls out of this. If the shapes do not agree, SAMOSA
says which convention the claim used, and offers the transpose.

A Hessian is checked with hyper-dual numbers, which carry a third component
for the mixed second derivative.

## Expectations: rational quadrature

A distribution on rational atoms that matches the moments of the normal
distribution integrates polynomials *exactly*.

* The five point rule has atoms 0, ±1, ±2 with weights 1/2, 1/6, 1/12. It
  matches E z^2 = 1 and E z^4 = 3, so it is exact up to degree five.
* The seven point rule adds ±3 and matches E z^6 = 15 as well, so it is
  exact up to degree seven.

For a normal variable with mean μ and covariance Σ = LL^T, the variable is
written x = μ + Lz, and the expectation becomes a weighted sum over the
tensor product of the atoms. The weights and the atoms are rational, so the
whole sum runs over the finite field, and the answer is exact.

The spike `spikes/quadrature_check.py` verifies the rules against exact
fractions, and checks that each rule fails at the next degree.

If the integrand is not a polynomial in the random variable, SAMOSA says so
instead of quietly approximating.

## Numeric mode

Everything else runs over the reals, first in float64 and then, when the two
sides agree to more than 12 digits, at 50 digits with decimal.js.

* If every difference is below 10^-35, the step is a checkmark.
* If a difference is above 10^-20 and it survives three fresh instances, the
  step is wrong.
* In between, the step is inconclusive, and the card says so.

A checkmark in numeric mode has no probability bound, because there is no
finite field to bound it with. The card says how many instances and how many
digits, and that is all it can honestly say.

## Definitions, chains and implications

* `K := ...` and `\coloneqq` bind a definition.
* An equation whose left hand side is a bare symbol that has not been defined
  yet is a definition too, and the card says "defined".
* A continuation row (`&=`) compares against the previous right hand side.
* An implication (`=>`) is checked by constraint completion: the residual of
  the premise has to be affine in the variable of the conclusion. If it is,
  the premise is solved for that variable and the conclusion is checked on
  the solution. "Setting the gradient to zero and solving" is the case that
  matters, and it is exact.

## What SAMOSA does not do

* It does not prove theorems. It checks steps.
* It does not check inequalities, limits or series.
* It does not check the logic of a paragraph. It checks the rows.
* It does not understand every notation. When it does not, it says `?` and
  tells you what to declare.
* It does not use a language model, anywhere, in the verdict path.
