# Notation

What SAMOSA reads, and how it reads it.

## Rows

SAMOSA looks for the math of a document:

* LaTeX: `align`, `align*`, `aligned`, `gather`, `gather*`, `split`,
  `equation`, `equation*`, `multline`, `eqnarray`, `displaymath`, `array`.
* Markdown: `$$ ... $$` blocks.
* A bare paste: every line is a row.

Inside a math environment, `\\` starts a new row and `&` is the alignment
marker. Both are removed before the row is parsed.

## Symbols

A symbol is a base letter, the accents on it, a subscript, and a label
superscript. So:

| Written | The symbol |
| --- | --- |
| `\hat{x}_{k\|k-1}` | one symbol, shown as x̂_{k\|k-1} |
| `\bar\Sigma_t` | a different symbol from `\Sigma_t` |
| `x` | a vector or a matrix, depending on the declarations |
| `e` | Euler's number, unless it is subscripted |

A run of letters is a product of single letter symbols: `cuv^\top` is c
times u times v transpose. The only exceptions are the known functions and
the functions you declared.

A symbol you declared as a value is a factor, never a function, so
`A (B + C)` and `x (y + z)` are products. An undeclared lowercase name before
a parenthesis, `f(x)`, is a call.

`a \times b` between two column vectors is the cross product, which makes
both of them size 3. Anywhere else `\times` is the ordinary product.

## Scripts

| Written | Read as |
| --- | --- |
| `A^\top`, `A^T`, `A^{\mathsf T}` | the transpose |
| `A^{-1}` | the inverse |
| `A^{-\top}`, `A^{-T}` | the inverse transpose |
| `A^{2}` | the square, or the power, depending on the shape |
| `A^{1/2}`, `A^{-1/2}` | the principal square root and its inverse, numeric mode only |
| `x^{1/3}`, `x^{-2/3}`, `x^{\frac{3}{2}}` | a rational power of a scalar, numeric mode only; an odd root keeps the sign of a negative number, an even root of one is outside the domain |
| `A^{-2}` | the inverse of the square, and exact |
| `A^{1/3}` | not read for a matrix: a question, with the reason |
| `A^\dagger` | the pseudo inverse, numeric mode only |
| `P^+`, `x^*` | a label, folded into the name |
| `x_{k\|k-1}` | part of the name |
| `\sqrt[k]{x}` | the k-th root, `x^{1/k}`, for a whole number k |
| `\begin{bmatrix} … \end{bmatrix}` | a block matrix, the blocks are its rows |
| `\|A\|_F` | the Frobenius norm |
| `\|A\|` | the spectral norm, with a chip |

## Functions

`\exp`, `\log`, `\ln`, `\sin`, `\cos`, `\tan`, `\tanh`, `\sqrt`, `\det`,
`\operatorname{tr}`, `\sigma` (the sigmoid), `\operatorname{Var}`,
`\operatorname{Cov}`, and the densities `\mathcal{N}` and `\mathcal{U}`.

`\operatorname{Var}(g)` is `E[g g^\top] - E[g] E[g]^\top`, so the variance of a
vector is its covariance matrix, and `g` can be any polynomial of the random
variables: `\operatorname{Var}(A x)` and `\operatorname{Var}(x + y)` are read
as written. `\operatorname{Cov}(g, h)` is `E[g h^\top] - E[g] E[h]^\top`. Two
random variables declared apart are independent, and `x \sim
\mathcal{N}(0, \Sigma)` has mean zero.

A row whose expectation is not a polynomial (say `\mathbb{E}[\sin x] = 0`)
cannot be read by the quadrature. It goes through a seeded Monte Carlo
estimate instead: the verdict is wrong when the estimate is more than six
standard errors from the claim, inconclusive otherwise, and never a
checkmark. The estimate can refute and it can fail to refute; it cannot
certify.

A row `f ~ \mathcal{N}(m, S)` with a Gaussian on the right is checked by its
two moments, exactly: `E[f] = m` and `Var(f) = S` are evaluated by the
rational quadrature, in the primes. The first two moments determine the law
of a Gaussian, so the moment match is the distribution. The card says
`the first two moments match` and lists the assumption that the left side is
a Gaussian (an affine function of one is, and SAMOSA checks that); a law
whose left side is not affine is not certified. Before declaring the random
variable with `x ~ N(mu, Sigma)`, SAMOSA cannot check the row and says so.

Everything else is a symbol, unless you declared it as a function with
`f: fn n→1`.

## Derivatives

| Written | Read as |
| --- | --- |
| `\frac{\partial f}{\partial x}` | the gradient or the Jacobian |
| `\frac{\partial^2 f}{\partial x\,\partial x^\top}` | the Hessian |
| `\frac{\partial f}{\partial x^2}` | the Hessian, for a vector x |
| `\nabla_x f` | the gradient |
| `\mathrm{d}f` | the differential |

The denominator layout is the default: the gradient of a scalar with respect
to a vector has the shape of that vector. The numerator layout can be
switched on, and the two are told apart by their shapes.

## Relations

| Written | Read as |
| --- | --- |
| `=` | an identity, checked |
| `:=`, `\coloneqq` | a definition |
| `=>`, `\implies` | an implication, checked by constraint completion |
| `\iff` | both directions |
| `\propto` | proportionality, checked over the reals |
| `\le`, `\ge`, `<`, `>` | not checked in v1 |
| `\approx` | not checked in v1 |

## Declarations

The compact syntax, for the editor, the CLI and the MCP server:

```
names : type
names ~ distribution
name := latex
dimvar = number
```

The types are:

| Type | Meaning |
| --- | --- |
| `n` | a column vector of size n |
| `n×m` | a matrix |
| `scalar` | a number |
| `pos` | a strictly positive number, over the reals |
| `int` | an integer |
| `fn n→1` | a function |
| `sym n`, `spd n`, `psd n`, `orth n`, `rot n`, `diag n`, `triu n`, `tril n`, `skew n`, `idem n`, `proj n`, `unit n`, `stoch n` | a matrix with that structure |
| `rank 3 n×n` | a matrix of that rank |

`orth n` is the orthogonal group O(n), the matrices whose transpose is
their inverse; `rot n` is the spelling for the rotations, the orthogonal
matrices with determinant one.

`ident n`, `zero n`, `ones n`, `unit n` and `stoch n` are matrices of that
size, so `ident n` is the n by n identity, `zero n` the zero matrix, `ones n`
the matrix of ones, `unit n` a unit vector and `stoch n` a stochastic matrix.
A `pos` symbol is a strictly positive number, so over the reals the sampler
draws a small positive magnitude; over a finite field no number is positive,
so there it draws a field element.

The LaTeX forms are read as well:

```latex
A, B \in \mathbb{R}^{n\times n}
\Sigma \succ 0
Q^\top Q = I
A = A^\top
x \sim \mathcal{N}(\mu, \Sigma)
f: \mathbb{R}^n \to \mathbb{R}
```

## The presets

One click of a preset fills the declarations. Every preset is editable, and
editing one does not change the others.

| Preset | The symbols |
| --- | --- |
| Kalman (Thrun) | A, B, C, Σ̄, Q as the measurement noise, R as the process noise |
| Kalman (H, P, R) | the same, in the other convention |
| Linear regression | X, y, w and the normal equations |
| Logistic regression | X, w, b and the sigmoid |
| MLP backprop | one hidden layer, W1, W2 and the deltas |
| Attention | Q, K, V and the scaled scores |
| Gaussian conditioning | the blocks of a joint Gaussian |
| LQR | the Riccati recursion |
| PCA | the covariance and its eigen decomposition |
