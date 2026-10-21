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

## Scripts

| Written | Read as |
| --- | --- |
| `A^\top`, `A^T`, `A^{\mathsf T}` | the transpose |
| `A^{-1}` | the inverse |
| `A^{-\top}`, `A^{-T}` | the inverse transpose |
| `A^{2}` | the square, or the power, depending on the shape |
| `A^{1/2}` | the principal square root, numeric mode only |
| `A^\dagger` | the pseudo inverse, numeric mode only |
| `P^+`, `x^*` | a label, folded into the name |
| `x_{k\|k-1}` | part of the name |
| `\|A\|_F` | the Frobenius norm |
| `\|A\|` | the spectral norm, with a chip |

## Functions

`\exp`, `\log`, `\ln`, `\sin`, `\cos`, `\tan`, `\tanh`, `\sqrt`, `\det`,
`\operatorname{tr}`, `\sigma` (the sigmoid), `\operatorname{Var}`,
`\operatorname{Cov}`, and the densities `\mathcal{N}` and `\mathcal{U}`.

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
| `pos` | a positive number |
| `int` | an integer |
| `fn n→1` | a function |
| `sym n`, `spd n`, `psd n`, `orth n`, `diag n`, `triu n`, `tril n`, `skew n`, `idem n`, `proj n`, `unit n`, `stoch n` | a matrix with that structure |
| `rank 3 n×n` | a matrix of that rank |

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
