# The ledger

The plausible-but-false identities, and the checkmarks SAMOSA had not earned.

## The 40 friends nobody wants

These are the mistakes people actually write. None of them may ever come
back ok: the structures test holds the engine to this list on every commit,
and a new false checkmark fails CI. Where the surface syntax of an operator
is missing, the step is unchecked, which is honest, never a checkmark.

| | |
| --- | --- |
| the determinant of an orthogonal matrix is not one | `\det(Q) = 1` |
| two orthogonal matrices do not commute | `Q_1 Q_2 = Q_2 Q_1` |
| the absolute value is not the identity | `\|x\| = x` |
| the absolute value does not split a sum | `\|a + b\| = \|a\| + \|b\|` |
| the square root of a square is not the number | `\sqrt{x^2} = x` |
| the square root of a square is not the negative, for a positive one | `\sqrt{x^2} = -x` |
| the inverse of a sum is not the sum of the inverses | `(A + B)^{-1} = A^{-1} + B^{-1}` |
| the trace of a product is not the product of the traces | `\operatorname{tr}(A B) = \operatorname{tr}(A)\operatorname{tr}(B)` |
| the determinant of a sum is not the sum of the determinants | `\det(A + B) = \det(A) + \det(B)` |
| the exponential does not split a sum of matrices | `e^{A + B} = e^A e^B` |
| the inverse of a product is not the product of the inverses | `(A B)^{-1} = A^{-1} B^{-1}` |
| the transpose of a product is not the product of the transposes | `(A B)^\top = A^\top B^\top` |
| the inverse of the transpose is not the inverse | `(A^\top)^{-1} = A^{-1}` |
| a square is not twice the matrix | `A^2 = 2 A` |
| subtraction does not commute | `A - B = B - A` |
| a quotient is not the product | `A / B = A B` |
| the squared norm does not split a sum | `\\|u + v\\|^2 = \\|u\\|^2 + \\|v\\|^2` |
| the unsquared norm does not split a sum | `\\|u + v\\| = \\|u\\| + \\|v\\|` |
| an inner product is not the product of the norms | `\langle u, v \rangle = \\|u\\| \\|v\\|` |
| a squared inner product is not the product of the squared norms | `\langle u, v \rangle^2 = \\|u\\|^2 \\|v\\|^2` |
| the Frobenius norm does not split a sum | `\\|A + B\\|_F^2 = \\|A\\|_F^2 + \\|B\\|_F^2` |
| a Kronecker product does not commute | `A \otimes B = B \otimes A` |
| an element wise product is not a matrix product | `A \odot B = A B` |
| a lower triangular matrix is not symmetric | `L^\top = L` |
| a triangular matrix does not commute with its transpose | `U^\top U = U U^\top` |
| the log of a square is not twice the log, for a scalar | `\log(x^2) = 2 \log x` |
| the exponential does not split a sum of scalars | `e^{a + b} = e^a + e^b` |
| a cube root is not a square root | `\sqrt[3]{8} = 3` |
| two fractional powers do not multiply their exponents | `x^{1/3} x^{2/3} = x^{2/9}` |
| the variance of an affine map is not taken on the other side | `\operatorname{Var}(A x) = A^\top \operatorname{Var}(x) A` |
| the second moment of a Gaussian with a mean is not its covariance | `\mathbb{E}[x x^\top] = \Sigma` |
| the cross product does not commute | `a \times b = b \times a` |
| the cross product is not associative | `a \times (b \times c) = (a \times b) \times c` |
| a reflection flips a cross product | `Q (a \times b) = (Q a) \times (Q b)` |
| a cube root of a matrix is not read | `\Sigma^{1/3} = \Sigma` |
| the matrix square root is not the identity | `\Sigma^{1/2} = I` |
| a square of a Gaussian is not its mean | `E[x^2] = E[x]` |
| the adjugate of a product is not the product of the adjugates | `\operatorname{adj}(A B) = \operatorname{adj}(A)\operatorname{adj}(B)` |
| the vectorisation does not survive a transpose | `\operatorname{vec}(A^\top) = \operatorname{vec}(A)` |
| block rows do not commute | `\begin{pmatrix} A & B \end{pmatrix} = \begin{pmatrix} B & A \end{pmatrix}` |

## The dated list of false checkmarks found and fixed

Taken from the changelog, verbatim. The generator fails on drift, so this
list cannot silently grow stale.

### 2026-11-03 — 1.1.0

**the checkmarks the checker had not earned.**

> The checkmarks the checker had not earned: the orth components are declared, `abs` is out of exact mode, the degree rules bound det, tr, derivatives and blocks, and the structured samplers (spd, orth, stoch, unit, tril, triu) draw from the structure they claim.

### 2026-11-03 — 1.1.0

**a non-square identity behind det and tr.**

> The identity is square in the type system, in the sampler and in the printer, so det and tr no longer meet a non-square one.

### 2026-11-03 — 1.1.0

**a shape assignment where the sizes happened to agree.**

> A shape error carries the sizes that do not fit, never an assignment where the shapes happen to agree.


## The method

A verdict is computed by evaluating both sides of a step on sampled
instances, over a finite field or at 50 digits, and never by a language
model. A checkmark carries the sizes that were tested, the number of
trials, the primes, the degree bound and the assumptions, and a wrong step
is caught by the same machinery: the engine found the counterexample above.
The [how it works](/docs/HOW_IT_WORKS) page says what the engine does; the
[Cookbook](/docs/COOKBOOK) shows the numbers measured on the corpus it
inherits from.
